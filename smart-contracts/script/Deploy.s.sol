// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {FundingPlatform} from "../src/FundingPlatform.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        new FundingPlatform();
        vm.stopBroadcast();
    }
}
