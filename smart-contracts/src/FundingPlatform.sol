// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title FundingPlatform - Community fundraising platform with NFT certificates
/// @notice Allows creating campaigns, donations, minting NFTs, and refunds if campaign fails
/// Inherits ERC721 to issue NFT certificates to donors, uses ReentrancyGuard to protect fund transfer functions, and Ownable to manage admin permissions.
contract FundingPlatform is ERC721, ReentrancyGuard, Ownable {
    // ENUMS & STRUCTS

    enum CampaignStatus {
        Active, // Currently accepting donations
        Succeeded,
        Failed, // Deadline reached without reaching goal → allows refunds
        Cancelled // Admin/creator manually cancelled
    }

    struct Campaign {
        uint256 id;
        address creator;
        address beneficiary; // Recipient of funds upon disbursement
        uint256 goal;
        uint256 totalRaised;
        uint256 deadline; // Unix timestamp for end time
        bool withdrawn; // Funds already withdrawn (prevents double-withdrawal)
        CampaignStatus status;
    }

    // STATE VARIABLES

    uint256 public campaignCount;
    uint256 private _tokenIdCounter;

    /// @notice campaignId => Campaign
    mapping(uint256 => Campaign) public campaigns;

    /// @notice campaignId => donorAddress => totalDonated
    mapping(uint256 => mapping(address => uint256)) public donations;

    /// @notice tokenId => campaignId (which campaign does this NFT belong to)
    mapping(uint256 => uint256) public tokenToCampaign;

    /// @notice address => list of tokenIds they hold (for quick FE/BE queries)
    mapping(address => uint256[]) public certificatesOf;

    /// @notice campaignId => donorAddress => has minted NFT (prevents double minting)
    mapping(uint256 => mapping(address => bool)) public hasMintedCertificate;

    // EVENTS

    event CampaignCreated(
        uint256 indexed id,
        address indexed creator,
        address beneficiary,
        uint256 goal,
        uint256 deadline
    );

    event Donated(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 amount
    );

    event CertificateMinted(
        uint256 indexed campaignId,
        address indexed owner,
        uint256 tokenId
    );

    event FundsWithdrawn(
        uint256 indexed campaignId,
        address indexed beneficiary,
        uint256 amount
    );

    event RefundIssued(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 amount
    );

    event CampaignCancelled(
        uint256 indexed campaignId,
        address indexed cancelledBy
    );

    // CONSTRUCTOR
    // Runs only once when contract is deployed, sets NFT name and symbol, and establishes initial owner.
    constructor() ERC721("DonationCertificate", "CERT") Ownable(msg.sender) {
        campaignCount = 0;
        _tokenIdCounter = 0;
    }

    // MODIFIERS
    // Used for repetitive validation logic across multiple functions

    modifier campaignExists(uint256 _campaignId) {
        require(
            _campaignId > 0 && _campaignId <= campaignCount,
            "Campaign does not exist"
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

    // FUNCTIONS

    /// @notice Create a new fundraising campaign
    /// @param _beneficiary Address to receive funds upon disbursement
    /// @param _goal Fundraising target (wei)
    /// @param _durationDays Number of days the campaign runs
    function createCampaign(
        address _beneficiary,
        uint256 _goal,
        uint256 _durationDays
    ) external returns (uint256) {
        require(_beneficiary != address(0), "Invalid beneficiary");
        require(_goal > 0, "Goal must be greater than 0");
        require(
            _durationDays > 0 && _durationDays <= 365,
            "Duration must be 1-365 days"
        );

        campaignCount++;
        uint256 deadline = block.timestamp + (_durationDays * 1 days);

        campaigns[campaignCount] = Campaign({
            id: campaignCount,
            creator: msg.sender,
            beneficiary: _beneficiary,
            goal: _goal,
            totalRaised: 0,
            deadline: deadline,
            withdrawn: false,
            status: CampaignStatus.Active
        });

        emit CampaignCreated(
            campaignCount,
            msg.sender,
            _beneficiary,
            _goal,
            deadline
        );
        return campaignCount;
    }

    /// @notice Donate to a campaign
    /// @param _campaignId Campaign ID
    function donate(
        uint256 _campaignId
    ) external payable nonReentrant campaignExists(_campaignId) {
        Campaign storage campaign = campaigns[_campaignId];

        require(
            campaign.status == CampaignStatus.Active,
            "Campaign is not active"
        );
        require(block.timestamp < campaign.deadline, "Campaign has ended");
        require(msg.value > 0, "Donation must be greater than 0");

        donations[_campaignId][msg.sender] += msg.value;
        campaign.totalRaised += msg.value;

        // Automatically update status if goal is reached
        if (campaign.totalRaised >= campaign.goal) {
            campaign.status = CampaignStatus.Succeeded;
        }

        emit Donated(_campaignId, msg.sender, msg.value);
    }

    /// @notice Mint certificate NFT after donating
    /// @param _campaignId Campaign ID
    function mintCertificate(
        uint256 _campaignId
    ) external nonReentrant campaignExists(_campaignId) {
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

        emit CertificateMinted(_campaignId, msg.sender, newTokenId);
    }

    /// @notice Creator/Beneficiary withdraws funds when campaign succeeds
    /// @param _campaignId Campaign ID
    function withdrawFunds(
        uint256 _campaignId
    ) external nonReentrant campaignExists(_campaignId) {
        // Pointer directly references storage
        Campaign storage campaign = campaigns[_campaignId];

        require(
            msg.sender == campaign.creator ||
                msg.sender == campaign.beneficiary,
            "Not authorized to withdraw"
        );
        require(
            campaign.status == CampaignStatus.Succeeded,
            "Campaign has not succeeded"
        );
        require(!campaign.withdrawn, "Funds already withdrawn");

        campaign.withdrawn = true;
        uint256 amount = campaign.totalRaised;

        (bool success, ) = campaign.beneficiary.call{value: amount}("");
        require(success, "Transfer failed");

        emit FundsWithdrawn(_campaignId, campaign.beneficiary, amount);
    }

    /// @notice Update campaign status to failed (backend calls after deadline)
    /// @param _campaignId Campaign ID
    function markAsFailed(
        uint256 _campaignId
    ) external campaignExists(_campaignId) {
        Campaign storage campaign = campaigns[_campaignId];

        require(
            campaign.status == CampaignStatus.Active,
            "Campaign is not active"
        );
        require(
            block.timestamp >= campaign.deadline,
            "Campaign deadline not reached"
        );
        require(
            campaign.totalRaised < campaign.goal,
            "Campaign has reached its goal"
        );

        campaign.status = CampaignStatus.Failed;
    }

    /// @notice User claims refund when campaign fails
    /// @param _campaignId Campaign ID
    function claimRefund(
        uint256 _campaignId
    ) external nonReentrant campaignExists(_campaignId) {
        Campaign storage campaign = campaigns[_campaignId];

        require(
            campaign.status == CampaignStatus.Failed,
            "Campaign has not failed"
        );

        uint256 amount = donations[_campaignId][msg.sender];
        require(amount > 0, "No donation to refund");

        // Reset before transfer (prevents reentrancy)
        donations[_campaignId][msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Refund transfer failed");

        emit RefundIssued(_campaignId, msg.sender, amount);
    }

    /// @notice Creator or Admin cancels campaign (when no donations yet)
    /// @param _campaignId Campaign ID
    function cancelCampaign(
        uint256 _campaignId
    ) external campaignExists(_campaignId) {
        Campaign storage campaign = campaigns[_campaignId];

        require(
            msg.sender == campaign.creator || msg.sender == owner(),
            "Not authorized to cancel"
        );
        require(
            campaign.status == CampaignStatus.Active,
            "Campaign is not active"
        );
        require(
            campaign.totalRaised == 0,
            "Cannot cancel: funds already raised"
        );

        campaign.status = CampaignStatus.Cancelled;

        emit CampaignCancelled(_campaignId, msg.sender);
    }

    // VIEW FUNCTIONS (read-only data, no gas cost when called off-chain)

    /// @notice Get campaign information
    function getCampaign(
        uint256 _campaignId
    ) external view campaignExists(_campaignId) returns (Campaign memory) {
        return campaigns[_campaignId];
    }

    /// @notice Get the amount a user has donated to a campaign
    function getDonation(
        uint256 _campaignId,
        address _donor
    ) external view returns (uint256) {
        return donations[_campaignId][_donor];
    }

    /// @notice Get list of NFTs held by an address
    function getCertificates(
        address _owner
    ) external view returns (uint256[] memory) {
        return certificatesOf[_owner];
    }

    /// @notice Check if a campaign is still active
    function isCampaignActive(
        uint256 _campaignId
    ) external view campaignExists(_campaignId) returns (bool) {
        Campaign memory campaign = campaigns[_campaignId];
        return
            campaign.status == CampaignStatus.Active &&
            block.timestamp < campaign.deadline;
    }
}
