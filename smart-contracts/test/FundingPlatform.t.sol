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

    function setUp() public {
        platform = new FundingPlatform();
        safe = new MockSafe();
        reviewerSafe = address(safe);

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

    function _createCampaign() internal returns (uint256) {
        uint16[] memory bps = _defaultAllocationBps();
        uint256[] memory deadlines = _defaultDeadlines();

        vm.prank(creator);
        return
            platform.createCampaignWithMilestones(
                bps,
                deadlines,
                block.timestamp + 7 days,
                reviewerSafe
            );
    }

    function _fundCampaign(uint256 campaignId) internal {
        vm.prank(donor);
        platform.donate{value: 1 ether}(campaignId);
    }

    function test_CreateCampaignWithMilestones_StoresAllocationAndDeadlines() public {
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
            uint256(FundingPlatform.CampaignStatus.Active)
        );
        assertEq(platform.campaignReviewerSafe(campaignId), reviewerSafe);

        FundingPlatform.Milestone memory m0 = platform.getMilestone(campaignId, 0);
        FundingPlatform.Milestone memory m1 = platform.getMilestone(campaignId, 1);
        assertEq(m0.allocationBps, 3000);
        assertEq(m1.allocationBps, 7000);
        assertEq(m0.deadline, deadlines[0]);
        assertEq(m1.deadline, deadlines[1]);
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

    function test_Donate_EmitsDonatedThenFundingCompleteAndAutodisburse() public {
        uint256 campaignId = _createCampaign();

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
        assertEq(campaign.currentMilestoneId, 1);

        FundingPlatform.Milestone memory m0 = platform.getMilestone(campaignId, 0);
        FundingPlatform.Milestone memory m1 = platform.getMilestone(campaignId, 1);
        assertEq(
            uint256(m0.status),
            uint256(FundingPlatform.MilestoneStatus.Disbursed)
        );
        assertEq(
            uint256(m1.status),
            uint256(FundingPlatform.MilestoneStatus.PendingVerification)
        );
    }

    function test_GetMilestoneAmount_UsesAllocationBps() public {
        uint256 campaignId = _createCampaign();
        _fundCampaign(campaignId);

        uint256 m0Amount = platform.getMilestoneAmount(campaignId, 0);
        uint256 m1Amount = platform.getMilestoneAmount(campaignId, 1);

        assertEq(m0Amount, 0.3 ether);
        assertEq(m1Amount, 0.7 ether);
    }

    function test_ApproveMilestone_RequiresCampaignReviewerSafe() public {
        uint256 campaignId = _createCampaign();
        _fundCampaign(campaignId);

        vm.prank(creator);
        platform.submitMilestoneProof(campaignId, 1, CID_1);

        vm.prank(outsider);
        vm.expectRevert("Wrong reviewer");
        platform.approveMilestone(campaignId, 1);

        vm.prank(reviewerSafe);
        platform.approveMilestone(campaignId, 1);

        FundingPlatform.Milestone memory m1 = platform.getMilestone(campaignId, 1);
        assertEq(
            uint256(m1.status),
            uint256(FundingPlatform.MilestoneStatus.Approved)
        );
    }

    function test_MarkMilestoneFailed_IsPublic_NoCascade() public {
        uint256 campaignId = _createCampaign();
        _fundCampaign(campaignId);

        FundingPlatform.Milestone memory m1Before = platform.getMilestone(campaignId, 1);
        vm.warp(m1Before.deadline + 1);

        vm.prank(outsider);
        platform.markMilestoneFailed(campaignId, 1);

        FundingPlatform.Campaign memory campaign = platform.getCampaign(campaignId);
        FundingPlatform.Milestone memory m0 = platform.getMilestone(campaignId, 0);
        FundingPlatform.Milestone memory m1 = platform.getMilestone(campaignId, 1);

        assertEq(
            uint256(campaign.status),
            uint256(FundingPlatform.CampaignStatus.PartialFailed)
        );
        assertEq(
            uint256(m0.status),
            uint256(FundingPlatform.MilestoneStatus.Disbursed)
        );
        assertEq(
            uint256(m1.status),
            uint256(FundingPlatform.MilestoneStatus.Failed)
        );
    }

    function test_MintCertificate_EmitsCertificateMinted() public {
        uint256 campaignId = _createCampaign();
        _fundCampaign(campaignId);

        vm.expectEmit(true, true, true, true);
        emit FundingPlatform.CertificateMinted(campaignId, donor, 1);

        vm.prank(donor);
        platform.mintCertificate(campaignId);

        uint256[] memory certs = platform.getCertificates(donor);
        assertEq(certs.length, 1);
        assertEq(platform.tokenToCampaign(certs[0]), campaignId);
    }

    function test_ClaimMilestoneRefund_UsesProRataShare() public {
        uint256 campaignId = _createCampaign();

        vm.prank(donor);
        platform.donate{value: 0.6 ether}(campaignId);
        vm.prank(donor2);
        platform.donate{value: 0.4 ether}(campaignId);

        FundingPlatform.Milestone memory m1 = platform.getMilestone(campaignId, 1);
        vm.warp(m1.deadline + 1);

        vm.prank(outsider);
        platform.markMilestoneFailed(campaignId, 1);

        uint256 donorBefore = donor.balance;
        uint256 donor2Before = donor2.balance;

        vm.prank(donor);
        platform.claimMilestoneRefund(campaignId, 1);

        vm.prank(donor2);
        platform.claimMilestoneRefund(campaignId, 1);

        // Milestone 1 pool = 70% of 1 ether = 0.7 ether
        // donor(0.6) => 0.42 ether, donor2(0.4) => 0.28 ether
        assertEq(donor.balance, donorBefore + 0.42 ether);
        assertEq(donor2.balance, donor2Before + 0.28 ether);
    }
}
