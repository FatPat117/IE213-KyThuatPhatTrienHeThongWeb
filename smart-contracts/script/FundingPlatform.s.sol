// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {FundingPlatform} from "../src/FundingPlatform.sol";

/// @notice Deploy FundingPlatform to testnet
/// @dev Local simulation : forge script script/Deploy.s.sol
/// @dev Deploy to Sepolia : forge script script/Deploy.s.sol --rpc-url sepolia --broadcast --verify
contract DeployFundingPlatform is Script {
    function run() external returns (FundingPlatform) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        address multisig = vm.envAddress("MULTISIG_ADDRESS");
        // For simplicity, we read one admin address. You can expand this if needed.
        address admin = vm.envAddress("ADMIN_WALLETS"); 

        address[] memory admins = new address[](1);
        admins[0] = admin;

        console.log("FundingPlatform Deployment");
        console.log("Deployer  :", deployer);
        console.log("Multisig  :", multisig);
        console.log("Admin     :", admin);
        console.log("Chain ID  :", block.chainid);

        vm.startBroadcast(deployerPrivateKey);
        FundingPlatform platform = new FundingPlatform(multisig, admins);
        vm.stopBroadcast();

        console.log("==========================================");
        console.log("Contract  :", address(platform));
        console.log("NFT Name  :", platform.name());
        console.log("NFT Symbol:", platform.symbol());

        return platform;
    }
}
