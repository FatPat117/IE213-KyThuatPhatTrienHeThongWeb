// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {FundingPlatform} from "../src/FundingPlatform.sol";

contract MockSafe {}

contract FundingPlatformTest is Test {
    FundingPlatform public platform;

    address public creator = makeAddr("creator");
    address public donor = makeAddr("donor");
    address public donor2 = makeAddr("donor2");
    address public outsider = makeAddr("outsider");

    MockSafe public safe;
    address public reviewerSafe;

    string private constant CID_1 = "QmMilestoneProofHash1";
    string private constant CID_2 = "QmMilestoneProofHash2";

    function setUp() public {
        address[] memory initialAdmins = new address[](1);
        initialAdmins[0] = address(this);
        platform = new FundingPlatform(address(this), initialAdmins);
        safe = new MockSafe();
        reviewerSafe = address(safe);
        platform.addReviewerSafe(reviewerSafe);

        vm.deal(creator, 2 ether);
        vm.deal(donor, 10 ether);
        vm.deal(donor2, 10 ether);
        vm.deal(outsider, 10 ether);
    }

    function _defaultAllocationBps() internal pure returns (uint16[] memory bps) {
        bps = new uint16[](2);
        bps[0] = 3000;
        bps[1] = 7000;
    }

    function _defaultDeadlines() internal view returns (uint256[] memory deadlines) {
        deadlines = new uint256[](2);
        deadlines[0] = block.timestamp + 15 days;
        deadlines[1] = block.timestamp + 30 days;
    }

    function _threeMilestoneAllocationBps()
        internal
        pure
        returns (uint16[] memory bps)
    {
        bps = new uint16[](3);
        bps[0] = 2000;
        bps[1] = 3000;
        bps[2] = 5000;
    }

    function _threeMilestoneDeadlines()
        internal
        view
        returns (uint256[] memory deadlines)
    {
        deadlines = new uint256[](3);
        deadlines[0] = block.timestamp + 15 days;
        deadlines[1] = block.timestamp + 30 days;
        deadlines[2] = block.timestamp + 45 days;
    }

    function _createCampaign(
        uint16[] memory bps,
        uint256[] memory deadlines
    ) internal returns (uint256) {
        vm.prank(creator);
        return
            platform.createCampaignWithMilestones(
                bps,
                deadlines,
                block.timestamp + 7 days,
                reviewerSafe
            );
    }

    function _createDefaultCampaign() internal returns (uint256) {
        return _createCampaign(_defaultAllocationBps(), _defaultDeadlines());
    }

    function _approveCampaign(uint256 campaignId) internal {
        platform.adminApprove(campaignId);
    }

    function _createApprovedDefaultCampaign() internal returns (uint256) {
        uint256 campaignId = _createDefaultCampaign();
        _approveCampaign(campaignId);
        return campaignId;
    }

    function _fundCampaign(uint256 campaignId) internal {
        vm.prank(donor);
        platform.donate{value: 1 ether}(campaignId);
    }

    function test_CreateCampaignWithMilestones_StartsPendingApproval() public {
        uint16[] memory bps = _defaultAllocationBps();
        uint256[] memory deadlines = _defaultDeadlines();
        uint256 fundingDeadline = block.timestamp + 7 days;

        vm.prank(creator);
        uint256 campaignId = platform.createCampaignWithMilestones(
            bps,
            deadlines,
            fundingDeadline,
            reviewerSafe
        );

        FundingPlatform.Campaign memory campaign = platform.getCampaign(campaignId);
        assertEq(campaign.id, 1);
        assertEq(campaign.creator, creator);
        assertEq(campaign.beneficiary, creator);
        assertEq(campaign.goal, 1 ether);
        assertEq(campaign.deadline, fundingDeadline);
        assertEq(campaign.milestoneCount, 2);
        assertEq(campaign.currentMilestoneId, 0);
        assertEq(
            uint256(campaign.status),
            uint256(FundingPlatform.CampaignStatus.PendingApproval)
        );
        assertEq(platform.campaignReviewerSafe(campaignId), reviewerSafe);

        FundingPlatform.Milestone memory m0 = platform.getMilestone(campaignId, 0);
        FundingPlatform.Milestone memory m1 = platform.getMilestone(campaignId, 1);
        assertEq(m0.allocationBps, 3000);
        assertEq(m1.allocationBps, 7000);
        assertEq(m0.deadline, deadlines[0]);
        assertEq(m1.deadline, deadlines[1]);
        assertEq(m0.proofSubmissionCount, 0);
        assertEq(m1.proofSubmissionCount, 0);
    }

    function test_CreateCampaignWithMilestones_RevertsIfAllocationNot10000() public {
        uint16[] memory bps = new uint16[](2);
        bps[0] = 2000;
        bps[1] = 7000;
        uint256[] memory deadlines = _defaultDeadlines();

        vm.prank(creator);
        vm.expectRevert("Allocation must sum to 10000");
        platform.createCampaignWithMilestones(
            bps,
            deadlines,
            block.timestamp + 7 days,
            reviewerSafe
        );
    }

    function test_AdminApprove_RevertsForNonOwner() public {
        uint256 campaignId = _createDefaultCampaign();

        vm.prank(outsider);
        vm.expectRevert();
        platform.adminApprove(campaignId);
    }

    function test_AdminApprove_EmitsCampaignApprovedAndActivatesCampaign() public {
        uint256 campaignId = _createDefaultCampaign();

        vm.expectEmit(true, false, false, true);
        emit FundingPlatform.CampaignApproved(campaignId, address(this));

        platform.adminApprove(campaignId);

        FundingPlatform.Campaign memory campaign = platform.getCampaign(campaignId);
        assertEq(
            uint256(campaign.status),
            uint256(FundingPlatform.CampaignStatus.Active)
        );
    }

    function test_Donate_RevertsWhileCampaignPendingApproval() public {
        uint256 campaignId = _createDefaultCampaign();

        vm.prank(donor);
        vm.expectRevert("Campaign is not active");
        platform.donate{value: 1 ether}(campaignId);
    }

    function test_Donate_EmitsDonatedThenFundingCompleteAndAutodisburse() public {
        uint256 campaignId = _createApprovedDefaultCampaign();

        vm.expectEmit(true, true, false, true);
        emit FundingPlatform.Donated(campaignId, donor, 1 ether, 1 ether);

        vm.expectEmit(true, false, false, true);
        emit FundingPlatform.FundingComplete(campaignId, 1 ether);

        vm.prank(donor);
        platform.donate{value: 1 ether}(campaignId);

        FundingPlatform.Campaign memory campaign = platform.getCampaign(campaignId);
        assertEq(
            uint256(campaign.status),
            uint256(FundingPlatform.CampaignStatus.InProgress)
        );
        assertEq(campaign.currentMilestoneId, 0);

        FundingPlatform.Milestone memory m0 = platform.getMilestone(campaignId, 0);
        FundingPlatform.Milestone memory m1 = platform.getMilestone(campaignId, 1);
        assertEq(
            uint256(m0.status),
            uint256(FundingPlatform.MilestoneStatus.PendingVerification)
        );
        assertEq(
            uint256(m1.status),
            uint256(FundingPlatform.MilestoneStatus.PendingFunding)
        );
    }

    function test_GetMilestoneAmount_UsesAllocationBps() public {
        uint256 campaignId = _createApprovedDefaultCampaign();
        _fundCampaign(campaignId);

        uint256 m0Amount = platform.getMilestoneAmount(campaignId, 0);
        uint256 m1Amount = platform.getMilestoneAmount(campaignId, 1);

        assertEq(m0Amount, 0.3 ether);
        assertEq(m1Amount, 0.7 ether);
    }

    function test_ApproveMilestone_RequiresCampaignReviewerSafe() public {
        uint256 campaignId = _createApprovedDefaultCampaign();
        _fundCampaign(campaignId);

        vm.prank(creator);
        platform.submitMilestoneProof(campaignId, 0, CID_1);

        vm.prank(outsider);
        vm.expectRevert("Wrong reviewer");
        platform.approveMilestone(campaignId, 1);

        uint256 creatorBalanceBeforeApprove = creator.balance;

        vm.prank(reviewerSafe);
        platform.approveMilestone(campaignId, 0);

        FundingPlatform.Campaign memory campaign = platform.getCampaign(campaignId);
        FundingPlatform.Milestone memory m0 = platform.getMilestone(campaignId, 0);
        FundingPlatform.Milestone memory m1 = platform.getMilestone(campaignId, 1);
        assertEq(
            uint256(m0.status),
            uint256(FundingPlatform.MilestoneStatus.Disbursed)
        );
        assertEq(
            uint256(campaign.status),
            uint256(FundingPlatform.CampaignStatus.InProgress)
        );
        assertEq(
            uint256(m1.status),
            uint256(FundingPlatform.MilestoneStatus.PendingVerification)
        );
        assertEq(creator.balance, creatorBalanceBeforeApprove + 0.7 ether);
    }

    function test_ApproveMilestone_RevertsWhenNoProofSubmitted() public {
        uint256 campaignId = _createApprovedDefaultCampaign();
        _fundCampaign(campaignId);

        vm.prank(reviewerSafe);
        vm.expectRevert("No proof submitted yet");
        platform.approveMilestone(campaignId, 0);
    }

    function test_ApproveMilestone_RevertsOnDuplicateApproval() public {
        uint256 campaignId = _createApprovedDefaultCampaign();
        _fundCampaign(campaignId);

        vm.prank(creator);
        platform.submitMilestoneProof(campaignId, 0, CID_1);

        vm.prank(reviewerSafe);
        platform.approveMilestone(campaignId, 0);

        vm.prank(creator);
        platform.submitMilestoneProof(campaignId, 1, CID_2);

        vm.prank(reviewerSafe);
        platform.approveMilestone(campaignId, 1);

        vm.prank(reviewerSafe);
        vm.expectRevert("Campaign not in progress");
        platform.approveMilestone(campaignId, 1);
    }

    function test_ApproveMilestone_AutoUnlocksNextMilestone() public {
        uint16[] memory bps = _threeMilestoneAllocationBps();
        uint256[] memory deadlines = _threeMilestoneDeadlines();
        uint256 campaignId = _createCampaign(bps, deadlines);
        _approveCampaign(campaignId);

        _fundCampaign(campaignId);

        vm.prank(creator);
        platform.submitMilestoneProof(campaignId, 0, CID_1);

        vm.prank(reviewerSafe);
        platform.approveMilestone(campaignId, 0);

        FundingPlatform.Campaign memory campaign = platform.getCampaign(campaignId);
        FundingPlatform.Milestone memory m0 = platform.getMilestone(campaignId, 0);
        FundingPlatform.Milestone memory m1 = platform.getMilestone(campaignId, 1);
        FundingPlatform.Milestone memory m2 = platform.getMilestone(campaignId, 2);

        assertEq(campaign.currentMilestoneId, 1);
        assertEq(
            uint256(campaign.status),
            uint256(FundingPlatform.CampaignStatus.InProgress)
        );
        assertEq(
            uint256(m0.status),
            uint256(FundingPlatform.MilestoneStatus.Disbursed)
        );
        assertEq(
            uint256(m1.status),
            uint256(FundingPlatform.MilestoneStatus.PendingVerification)
        );
        assertEq(
            uint256(m2.status),
            uint256(FundingPlatform.MilestoneStatus.PendingFunding)
        );
    }

    function test_SubmitMilestoneProof_TracksSubmissionCountAndLatestCid() public {
        uint256 campaignId = _createApprovedDefaultCampaign();
        _fundCampaign(campaignId);

        vm.expectEmit(true, true, false, true);
        emit FundingPlatform.MilestoneReportSubmitted(campaignId, 0, CID_1, creator, 1);

        vm.prank(creator);
        platform.submitMilestoneProof(campaignId, 0, CID_1);

        vm.expectEmit(true, true, false, true);
        emit FundingPlatform.MilestoneReportSubmitted(campaignId, 0, CID_2, creator, 2);

        vm.prank(creator);
        platform.submitMilestoneProof(campaignId, 0, CID_2);

        FundingPlatform.Milestone memory m0 = platform.getMilestone(campaignId, 0);
        assertEq(m0.proofSubmissionCount, 2);
        assertEq(m0.proofCids[0], CID_1);
        assertEq(m0.proofCids[m0.proofCids.length - 1], CID_2);
    }

    function test_MarkMilestoneFailed_IsPublic_NoCascade() public {
        uint256 campaignId = _createApprovedDefaultCampaign();
        _fundCampaign(campaignId);

        FundingPlatform.Milestone memory m0Before = platform.getMilestone(campaignId, 0);
        vm.warp(m0Before.deadline + 1);

        vm.prank(outsider);
        platform.markMilestoneFailed(campaignId, 0);

        FundingPlatform.Campaign memory campaign = platform.getCampaign(campaignId);
        FundingPlatform.Milestone memory m0 = platform.getMilestone(campaignId, 0);
        FundingPlatform.Milestone memory m1 = platform.getMilestone(campaignId, 1);

        assertEq(
            uint256(campaign.status),
            uint256(FundingPlatform.CampaignStatus.PartialFailed)
        );
        assertEq(
            uint256(m0.status),
            uint256(FundingPlatform.MilestoneStatus.Failed)
        );
        assertEq(
            uint256(m1.status),
            uint256(FundingPlatform.MilestoneStatus.PendingFunding)
        );
    }

    function test_MintCertificate_EmitsCertificateMinted() public {
        uint256 campaignId = _createApprovedDefaultCampaign();
        _fundCampaign(campaignId);

        vm.expectEmit(true, true, true, true);
        emit FundingPlatform.CertificateMinted(campaignId, donor, 1);

        vm.prank(donor);
        platform.mintCertificate(campaignId);

        uint256[] memory certs = platform.getCertificates(donor);
        assertEq(certs.length, 1);
        assertEq(platform.tokenToCampaign(certs[0]), campaignId);
    }

    function test_ClaimMilestoneRefund_UsesRemainingEthProRataShare() public {
        uint16[] memory bps = _threeMilestoneAllocationBps();
        uint256[] memory deadlines = _threeMilestoneDeadlines();
        uint256 campaignId = _createCampaign(bps, deadlines);
        _approveCampaign(campaignId);

        vm.prank(donor);
        platform.donate{value: 0.6 ether}(campaignId);
        vm.prank(donor2);
        platform.donate{value: 0.4 ether}(campaignId);

        FundingPlatform.Milestone memory m0 = platform.getMilestone(campaignId, 0);
        vm.warp(m0.deadline + 1);

        vm.prank(outsider);
        platform.markMilestoneFailed(campaignId, 0);

        uint256 donorBefore = donor.balance;
        uint256 donor2Before = donor2.balance;

        vm.prank(donor);
        platform.claimMilestoneRefund(campaignId, 0);

        vm.prank(donor2);
        platform.claimMilestoneRefund(campaignId, 0);

        // totalRaised = 1 ether
        // totalDisbursed after funding completion = milestone0 = 20% = 0.2 ether
        // remainingETH = 0.8 ether
        // donor(0.6) => 0.48 ether, donor2(0.4) => 0.32 ether
        assertEq(donor.balance, donorBefore + 0.48 ether);
        assertEq(donor2.balance, donor2Before + 0.32 ether);
    }

    function test_DisburseMilestone_RevertsInAutomaticDisbursementFlow() public {
        uint256 campaignId = _createApprovedDefaultCampaign();
        _fundCampaign(campaignId);

        vm.expectRevert("Disbursement handled in approveMilestone");
        platform.disburseMilestone(campaignId, 1);
    }

    // ══════════════════════════════════════════════════════════
    // DONATION EDGE CASES
    // ══════════════════════════════════════════════════════════

    function test_Donate_RevertsIfZeroValue() public {
        uint256 campaignId = _createApprovedDefaultCampaign();

        vm.prank(donor);
        vm.expectRevert("Donation must be > 0");
        platform.donate{value: 0}(campaignId);
    }

    function test_Donate_RevertsIfFundingDeadlinePassed() public {
        uint256 campaignId = _createApprovedDefaultCampaign();

        // Warp past the 7-day funding deadline
        vm.warp(block.timestamp + 8 days);

        vm.prank(donor);
        vm.expectRevert("Funding deadline passed");
        platform.donate{value: 1 ether}(campaignId);
    }

    function test_Donate_AccumulatesFromMultipleDonors() public {
        uint256 campaignId = _createApprovedDefaultCampaign();

        // Each donor donates 0.5 ETH → total 1 ETH = goal
        vm.prank(donor);
        platform.donate{value: 0.5 ether}(campaignId);

        vm.prank(donor2);
        platform.donate{value: 0.5 ether}(campaignId);

        FundingPlatform.Campaign memory campaign = platform.getCampaign(campaignId);
        assertEq(campaign.totalRaised, 1 ether);
        assertEq(
            uint256(campaign.status),
            uint256(FundingPlatform.CampaignStatus.InProgress)
        );
        assertEq(platform.getDonation(campaignId, donor), 0.5 ether);
        assertEq(platform.getDonation(campaignId, donor2), 0.5 ether);
    }

    function test_Donate_RevertsWhenCampaignAlreadyInProgress() public {
        uint256 campaignId = _createApprovedDefaultCampaign();
        _fundCampaign(campaignId); // goal met → status = InProgress

        vm.prank(donor2);
        vm.expectRevert("Campaign is not active");
        platform.donate{value: 1 ether}(campaignId);
    }

    // ══════════════════════════════════════════════════════════
    // CAMPAIGN CREATION VALIDATION
    // ══════════════════════════════════════════════════════════

    function test_CreateCampaign_RevertsIfFundingDeadlineInPast() public {
        uint16[] memory bps = _defaultAllocationBps();
        uint256[] memory deadlines = _defaultDeadlines();

        vm.prank(creator);
        vm.expectRevert("Invalid funding deadline");
        platform.createCampaignWithMilestones(
            bps,
            deadlines,
            block.timestamp - 1, // deadline in the past
            reviewerSafe
        );
    }

    function test_CreateCampaign_RevertsIfNoMilestones() public {
        uint16[] memory bps = new uint16[](0);
        uint256[] memory deadlines = new uint256[](0);

        vm.prank(creator);
        vm.expectRevert("At least one milestone is required");
        platform.createCampaignWithMilestones(
            bps,
            deadlines,
            block.timestamp + 7 days,
            reviewerSafe
        );
    }

    function test_CreateCampaign_RevertsIfMilestoneDeadlineBeforeFundingDeadline() public {
        uint16[] memory bps = _defaultAllocationBps();
        uint256[] memory deadlines = new uint256[](2);
        uint256 fundingDeadline = block.timestamp + 7 days;
        deadlines[0] = block.timestamp + 3 days; // BEFORE funding deadline
        deadlines[1] = block.timestamp + 30 days;

        vm.prank(creator);
        vm.expectRevert("Milestone deadline must be after funding deadline");
        platform.createCampaignWithMilestones(
            bps,
            deadlines,
            fundingDeadline,
            reviewerSafe
        );
    }

    function test_CreateCampaign_RevertsIfReviewerNotApproved() public {
        uint16[] memory bps = _defaultAllocationBps();
        uint256[] memory deadlines = _defaultDeadlines();
        address unapprovedReviewer = makeAddr("unapprovedReviewer");

        vm.prank(creator);
        vm.expectRevert("Reviewer not approved");
        platform.createCampaignWithMilestones(
            bps,
            deadlines,
            block.timestamp + 7 days,
            unapprovedReviewer
        );
    }

    function test_CreateCampaignWithGoal_SetsCorrectGoal() public {
        uint16[] memory bps = _defaultAllocationBps();
        uint256[] memory deadlines = _defaultDeadlines();
        uint256 customGoal = 2 ether;

        vm.prank(creator);
        uint256 campaignId = platform.createCampaignWithGoal(
            customGoal,
            bps,
            deadlines,
            block.timestamp + 7 days,
            reviewerSafe
        );

        FundingPlatform.Campaign memory campaign = platform.getCampaign(campaignId);
        assertEq(campaign.goal, customGoal);
    }

    // ══════════════════════════════════════════════════════════
    // CAMPAIGN FAILURE (markCampaignFailed)
    // ══════════════════════════════════════════════════════════

    function test_MarkCampaignFailed_WhenDeadlinePassedAndUnderGoal() public {
        uint256 campaignId = _createApprovedDefaultCampaign();

        // Donate partial amount
        vm.prank(donor);
        platform.donate{value: 0.5 ether}(campaignId);

        // Warp past funding deadline
        vm.warp(block.timestamp + 8 days);

        vm.prank(outsider);
        platform.markCampaignFailed(campaignId);

        FundingPlatform.Campaign memory campaign = platform.getCampaign(campaignId);
        assertEq(
            uint256(campaign.status),
            uint256(FundingPlatform.CampaignStatus.Failed)
        );
    }

    function test_MarkCampaignFailed_RevertsIfGoalAlreadyReached() public {
        uint256 campaignId = _createApprovedDefaultCampaign();
        _fundCampaign(campaignId); // goal reached → InProgress

        vm.warp(block.timestamp + 8 days);

        vm.prank(outsider);
        vm.expectRevert("Campaign is not active");
        platform.markCampaignFailed(campaignId);
    }

    function test_MarkCampaignFailed_RevertsBeforeDeadline() public {
        uint256 campaignId = _createApprovedDefaultCampaign();

        vm.prank(donor);
        platform.donate{value: 0.5 ether}(campaignId);

        // Still before funding deadline
        vm.prank(outsider);
        vm.expectRevert("Funding deadline not reached");
        platform.markCampaignFailed(campaignId);
    }

    // ══════════════════════════════════════════════════════════
    // FUNDING REFUND (claimFundingRefund)
    // ══════════════════════════════════════════════════════════

    function test_ClaimFundingRefund_ReturnsFullAmountToEachDonor() public {
        uint256 campaignId = _createApprovedDefaultCampaign();

        vm.prank(donor);
        platform.donate{value: 0.6 ether}(campaignId);
        vm.prank(donor2);
        platform.donate{value: 0.3 ether}(campaignId);

        // Fail the campaign
        vm.warp(block.timestamp + 8 days);
        platform.markCampaignFailed(campaignId);

        uint256 donorBefore = donor.balance;
        uint256 donor2Before = donor2.balance;

        vm.prank(donor);
        platform.claimFundingRefund(campaignId);
        vm.prank(donor2);
        platform.claimFundingRefund(campaignId);

        assertEq(donor.balance, donorBefore + 0.6 ether);
        assertEq(donor2.balance, donor2Before + 0.3 ether);
    }

    function test_ClaimFundingRefund_RevertsIfAlreadyClaimed() public {
        uint256 campaignId = _createApprovedDefaultCampaign();

        vm.prank(donor);
        platform.donate{value: 0.5 ether}(campaignId);

        vm.warp(block.timestamp + 8 days);
        platform.markCampaignFailed(campaignId);

        vm.prank(donor);
        platform.claimFundingRefund(campaignId);

        // Try to claim again
        vm.prank(donor);
        vm.expectRevert("Nothing to refund");
        platform.claimFundingRefund(campaignId);
    }

    function test_ClaimFundingRefund_RevertsIfNotDonor() public {
        uint256 campaignId = _createApprovedDefaultCampaign();

        vm.prank(donor);
        platform.donate{value: 0.5 ether}(campaignId);

        vm.warp(block.timestamp + 8 days);
        platform.markCampaignFailed(campaignId);

        // Outsider (never donated) tries to claim
        vm.prank(outsider);
        vm.expectRevert("Nothing to refund");
        platform.claimFundingRefund(campaignId);
    }

    // ══════════════════════════════════════════════════════════
    // MILESTONE REFUND EDGE CASES
    // ══════════════════════════════════════════════════════════

    function test_ClaimMilestoneRefund_RevertsIfAlreadyClaimed() public {
        uint256 campaignId = _createApprovedDefaultCampaign();
        _fundCampaign(campaignId);

        FundingPlatform.Milestone memory m0 = platform.getMilestone(campaignId, 0);
        vm.warp(m0.deadline + 1);
        platform.markMilestoneFailed(campaignId, 0);

        vm.prank(donor);
        platform.claimMilestoneRefund(campaignId, 0);

        // Second claim must revert
        vm.prank(donor);
        vm.expectRevert("Refund already claimed");
        platform.claimMilestoneRefund(campaignId, 0);
    }

    function test_ClaimMilestoneRefund_RevertsIfNotDonor() public {
        uint256 campaignId = _createApprovedDefaultCampaign();
        _fundCampaign(campaignId);

        FundingPlatform.Milestone memory m0 = platform.getMilestone(campaignId, 0);
        vm.warp(m0.deadline + 1);
        platform.markMilestoneFailed(campaignId, 0);

        // Outsider never donated
        vm.prank(outsider);
        vm.expectRevert("No donation to refund");
        platform.claimMilestoneRefund(campaignId, 0);
    }

    function test_ClaimMilestoneRefund_ProRataWith3Donors() public {
        uint16[] memory bps = _threeMilestoneAllocationBps();
        uint256[] memory deadlines = _threeMilestoneDeadlines();
        uint256 campaignId = _createCampaign(bps, deadlines);
        _approveCampaign(campaignId);

        address donor3 = makeAddr("donor3");
        vm.deal(donor3, 10 ether);

        // 3 donors contributing 50%, 30%, 20%
        vm.prank(donor);  platform.donate{value: 0.5 ether}(campaignId);
        vm.prank(donor2); platform.donate{value: 0.3 ether}(campaignId);
        vm.prank(donor3); platform.donate{value: 0.2 ether}(campaignId);

        // Fail milestone 0
        FundingPlatform.Milestone memory m0 = platform.getMilestone(campaignId, 0);
        vm.warp(m0.deadline + 1);
        platform.markMilestoneFailed(campaignId, 0);

        uint256 d1Before = donor.balance;
        uint256 d2Before = donor2.balance;
        uint256 d3Before = donor3.balance;

        vm.prank(donor);  platform.claimMilestoneRefund(campaignId, 0);
        vm.prank(donor2); platform.claimMilestoneRefund(campaignId, 0);
        vm.prank(donor3); platform.claimMilestoneRefund(campaignId, 0);

        // totalRaised = 1 ether, m0 auto-disbursed 20% = 0.2 ether → remaining = 0.8 ether
        // donor(50%) → 0.4, donor2(30%) → 0.24, donor3(20%) → 0.16
        assertEq(donor.balance,  d1Before + 0.4 ether);
        assertEq(donor2.balance, d2Before + 0.24 ether);
        assertEq(donor3.balance, d3Before + 0.16 ether);
    }

    // ══════════════════════════════════════════════════════════
    // CERTIFICATE NFT EDGE CASES
    // ══════════════════════════════════════════════════════════

    function test_MintCertificate_RevertsIfNotDonor() public {
        uint256 campaignId = _createApprovedDefaultCampaign();
        _fundCampaign(campaignId);

        vm.prank(outsider); // never donated
        vm.expectRevert("You have not donated");
        platform.mintCertificate(campaignId);
    }

    function test_MintCertificate_RevertsIfDuplicateMint() public {
        uint256 campaignId = _createApprovedDefaultCampaign();
        _fundCampaign(campaignId);

        vm.prank(donor);
        platform.mintCertificate(campaignId);

        vm.prank(donor);
        vm.expectRevert("Certificate already minted");
        platform.mintCertificate(campaignId);
    }

    function test_MintCertificate_RevertsIfCampaignNotStarted() public {
        uint256 campaignId = _createApprovedDefaultCampaign();
        // Campaign is Active (funded partially), not InProgress

        vm.prank(donor);
        vm.expectRevert("Certificate not available yet");
        platform.mintCertificate(campaignId);
    }

    function test_GetCertificates_ReturnsAllTokenIds() public {
        uint256 campaignId = _createApprovedDefaultCampaign();
        _fundCampaign(campaignId);

        vm.prank(donor);
        platform.mintCertificate(campaignId);

        uint256[] memory certs = platform.getCertificates(donor);
        assertEq(certs.length, 1);
        assertEq(platform.tokenToCampaign(certs[0]), campaignId);
    }

    // ══════════════════════════════════════════════════════════
    // SAFE REVIEWER PERMISSIONS
    // ══════════════════════════════════════════════════════════

    function test_AddReviewerSafe_RevertsIfNotAdmin() public {
        address newSafe = makeAddr("newSafe");

        vm.prank(outsider);
        vm.expectRevert();
        platform.addReviewerSafe(newSafe);
    }

    function test_AddReviewerSafe_RevertsIfAlreadyApproved() public {
        vm.expectRevert("Reviewer already approved");
        platform.addReviewerSafe(reviewerSafe); // already added in setUp
    }

    function test_ReviewerSafe_CanApproveMilestone() public {
        uint256 campaignId = _createApprovedDefaultCampaign();
        _fundCampaign(campaignId);

        vm.prank(creator);
        platform.submitMilestoneProof(campaignId, 0, CID_1);

        // Only the campaign-specific reviewer safe should work
        vm.prank(reviewerSafe);
        platform.approveMilestone(campaignId, 0);

        assertEq(
            uint256(platform.getMilestone(campaignId, 0).status),
            uint256(FundingPlatform.MilestoneStatus.Disbursed)
        );
    }

    function test_WrongReviewerSafe_CannotApproveMilestone() public {
        uint256 campaignId = _createApprovedDefaultCampaign();
        _fundCampaign(campaignId);

        vm.prank(creator);
        platform.submitMilestoneProof(campaignId, 0, CID_1);

        // Create a second (different) approved safe
        MockSafe safe2 = new MockSafe();
        platform.addReviewerSafe(address(safe2));

        // safe2 is approved globally but NOT this campaign's reviewer
        vm.prank(address(safe2));
        vm.expectRevert("Wrong reviewer");
        platform.approveMilestone(campaignId, 0);
    }
}
