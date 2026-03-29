// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract FundingPlatform is ERC721, ReentrancyGuard, Ownable {
    // ENUMS
    enum CampaignStatus {
        Active, // Accepting donations; milestones pending
        FundingComplete, // Goal reached; construction phase begins
        InProgress, // At least one milestone is being executed
        Completed, // All milestones approved & disbursed
        PartialFailure, // One or more milestones failed; rest succeeded
        Failed // Campaign failed before goal / all milestones failed
    }

    /// @notice Per-milestone lifecycle (strictly sequential)
    enum MilestoneStatus {
        PendingFunding, // Waiting for campaign goal to be reached
        PendingVerification, // Proof submitted (or unlocked); awaiting reviewer approval
        Approved, // Reviewer approved; ready for disbursement
        Disbursed, // Funds sent to beneficiary
        Failed, // Reviewer rejected or deadline passed
        Refunded // Donor refunds processed for this milestone
    }

    // STRUCTS

    struct Milestone {
        uint256 id;
        uint256 campaignId;
        string title;
        string description; // Scope of work for this phase
        uint256 fundAmount; // Wei allocated to this milestone
        uint256 deadline; // Unix timestamp by which proof must be submitted
        string proofIpfsCid; // IPFS CID of evidence uploaded by creator
        MilestoneStatus status;
    }

    struct Campaign {
        uint256 id;
        address creator;
        address beneficiary; // Receives funds upon milestone disbursement
        uint256 goal; // Sum of all milestone fundAmounts
        uint256 totalRaised;
        uint256 deadline; // Funding deadline (unix timestamp)
        bool withdrawn; // Safety flag (unused in milestone flow; kept for compatibility)
        CampaignStatus status;
        uint256 milestoneCount;
    }

    struct Reviewer {
        address wallet; // Gnosis Safe multisig address (must be a contract)
        string name; // Off-chain identifier for UI
        bool active;
    }

    /// @notice Input bundle for a single milestone.
    /// Grouping into a struct avoids "stack too deep" in createCampaign.
    struct MilestoneInput {
        string title;
        string description;
        uint256 fundAmount; // Wei allocated to this milestone
        uint256 durationDays; // Days after funding deadline for this milestone's deadline
    }

    // STATE VARIABLES

    uint256 public campaignCount;
    uint256 private _tokenIdCounter;

    /// @notice campaignId → Campaign
    mapping(uint256 => Campaign) public campaigns;

    /// @notice campaignId → milestoneIndex (1-based) → Milestone
    mapping(uint256 => mapping(uint256 => Milestone)) public milestones;

    /// @notice campaignId → donorAddress → totalDonated
    mapping(uint256 => mapping(address => uint256)) public donations;

    /// @notice campaignId → milestoneId → donorAddress → refund claimed
    mapping(uint256 => mapping(uint256 => mapping(address => bool)))
        public refundClaimed;

    /// @notice campaignId → milestoneId → total wei already refunded
    /// @dev    Used to compute dust-safe final refund (Fix #3)
    mapping(uint256 => mapping(uint256 => uint256))
        public totalRefundedPerMilestone;

    /// @notice tokenId → campaignId
    mapping(uint256 => uint256) public tokenToCampaign;

    /// @notice address → list of tokenIds
    mapping(address => uint256[]) public certificatesOf;

    /// @notice campaignId → donorAddress → has minted NFT
    mapping(uint256 => mapping(address => bool)) public hasMintedCertificate;

    /// @notice reviewerId (1-based) → Reviewer
    mapping(uint256 => Reviewer) public reviewers;
    uint256 public reviewerCount;

    /// @notice address → reviewerId (0 means not a reviewer)
    mapping(address => uint256) public reviewerIndex;

    // EVENTS

    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed creator,
        address beneficiary,
        uint256 goal,
        uint256 deadline,
        uint256 milestoneCount
    );

    event FundingComplete(uint256 indexed campaignId, uint256 totalRaised);

    event MilestoneReportSubmitted(
        uint256 indexed campaignId,
        uint256 indexed milestoneId,
        string ipfsCid,
        address submittedBy
    );

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

    event MilestoneRefunded(
        uint256 indexed campaignId,
        uint256 indexed milestoneId,
        address indexed donor,
        uint256 amount
    );

    event ReviewerWalletUpdated(
        uint256 indexed reviewerId,
        address oldWallet,
        address newWallet,
        address updatedBy
    );

    // CONSTRUCTOR

    constructor() ERC721("SchoolCertificate", "SCERT") Ownable(msg.sender) {}

    // MODIFIERS

    modifier campaignExists(uint256 _campaignId) {
        require(
            _campaignId > 0 && _campaignId <= campaignCount,
            "Campaign does not exist"
        );
        _;
    }

    modifier milestoneExists(uint256 _campaignId, uint256 _milestoneId) {
        require(
            _milestoneId > 0 &&
                _milestoneId <= campaigns[_campaignId].milestoneCount,
            "Milestone does not exist"
        );
        _;
    }

    modifier onlyReviewer() {
        require(
            reviewerIndex[msg.sender] != 0 &&
                reviewers[reviewerIndex[msg.sender]].active,
            "Not an active reviewer"
        );
        _;
    }

    modifier onlyCreator(uint256 _campaignId) {
        require(
            msg.sender == campaigns[_campaignId].creator,
            "Not campaign creator"
        );
        _;
    }

    // INTERNAL HELPERS

    function _isContract(address _addr) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(_addr)
        }
        return size > 0;
    }

    // REVIEWER MANAGEMENT  (admin only)

    /// @notice Add a new reviewer Gnosis Safe wallet.
    /// @param _wallet  Reviewer's Safe multisig address (must be a contract).
    /// @param _name    Human-readable label for UI.
    function addReviewer(
        address _wallet,
        string calldata _name
    ) external onlyOwner {
        require(_wallet != address(0), "Invalid wallet");
        // FIX #4 — enforce Gnosis Safe (contract wallet) requirement
        require(
            _isContract(_wallet),
            "Reviewer wallet must be a smart contract (Gnosis Safe)"
        );
        require(reviewerIndex[_wallet] == 0, "Already a reviewer");

        reviewerCount++;
        reviewers[reviewerCount] = Reviewer({
            wallet: _wallet,
            name: _name,
            active: true
        });
        reviewerIndex[_wallet] = reviewerCount;

        emit ReviewerWalletUpdated(
            reviewerCount,
            address(0),
            _wallet,
            msg.sender
        );
    }

    /// @notice Update the wallet address of an existing reviewer.
    /// @param _reviewerId  ID of the reviewer to update.
    /// @param _newWallet   New Gnosis Safe wallet address (must be a contract).
    function updateReviewerWallet(
        uint256 _reviewerId,
        address _newWallet
    ) external onlyOwner {
        require(
            _reviewerId > 0 && _reviewerId <= reviewerCount,
            "Reviewer does not exist"
        );
        require(_newWallet != address(0), "Invalid wallet");
        // FIX #4 — enforce Gnosis Safe (contract wallet) requirement
        require(
            _isContract(_newWallet),
            "New wallet must be a smart contract (Gnosis Safe)"
        );
        require(reviewerIndex[_newWallet] == 0, "New wallet already in use");

        Reviewer storage reviewer = reviewers[_reviewerId];
        address oldWallet = reviewer.wallet;

        reviewerIndex[oldWallet] = 0;
        reviewer.wallet = _newWallet;
        reviewerIndex[_newWallet] = _reviewerId;

        emit ReviewerWalletUpdated(
            _reviewerId,
            oldWallet,
            _newWallet,
            msg.sender
        );
    }

    /// @notice Deactivate a reviewer (does not delete history).
    function deactivateReviewer(uint256 _reviewerId) external onlyOwner {
        require(
            _reviewerId > 0 && _reviewerId <= reviewerCount,
            "Reviewer does not exist"
        );
        Reviewer storage reviewer = reviewers[_reviewerId];
        require(reviewer.active, "Already inactive");
        reviewer.active = false;
        reviewerIndex[reviewer.wallet] = 0;
    }

    // CAMPAIGN CREATION

    /// @notice Create a campaign with pre-defined milestones.
    /// @param _beneficiary   Who receives disbursed milestone funds.
    /// @param _durationDays  How many days the funding phase lasts.
    /// @param _milestones    Array of MilestoneInput structs.
    function createCampaign(
        address _beneficiary,
        uint256 _durationDays,
        MilestoneInput[] calldata _milestones
    ) external returns (uint256) {
        require(_beneficiary != address(0), "Invalid beneficiary");
        require(
            _durationDays > 0 && _durationDays <= 365,
            "Duration must be 1-365 days"
        );

        uint256 mCount = _milestones.length;
        require(mCount > 0, "Must have at least one milestone");

        uint256 totalGoal;
        for (uint256 i = 0; i < mCount; i++) {
            require(
                _milestones[i].fundAmount > 0,
                "Milestone fund must be > 0"
            );
            require(
                _milestones[i].durationDays > 0,
                "Milestone duration must be > 0"
            );
            totalGoal += _milestones[i].fundAmount;
        }

        campaignCount++;
        uint256 cId = campaignCount;
        uint256 fundingDeadline = block.timestamp + (_durationDays * 1 days);

        campaigns[cId] = Campaign({
            id: cId,
            creator: msg.sender,
            beneficiary: _beneficiary,
            goal: totalGoal,
            totalRaised: 0,
            deadline: fundingDeadline,
            withdrawn: false,
            status: CampaignStatus.Active,
            milestoneCount: mCount
        });

        _storeMilestones(cId, fundingDeadline, _milestones);

        emit CampaignCreated(
            cId,
            msg.sender,
            _beneficiary,
            totalGoal,
            fundingDeadline,
            mCount
        );
        return cId;
    }

    /// @dev Extracted to keep createCampaign stack usage below EVM limit (16 slots).
    function _storeMilestones(
        uint256 cId,
        uint256 fundingDeadline,
        MilestoneInput[] calldata _milestones
    ) internal {
        for (uint256 i = 0; i < _milestones.length; i++) {
            milestones[cId][i + 1] = Milestone({
                id: i + 1,
                campaignId: cId,
                title: _milestones[i].title,
                description: _milestones[i].description,
                fundAmount: _milestones[i].fundAmount,
                deadline: fundingDeadline +
                    (_milestones[i].durationDays * 1 days),
                proofIpfsCid: "",
                status: MilestoneStatus.PendingFunding
            });
        }
    }

    // DONATION

    /// @notice Donate ETH to a campaign's funding phase.
    function donate(
        uint256 _campaignId
    ) external payable nonReentrant campaignExists(_campaignId) {
        Campaign storage campaign = campaigns[_campaignId];

        require(
            campaign.status == CampaignStatus.Active,
            "Campaign is not in funding phase"
        );
        require(block.timestamp < campaign.deadline, "Funding deadline passed");
        require(msg.value > 0, "Donation must be > 0");

        donations[_campaignId][msg.sender] += msg.value;
        campaign.totalRaised += msg.value;

        if (campaign.totalRaised >= campaign.goal) {
            campaign.status = CampaignStatus.FundingComplete;
            emit FundingComplete(_campaignId, campaign.totalRaised);
        }
    }

    /// @notice Transition campaign from FundingComplete → InProgress and unlock milestone 1.
    function startExecution(
        uint256 _campaignId
    ) external campaignExists(_campaignId) onlyCreator(_campaignId) {
        Campaign storage campaign = campaigns[_campaignId];

        require(
            campaign.status == CampaignStatus.FundingComplete,
            "Campaign not in FundingComplete"
        );

        campaign.status = CampaignStatus.InProgress;
        milestones[_campaignId][1].status = MilestoneStatus.PendingVerification;
    }

    // MILESTONE PROOF SUBMISSION

    /// @notice Creator submits IPFS proof for a milestone.
    function submitMilestoneProof(
        uint256 _campaignId,
        uint256 _milestoneId,
        string calldata _ipfsCid
    )
        external
        campaignExists(_campaignId)
        milestoneExists(_campaignId, _milestoneId)
        onlyCreator(_campaignId)
    {
        Campaign storage campaign = campaigns[_campaignId];
        Milestone storage milestone = milestones[_campaignId][_milestoneId];

        require(
            campaign.status == CampaignStatus.InProgress,
            "Campaign not in progress"
        );
        require(
            milestone.status == MilestoneStatus.PendingVerification,
            "Milestone not awaiting proof"
        );
        require(
            block.timestamp <= milestone.deadline,
            "Milestone deadline has passed"
        );
        require(bytes(_ipfsCid).length > 0, "IPFS CID cannot be empty");

        milestone.proofIpfsCid = _ipfsCid;

        emit MilestoneReportSubmitted(
            _campaignId,
            _milestoneId,
            _ipfsCid,
            msg.sender
        );
    }

    // MILESTONE APPROVAL  (reviewer Safe only)

    /// @notice Reviewer approves a milestone after verifying the proof.
    function approveMilestone(
        uint256 _campaignId,
        uint256 _milestoneId
    )
        external
        onlyReviewer
        campaignExists(_campaignId)
        milestoneExists(_campaignId, _milestoneId)
    {
        Campaign storage campaign = campaigns[_campaignId];
        Milestone storage milestone = milestones[_campaignId][_milestoneId];

        require(
            campaign.status == CampaignStatus.InProgress,
            "Campaign not in progress"
        );
        require(
            milestone.status == MilestoneStatus.PendingVerification,
            "Milestone not pending verification"
        );
        require(
            bytes(milestone.proofIpfsCid).length > 0,
            "No proof submitted yet"
        );

        milestone.status = MilestoneStatus.Approved;

        // FIX #2 — include ipfsCid and amount so backend listener has full data
        emit MilestoneApproved(
            _campaignId,
            _milestoneId,
            msg.sender,
            milestone.proofIpfsCid,
            milestone.fundAmount
        );
    }

    // MILESTONE DISBURSEMENT

    /// @notice Disburse funds for an approved milestone to the beneficiary.
    ///         Permissionless — anyone can trigger after approval.
    function disburseMilestone(
        uint256 _campaignId,
        uint256 _milestoneId
    )
        external
        nonReentrant
        campaignExists(_campaignId)
        milestoneExists(_campaignId, _milestoneId)
    {
        Campaign storage campaign = campaigns[_campaignId];
        Milestone storage milestone = milestones[_campaignId][_milestoneId];

        require(
            campaign.status == CampaignStatus.InProgress,
            "Campaign not in progress"
        );
        require(
            milestone.status == MilestoneStatus.Approved,
            "Milestone not approved"
        );

        milestone.status = MilestoneStatus.Disbursed;
        uint256 amount = milestone.fundAmount;

        (bool success, ) = campaign.beneficiary.call{value: amount}("");
        require(success, "Disbursement transfer failed");

        emit MilestoneDisbursed(
            _campaignId,
            _milestoneId,
            campaign.beneficiary,
            amount
        );

        // Unlock the next milestone (sequential flow)
        uint256 nextId = _milestoneId + 1;
        if (nextId <= campaign.milestoneCount) {
            milestones[_campaignId][nextId].status = MilestoneStatus
                .PendingVerification;
        } else {
            _evaluateCampaignCompletion(_campaignId);
        }
    }

    // MILESTONE FAILURE

    /// @notice Reviewer or admin marks a milestone as failed.
    function markMilestoneFailed(
        uint256 _campaignId,
        uint256 _milestoneId
    )
        external
        campaignExists(_campaignId)
        milestoneExists(_campaignId, _milestoneId)
    {
        require(
            (reviewerIndex[msg.sender] != 0 &&
                reviewers[reviewerIndex[msg.sender]].active) ||
                msg.sender == owner(),
            "Not a reviewer or admin"
        );

        Campaign storage campaign = campaigns[_campaignId];
        Milestone storage milestone = milestones[_campaignId][_milestoneId];

        require(
            campaign.status == CampaignStatus.InProgress,
            "Campaign not in progress"
        );
        require(
            milestone.status == MilestoneStatus.PendingVerification,
            "Milestone not pending verification"
        );

        // Mark the target milestone failed
        milestone.status = MilestoneStatus.Failed;
        emit MilestoneFailed(
            _campaignId,
            _milestoneId,
            msg.sender,
            milestone.fundAmount
        );

        for (uint256 i = _milestoneId + 1; i <= campaign.milestoneCount; i++) {
            MilestoneStatus s = milestones[_campaignId][i].status;
            if (
                s == MilestoneStatus.PendingFunding ||
                s == MilestoneStatus.PendingVerification
            ) {
                milestones[_campaignId][i].status = MilestoneStatus.Failed;
                emit MilestoneFailed(
                    _campaignId,
                    i,
                    msg.sender,
                    milestones[_campaignId][i].fundAmount
                );
            }
        }

        // Now all milestones have a terminal status — evaluate final campaign state
        _evaluateCampaignCompletion(_campaignId);
    }

    // REFUNDS

    /// @notice Donor claims pro-rata refund for a failed milestone.
    ///         Refund = (donorContribution / totalRaised) * milestone.fundAmount
    function claimMilestoneRefund(
        uint256 _campaignId,
        uint256 _milestoneId
    )
        external
        nonReentrant
        campaignExists(_campaignId)
        milestoneExists(_campaignId, _milestoneId)
    {
        Milestone storage milestone = milestones[_campaignId][_milestoneId];
        Campaign storage campaign = campaigns[_campaignId];

        require(
            milestone.status == MilestoneStatus.Failed ||
                milestone.status == MilestoneStatus.Refunded,
            "Milestone not failed"
        );
        require(
            !refundClaimed[_campaignId][_milestoneId][msg.sender],
            "Refund already claimed"
        );
        require(
            donations[_campaignId][msg.sender] > 0,
            "No donation to refund"
        );

        refundClaimed[_campaignId][_milestoneId][msg.sender] = true;

        // Computed pro-rata share
        uint256 donorShare = donations[_campaignId][msg.sender];
        uint256 computedRefund = (donorShare * milestone.fundAmount) /
            campaign.totalRaised;
        require(computedRefund > 0, "Refund amount is zero");

        uint256 alreadyRefunded = totalRefundedPerMilestone[_campaignId][
            _milestoneId
        ];
        uint256 remainingPool = milestone.fundAmount - alreadyRefunded;

        // Cap at remainingPool so the last donor cannot over-claim, and use
        // min(computedRefund, remainingPool) — normally equal except for last claimant.
        uint256 refundAmount = computedRefund < remainingPool
            ? computedRefund
            : remainingPool;
        require(refundAmount > 0, "Nothing left in refund pool");

        // Update refund pool tracker before external call (CEI pattern)
        totalRefundedPerMilestone[_campaignId][_milestoneId] += refundAmount;

        // Transition milestone state on first claim
        if (milestone.status == MilestoneStatus.Failed) {
            milestone.status = MilestoneStatus.Refunded;
        }

        (bool success, ) = msg.sender.call{value: refundAmount}("");
        require(success, "Refund transfer failed");

        emit MilestoneRefunded(
            _campaignId,
            _milestoneId,
            msg.sender,
            refundAmount
        );
    }

    /// @notice Donor claims full refund when campaign fails during funding phase
    ///         (Active → deadline passed, goal not met).
    function claimFundingRefund(
        uint256 _campaignId
    ) external nonReentrant campaignExists(_campaignId) {
        Campaign storage campaign = campaigns[_campaignId];

        require(
            campaign.status == CampaignStatus.Failed,
            "Campaign has not failed"
        );

        uint256 amount = donations[_campaignId][msg.sender];
        require(amount > 0, "Nothing to refund");

        donations[_campaignId][msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Refund transfer failed");

        // milestoneId 0 signals a full-campaign (pre-execution) refund
        emit MilestoneRefunded(_campaignId, 0, msg.sender, amount);
    }

    // CAMPAIGN FAILURE  (funding phase)

    /// @notice Mark a campaign as Failed if the funding deadline passed without
    ///         reaching the goal. Permissionless state-check function.
    function markCampaignFailed(
        uint256 _campaignId
    ) external campaignExists(_campaignId) {
        Campaign storage campaign = campaigns[_campaignId];

        require(
            campaign.status == CampaignStatus.Active,
            "Campaign is not active"
        );
        require(
            block.timestamp >= campaign.deadline,
            "Funding deadline not reached"
        );
        require(campaign.totalRaised < campaign.goal, "Goal already reached");

        campaign.status = CampaignStatus.Failed;
    }

    // NFT CERTIFICATES

    /// @notice Mint a donation certificate NFT for a campaign donor.
    ///         Available once funding is complete or campaign is in progress.
    function mintCertificate(
        uint256 _campaignId
    ) external nonReentrant campaignExists(_campaignId) {
        Campaign storage campaign = campaigns[_campaignId];

        require(
            campaign.status == CampaignStatus.FundingComplete ||
                campaign.status == CampaignStatus.InProgress ||
                campaign.status == CampaignStatus.Completed ||
                campaign.status == CampaignStatus.PartialFailure,
            "Certificate not available yet"
        );
        require(
            donations[_campaignId][msg.sender] > 0,
            "You have not donated to this campaign"
        );
        require(
            !hasMintedCertificate[_campaignId][msg.sender],
            "Certificate already minted"
        );

        hasMintedCertificate[_campaignId][msg.sender] = true;
        _tokenIdCounter++;
        uint256 newTokenId = _tokenIdCounter;

        tokenToCampaign[newTokenId] = _campaignId;
        certificatesOf[msg.sender].push(newTokenId);

        _safeMint(msg.sender, newTokenId);
        // Note: _safeMint already emits Transfer(address(0), msg.sender, newTokenId)
        // per ERC721 spec — no need to emit it again.
    }

    // INTERNAL HELPERS
    function _evaluateCampaignCompletion(uint256 _campaignId) internal {
        Campaign storage campaign = campaigns[_campaignId];
        uint256 count = campaign.milestoneCount;

        uint256 disbursed;
        uint256 failed;

        for (uint256 i = 1; i <= count; i++) {
            MilestoneStatus s = milestones[_campaignId][i].status;
            if (s == MilestoneStatus.Disbursed) disbursed++;
            if (s == MilestoneStatus.Failed || s == MilestoneStatus.Refunded)
                failed++;
        }

        if (disbursed == count) {
            campaign.status = CampaignStatus.Completed;
        } else if (failed == count) {
            campaign.status = CampaignStatus.Failed;
        } else if (disbursed + failed == count) {
            // Some milestones succeeded, some failed
            campaign.status = CampaignStatus.PartialFailure;
        }
        // Otherwise still InProgress — more milestones remain (shouldn't happen post-FIX #1)
    }

    // VIEW FUNCTIONS

    /// @notice Get full campaign data.
    function getCampaign(
        uint256 _campaignId
    ) external view campaignExists(_campaignId) returns (Campaign memory) {
        return campaigns[_campaignId];
    }

    /// @notice Get a specific milestone.
    function getMilestone(
        uint256 _campaignId,
        uint256 _milestoneId
    )
        external
        view
        campaignExists(_campaignId)
        milestoneExists(_campaignId, _milestoneId)
        returns (Milestone memory)
    {
        return milestones[_campaignId][_milestoneId];
    }

    /// @notice Get all milestones for a campaign.
    function getAllMilestones(
        uint256 _campaignId
    ) external view campaignExists(_campaignId) returns (Milestone[] memory) {
        uint256 count = campaigns[_campaignId].milestoneCount;
        Milestone[] memory result = new Milestone[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = milestones[_campaignId][i + 1];
        }
        return result;
    }

    /// @notice Get donor's total contribution to a campaign.
    function getDonation(
        uint256 _campaignId,
        address _donor
    ) external view returns (uint256) {
        return donations[_campaignId][_donor];
    }

    /// @notice Get all certificate token IDs held by an address.
    function getCertificates(
        address _owner
    ) external view returns (uint256[] memory) {
        return certificatesOf[_owner];
    }

    /// @notice Check if a campaign is currently accepting donations.
    function isFundingActive(
        uint256 _campaignId
    ) external view campaignExists(_campaignId) returns (bool) {
        Campaign memory c = campaigns[_campaignId];
        return
            c.status == CampaignStatus.Active && block.timestamp < c.deadline;
    }

    /// @notice Get reviewer info by ID.
    function getReviewer(
        uint256 _reviewerId
    ) external view returns (Reviewer memory) {
        require(
            _reviewerId > 0 && _reviewerId <= reviewerCount,
            "Reviewer does not exist"
        );
        return reviewers[_reviewerId];
    }

    /// @notice Check if an address is an active reviewer.
    function isActiveReviewer(address _addr) external view returns (bool) {
        uint256 idx = reviewerIndex[_addr];
        return idx != 0 && reviewers[idx].active;
    }

    /// @notice Get how much of a failed milestone's refund pool has been paid out.
    /// @dev    Useful for frontend to show remaining claimable amount.
    function getRefundedAmount(
        uint256 _campaignId,
        uint256 _milestoneId
    ) external view returns (uint256) {
        return totalRefundedPerMilestone[_campaignId][_milestoneId];
    }

    function sweepDust(
        uint256 _campaignId,
        address payable _treasury
    ) external onlyOwner {
        Campaign storage campaign = campaigns[_campaignId];
        require(
            campaign.status == CampaignStatus.Completed ||
                campaign.status == CampaignStatus.Failed ||
                campaign.status == CampaignStatus.PartialFailure,
            "Campaign not finalized"
        );
        // Chỉ dùng được khi 1 campaign active cùng lúc
        // Nếu multi-campaign cần per-campaign balance tracking
        uint256 dust = address(this).balance;
        require(dust > 0, "No dust");
        (bool ok, ) = _treasury.call{value: dust}("");
        require(ok, "Sweep failed");
    }
}
