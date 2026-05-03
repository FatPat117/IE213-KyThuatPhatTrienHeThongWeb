// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract FundingPlatform is ERC721, ReentrancyGuard, AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant DEFAULT_GOAL_WEI = 1 ether;

    enum CampaignStatus {
        PendingApproval,
        Active,
        InProgress,
        Completed,
        PartialFailed,
        Failed,
        Cancelled
    }

    enum MilestoneStatus {
        PendingFunding,
        PendingVerification,
        Approved,
        Disbursed,
        Failed,
        Refunded
    }

    struct Campaign {
        uint256 id;
        address creator;
        address beneficiary;
        uint256 goal;
        uint256 totalRaised;
        uint256 totalDisbursed;
        uint256 deadline;
        bool withdrawn;
        CampaignStatus status;
        uint256 milestoneCount;
        uint256 currentMilestoneId;
    }

    struct Milestone {
        uint256 id;
        uint16 allocationBps;
        uint256 deadline;
        string[] proofCids;
        uint256 proofSubmissionCount;
        MilestoneStatus status;
        address approvedBy;
        uint256 approvedAt;
        uint256 disbursedAt;
        uint256 failedAt;
    }

    uint256 public campaignCount;
    uint256 private _tokenIdCounter;

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(uint256 => Milestone)) public milestones;
    mapping(uint256 => mapping(address => uint256)) public donations;
    mapping(uint256 => address) public campaignReviewerSafe;
    mapping(address => bool) public reviewerSafes;
    address[] private _reviewerSafeList;
    mapping(uint256 => mapping(uint256 => mapping(address => bool)))
        public refundClaimed;
    mapping(uint256 => mapping(address => bool)) public milestoneRefundClaimed;
    mapping(uint256 => mapping(address => bool)) public hasMintedCertificate;
    mapping(uint256 => uint256) public tokenToCampaign;
    mapping(address => uint256[]) public certificatesOf;

    event CampaignCreated(
        uint256 indexed campaignId,
        address creator,
        address beneficiary,
        uint256 goal,
        uint256 fundingDeadline,
        uint256 milestoneCount
    );

    event CampaignApproved(uint256 indexed campaignId, address approvedBy);

    event Donated(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 amount,
        uint256 totalRaised
    );

    event FundingComplete(uint256 indexed campaignId, uint256 totalRaised);

    event MilestoneReportSubmitted(
        uint256 indexed campaignId,
        uint256 indexed milestoneId,
        string ipfsCid,
        address submittedBy,
        uint256 submissionCount
    );

    event MilestoneUnlocked(uint256 indexed campaignId, uint256 indexed milestoneId);

    event MilestoneApproved(
        uint256 indexed campaignId,
        uint256 indexed milestoneId,
        address indexed reviewer,
        string ipfsCid,
        uint256 amount
    );

    event MilestoneDisbursed(
        uint256 indexed campaignId,
        uint256 indexed milestoneId,
        address beneficiary,
        uint256 amount
    );

    event MilestoneFailed(
        uint256 indexed campaignId,
        uint256 indexed milestoneId,
        address markedBy,
        uint256 amount
    );

    event CampaignStopped(
        uint256 indexed campaignId,
        uint256 remainingWei,
        uint256 milestoneId
    );

    event MilestoneRefunded(
        uint256 indexed campaignId,
        uint256 indexed milestoneId,
        address indexed donor,
        uint256 amount
    );

    event CertificateMinted(
        uint256 indexed campaignId,
        address indexed owner,
        uint256 indexed tokenId
    );

    event ReviewerSafeAdded(address indexed safe);
    event ReviewerSafeRemoved(address indexed safe);

    constructor(
        address multisig,
        address[] memory initialAdmins
    ) ERC721("SchoolCertificate", "SCERT") {
        require(multisig != address(0), "Invalid multisig");

        // Grant super-admin role to multisig
        _grantRole(DEFAULT_ADMIN_ROLE, multisig);
        _grantRole(ADMIN_ROLE, multisig);

        // Grant admin role to initial admin list
        for (uint256 i = 0; i < initialAdmins.length; i++) {
            _grantRole(ADMIN_ROLE, initialAdmins[i]);
        }
    }

    function addAdmin(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(ADMIN_ROLE, account);
    }

    function removeAdmin(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(ADMIN_ROLE, account);
    }

    modifier campaignExists(uint256 campaignId) {
        require(
            campaignId > 0 && campaignId <= campaignCount,
            "Campaign does not exist"
        );
        _;
    }

    modifier milestoneExists(uint256 campaignId, uint256 milestoneId) {
        require(
            milestoneId < campaigns[campaignId].milestoneCount,
            "Milestone does not exist"
        );
        _;
    }

    modifier onlyCreator(uint256 campaignId) {
        require(msg.sender == campaigns[campaignId].creator, "Not campaign creator");
        _;
    }

    function createCampaignWithMilestones(
        uint16[] calldata allocationBps,
        uint256[] calldata deadlines,
        uint256 fundingDeadline,
        address reviewerSafe
    ) external returns (uint256) {
        return
            _createCampaign(
                msg.sender,
                DEFAULT_GOAL_WEI,
                allocationBps,
                deadlines,
                fundingDeadline,
                reviewerSafe
            );
    }

    function createCampaignWithGoal(
        uint256 goalWei,
        uint16[] calldata allocationBps,
        uint256[] calldata deadlines,
        uint256 fundingDeadline,
        address reviewerSafe
    ) external returns (uint256) {
        return
            _createCampaign(
                msg.sender,
                goalWei,
                allocationBps,
                deadlines,
                fundingDeadline,
                reviewerSafe
            );
    }

    function _createCampaign(
        address beneficiary,
        uint256 goalWei,
        uint16[] calldata allocationBps,
        uint256[] calldata deadlines,
        uint256 fundingDeadline,
        address reviewerSafe
    ) internal returns (uint256 cId) {
        require(beneficiary != address(0), "Invalid beneficiary");
        require(goalWei > 0, "Invalid goal");
        require(reviewerSafe != address(0), "Invalid reviewer");
        require(reviewerSafes[reviewerSafe], "Reviewer not approved");
        require(fundingDeadline > block.timestamp, "Invalid funding deadline");
        require(allocationBps.length > 0, "At least one milestone is required");
        require(allocationBps.length == deadlines.length, "Array length mismatch");

        uint256 totalBps = 0;
        for (uint256 i = 0; i < allocationBps.length; i++) {
            require(allocationBps[i] > 0, "Allocation must be > 0");
            require(
                deadlines[i] > fundingDeadline,
                "Milestone deadline must be after funding deadline"
            );
            totalBps += allocationBps[i];
        }
        require(totalBps == BPS_DENOMINATOR, "Allocation must sum to 10000");

        cId = ++campaignCount;
        campaigns[cId] = Campaign({
            id: cId,
            creator: msg.sender,
            beneficiary: beneficiary,
            goal: goalWei,
            totalRaised: 0,
            totalDisbursed: 0,
            deadline: fundingDeadline,
            withdrawn: false,
            status: CampaignStatus.PendingApproval,
            milestoneCount: allocationBps.length,
            currentMilestoneId: 0
        });

        campaignReviewerSafe[cId] = reviewerSafe;

        for (uint256 i = 0; i < allocationBps.length; i++) {
            milestones[cId][i] = Milestone({
                id: i,
                allocationBps: allocationBps[i],
                deadline: deadlines[i],
                proofCids: new string[](0),
                proofSubmissionCount: 0,
                status: MilestoneStatus.PendingFunding,
                approvedBy: address(0),
                approvedAt: 0,
                disbursedAt: 0,
                failedAt: 0
            });
        }

        emit CampaignCreated(
            cId,
            msg.sender,
            beneficiary,
            goalWei,
            fundingDeadline,
            allocationBps.length
        );
    }

    function addReviewerSafe(address safe) external onlyRole(ADMIN_ROLE) {
        require(safe != address(0), "Invalid reviewer");
        require(!reviewerSafes[safe], "Reviewer already approved");

        reviewerSafes[safe] = true;
        _reviewerSafeList.push(safe);
        emit ReviewerSafeAdded(safe);
    }

    function removeReviewerSafe(address safe) external onlyRole(ADMIN_ROLE) {
        require(reviewerSafes[safe], "Reviewer not approved");

        reviewerSafes[safe] = false;
        emit ReviewerSafeRemoved(safe);

        uint256 count = _reviewerSafeList.length;
        for (uint256 i = 0; i < count; i++) {
            if (_reviewerSafeList[i] == safe) {
                _reviewerSafeList[i] = _reviewerSafeList[count - 1];
                _reviewerSafeList.pop();
                break;
            }
        }
    }

    function getReviewerSafes() external view returns (address[] memory) {
        return _reviewerSafeList;
    }

    function donate(
        uint256 campaignId
    ) external payable nonReentrant campaignExists(campaignId) {
        Campaign storage campaign = campaigns[campaignId];
        require(campaign.status == CampaignStatus.Active, "Campaign is not active");
        require(block.timestamp < campaign.deadline, "Funding deadline passed");
        require(msg.value > 0, "Donation must be > 0");

        donations[campaignId][msg.sender] += msg.value;
        campaign.totalRaised += msg.value;

        emit Donated(campaignId, msg.sender, msg.value, campaign.totalRaised);

        if (campaign.totalRaised >= campaign.goal) {
            campaign.status = CampaignStatus.InProgress;

            // Kích hoạt mốc đầu tiên để chờ nộp minh chứng và duyệt
            milestones[campaignId][0].status = MilestoneStatus.PendingVerification;
            campaign.currentMilestoneId = 0;

            // Tự động giải ngân ứng trước cho mốc đầu tiên để bắt đầu thực hiện
            _disburseMilestone(campaignId, 0);

            emit FundingComplete(campaignId, campaign.totalRaised);
        }
    }

    /**
     * @dev Giải ngân tiền cho một mốc cụ thể (ứng trước)
     */
    function _disburseMilestone(uint256 campaignId, uint256 milestoneId) internal {
        Campaign storage campaign = campaigns[campaignId];
        Milestone storage milestone = milestones[campaignId][milestoneId];

        // Đã giải ngân rồi thì không giải ngân lại
        if (milestone.disbursedAt > 0) return;

        uint256 amount = getMilestoneAmount(campaignId, milestoneId);
        campaign.totalDisbursed += amount;

        (bool success, ) = payable(campaign.beneficiary).call{value: amount}("");
        require(success, "Transfer failed");

        milestone.disbursedAt = block.timestamp;
        emit MilestoneDisbursed(campaignId, milestoneId, campaign.beneficiary, amount);
    }

    function submitMilestoneProof(
        uint256 campaignId,
        uint256 milestoneId,
        string calldata ipfsCid
    )
        external
        campaignExists(campaignId)
        milestoneExists(campaignId, milestoneId)
        onlyCreator(campaignId)
    {
        Campaign storage campaign = campaigns[campaignId];
        Milestone storage milestone = milestones[campaignId][milestoneId];

        require(campaign.status == CampaignStatus.InProgress, "Campaign not in progress");
        require(
            milestoneId == campaign.currentMilestoneId,
            "Only current milestone can be updated"
        );
        require(
            milestone.status == MilestoneStatus.PendingVerification,
            "Milestone not pending verification"
        );
        require(block.timestamp <= milestone.deadline, "Milestone deadline has passed");
        require(bytes(ipfsCid).length > 0, "IPFS CID cannot be empty");

        milestone.proofCids.push(ipfsCid);
        milestone.proofSubmissionCount += 1;
        emit MilestoneReportSubmitted(
            campaignId,
            milestoneId,
            ipfsCid,
            msg.sender,
            milestone.proofSubmissionCount
        );
    }

    function approveMilestone(
        uint256 campaignId,
        uint256 milestoneId
    )
        external
        nonReentrant
        campaignExists(campaignId)
        milestoneExists(campaignId, milestoneId)
    {
        Campaign storage campaign = campaigns[campaignId];
        Milestone storage milestone = milestones[campaignId][milestoneId];

        require(msg.sender == campaignReviewerSafe[campaignId], "Wrong reviewer");
        require(campaign.status == CampaignStatus.InProgress, "Campaign not in progress");
        require(
            milestoneId == campaign.currentMilestoneId,
            "Only current milestone can be approved"
        );
        require(
            milestone.status == MilestoneStatus.PendingVerification,
            "Milestone not pending verification"
        );
        require(milestone.proofCids.length > 0, "No proof submitted yet");

        // 1. Phê duyệt mốc hiện tại (đã thực hiện xong và có minh chứng)
        milestone.status = MilestoneStatus.Disbursed;
        milestone.approvedBy = msg.sender;
        milestone.approvedAt = block.timestamp;

        uint256 amountApproved = getMilestoneAmount(campaignId, milestoneId);
        emit MilestoneApproved(
            campaignId,
            milestoneId,
            msg.sender,
            milestone.proofCids[milestone.proofCids.length - 1],
            amountApproved
        );

        // 2. Nếu còn mốc tiếp theo, giải ngân ỨNG TRƯỚC cho mốc đó
        uint256 nextMilestoneId = milestoneId + 1;
        if (nextMilestoneId < campaign.milestoneCount) {
            campaign.currentMilestoneId = nextMilestoneId;
            milestones[campaignId][nextMilestoneId].status = MilestoneStatus.PendingVerification;

            // Giải ngân ứng trước cho mốc tiếp theo
            _disburseMilestone(campaignId, nextMilestoneId);

            emit MilestoneUnlocked(campaignId, nextMilestoneId);
        } else {
            // Nếu là mốc cuối cùng, đánh dấu chiến dịch hoàn thành
            campaign.status = CampaignStatus.Completed;
        }
    }

    function disburseMilestone(
        uint256 campaignId,
        uint256 milestoneId
    )
        external
        campaignExists(campaignId)
        milestoneExists(campaignId, milestoneId)
    {
        revert("Disbursement handled in approveMilestone");
    }

    function markMilestoneFailed(
        uint256 campaignId,
        uint256 milestoneId
    ) external campaignExists(campaignId) milestoneExists(campaignId, milestoneId) {
        Campaign storage campaign = campaigns[campaignId];
        Milestone storage milestone = milestones[campaignId][milestoneId];

        require(campaign.status == CampaignStatus.InProgress, "Campaign not in progress");
        require(
            milestoneId == campaign.currentMilestoneId,
            "Only current milestone can be marked failed"
        );
        require(block.timestamp > milestone.deadline, "Milestone deadline not reached");
        require(
            milestone.status == MilestoneStatus.PendingVerification,
            "Milestone not pending verification"
        );

        milestone.status = MilestoneStatus.Failed;
        milestone.failedAt = block.timestamp;
        campaign.status = CampaignStatus.PartialFailed;

        uint256 failedAmount = getMilestoneAmount(campaignId, milestoneId);
        emit MilestoneFailed(campaignId, milestoneId, msg.sender, failedAmount);

        uint256 remainingWei = campaign.totalRaised - campaign.totalDisbursed;
        emit CampaignStopped(campaignId, remainingWei, milestoneId);
    }

    function markCampaignFailed(uint256 campaignId) external campaignExists(campaignId) {
        Campaign storage campaign = campaigns[campaignId];
        require(campaign.status == CampaignStatus.Active, "Campaign is not active");
        require(block.timestamp >= campaign.deadline, "Funding deadline not reached");
        require(campaign.totalRaised < campaign.goal, "Goal already reached");

        campaign.status = CampaignStatus.Failed;
        emit CampaignStopped(campaignId, campaign.totalRaised, type(uint256).max);
    }

    function adminApprove(
        uint256 campaignId
    ) external onlyRole(ADMIN_ROLE) campaignExists(campaignId) {
        Campaign storage campaign = campaigns[campaignId];
        require(
            campaign.status == CampaignStatus.PendingApproval,
            "Campaign not pending approval"
        );

        campaign.status = CampaignStatus.Active;
        emit CampaignApproved(campaignId, msg.sender);
    }

    function claimMilestoneRefund(
        uint256 campaignId,
        uint256 milestoneId
    )
        external
        nonReentrant
        campaignExists(campaignId)
        milestoneExists(campaignId, milestoneId)
    {
        Campaign storage campaign = campaigns[campaignId];
        Milestone storage milestone = milestones[campaignId][milestoneId];

        require(milestone.status == MilestoneStatus.Failed, "Milestone not failed");
        require(campaign.status == CampaignStatus.PartialFailed, "Campaign not partial failed");
        require(
            !milestoneRefundClaimed[campaignId][msg.sender],
            "Refund already claimed"
        );

        uint256 donorShare = donations[campaignId][msg.sender];
        require(donorShare > 0, "No donation to refund");
        require(campaign.totalRaised > 0, "Campaign has no raised amount");

        milestoneRefundClaimed[campaignId][msg.sender] = true;

        uint256 remainingETH = campaign.totalRaised - campaign.totalDisbursed;
        uint256 refundAmount = (donorShare * remainingETH) / campaign.totalRaised;
        require(refundAmount > 0, "Nothing to refund");

        (bool success, ) = msg.sender.call{value: refundAmount}("");
        require(success, "Refund transfer failed");

        emit MilestoneRefunded(campaignId, milestoneId, msg.sender, refundAmount);
    }

    function claimFundingRefund(
        uint256 campaignId
    ) external nonReentrant campaignExists(campaignId) {
        Campaign storage campaign = campaigns[campaignId];
        require(campaign.status == CampaignStatus.Failed, "Campaign has not failed");

        uint256 amount = donations[campaignId][msg.sender];
        require(amount > 0, "Nothing to refund");

        donations[campaignId][msg.sender] = 0;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Refund transfer failed");

        emit MilestoneRefunded(campaignId, type(uint256).max, msg.sender, amount);
    }

    function mintCertificate(
        uint256 campaignId
    ) external nonReentrant campaignExists(campaignId) {
        Campaign storage campaign = campaigns[campaignId];

        require(
            campaign.status == CampaignStatus.InProgress ||
                campaign.status == CampaignStatus.Completed ||
                campaign.status == CampaignStatus.PartialFailed,
            "Certificate not available yet"
        );
        require(donations[campaignId][msg.sender] > 0, "You have not donated");
        require(
            !hasMintedCertificate[campaignId][msg.sender],
            "Certificate already minted"
        );

        hasMintedCertificate[campaignId][msg.sender] = true;
        _tokenIdCounter += 1;

        tokenToCampaign[_tokenIdCounter] = campaignId;
        certificatesOf[msg.sender].push(_tokenIdCounter);

        _safeMint(msg.sender, _tokenIdCounter);
        emit CertificateMinted(campaignId, msg.sender, _tokenIdCounter);
    }

    function getCampaign(
        uint256 campaignId
    ) external view campaignExists(campaignId) returns (Campaign memory) {
        return campaigns[campaignId];
    }

    function getMilestone(
        uint256 campaignId,
        uint256 milestoneId
    )
        external
        view
        campaignExists(campaignId)
        milestoneExists(campaignId, milestoneId)
        returns (Milestone memory)
    {
        return milestones[campaignId][milestoneId];
    }

    function getAllMilestones(
        uint256 campaignId
    ) external view campaignExists(campaignId) returns (Milestone[] memory) {
        uint256 count = campaigns[campaignId].milestoneCount;
        Milestone[] memory result = new Milestone[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = milestones[campaignId][i];
        }
        return result;
    }

    function getDonation(
        uint256 campaignId,
        address donor
    ) external view returns (uint256) {
        return donations[campaignId][donor];
    }

    function getCertificates(address owner) external view returns (uint256[] memory) {
        return certificatesOf[owner];
    }

    function getMilestoneAmount(
        uint256 campaignId,
        uint256 milestoneId
    ) public view campaignExists(campaignId) milestoneExists(campaignId, milestoneId) returns (uint256) {
        Campaign storage campaign = campaigns[campaignId];
        Milestone storage milestone = milestones[campaignId][milestoneId];
        return (campaign.totalRaised * milestone.allocationBps) / BPS_DENOMINATOR;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
