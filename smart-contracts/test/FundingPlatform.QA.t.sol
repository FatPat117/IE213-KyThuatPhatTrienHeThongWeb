// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {FundingPlatform} from "../src/FundingPlatform.sol";

contract FundingPlatformQATest is Test {
    FundingPlatform public platform;

    address public admin = makeAddr("admin");
    address public creator = makeAddr("creator");
    address public beneficiary = makeAddr("beneficiary");
    address public donor = makeAddr("donor");
    address public stranger = makeAddr("stranger");

    uint256 public constant GOAL = 1 ether;
    uint256 public constant DURATION_DAYS = 7;
    uint256 public constant SMALL_DONATION = 0.2 ether;

    function setUp() public {
        vm.txGasPrice(0);
        vm.prank(admin);
        platform = new FundingPlatform();

        vm.deal(donor, 10 ether);
        vm.deal(stranger, 10 ether);
    }

    function _createCampaign() internal returns (uint256) {
        vm.prank(creator);
        return platform.createCampaign(beneficiary, GOAL, DURATION_DAYS);
    }

    function test_HappyPath_CreateDonateWithdraw() public {
        uint256 campaignId = _createCampaign();

        vm.expectEmit(true, true, false, true);
        emit FundingPlatform.Donated(campaignId, donor, GOAL);

        uint256 donorBalanceBefore = donor.balance;
        vm.prank(donor);
        platform.donate{value: GOAL}(campaignId);
        assertEq(donor.balance, donorBalanceBefore - GOAL);
        assertEq(platform.getDonation(campaignId, donor), GOAL);

        uint256 beneficiaryBalanceBefore = beneficiary.balance;
        vm.prank(beneficiary);
        platform.withdrawFunds(campaignId);
        assertEq(beneficiary.balance, beneficiaryBalanceBefore + GOAL);
    }

    function test_HappyPath_EmitsCampaignCreated() public {
        vm.expectEmit(true, true, false, true);
        emit FundingPlatform.CampaignCreated(
            1,
            creator,
            beneficiary,
            GOAL,
            block.timestamp + DURATION_DAYS * 1 days
        );

        vm.prank(creator);
        platform.createCampaign(beneficiary, GOAL, DURATION_DAYS);
    }

    function test_Edge_DonateAfterDeadline() public {
        uint256 campaignId = _createCampaign();

        vm.warp(block.timestamp + DURATION_DAYS * 1 days + 1);

        vm.prank(donor);
        vm.expectRevert("Campaign has ended");
        platform.donate{value: SMALL_DONATION}(campaignId);
    }

    function test_Edge_DonateWhenNotActive() public {
        uint256 campaignId = _createCampaign();

        vm.prank(creator);
        platform.cancelCampaign(campaignId);

        vm.prank(donor);
        vm.expectRevert("Campaign is not active");
        platform.donate{value: SMALL_DONATION}(campaignId);
    }

    function test_Edge_DonateZeroValue() public {
        uint256 campaignId = _createCampaign();

        vm.prank(donor);
        vm.expectRevert("Donation must be greater than 0");
        platform.donate{value: 0}(campaignId);
    }

    function test_Edge_WithdrawBeforeGoal() public {
        uint256 campaignId = _createCampaign();

        vm.prank(donor);
        platform.donate{value: SMALL_DONATION}(campaignId);

        vm.prank(creator);
        vm.expectRevert("Campaign has not succeeded");
        platform.withdrawFunds(campaignId);
    }

    function test_Edge_WithdrawUnauthorized() public {
        uint256 campaignId = _createCampaign();

        vm.prank(donor);
        platform.donate{value: GOAL}(campaignId);

        vm.prank(stranger);
        vm.expectRevert("Not authorized to withdraw");
        platform.withdrawFunds(campaignId);
    }

    function test_MintNFT_AfterDonate() public {
        uint256 campaignId = _createCampaign();

        vm.prank(donor);
        platform.donate{value: SMALL_DONATION}(campaignId);

        vm.expectEmit(true, true, false, true);
        emit FundingPlatform.CertificateMinted(campaignId, donor, 1);

        vm.prank(donor);
        platform.mintCertificate(campaignId);

        uint256[] memory certs = platform.getCertificates(donor);
        assertEq(certs.length, 1);
        assertEq(platform.tokenToCampaign(certs[0]), campaignId);
        assertEq(platform.ownerOf(certs[0]), donor);
    }
}
