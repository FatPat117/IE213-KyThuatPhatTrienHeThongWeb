// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {FundingPlatform} from "../src/FundingPlatform.sol";

contract FundingPlatformTest is Test {
    FundingPlatform public platform;

    // ACTORS

    address public admin = makeAddr("admin");
    address public creator = makeAddr("creator");
    address public beneficiary = makeAddr("beneficiary");
    address public donor1 = makeAddr("donor1");
    address public donor2 = makeAddr("donor2");
    address public reviewer = makeAddr("reviewer");
    address public stranger = makeAddr("stranger");

    // SHARED CONSTANTS

    uint256 public constant FUNDING_DURATION = 30; // days
    uint256 public constant M1_FUND = 0.4 ether;
    uint256 public constant M2_FUND = 0.6 ether;
    uint256 public constant GOAL = M1_FUND + M2_FUND; // 1 ether total

    // Milestone execution deadlines (days after funding deadline)
    uint256 public constant M1_DURATION = 60;
    uint256 public constant M2_DURATION = 90;

    string public constant IPFS_CID_1 = "QmMilestone1ProofHash";
    string public constant IPFS_CID_2 = "QmMilestone2ProofHash";

    // SETUP

    function setUp() public {
        vm.prank(admin);
        platform = new FundingPlatform();

        vm.deal(donor1, 10 ether);
        vm.deal(donor2, 10 ether);
        vm.deal(stranger, 10 ether);

        // Register a reviewer (done by admin)
        vm.prank(admin);
        platform.addReviewer(reviewer, "SchoolBuildingReviewer");
    }

    // HELPERS

    /// @dev Creates a campaign with 2 milestones. Returns campaignId.
    function _createDefaultCampaign() internal returns (uint256) {
        FundingPlatform.MilestoneInput[]
            memory ms = new FundingPlatform.MilestoneInput[](2);
        ms[0] = FundingPlatform.MilestoneInput({
            title: "Foundation",
            description: "Lay the foundation",
            fundAmount: M1_FUND,
            durationDays: M1_DURATION
        });
        ms[1] = FundingPlatform.MilestoneInput({
            title: "Structure",
            description: "Build the walls and roof",
            fundAmount: M2_FUND,
            durationDays: M2_DURATION
        });

        vm.prank(creator);
        return platform.createCampaign(beneficiary, FUNDING_DURATION, ms);
    }

    /// @dev Funds campaign to goal using donor1.
    function _fundCampaign(uint256 campaignId) internal {
        vm.prank(donor1);
        platform.donate{value: GOAL}(campaignId);
    }

    /// @dev Funds campaign + starts execution (Active → FundingComplete → InProgress).
    function _fundAndStart(uint256 campaignId) internal {
        _fundCampaign(campaignId);
        vm.prank(creator);
        platform.startExecution(campaignId);
    }

    /// @dev Full happy path for one milestone: submit proof → approve → disburse.
    function _completeMilestone(
        uint256 campaignId,
        uint256 milestoneId,
        string memory cid
    ) internal {
        vm.prank(creator);
        platform.submitMilestoneProof(campaignId, milestoneId, cid);

        vm.prank(reviewer);
        platform.approveMilestone(campaignId, milestoneId);

        platform.disburseMilestone(campaignId, milestoneId); // permissionless
    }

    // TEST: createCampaign

    function test_CreateCampaign_Success() public {
        uint256 cId = _createDefaultCampaign();

        assertEq(cId, 1);
        assertEq(platform.campaignCount(), 1);

        FundingPlatform.Campaign memory c = platform.getCampaign(1);
        assertEq(c.id, 1);
        assertEq(c.creator, creator);
        assertEq(c.beneficiary, beneficiary);
        assertEq(c.goal, GOAL);
        assertEq(c.totalRaised, 0);
        assertEq(c.milestoneCount, 2);
        assertEq(
            uint256(c.status),
            uint256(FundingPlatform.CampaignStatus.Active)
        );
    }

    function test_CreateCampaign_MilestonesStoredCorrectly() public {
        uint256 cId = _createDefaultCampaign();

        FundingPlatform.Milestone memory m1 = platform.getMilestone(cId, 1);
        FundingPlatform.Milestone memory m2 = platform.getMilestone(cId, 2);

        assertEq(m1.id, 1);
        assertEq(m1.fundAmount, M1_FUND);
        assertEq(
            uint256(m1.status),
            uint256(FundingPlatform.MilestoneStatus.PendingFunding)
        );

        assertEq(m2.id, 2);
        assertEq(m2.fundAmount, M2_FUND);
        assertEq(
            uint256(m2.status),
            uint256(FundingPlatform.MilestoneStatus.PendingFunding)
        );
    }

    function test_CreateCampaign_GoalEqualsSumOfMilestoneFunds() public {
        uint256 cId = _createDefaultCampaign();
        FundingPlatform.Campaign memory c = platform.getCampaign(cId);
        assertEq(c.goal, M1_FUND + M2_FUND);
    }

    function test_CreateCampaign_EmitEvent() public {
        FundingPlatform.MilestoneInput[]
            memory ms = new FundingPlatform.MilestoneInput[](1);
        ms[0] = FundingPlatform.MilestoneInput({
            title: "Phase 1",
            description: "desc",
            fundAmount: 1 ether,
            durationDays: 60
        });

        uint256 expectedDeadline = block.timestamp + FUNDING_DURATION * 1 days;

        vm.expectEmit(true, true, false, true);
        emit FundingPlatform.CampaignCreated(
            1,
            creator,
            beneficiary,
            1 ether,
            expectedDeadline,
            1
        );

        vm.prank(creator);
        platform.createCampaign(beneficiary, FUNDING_DURATION, ms);
    }

    function test_CreateCampaign_Revert_InvalidBeneficiary() public {
        FundingPlatform.MilestoneInput[]
            memory ms = new FundingPlatform.MilestoneInput[](1);
        ms[0] = FundingPlatform.MilestoneInput({
            title: "t",
            description: "d",
            fundAmount: 1 ether,
            durationDays: 30
        });

        vm.prank(creator);
        vm.expectRevert("Invalid beneficiary");
        platform.createCampaign(address(0), FUNDING_DURATION, ms);
    }

    function test_CreateCampaign_Revert_InvalidDuration() public {
        FundingPlatform.MilestoneInput[]
            memory ms = new FundingPlatform.MilestoneInput[](1);
        ms[0] = FundingPlatform.MilestoneInput({
            title: "t",
            description: "d",
            fundAmount: 1 ether,
            durationDays: 30
        });

        vm.prank(creator);
        vm.expectRevert("Duration must be 1-365 days");
        platform.createCampaign(beneficiary, 0, ms);

        vm.prank(creator);
        vm.expectRevert("Duration must be 1-365 days");
        platform.createCampaign(beneficiary, 366, ms);
    }

    function test_CreateCampaign_Revert_NoMilestones() public {
        FundingPlatform.MilestoneInput[]
            memory ms = new FundingPlatform.MilestoneInput[](0);

        vm.prank(creator);
        vm.expectRevert("Must have at least one milestone");
        platform.createCampaign(beneficiary, FUNDING_DURATION, ms);
    }

    function test_CreateCampaign_Revert_ZeroMilestoneFund() public {
        FundingPlatform.MilestoneInput[]
            memory ms = new FundingPlatform.MilestoneInput[](1);
        ms[0] = FundingPlatform.MilestoneInput({
            title: "t",
            description: "d",
            fundAmount: 0,
            durationDays: 30
        });

        vm.prank(creator);
        vm.expectRevert("Milestone fund must be > 0");
        platform.createCampaign(beneficiary, FUNDING_DURATION, ms);
    }

    // TEST: donate

    function test_Donate_Success() public {
        uint256 cId = _createDefaultCampaign();

        vm.prank(donor1);
        platform.donate{value: 0.3 ether}(cId);

        assertEq(platform.getDonation(cId, donor1), 0.3 ether);
        assertEq(platform.getCampaign(cId).totalRaised, 0.3 ether);
    }

    function test_Donate_MultipleDonors() public {
        uint256 cId = _createDefaultCampaign();

        vm.prank(donor1);
        platform.donate{value: 0.3 ether}(cId);
        vm.prank(donor2);
        platform.donate{value: 0.4 ether}(cId);

        assertEq(platform.getCampaign(cId).totalRaised, 0.7 ether);
    }

    function test_Donate_TransitionToFundingComplete_WhenGoalReached() public {
        uint256 cId = _createDefaultCampaign();

        vm.prank(donor1);
        platform.donate{value: GOAL}(cId);

        assertEq(
            uint256(platform.getCampaign(cId).status),
            uint256(FundingPlatform.CampaignStatus.FundingComplete)
        );
    }

    function test_Donate_EmitFundingCompleteEvent() public {
        uint256 cId = _createDefaultCampaign();

        vm.expectEmit(true, false, false, true);
        emit FundingPlatform.FundingComplete(cId, GOAL);

        vm.prank(donor1);
        platform.donate{value: GOAL}(cId);
    }

    function test_Donate_Revert_AfterDeadline() public {
        uint256 cId = _createDefaultCampaign();
        vm.warp(block.timestamp + FUNDING_DURATION * 1 days + 1);

        vm.prank(donor1);
        vm.expectRevert("Funding deadline passed");
        platform.donate{value: 0.1 ether}(cId);
    }

    function test_Donate_Revert_ZeroValue() public {
        uint256 cId = _createDefaultCampaign();

        vm.prank(donor1);
        vm.expectRevert("Donation must be > 0");
        platform.donate{value: 0}(cId);
    }

    function test_Donate_Revert_AfterFundingComplete() public {
        uint256 cId = _createDefaultCampaign();
        _fundCampaign(cId); // status → FundingComplete

        vm.prank(donor2);
        vm.expectRevert("Campaign is not in funding phase");
        platform.donate{value: 0.1 ether}(cId);
    }

    function test_Donate_Revert_InvalidCampaign() public {
        vm.prank(donor1);
        vm.expectRevert("Campaign does not exist");
        platform.donate{value: 0.1 ether}(999);
    }

    // TEST: startExecution

    function test_StartExecution_Success() public {
        uint256 cId = _createDefaultCampaign();
        _fundCampaign(cId);

        vm.prank(creator);
        platform.startExecution(cId);

        assertEq(
            uint256(platform.getCampaign(cId).status),
            uint256(FundingPlatform.CampaignStatus.InProgress)
        );

        // Only milestone 1 should be unlocked
        assertEq(
            uint256(platform.getMilestone(cId, 1).status),
            uint256(FundingPlatform.MilestoneStatus.PendingVerification)
        );
        // Milestone 2 still pending funding
        assertEq(
            uint256(platform.getMilestone(cId, 2).status),
            uint256(FundingPlatform.MilestoneStatus.PendingFunding)
        );
    }

    function test_StartExecution_Revert_NotFundingComplete() public {
        uint256 cId = _createDefaultCampaign(); // still Active

        vm.prank(creator);
        vm.expectRevert("Campaign not in FundingComplete");
        platform.startExecution(cId);
    }

    function test_StartExecution_Revert_NotCreator() public {
        uint256 cId = _createDefaultCampaign();
        _fundCampaign(cId);

        vm.prank(stranger);
        vm.expectRevert("Not campaign creator");
        platform.startExecution(cId);
    }

    // TEST: submitMilestoneProof

    function test_SubmitProof_Success() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);

        vm.prank(creator);
        platform.submitMilestoneProof(cId, 1, IPFS_CID_1);

        assertEq(platform.getMilestone(cId, 1).proofIpfsCid, IPFS_CID_1);
    }

    function test_SubmitProof_EmitEvent() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);

        vm.expectEmit(true, true, false, true);
        emit FundingPlatform.MilestoneReportSubmitted(
            cId,
            1,
            IPFS_CID_1,
            creator
        );

        vm.prank(creator);
        platform.submitMilestoneProof(cId, 1, IPFS_CID_1);
    }

    function test_SubmitProof_Revert_NotCreator() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);

        vm.prank(stranger);
        vm.expectRevert("Not campaign creator");
        platform.submitMilestoneProof(cId, 1, IPFS_CID_1);
    }

    function test_SubmitProof_Revert_EmptyCid() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);

        vm.prank(creator);
        vm.expectRevert("IPFS CID cannot be empty");
        platform.submitMilestoneProof(cId, 1, "");
    }

    function test_SubmitProof_Revert_CampaignNotInProgress() public {
        uint256 cId = _createDefaultCampaign();
        _fundCampaign(cId); // FundingComplete, not InProgress yet

        vm.prank(creator);
        vm.expectRevert("Campaign not in progress");
        platform.submitMilestoneProof(cId, 1, IPFS_CID_1);
    }

    function test_SubmitProof_Revert_MilestoneNotUnlocked() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);

        // Milestone 2 is still PendingFunding, not PendingVerification
        vm.prank(creator);
        vm.expectRevert("Milestone not awaiting proof");
        platform.submitMilestoneProof(cId, 2, IPFS_CID_2);
    }

    function test_SubmitProof_Revert_AfterMilestoneDeadline() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);

        // Warp past milestone 1 deadline
        FundingPlatform.Milestone memory m = platform.getMilestone(cId, 1);
        vm.warp(m.deadline + 1);

        vm.prank(creator);
        vm.expectRevert("Milestone deadline has passed");
        platform.submitMilestoneProof(cId, 1, IPFS_CID_1);
    }

    // TEST: approveMilestone

    function test_ApproveMilestone_Success() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);

        vm.prank(creator);
        platform.submitMilestoneProof(cId, 1, IPFS_CID_1);

        vm.prank(reviewer);
        platform.approveMilestone(cId, 1);

        assertEq(
            uint256(platform.getMilestone(cId, 1).status),
            uint256(FundingPlatform.MilestoneStatus.Approved)
        );
    }

    function test_ApproveMilestone_EmitEvent() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);

        vm.prank(creator);
        platform.submitMilestoneProof(cId, 1, IPFS_CID_1);

        vm.expectEmit(true, true, true, false);
        emit FundingPlatform.MilestoneApproved(cId, 1, reviewer);

        vm.prank(reviewer);
        platform.approveMilestone(cId, 1);
    }

    function test_ApproveMilestone_Revert_NotReviewer() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);

        vm.prank(creator);
        platform.submitMilestoneProof(cId, 1, IPFS_CID_1);

        vm.prank(stranger);
        vm.expectRevert("Not an active reviewer");
        platform.approveMilestone(cId, 1);
    }

    function test_ApproveMilestone_Revert_NoProofSubmitted() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);
        // Proof not submitted yet

        vm.prank(reviewer);
        vm.expectRevert("No proof submitted yet");
        platform.approveMilestone(cId, 1);
    }

    function test_ApproveMilestone_Revert_WrongStatus() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);

        vm.prank(creator);
        platform.submitMilestoneProof(cId, 1, IPFS_CID_1);

        vm.prank(reviewer);
        platform.approveMilestone(cId, 1); // Approve once

        // Try to approve again
        vm.prank(reviewer);
        vm.expectRevert("Milestone not pending verification");
        platform.approveMilestone(cId, 1);
    }

    // TEST: disburseMilestone

    function test_DisburseMilestone_Success_TransfersFunds() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);

        uint256 balanceBefore = beneficiary.balance;

        _completeMilestone(cId, 1, IPFS_CID_1);

        assertEq(beneficiary.balance, balanceBefore + M1_FUND);
        assertEq(
            uint256(platform.getMilestone(cId, 1).status),
            uint256(FundingPlatform.MilestoneStatus.Disbursed)
        );
    }

    function test_DisburseMilestone_UnlocksNextMilestone() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);

        _completeMilestone(cId, 1, IPFS_CID_1);

        // Milestone 2 should now be PendingVerification
        assertEq(
            uint256(platform.getMilestone(cId, 2).status),
            uint256(FundingPlatform.MilestoneStatus.PendingVerification)
        );
    }

    function test_DisburseMilestone_LastMilestone_SetsCompleted() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);

        _completeMilestone(cId, 1, IPFS_CID_1);
        _completeMilestone(cId, 2, IPFS_CID_2);

        assertEq(
            uint256(platform.getCampaign(cId).status),
            uint256(FundingPlatform.CampaignStatus.Completed)
        );
    }

    function test_DisburseMilestone_EmitEvent() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);

        vm.prank(creator);
        platform.submitMilestoneProof(cId, 1, IPFS_CID_1);
        vm.prank(reviewer);
        platform.approveMilestone(cId, 1);

        vm.expectEmit(true, true, false, true);
        emit FundingPlatform.MilestoneDisbursed(cId, 1, beneficiary, M1_FUND);

        platform.disburseMilestone(cId, 1);
    }

    function test_DisburseMilestone_Revert_NotApproved() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);

        vm.expectRevert("Milestone not approved");
        platform.disburseMilestone(cId, 1);
    }

    function test_DisburseMilestone_IsPermissionless() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);

        vm.prank(creator);
        platform.submitMilestoneProof(cId, 1, IPFS_CID_1);
        vm.prank(reviewer);
        platform.approveMilestone(cId, 1);

        // Stranger can trigger disbursement (permissionless)
        vm.prank(stranger);
        platform.disburseMilestone(cId, 1);

        assertEq(
            uint256(platform.getMilestone(cId, 1).status),
            uint256(FundingPlatform.MilestoneStatus.Disbursed)
        );
    }

    // TEST: markMilestoneFailed

    function test_MarkMilestoneFailed_ByReviewer() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);

        vm.prank(creator);
        platform.submitMilestoneProof(cId, 1, IPFS_CID_1);

        vm.prank(reviewer);
        platform.markMilestoneFailed(cId, 1);

        assertEq(
            uint256(platform.getMilestone(cId, 1).status),
            uint256(FundingPlatform.MilestoneStatus.Failed)
        );
    }

    function test_MarkMilestoneFailed_ByAdmin() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);

        vm.prank(creator);
        platform.submitMilestoneProof(cId, 1, IPFS_CID_1);

        vm.prank(admin);
        platform.markMilestoneFailed(cId, 1);

        assertEq(
            uint256(platform.getMilestone(cId, 1).status),
            uint256(FundingPlatform.MilestoneStatus.Failed)
        );
    }

    function test_MarkMilestoneFailed_EmitEvent() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);

        vm.prank(creator);
        platform.submitMilestoneProof(cId, 1, IPFS_CID_1);

        vm.expectEmit(true, true, false, true);
        emit FundingPlatform.MilestoneFailed(cId, 1, reviewer);

        vm.prank(reviewer);
        platform.markMilestoneFailed(cId, 1);
    }

    function test_MarkMilestoneFailed_AllFailed_SetsCampaignFailed() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);

        // Fail milestone 1
        vm.prank(creator);
        platform.submitMilestoneProof(cId, 1, IPFS_CID_1);
        vm.prank(reviewer);
        platform.markMilestoneFailed(cId, 1);

        // After M1 fails, M2 is NOT automatically unlocked because _evaluateCampaignCompletion
        // sees 1 failed + 1 pendingFunding = not all done → still InProgress.
        // To test all-failed, we need a single-milestone campaign.
        // See test_MarkMilestoneFailed_SingleMilestone_SetsCampaignFailed below.
        assertEq(
            uint256(platform.getCampaign(cId).status),
            uint256(FundingPlatform.CampaignStatus.InProgress)
        );
    }

    function test_MarkMilestoneFailed_SingleMilestone_SetsCampaignFailed()
        public
    {
        // Create campaign with 1 milestone
        FundingPlatform.MilestoneInput[]
            memory ms = new FundingPlatform.MilestoneInput[](1);
        ms[0] = FundingPlatform.MilestoneInput({
            title: "Only phase",
            description: "desc",
            fundAmount: 1 ether,
            durationDays: 60
        });

        vm.prank(creator);
        uint256 cId = platform.createCampaign(
            beneficiary,
            FUNDING_DURATION,
            ms
        );

        vm.prank(donor1);
        platform.donate{value: 1 ether}(cId);
        vm.prank(creator);
        platform.startExecution(cId);

        vm.prank(creator);
        platform.submitMilestoneProof(cId, 1, IPFS_CID_1);

        vm.prank(reviewer);
        platform.markMilestoneFailed(cId, 1);

        assertEq(
            uint256(platform.getCampaign(cId).status),
            uint256(FundingPlatform.CampaignStatus.Failed)
        );
    }

    function test_MarkMilestoneFailed_Revert_NotReviewerOrAdmin() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);

        vm.prank(creator);
        platform.submitMilestoneProof(cId, 1, IPFS_CID_1);

        vm.prank(stranger);
        vm.expectRevert("Not a reviewer or admin");
        platform.markMilestoneFailed(cId, 1);
    }

    function test_MarkMilestoneFailed_Revert_WrongMilestoneStatus() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);
        // Milestone 1 is PendingVerification but no proof yet — fine to fail.
        // Milestone 2 is PendingFunding — should revert.

        vm.prank(reviewer);
        vm.expectRevert("Milestone not pending verification");
        platform.markMilestoneFailed(cId, 2);
    }

    // TEST: PartialFailure campaign status

    function test_PartialFailure_Status_WhenMixedOutcomes() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);

        // Complete milestone 1 successfully
        _completeMilestone(cId, 1, IPFS_CID_1);

        // Milestone 2 is now PendingVerification; submit proof then fail it
        vm.prank(creator);
        platform.submitMilestoneProof(cId, 2, IPFS_CID_2);
        vm.prank(reviewer);
        platform.markMilestoneFailed(cId, 2);

        assertEq(
            uint256(platform.getCampaign(cId).status),
            uint256(FundingPlatform.CampaignStatus.PartialFailure)
        );
    }

    // TEST: claimMilestoneRefund

    function test_ClaimMilestoneRefund_Success_ProRata() public {
        uint256 cId = _createDefaultCampaign();

        // Two donors: donor1 = 0.6 ether, donor2 = 0.4 ether → total = 1 ether
        vm.prank(donor1);
        platform.donate{value: 0.6 ether}(cId);
        vm.prank(donor2);
        platform.donate{value: 0.4 ether}(cId);

        vm.prank(creator);
        platform.startExecution(cId);

        vm.prank(creator);
        platform.submitMilestoneProof(cId, 1, IPFS_CID_1);
        vm.prank(reviewer);
        platform.markMilestoneFailed(cId, 1);

        uint256 d1Before = donor1.balance;
        uint256 d2Before = donor2.balance;

        vm.prank(donor1);
        platform.claimMilestoneRefund(cId, 1);
        vm.prank(donor2);
        platform.claimMilestoneRefund(cId, 1);

        // M1_FUND = 0.4 ether
        // donor1 refund = (0.6 / 1.0) * 0.4 = 0.24 ether
        // donor2 refund = (0.4 / 1.0) * 0.4 = 0.16 ether
        assertEq(donor1.balance, d1Before + 0.24 ether);
        assertEq(donor2.balance, d2Before + 0.16 ether);
    }

    function test_ClaimMilestoneRefund_EmitEvent() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);

        vm.prank(creator);
        platform.submitMilestoneProof(cId, 1, IPFS_CID_1);
        vm.prank(reviewer);
        platform.markMilestoneFailed(cId, 1);

        // donor1 donated GOAL (1 ether), so refund = (1/1) * M1_FUND = 0.4 ether
        vm.expectEmit(true, true, true, true);
        emit FundingPlatform.MilestoneRefunded(cId, 1, donor1, M1_FUND);

        vm.prank(donor1);
        platform.claimMilestoneRefund(cId, 1);
    }

    function test_ClaimMilestoneRefund_Revert_DoubleClaimSameDonor() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);

        vm.prank(creator);
        platform.submitMilestoneProof(cId, 1, IPFS_CID_1);
        vm.prank(reviewer);
        platform.markMilestoneFailed(cId, 1);

        vm.prank(donor1);
        platform.claimMilestoneRefund(cId, 1);

        vm.prank(donor1);
        vm.expectRevert("Refund already claimed");
        platform.claimMilestoneRefund(cId, 1);
    }

    function test_ClaimMilestoneRefund_Revert_MilestoneNotFailed() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);

        vm.prank(donor1);
        vm.expectRevert("Milestone not failed");
        platform.claimMilestoneRefund(cId, 1);
    }

    function test_ClaimMilestoneRefund_Revert_NoDonation() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);

        vm.prank(creator);
        platform.submitMilestoneProof(cId, 1, IPFS_CID_1);
        vm.prank(reviewer);
        platform.markMilestoneFailed(cId, 1);

        vm.prank(stranger);
        vm.expectRevert("No donation to refund");
        platform.claimMilestoneRefund(cId, 1);
    }

    // TEST: markCampaignFailed + claimFundingRefund

    function test_MarkCampaignFailed_Success() public {
        uint256 cId = _createDefaultCampaign();

        vm.prank(donor1);
        platform.donate{value: 0.3 ether}(cId); // below goal

        vm.warp(block.timestamp + FUNDING_DURATION * 1 days + 1);
        platform.markCampaignFailed(cId); // permissionless

        assertEq(
            uint256(platform.getCampaign(cId).status),
            uint256(FundingPlatform.CampaignStatus.Failed)
        );
    }

    function test_MarkCampaignFailed_Revert_BeforeDeadline() public {
        uint256 cId = _createDefaultCampaign();

        vm.expectRevert("Funding deadline not reached");
        platform.markCampaignFailed(cId);
    }

    function test_MarkCampaignFailed_Revert_GoalAlreadyReached() public {
        uint256 cId = _createDefaultCampaign();
        _fundCampaign(cId); // status → FundingComplete

        vm.warp(block.timestamp + FUNDING_DURATION * 1 days + 1);

        vm.expectRevert("Campaign is not active");
        platform.markCampaignFailed(cId);
    }

    function test_ClaimFundingRefund_Success() public {
        uint256 cId = _createDefaultCampaign();

        vm.prank(donor1);
        platform.donate{value: 0.5 ether}(cId);

        vm.warp(block.timestamp + FUNDING_DURATION * 1 days + 1);
        platform.markCampaignFailed(cId);

        uint256 balanceBefore = donor1.balance;

        vm.prank(donor1);
        platform.claimFundingRefund(cId);

        assertEq(donor1.balance, balanceBefore + 0.5 ether);
        assertEq(platform.getDonation(cId, donor1), 0);
    }

    function test_ClaimFundingRefund_Revert_NotFailed() public {
        uint256 cId = _createDefaultCampaign();

        vm.prank(donor1);
        platform.donate{value: 0.3 ether}(cId);

        vm.prank(donor1);
        vm.expectRevert("Campaign has not failed");
        platform.claimFundingRefund(cId);
    }

    function test_ClaimFundingRefund_Revert_NoDonation() public {
        uint256 cId = _createDefaultCampaign();

        vm.warp(block.timestamp + FUNDING_DURATION * 1 days + 1);
        platform.markCampaignFailed(cId);

        vm.prank(stranger);
        vm.expectRevert("Nothing to refund");
        platform.claimFundingRefund(cId);
    }

    // TEST: mintCertificate

    function test_MintCertificate_Success_AfterFundingComplete() public {
        uint256 cId = _createDefaultCampaign();
        _fundCampaign(cId); // → FundingComplete

        vm.prank(donor1);
        platform.mintCertificate(cId);

        uint256[] memory certs = platform.getCertificates(donor1);
        assertEq(certs.length, 1);
        assertEq(platform.tokenToCampaign(certs[0]), cId);
        assertEq(platform.ownerOf(certs[0]), donor1);
        assertTrue(platform.hasMintedCertificate(cId, donor1));
    }

    function test_MintCertificate_Success_AfterCompleted() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);
        _completeMilestone(cId, 1, IPFS_CID_1);
        _completeMilestone(cId, 2, IPFS_CID_2); // → Completed

        vm.prank(donor1);
        platform.mintCertificate(cId);

        assertEq(platform.getCertificates(donor1).length, 1);
    }

    function test_MintCertificate_MultipleDonors_UniqueTokenIds() public {
        uint256 cId = _createDefaultCampaign();

        vm.prank(donor1);
        platform.donate{value: 0.5 ether}(cId);
        vm.prank(donor2);
        platform.donate{value: 0.5 ether}(cId);

        vm.prank(donor1);
        platform.mintCertificate(cId);
        vm.prank(donor2);
        platform.mintCertificate(cId);

        uint256[] memory c1 = platform.getCertificates(donor1);
        uint256[] memory c2 = platform.getCertificates(donor2);
        assertTrue(c1[0] != c2[0]);
    }

    function test_MintCertificate_Revert_NoDonation() public {
        uint256 cId = _createDefaultCampaign();
        _fundCampaign(cId);

        vm.prank(stranger);
        vm.expectRevert("You have not donated to this campaign");
        platform.mintCertificate(cId);
    }

    function test_MintCertificate_Revert_DoubleMint() public {
        uint256 cId = _createDefaultCampaign();
        _fundCampaign(cId);

        vm.prank(donor1);
        platform.mintCertificate(cId);

        vm.prank(donor1);
        vm.expectRevert("Certificate already minted");
        platform.mintCertificate(cId);
    }

    function test_MintCertificate_Revert_WhenActive() public {
        uint256 cId = _createDefaultCampaign();

        vm.prank(donor1);
        platform.donate{value: 0.3 ether}(cId); // Still Active

        vm.prank(donor1);
        vm.expectRevert("Certificate not available yet");
        platform.mintCertificate(cId);
    }

    // TEST: Reviewer management

    function test_AddReviewer_Success() public {
        address newReviewer = makeAddr("newReviewer");

        vm.prank(admin);
        platform.addReviewer(newReviewer, "Reviewer2");

        assertTrue(platform.isActiveReviewer(newReviewer));

        FundingPlatform.Reviewer memory r = platform.getReviewer(2);
        assertEq(r.wallet, newReviewer);
        assertEq(r.name, "Reviewer2");
        assertTrue(r.active);
    }

    function test_AddReviewer_EmitEvent() public {
        address newReviewer = makeAddr("newReviewer");

        vm.expectEmit(true, false, false, true);
        emit FundingPlatform.ReviewerWalletUpdated(
            2,
            address(0),
            newReviewer,
            admin
        );

        vm.prank(admin);
        platform.addReviewer(newReviewer, "Reviewer2");
    }

    function test_AddReviewer_Revert_NotOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        platform.addReviewer(stranger, "Attacker");
    }

    function test_AddReviewer_Revert_AlreadyReviewer() public {
        vm.prank(admin);
        vm.expectRevert("Already a reviewer");
        platform.addReviewer(reviewer, "Duplicate");
    }

    function test_UpdateReviewerWallet_Success() public {
        address newWallet = makeAddr("newWallet");

        vm.prank(admin);
        platform.updateReviewerWallet(1, newWallet);

        assertTrue(platform.isActiveReviewer(newWallet));
        assertFalse(platform.isActiveReviewer(reviewer)); // old wallet no longer active
        assertEq(platform.getReviewer(1).wallet, newWallet);
    }

    function test_UpdateReviewerWallet_EmitEvent() public {
        address newWallet = makeAddr("newWallet");

        vm.expectEmit(true, false, false, true);
        emit FundingPlatform.ReviewerWalletUpdated(
            1,
            reviewer,
            newWallet,
            admin
        );

        vm.prank(admin);
        platform.updateReviewerWallet(1, newWallet);
    }

    function test_UpdateReviewerWallet_Revert_NewWalletAlreadyInUse() public {
        address reviewer2 = makeAddr("reviewer2");
        vm.prank(admin);
        platform.addReviewer(reviewer2, "R2");

        // Try to set reviewer 1's wallet to reviewer2's wallet
        vm.prank(admin);
        vm.expectRevert("New wallet already in use");
        platform.updateReviewerWallet(1, reviewer2);
    }

    function test_UpdateReviewerWallet_Revert_NotOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        platform.updateReviewerWallet(1, stranger);
    }

    function test_DeactivateReviewer_Success() public {
        vm.prank(admin);
        platform.deactivateReviewer(1);

        assertFalse(platform.isActiveReviewer(reviewer));
        assertFalse(platform.getReviewer(1).active);
    }

    function test_DeactivateReviewer_Revert_AlreadyInactive() public {
        vm.prank(admin);
        platform.deactivateReviewer(1);

        vm.prank(admin);
        vm.expectRevert("Already inactive");
        platform.deactivateReviewer(1);
    }

    function test_DeactivatedReviewer_CannotApprove() public {
        uint256 cId = _createDefaultCampaign();
        _fundAndStart(cId);

        vm.prank(creator);
        platform.submitMilestoneProof(cId, 1, IPFS_CID_1);

        // Deactivate reviewer
        vm.prank(admin);
        platform.deactivateReviewer(1);

        vm.prank(reviewer);
        vm.expectRevert("Not an active reviewer");
        platform.approveMilestone(cId, 1);
    }

    // TEST: isFundingActive view

    function test_IsFundingActive_True() public {
        uint256 cId = _createDefaultCampaign();
        assertTrue(platform.isFundingActive(cId));
    }

    function test_IsFundingActive_False_AfterDeadline() public {
        uint256 cId = _createDefaultCampaign();
        vm.warp(block.timestamp + FUNDING_DURATION * 1 days + 1);
        assertFalse(platform.isFundingActive(cId));
    }

    function test_IsFundingActive_False_AfterGoalReached() public {
        uint256 cId = _createDefaultCampaign();
        _fundCampaign(cId);
        assertFalse(platform.isFundingActive(cId));
    }

    // TEST: getAllMilestones view

    function test_GetAllMilestones_ReturnsCorrectCount() public {
        uint256 cId = _createDefaultCampaign();
        FundingPlatform.Milestone[] memory all = platform.getAllMilestones(cId);
        assertEq(all.length, 2);
        assertEq(all[0].id, 1);
        assertEq(all[1].id, 2);
    }

    // TEST: Full happy path (end-to-end)

    function test_FullHappyPath_TwoMilestones_Completed() public {
        uint256 cId = _createDefaultCampaign();

        // Phase 1: Funding
        vm.prank(donor1);
        platform.donate{value: 0.6 ether}(cId);
        vm.prank(donor2);
        platform.donate{value: 0.4 ether}(cId);

        assertEq(
            uint256(platform.getCampaign(cId).status),
            uint256(FundingPlatform.CampaignStatus.FundingComplete)
        );

        // Mint certificates
        vm.prank(donor1);
        platform.mintCertificate(cId);
        vm.prank(donor2);
        platform.mintCertificate(cId);

        // Phase 2: Start execution
        vm.prank(creator);
        platform.startExecution(cId);

        // Milestone 1: submit proof → approve → disburse
        uint256 benBefore = beneficiary.balance;
        _completeMilestone(cId, 1, IPFS_CID_1);
        assertEq(beneficiary.balance, benBefore + M1_FUND);

        // Milestone 2: submit proof → approve → disburse
        _completeMilestone(cId, 2, IPFS_CID_2);
        assertEq(beneficiary.balance, benBefore + M1_FUND + M2_FUND);

        // Campaign should be Completed
        assertEq(
            uint256(platform.getCampaign(cId).status),
            uint256(FundingPlatform.CampaignStatus.Completed)
        );
    }

    function test_FullFailurePath_FundingNotReached() public {
        uint256 cId = _createDefaultCampaign();

        vm.prank(donor1);
        platform.donate{value: 0.2 ether}(cId);

        vm.warp(block.timestamp + FUNDING_DURATION * 1 days + 1);
        platform.markCampaignFailed(cId);

        uint256 balanceBefore = donor1.balance;
        vm.prank(donor1);
        platform.claimFundingRefund(cId);
        assertEq(donor1.balance, balanceBefore + 0.2 ether);
    }
}
