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

        console.log("FundingPlatform Deployment");
        console.log("Deployer  :", deployer);
        console.log("Balance   :", deployer.balance);
        console.log("Chain ID  :", block.chainid);

        vm.startBroadcast(deployerPrivateKey);
        FundingPlatform platform = new FundingPlatform();
        vm.stopBroadcast();

        console.log("==========================================");
        console.log("Contract  :", address(platform));
        console.log("NFT Name  :", platform.name());
        console.log("NFT Symbol:", platform.symbol());
        console.log("Owner     :", platform.owner());

        return platform;
    }
}
