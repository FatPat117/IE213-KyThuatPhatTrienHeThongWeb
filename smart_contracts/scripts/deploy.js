const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  const FundRaising = await hre.ethers.getContractFactory("FundRaising");
  const contract = await FundRaising.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log("FundRaising deployed to:", address);
  console.log("---");
  console.log("Lưu địa chỉ contract vào .env và frontend/backend: FUNDRAISING_CONTRACT_ADDRESS=" + address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
