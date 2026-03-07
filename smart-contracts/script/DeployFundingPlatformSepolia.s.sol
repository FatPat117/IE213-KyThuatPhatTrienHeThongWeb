// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {FundingPlatform} from "../src/FundingPlatform.sol";

/// @notice Deploy FundingPlatform to a live network
contract DeployFundingPlatformSepolia is Script {
    function run() external returns (FundingPlatform) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying FundingPlatform...");
        console.log("Deployer address:", deployer);
        console.log("Deployer balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);
        FundingPlatform platform = new FundingPlatform();
        vm.stopBroadcast();

        console.log("FundingPlatform deployed at:", address(platform));
        console.log("NFT Name:", platform.name());
        console.log("NFT Symbol:", platform.symbol());
        console.log("Owner:", platform.owner());

        return platform;
    }
}
