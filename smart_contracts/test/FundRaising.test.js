const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("FundRaising", function () {
    let fundRaising, owner, creator1, creator2, donor1, donor2, donor3;
    const ONE_DAY = 24 * 60 * 60;

    beforeEach(async function () {
        [owner, creator1, creator2, donor1, donor2, donor3] =
            await ethers.getSigners();
        const FundRaisingFactory =
            await ethers.getContractFactory("FundRaising");
        fundRaising = await FundRaisingFactory.deploy();
        await fundRaising.waitForDeployment();
    });

    // ==================== CAMPAIGN CREATION TESTS ====================
    describe("Campaign Creation", function () {
        it("Should create a campaign successfully", async function () {
            const goalEth = ethers.parseEther("10");
            const durationDays = 30;

            const tx = await fundRaising
                .connect(creator1)
                .createCampaign(
                    "Help for Local School",
                    "We need funds to build a new library for our school",
                    goalEth,
                    durationDays,
                );

            const receipt = await tx.wait();

            // Verify campaignCount increased
            expect(await fundRaising.campaignCount()).to.equal(1);

            // Verify campaign data
            const campaign = await fundRaising.getCampaign(0);
            expect(campaign.title).to.equal("Help for Local School");
            expect(campaign.description).to.equal(
                "We need funds to build a new library for our school",
            );
            expect(campaign.creator).to.equal(creator1.address);
            expect(campaign.goal).to.equal(goalEth);
            expect(campaign.raised).to.equal(0);
            expect(campaign.completed).to.equal(false);
            expect(campaign.withdrawn).to.equal(false);
        });

        it("Should revert when goal is 0", async function () {
            await expect(
                fundRaising
                    .connect(creator1)
                    .createCampaign("Title", "Description", 0, 30),
            ).to.be.revertedWithCustomError(fundRaising, "GoalTooSmall");
        });

        it("Should revert when duration is 0", async function () {
            await expect(
                fundRaising
                    .connect(creator1)
                    .createCampaign(
                        "Title",
                        "Description",
                        ethers.parseEther("10"),
                        0,
                    ),
            ).to.be.revertedWithCustomError(fundRaising, "DeadlineInPast");
        });

        it("Should emit CampaignCreated event", async function () {
            const goalEth = ethers.parseEther("5");
            const durationDays = 20;

            await expect(
                fundRaising
                    .connect(creator1)
                    .createCampaign(
                        "Event Test",
                        "Testing event emission",
                        goalEth,
                        durationDays,
                    ),
            )
                .to.emit(fundRaising, "CampaignCreated")
                .withArgs(
                    0,
                    creator1.address,
                    "Event Test",
                    goalEth,
                    expect.any(Number),
                );
        });

        it("Should track user campaigns correctly", async function () {
            const goalEth = ethers.parseEther("10");
            const durationDays = 30;

            await fundRaising
                .connect(creator1)
                .createCampaign(
                    "Campaign 1",
                    "Description 1",
                    goalEth,
                    durationDays,
                );
            await fundRaising
                .connect(creator1)
                .createCampaign(
                    "Campaign 2",
                    "Description 2",
                    goalEth,
                    durationDays,
                );
            await fundRaising
                .connect(creator2)
                .createCampaign(
                    "Campaign 3",
                    "Description 3",
                    goalEth,
                    durationDays,
                );

            const creator1Campaigns = await fundRaising.getUserCampaigns(
                creator1.address,
            );
            const creator2Campaigns = await fundRaising.getUserCampaigns(
                creator2.address,
            );

            expect(creator1Campaigns.length).to.equal(2);
            expect(creator2Campaigns.length).to.equal(1);
        });
    });

    // ==================== DONATION TESTS ====================
    describe("Donations", function () {
        beforeEach(async function () {
            // Create a campaign for testing
            await fundRaising
                .connect(creator1)
                .createCampaign(
                    "Test Campaign",
                    "Campaign for testing donations",
                    ethers.parseEther("10"),
                    30,
                );
        });

        it("Should accept donations and update campaign.raised", async function () {
            const donationAmount = ethers.parseEther("2");

            await fundRaising
                .connect(donor1)
                .donate(0, { value: donationAmount });

            const campaign = await fundRaising.getCampaign(0);
            expect(campaign.raised).to.equal(donationAmount);
            expect(await fundRaising.totalRaised()).to.equal(donationAmount);
        });

        it("Should track individual donor contributions", async function () {
            const amount1 = ethers.parseEther("1");
            const amount2 = ethers.parseEther("2");

            await fundRaising.connect(donor1).donate(0, { value: amount1 });
            await fundRaising.connect(donor1).donate(0, { value: amount2 });

            const contribution = await fundRaising.getContribution(
                0,
                donor1.address,
            );
            expect(contribution).to.equal(amount1.add(amount2));
        });

        it("Should emit DonationReceived event", async function () {
            const donationAmount = ethers.parseEther("1");

            await expect(
                fundRaising
                    .connect(donor1)
                    .donate(0, { value: donationAmount }),
            )
                .to.emit(fundRaising, "DonationReceived")
                .withArgs(0, donor1.address, donationAmount, donationAmount);
        });

        it("Should revert when donating 0 ETH", async function () {
            await expect(
                fundRaising.connect(donor1).donate(0, { value: 0 }),
            ).to.be.revertedWithCustomError(fundRaising, "InvalidAmount");
        });

        it("Should revert when donating to non-existent campaign", async function () {
            await expect(
                fundRaising
                    .connect(donor1)
                    .donate(999, { value: ethers.parseEther("1") }),
            ).to.be.revertedWithCustomError(fundRaising, "InvalidCampaignId");
        });

        it("Should revert when campaign deadline has passed", async function () {
            // Create a campaign with 1 day duration
            await fundRaising
                .connect(creator1)
                .createCampaign(
                    "Short Campaign",
                    "Brief campaign",
                    ethers.parseEther("5"),
                    1,
                );

            // Move time forward by 2 days
            await time.increase(2 * ONE_DAY);

            // Try to donate - should fail
            await expect(
                fundRaising
                    .connect(donor1)
                    .donate(1, { value: ethers.parseEther("1") }),
            ).to.be.revertedWithCustomError(fundRaising, "CampaignNotActive");
        });

        it("Should auto-complete campaign when goal is reached", async function () {
            // Create a campaign with 2 ETH goal
            await fundRaising
                .connect(creator1)
                .createCampaign(
                    "Small Goal",
                    "Test auto-complete",
                    ethers.parseEther("2"),
                    30,
                );

            // Donate to reach goal
            await expect(
                fundRaising
                    .connect(donor1)
                    .donate(1, { value: ethers.parseEther("2") }),
            )
                .to.emit(fundRaising, "CampaignCompleted")
                .withArgs(1, ethers.parseEther("2"), true);

            const campaign = await fundRaising.getCampaign(1);
            expect(campaign.completed).to.equal(true);
        });

        it("Should revert when donating to completed campaign", async function () {
            // Create campaign with 1 ETH goal
            await fundRaising
                .connect(creator1)
                .createCampaign(
                    "Completion Test",
                    "Test",
                    ethers.parseEther("1"),
                    30,
                );

            // Donate to complete it
            await fundRaising
                .connect(donor1)
                .donate(1, { value: ethers.parseEther("1") });

            // Try to donate again - should fail
            await expect(
                fundRaising
                    .connect(donor2)
                    .donate(1, { value: ethers.parseEther("0.5") }),
            ).to.be.revertedWithCustomError(fundRaising, "CampaignNotActive");
        });

        it("Should allow multiple donors to contribute", async function () {
            await fundRaising
                .connect(donor1)
                .donate(0, { value: ethers.parseEther("2") });
            await fundRaising
                .connect(donor2)
                .donate(0, { value: ethers.parseEther("3") });
            await fundRaising
                .connect(donor3)
                .donate(0, { value: ethers.parseEther("1") });

            const campaign = await fundRaising.getCampaign(0);
            expect(campaign.raised).to.equal(ethers.parseEther("6"));
        });
    });

    // ==================== WITHDRAWAL TESTS ====================
    describe("Fund Withdrawal", function () {
        beforeEach(async function () {
            // Create a campaign
            await fundRaising
                .connect(creator1)
                .createCampaign(
                    "Withdrawal Test",
                    "Test withdrawals",
                    ethers.parseEther("10"),
                    30,
                );

            // Add some donations
            await fundRaising
                .connect(donor1)
                .donate(0, { value: ethers.parseEther("5") });
            await fundRaising
                .connect(donor2)
                .donate(0, { value: ethers.parseEther("3") });
        });

        it("Should withdraw funds after deadline when goal not reached", async function () {
            // Move time forward beyond deadline
            await time.increase(31 * ONE_DAY);

            const initialBalance = await ethers.provider.getBalance(
                creator1.address,
            );

            const tx = await fundRaising.connect(creator1).withdrawFunds(0);
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed.mul(receipt.gasPrice);

            const finalBalance = await ethers.provider.getBalance(
                creator1.address,
            );
            const withdrawnAmount = finalBalance
                .add(gasUsed)
                .sub(initialBalance);

            expect(withdrawnAmount).to.equal(ethers.parseEther("8"));
        });

        it("Should withdraw funds immediately when goal is reached", async function () {
            // Create new campaign with smaller goal
            await fundRaising
                .connect(creator1)
                .createCampaign(
                    "Goal Test",
                    "Quick goal",
                    ethers.parseEther("5"),
                    30,
                );

            // Donate to reach goal
            await fundRaising
                .connect(donor1)
                .donate(1, { value: ethers.parseEther("5") });

            // Should be able to withdraw immediately
            const tx = await fundRaising.connect(creator1).withdrawFunds(1);
            const receipt = await tx.wait();

            expect(receipt.status).to.equal(1); // Success
        });

        it("Should emit FundsWithdrawn event", async function () {
            await time.increase(31 * ONE_DAY);

            await expect(fundRaising.connect(creator1).withdrawFunds(0))
                .to.emit(fundRaising, "FundsWithdrawn")
                .withArgs(0, creator1.address, ethers.parseEther("8"));
        });

        it("Should revert when non-creator tries to withdraw", async function () {
            await time.increase(31 * ONE_DAY);

            await expect(
                fundRaising.connect(donor1).withdrawFunds(0),
            ).to.be.revertedWithCustomError(fundRaising, "NotCampaignCreator");
        });

        it("Should revert when campaign hasn't ended and goal not reached", async function () {
            await expect(
                fundRaising.connect(creator1).withdrawFunds(0),
            ).to.be.revertedWithCustomError(fundRaising, "CampaignNotActive");
        });

        it("Should revert when trying to withdraw twice", async function () {
            await time.increase(31 * ONE_DAY);

            await fundRaising.connect(creator1).withdrawFunds(0);

            // Try to withdraw again
            await expect(
                fundRaising.connect(creator1).withdrawFunds(0),
            ).to.be.revertedWithCustomError(fundRaising, "AlreadyWithdrawn");
        });

        it("Should revert when campaign has no funds", async function () {
            // Create campaign with no donations
            await fundRaising
                .connect(creator2)
                .createCampaign(
                    "No Funds",
                    "Empty campaign",
                    ethers.parseEther("10"),
                    1,
                );

            await time.increase(2 * ONE_DAY);

            await expect(
                fundRaising.connect(creator2).withdrawFunds(1),
            ).to.be.revertedWithCustomError(fundRaising, "InvalidAmount");
        });
    });

    // ==================== REFUND TESTS ====================
    describe("Refunds (Campaign Failed)", function () {
        beforeEach(async function () {
            // Create campaign with high goal that won't be met
            await fundRaising
                .connect(creator1)
                .createCampaign(
                    "Failed Campaign",
                    "This will fail",
                    ethers.parseEther("100"),
                    1,
                );

            // Add donations
            await fundRaising
                .connect(donor1)
                .donate(0, { value: ethers.parseEther("5") });
            await fundRaising
                .connect(donor2)
                .donate(0, { value: ethers.parseEther("3") });
        });

        it("Should allow refunds after failed campaign deadline", async function () {
            // Move past deadline
            await time.increase(2 * ONE_DAY);

            const initialBalance = await ethers.provider.getBalance(
                donor1.address,
            );

            const tx = await fundRaising.connect(donor1).refund(0);
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed.mul(receipt.gasPrice);

            const finalBalance = await ethers.provider.getBalance(
                donor1.address,
            );
            const refundedAmount = finalBalance
                .add(gasUsed)
                .sub(initialBalance);

            expect(refundedAmount).to.equal(ethers.parseEther("5"));
        });

        it("Should revert refund if goal was reached", async function () {
            // Create campaign with reachable goal
            await fundRaising
                .connect(creator1)
                .createCampaign(
                    "Success Campaign",
                    "Will succeed",
                    ethers.parseEther("3"),
                    1,
                );

            // Reach the goal
            await fundRaising
                .connect(donor1)
                .donate(1, { value: ethers.parseEther("3") });

            // Move past deadline
            await time.increase(2 * ONE_DAY);

            // Try to refund - should fail
            await expect(
                fundRaising.connect(donor1).refund(1),
            ).to.be.revertedWithCustomError(fundRaising, "CampaignNotActive");
        });

        it("Should revert refund before deadline", async function () {
            await expect(
                fundRaising.connect(donor1).refund(0),
            ).to.be.revertedWithCustomError(fundRaising, "CampaignNotActive");
        });

        it("Should revert refund for non-donor", async function () {
            await time.increase(2 * ONE_DAY);

            await expect(
                fundRaising.connect(donor3).refund(0),
            ).to.be.revertedWithCustomError(fundRaising, "InvalidAmount");
        });

        it("Should update campaign.raised when refunding", async function () {
            await time.increase(2 * ONE_DAY);

            const campaignBefore = await fundRaising.getCampaign(0);
            const raisedBefore = campaignBefore.raised;

            await fundRaising.connect(donor1).refund(0);

            const campaignAfter = await fundRaising.getCampaign(0);
            expect(campaignAfter.raised).to.equal(
                raisedBefore.sub(ethers.parseEther("5")),
            );
        });
    });

    // ==================== VIEW FUNCTIONS TESTS ====================
    describe("View Functions", function () {
        beforeEach(async function () {
            await fundRaising
                .connect(creator1)
                .createCampaign(
                    "View Test",
                    "Testing view functions",
                    ethers.parseEther("10"),
                    10,
                );

            await fundRaising
                .connect(donor1)
                .donate(0, { value: ethers.parseEther("4") });
        });

        it("Should return correct campaign count", async function () {
            expect(await fundRaising.campaignCount()).to.equal(1);
        });

        it("Should return correct total raised", async function () {
            expect(await fundRaising.totalRaised()).to.equal(
                ethers.parseEther("4"),
            );
        });

        it("Should return all campaigns", async function () {
            const allCampaigns = await fundRaising.getAllCampaigns();
            expect(allCampaigns.length).to.equal(1);
            expect(allCampaigns[0].title).to.equal("View Test");
        });

        it("Should check campaign active status", async function () {
            expect(await fundRaising.isCampaignActive(0)).to.equal(true);

            await time.increase(11 * ONE_DAY);

            expect(await fundRaising.isCampaignActive(0)).to.equal(false);
        });

        it("Should calculate remaining time correctly", async function () {
            const remaining = await fundRaising.getRemainingTime(0);
            expect(remaining).to.be.gt(0);

            await time.increase(5 * ONE_DAY);
            const remainingAfter = await fundRaising.getRemainingTime(0);
            expect(remainingAfter).to.be.lt(remaining);
        });

        it("Should calculate completion percentage", async function () {
            const percentage = await fundRaising.getCompletionPercentage(0);
            expect(percentage).to.equal(40); // 4 / 10 = 40%
        });
    });

    // ==================== EDGE CASES ====================
    describe("Edge Cases & Security", function () {
        it("Should handle multiple campaigns independently", async function () {
            // Create 3 campaigns
            for (let i = 0; i < 3; i++) {
                await fundRaising
                    .connect(creator1)
                    .createCampaign(
                        `Campaign ${i}`,
                        `Desc ${i}`,
                        ethers.parseEther("10"),
                        30,
                    );
            }

            // Donate to different campaigns
            await fundRaising
                .connect(donor1)
                .donate(0, { value: ethers.parseEther("1") });
            await fundRaising
                .connect(donor1)
                .donate(1, { value: ethers.parseEther("2") });
            await fundRaising
                .connect(donor1)
                .donate(2, { value: ethers.parseEther("3") });

            // Verify isolation
            const campaign0 = await fundRaising.getCampaign(0);
            const campaign1 = await fundRaising.getCampaign(1);
            const campaign2 = await fundRaising.getCampaign(2);

            expect(campaign0.raised).to.equal(ethers.parseEther("1"));
            expect(campaign1.raised).to.equal(ethers.parseEther("2"));
            expect(campaign2.raised).to.equal(ethers.parseEther("3"));
        });

        it("Should handle large amounts correctly", async function () {
            await fundRaising
                .connect(creator1)
                .createCampaign(
                    "Large Goal",
                    "Big money",
                    ethers.parseEther("1000"),
                    30,
                );

            const largeAmount = ethers.parseEther("500");
            await fundRaising.connect(donor1).donate(0, { value: largeAmount });

            const campaign = await fundRaising.getCampaign(0);
            expect(campaign.raised).to.equal(largeAmount);
        });

        it("Should handle small amounts correctly", async function () {
            await fundRaising
                .connect(creator1)
                .createCampaign(
                    "Small Goal",
                    "Tiny goal",
                    ethers.parseEther("0.01"),
                    30,
                );

            const tinyAmount = ethers.parseEther("0.001");
            await fundRaising.connect(donor1).donate(0, { value: tinyAmount });

            const campaign = await fundRaising.getCampaign(0);
            expect(campaign.raised).to.equal(tinyAmount);
        });
    });
});
