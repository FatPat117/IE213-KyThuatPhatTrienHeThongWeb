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
        string memory adminsRaw = vm.envString("ADMIN_WALLETS");
        
        address[] memory admins;
        // Check if there is a comma
        if (bytes(adminsRaw).length > 42) {
            // Very simple split: take the first 42 characters (0x...addr)
            bytes memory b = bytes(adminsRaw);
            bytes memory firstAddr = new bytes(42);
            for(uint i=0; i<42; i++) {
                firstAddr[i] = b[i];
            }
            admins = new address[](1);
            admins[0] = vm.parseAddress(string(firstAddr));
        } else {
            admins = new address[](1);
            admins[0] = vm.parseAddress(adminsRaw);
        }

        console.log("FundingPlatform Deployment");
        console.log("Deployer  :", deployer);
        console.log("Multisig  :", multisig);
        console.log("Admin[0]  :", admins[0]);
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
