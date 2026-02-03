// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FundRaising
 * @dev Contract gây quỹ minh bạch hỗ trợ multiple campaigns trên Ethereum Sepolia
 * - Tạo chiến dịch gây quỹ độc lập với deadline
 * - Quyên góp cho từng chiến dịch riêng
 * - Rút tiền sau khi kết thúc hoặc đạt mục tiêu
 */
contract FundRaising {
    // ==================== STRUCTS ====================
    struct Campaign {
        uint256 id;
        string title;
        string description;
        address creator;
        uint256 goal;
        uint256 raised;
        uint256 deadline;
        bool completed;
        bool withdrawn;
    }

    // ==================== STATE VARIABLES ====================
    uint256 public campaignCount;
    uint256 public totalRaised;

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => uint256)) public contributions; // campaignId => (donor => amount)
    mapping(address => uint256[]) public userCampaigns; // creator => list of campaign IDs

    // ==================== EVENTS ====================
    event CampaignCreated(
        indexed uint256 campaignId,
        indexed address creator,
        string title,
        uint256 goal,
        uint256 deadline
    );

    event DonationReceived(
        indexed uint256 campaignId,
        indexed address donor,
        uint256 amount,
        uint256 totalRaisedForCampaign
    );

    event CampaignCompleted(
        indexed uint256 campaignId,
        uint256 totalRaised,
        bool goalReached
    );

    event FundsWithdrawn(
        indexed uint256 campaignId,
        indexed address creator,
        uint256 amount
    );

    // ==================== CUSTOM ERRORS ====================
    error InvalidAmount();
    error DeadlineInPast();
    error GoalTooSmall();
    error CampaignNotFound();
    error CampaignNotActive();
    error AlreadyWithdrawn();
    error TransferFailed();
    error NotCampaignCreator();
    error InvalidCampaignId();

    // ==================== CONSTRUCTOR ====================
    constructor() {
        campaignCount = 0;
        totalRaised = 0;
    }

    // ==================== CAMPAIGN CREATION ====================
    /**
     * @notice Tạo chiến dịch gây quỹ mới
     * @param _title Tiêu đề chiến dịch
     * @param _description Mô tả chiến dịch
     * @param _goalEth Mục tiêu quỹ (tính bằng ETH)
     * @param _durationDays Thời hạn chiến dịch (tính bằng ngày)
     */
    function createCampaign(
        string calldata _title,
        string calldata _description,
        uint256 _goalEth,
        uint256 _durationDays
    ) external returns (uint256) {
        if (_goalEth == 0) revert GoalTooSmall();
        if (_durationDays == 0) revert DeadlineInPast();

        uint256 goalWei = _goalEth * 1 ether;
        uint256 deadline = block.timestamp + (_durationDays * 1 days);

        uint256 campaignId = campaignCount;
        campaigns[campaignId] = Campaign({
            id: campaignId,
            title: _title,
            description: _description,
            creator: msg.sender,
            goal: goalWei,
            raised: 0,
            deadline: deadline,
            completed: false,
            withdrawn: false
        });

        userCampaigns[msg.sender].push(campaignId);
        campaignCount++;

        emit CampaignCreated(campaignId, msg.sender, _title, goalWei, deadline);
        return campaignId;
    }

    // ==================== DONATION FUNCTIONS ====================
    /**
     * @notice Quyên góp cho chiến dịch
     * @param _campaignId ID chiến dịch
     */
    function donate(uint256 _campaignId) external payable {
        if (msg.value == 0) revert InvalidAmount();
        if (_campaignId >= campaignCount) revert InvalidCampaignId();

        Campaign storage campaign = campaigns[_campaignId];

        if (block.timestamp > campaign.deadline) revert CampaignNotActive();
        if (campaign.completed) revert CampaignNotActive();

        contributions[_campaignId][msg.sender] += msg.value;
        campaign.raised += msg.value;
        totalRaised += msg.value;

        // Đánh dấu campaign hoàn thành nếu đạt mục tiêu
        if (campaign.raised >= campaign.goal) {
            campaign.completed = true;
            emit CampaignCompleted(_campaignId, campaign.raised, true);
        }

        emit DonationReceived(_campaignId, msg.sender, msg.value, campaign.raised);
    }

    // ==================== WITHDRAWAL FUNCTIONS ====================
    /**
     * @notice Rút tiền từ chiến dịch (sau deadline hoặc nếu đạt mục tiêu)
     * @param _campaignId ID chiến dịch
     */
    function withdrawFunds(uint256 _campaignId) external {
        if (_campaignId >= campaignCount) revert InvalidCampaignId();

        Campaign storage campaign = campaigns[_campaignId];

        if (msg.sender != campaign.creator) revert NotCampaignCreator();
        if (campaign.withdrawn) revert AlreadyWithdrawn();
        if (campaign.raised == 0) revert InvalidAmount();

        // Chỉ rút được nếu: deadline đã qua HOẶC đã đạt mục tiêu
        bool deadlineReached = block.timestamp > campaign.deadline;
        bool goalReached = campaign.raised >= campaign.goal;

        if (!deadlineReached && !goalReached) revert CampaignNotActive();

        uint256 amountToWithdraw = campaign.raised;
        campaign.withdrawn = true;
        campaign.completed = true;

        (bool success, ) = payable(campaign.creator).call{value: amountToWithdraw}("");
        if (!success) revert TransferFailed();

        emit FundsWithdrawn(_campaignId, campaign.creator, amountToWithdraw);
    }

    // ==================== REFUND FUNCTIONS ====================
    /**
     * @notice Hoàn tiền cho người quyên góp nếu chiến dịch thất bại
     * @param _campaignId ID chiến dịch
     */
    function refund(uint256 _campaignId) external {
        if (_campaignId >= campaignCount) revert InvalidCampaignId();

        Campaign storage campaign = campaigns[_campaignId];

        // Chỉ hoàn tiền nếu: deadline đã qua + không đạt mục tiêu + chưa rút tiền
        bool deadlineReached = block.timestamp > campaign.deadline;
        bool goalNotReached = campaign.raised < campaign.goal;

        if (!deadlineReached || !goalNotReached || campaign.withdrawn) {
            revert CampaignNotActive();
        }

        uint256 userContribution = contributions[_campaignId][msg.sender];
        if (userContribution == 0) revert InvalidAmount();

        contributions[_campaignId][msg.sender] = 0;
        campaign.raised -= userContribution;
        totalRaised -= userContribution;

        (bool success, ) = payable(msg.sender).call{value: userContribution}("");
        if (!success) revert TransferFailed();
    }

    // ==================== VIEW FUNCTIONS ====================
    /**
     * @notice Lấy thông tin chiến dịch
     */
    function getCampaign(uint256 _campaignId)
        external
        view
        returns (Campaign memory)
    {
        if (_campaignId >= campaignCount) revert InvalidCampaignId();
        return campaigns[_campaignId];
    }

    /**
     * @notice Lấy tất cả chiến dịch
     */
    function getAllCampaigns() external view returns (Campaign[] memory) {
        Campaign[] memory allCampaigns = new Campaign[](campaignCount);
        for (uint256 i = 0; i < campaignCount; i++) {
            allCampaigns[i] = campaigns[i];
        }
        return allCampaigns;
    }

    /**
     * @notice Lấy danh sách chiến dịch của creator
     */
    function getUserCampaigns(address _creator)
        external
        view
        returns (uint256[] memory)
    {
        return userCampaigns[_creator];
    }

    /**
     * @notice Kiểm tra số tiền quyên góp của người dùng cho chiến dịch
     */
    function getContribution(uint256 _campaignId, address _donor)
        external
        view
        returns (uint256)
    {
        return contributions[_campaignId][_donor];
    }

    /**
     * @notice Kiểm tra trạng thái chiến dịch (còn thời hạn hay không)
     */
    function isCampaignActive(uint256 _campaignId) external view returns (bool) {
        if (_campaignId >= campaignCount) revert InvalidCampaignId();
        Campaign storage campaign = campaigns[_campaignId];
        return block.timestamp <= campaign.deadline && !campaign.completed;
    }

    /**
     * @notice Tính thời gian còn lại của chiến dịch (tính bằng giây)
     */
    function getRemainingTime(uint256 _campaignId) external view returns (int256) {
        if (_campaignId >= campaignCount) revert InvalidCampaignId();
        Campaign storage campaign = campaigns[_campaignId];
        return int256(campaign.deadline) - int256(block.timestamp);
    }

    /**
     * @notice Tính phần trăm hoàn thành chiến dịch
     */
    function getCompletionPercentage(uint256 _campaignId) external view returns (uint256) {
        if (_campaignId >= campaignCount) revert InvalidCampaignId();
        Campaign storage campaign = campaigns[_campaignId];
        if (campaign.goal == 0) return 0;
        return (campaign.raised * 100) / campaign.goal;
    }
}
