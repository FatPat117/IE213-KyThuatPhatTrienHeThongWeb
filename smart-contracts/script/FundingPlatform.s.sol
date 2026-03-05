// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {FundingPlatform} from "../src/FundingPlatform.sol";

/// @notice Script deploy FundingPlatform
/// @dev Test: forge script script/Deploy.s.sol
/// @dev Run: forge script script/Deploy.s.sol --rpc-url <RPC_URL> --broadcast
contract DeployFundingPlatform is Script {
    function run() external returns (FundingPlatform) {
        // Read private key from .env environment variable
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying FundingPlatform...");
        console.log("Deployer address :", deployer);
        console.log("Deployer balance :", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        FundingPlatform platform = new FundingPlatform();

        vm.stopBroadcast();

        console.log("FundingPlatform deployed at:", address(platform));
        console.log("NFT Name   :", platform.name());
        console.log("NFT Symbol :", platform.symbol());
        console.log("Owner      :", platform.owner());

        return platform;
    }
}
