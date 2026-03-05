// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {FundingPlatform} from "../src/FundingPlatform.sol";

contract FundingPlatformTest is Test {
    FundingPlatform public platform;

    // Mock wallet addresses used in tests
    address public admin = makeAddr("admin");
    address public creator = makeAddr("creator");
    address public beneficiary = makeAddr("beneficiary");
    address public donor1 = makeAddr("donor1");
    address public donor2 = makeAddr("donor2");
    address public stranger = makeAddr("stranger");

    // Shared constants
    uint256 public constant GOAL = 1 ether;
    uint256 public constant DURATION = 30; // days
    uint256 public constant SMALL_DONATION = 0.3 ether;
    uint256 public constant LARGE_DONATION = 1 ether;

    // Run before EACH test case
    function setUp() public {
        // Deploy contract with admin as the deployer
        vm.prank(admin);
        platform = new FundingPlatform();

        // Allocate ETH to test wallets
        vm.deal(donor1, 10 ether);
        vm.deal(donor2, 10 ether);
        vm.deal(stranger, 10 ether);
    }

    // HELPER: Create default campaign, return campaignId
    function _createDefaultCampaign() internal returns (uint256) {
        vm.prank(creator);
        return platform.createCampaign(beneficiary, GOAL, DURATION);
    }

    // TEST: createCampaign

    function test_CreateCampaign_Success() public {
        uint256 campaignId = _createDefaultCampaign();

        assertEq(campaignId, 1);
        assertEq(platform.campaignCount(), 1);

        FundingPlatform.Campaign memory c = platform.getCampaign(1);
        assertEq(c.id, 1);
        assertEq(c.creator, creator);
        assertEq(c.beneficiary, beneficiary);
        assertEq(c.goal, GOAL);
        assertEq(c.totalRaised, 0);
        assertEq(c.withdrawn, false);
        assertEq(
            uint256(c.status),
            uint256(FundingPlatform.CampaignStatus.Active)
        );
    }

    function test_CreateCampaign_EmitEvent() public {
        // Verify event is emitted correctly
        vm.expectEmit(true, true, false, true);
        emit FundingPlatform.CampaignCreated(
            1,
            creator,
            beneficiary,
            GOAL,
            block.timestamp + DURATION * 1 days
        );

        vm.prank(creator);
        platform.createCampaign(beneficiary, GOAL, DURATION);
    }

    function test_CreateCampaign_Revert_InvalidBeneficiary() public {
        vm.prank(creator);
        vm.expectRevert("Invalid beneficiary");
        platform.createCampaign(address(0), GOAL, DURATION);
    }

    function test_CreateCampaign_Revert_ZeroGoal() public {
        vm.prank(creator);
        vm.expectRevert("Goal must be greater than 0");
        platform.createCampaign(beneficiary, 0, DURATION);
    }

    function test_CreateCampaign_Revert_InvalidDuration() public {
        vm.prank(creator);
        vm.expectRevert("Duration must be 1-365 days");
        platform.createCampaign(beneficiary, GOAL, 0);

        vm.prank(creator);
        vm.expectRevert("Duration must be 1-365 days");
        platform.createCampaign(beneficiary, GOAL, 366);
    }

    // TEST: donate

    function test_Donate_Success() public {
        _createDefaultCampaign();

        vm.prank(donor1);
        platform.donate{value: SMALL_DONATION}(1);

        assertEq(platform.getDonation(1, donor1), SMALL_DONATION);
        assertEq(platform.getCampaign(1).totalRaised, SMALL_DONATION);
    }

    function test_Donate_MultipleDonors() public {
        _createDefaultCampaign();

        vm.prank(donor1);
        platform.donate{value: SMALL_DONATION}(1);

        vm.prank(donor2);
        platform.donate{value: SMALL_DONATION}(1);

        assertEq(platform.getCampaign(1).totalRaised, SMALL_DONATION * 2);
    }

    function test_Donate_AutoSucceeded_WhenGoalReached() public {
        _createDefaultCampaign();

        vm.prank(donor1);
        platform.donate{value: LARGE_DONATION}(1);

        FundingPlatform.Campaign memory c = platform.getCampaign(1);
        assertEq(
            uint256(c.status),
            uint256(FundingPlatform.CampaignStatus.Succeeded)
        );
    }

    function test_Donate_EmitEvent() public {
        _createDefaultCampaign();

        vm.expectEmit(true, true, false, true);
        emit FundingPlatform.Donated(1, donor1, SMALL_DONATION);

        vm.prank(donor1);
        platform.donate{value: SMALL_DONATION}(1);
    }

    function test_Donate_Revert_AfterDeadline() public {
        _createDefaultCampaign();

        // Fast forward time past deadline
        vm.warp(block.timestamp + DURATION * 1 days + 1);

        vm.prank(donor1);
        vm.expectRevert("Campaign has ended");
        platform.donate{value: SMALL_DONATION}(1);
    }

    function test_Donate_Revert_ZeroValue() public {
        _createDefaultCampaign();

        vm.prank(donor1);
        vm.expectRevert("Donation must be greater than 0");
        platform.donate{value: 0}(1);
    }

    function test_Donate_Revert_InvalidCampaign() public {
        vm.prank(donor1);
        vm.expectRevert("Campaign does not exist");
        platform.donate{value: SMALL_DONATION}(999);
    }

    // TEST: mintCertificate

    function test_MintCertificate_Success() public {
        _createDefaultCampaign();

        vm.prank(donor1);
        platform.donate{value: SMALL_DONATION}(1);

        vm.prank(donor1);
        platform.mintCertificate(1);

        uint256[] memory certs = platform.getCertificates(donor1);
        assertEq(certs.length, 1);
        assertEq(platform.tokenToCampaign(certs[0]), 1);
        assertEq(platform.ownerOf(certs[0]), donor1);
        assertTrue(platform.hasMintedCertificate(1, donor1));
    }

    function test_MintCertificate_EmitEvent() public {
        _createDefaultCampaign();

        vm.prank(donor1);
        platform.donate{value: SMALL_DONATION}(1);

        vm.expectEmit(true, true, false, true);
        emit FundingPlatform.CertificateMinted(1, donor1, 1);

        vm.prank(donor1);
        platform.mintCertificate(1);
    }

    function test_MintCertificate_Revert_NoDonation() public {
        _createDefaultCampaign();

        vm.prank(stranger);
        vm.expectRevert("You have not donated to this campaign");
        platform.mintCertificate(1);
    }

    function test_MintCertificate_Revert_DoubleMint() public {
        _createDefaultCampaign();

        vm.prank(donor1);
        platform.donate{value: SMALL_DONATION}(1);

        vm.prank(donor1);
        platform.mintCertificate(1);

        // Second mint should revert
        vm.prank(donor1);
        vm.expectRevert("Certificate already minted");
        platform.mintCertificate(1);
    }

    function test_MintCertificate_MultipleDonors_UniqueTokenIds() public {
        _createDefaultCampaign();

        vm.prank(donor1);
        platform.donate{value: SMALL_DONATION}(1);

        vm.prank(donor2);
        platform.donate{value: SMALL_DONATION}(1);

        vm.prank(donor1);
        platform.mintCertificate(1);

        vm.prank(donor2);
        platform.mintCertificate(1);

        uint256[] memory certs1 = platform.getCertificates(donor1);
        uint256[] memory certs2 = platform.getCertificates(donor2);

        // TokenIds must be different
        assertTrue(certs1[0] != certs2[0]);
    }

    // TEST: withdrawFunds

    function test_WithdrawFunds_Success() public {
        _createDefaultCampaign();

        // Donate enough to reach goal
        vm.prank(donor1);
        platform.donate{value: LARGE_DONATION}(1);

        uint256 balanceBefore = beneficiary.balance;

        vm.prank(creator);
        platform.withdrawFunds(1);

        assertEq(beneficiary.balance, balanceBefore + LARGE_DONATION);
        assertTrue(platform.getCampaign(1).withdrawn);
    }

    function test_WithdrawFunds_Revert_NotSucceeded() public {
        _createDefaultCampaign();

        vm.prank(donor1);
        platform.donate{value: SMALL_DONATION}(1); // Goal not reached yet

        vm.prank(creator);
        vm.expectRevert("Campaign has not succeeded");
        platform.withdrawFunds(1);
    }

    function test_WithdrawFunds_Revert_DoubleWithdraw() public {
        _createDefaultCampaign();

        vm.prank(donor1);
        platform.donate{value: LARGE_DONATION}(1);

        vm.prank(creator);
        platform.withdrawFunds(1);

        // Second withdrawal should revert
        vm.prank(creator);
        vm.expectRevert("Funds already withdrawn");
        platform.withdrawFunds(1);
    }

    function test_WithdrawFunds_Revert_Unauthorized() public {
        _createDefaultCampaign();

        vm.prank(donor1);
        platform.donate{value: LARGE_DONATION}(1);

        vm.prank(stranger);
        vm.expectRevert("Not authorized to withdraw");
        platform.withdrawFunds(1);
    }

    // TEST: markAsFailed & claimRefund

    function test_MarkAsFailed_Success() public {
        _createDefaultCampaign();

        vm.prank(donor1);
        platform.donate{value: SMALL_DONATION}(1);

        // Fast forward past deadline
        vm.warp(block.timestamp + DURATION * 1 days + 1);

        platform.markAsFailed(1); // Anyone can call

        assertEq(
            uint256(platform.getCampaign(1).status),
            uint256(FundingPlatform.CampaignStatus.Failed)
        );
    }

    function test_MarkAsFailed_Revert_BeforeDeadline() public {
        _createDefaultCampaign();

        vm.expectRevert("Campaign deadline not reached");
        platform.markAsFailed(1);
    }

    function test_MarkAsFailed_Revert_GoalReached() public {
        _createDefaultCampaign();

        vm.prank(donor1);
        platform.donate{value: LARGE_DONATION}(1); // Reach goal → Succeeded

        vm.warp(block.timestamp + DURATION * 1 days + 1);

        vm.expectRevert("Campaign is not active");
        platform.markAsFailed(1);
    }

    function test_ClaimRefund_Success() public {
        _createDefaultCampaign();

        vm.prank(donor1);
        platform.donate{value: SMALL_DONATION}(1);

        vm.warp(block.timestamp + DURATION * 1 days + 1);
        platform.markAsFailed(1);

        uint256 balanceBefore = donor1.balance;

        vm.prank(donor1);
        platform.claimRefund(1);

        assertEq(donor1.balance, balanceBefore + SMALL_DONATION);
        assertEq(platform.getDonation(1, donor1), 0); // Balance reset
    }

    function test_ClaimRefund_Revert_NoDonation() public {
        _createDefaultCampaign();

        vm.warp(block.timestamp + DURATION * 1 days + 1);
        platform.markAsFailed(1);

        vm.prank(stranger);
        vm.expectRevert("No donation to refund");
        platform.claimRefund(1);
    }

    function test_ClaimRefund_Revert_NotFailed() public {
        _createDefaultCampaign();

        vm.prank(donor1);
        platform.donate{value: SMALL_DONATION}(1);

        vm.prank(donor1);
        vm.expectRevert("Campaign has not failed");
        platform.claimRefund(1);
    }

    // TEST: cancelCampaign

    function test_CancelCampaign_ByCreator() public {
        _createDefaultCampaign();

        vm.prank(creator);
        platform.cancelCampaign(1);

        assertEq(
            uint256(platform.getCampaign(1).status),
            uint256(FundingPlatform.CampaignStatus.Cancelled)
        );
    }

    function test_CancelCampaign_ByAdmin() public {
        _createDefaultCampaign();

        vm.prank(admin);
        platform.cancelCampaign(1);

        assertEq(
            uint256(platform.getCampaign(1).status),
            uint256(FundingPlatform.CampaignStatus.Cancelled)
        );
    }

    function test_CancelCampaign_Revert_HasDonations() public {
        _createDefaultCampaign();

        vm.prank(donor1);
        platform.donate{value: SMALL_DONATION}(1);

        vm.prank(creator);
        vm.expectRevert("Cannot cancel: funds already raised");
        platform.cancelCampaign(1);
    }

    function test_CancelCampaign_Revert_Unauthorized() public {
        _createDefaultCampaign();

        vm.prank(stranger);
        vm.expectRevert("Not authorized to cancel");
        platform.cancelCampaign(1);
    }

    // TEST: isCampaignActive

    function test_IsCampaignActive_True() public {
        _createDefaultCampaign();
        assertTrue(platform.isCampaignActive(1));
    }

    function test_IsCampaignActive_False_AfterDeadline() public {
        _createDefaultCampaign();
        vm.warp(block.timestamp + DURATION * 1 days + 1);
        assertFalse(platform.isCampaignActive(1));
    }

    function test_IsCampaignActive_False_AfterSucceeded() public {
        _createDefaultCampaign();

        vm.prank(donor1);
        platform.donate{value: LARGE_DONATION}(1);

        assertFalse(platform.isCampaignActive(1));
    }
}
