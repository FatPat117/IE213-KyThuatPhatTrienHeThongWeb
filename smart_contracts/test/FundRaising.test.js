const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FundRaising", function () {
  let fundRaising, owner, donor1, donor2;

  beforeEach(async function () {
    [owner, donor1, donor2] = await ethers.getSigners();
    const FundRaisingFactory = await ethers.getContractFactory("FundRaising");
    fundRaising = await FundRaisingFactory.deploy();
    await fundRaising.waitForDeployment();
  });

  it("Should set owner correctly", async function () {
    expect(await fundRaising.owner()).to.equal(owner.address);
  });

  it("Should accept contributions and update totalRaised", async function () {
    await fundRaising.connect(donor1).contribute({ value: ethers.parseEther("1") });
    await fundRaising.connect(donor2).contribute({ value: ethers.parseEther("2") });
    expect(await fundRaising.totalRaised()).to.equal(ethers.parseEther("3"));
    expect(await fundRaising.getContribution(donor1.address)).to.equal(ethers.parseEther("1"));
  });

  it("Should revert when contributing 0", async function () {
    await expect(fundRaising.connect(donor1).contribute({ value: 0 }))
      .to.be.revertedWithCustomError(fundRaising, "InvalidAmount");
  });
});
