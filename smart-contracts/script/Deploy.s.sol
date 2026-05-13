// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {FundingPlatform} from "../src/FundingPlatform.sol";

contract Deploy is Script {
    function run() external {
        address multisig = vm.envAddress("MULTISIG_ADDRESS");
        string memory adminString = vm.envString("ADMIN_WALLETS");
        
        vm.startBroadcast();
        
        // Split comma-separated addresses
        address[] memory admins = parseAddressList(adminString);
        
        new FundingPlatform(multisig, admins);
        
        vm.stopBroadcast();
    }

    function parseAddressList(string memory str) internal pure returns (address[] memory) {
        // Count commas to determine array size
        uint256 count = 1;
        bytes memory strBytes = bytes(str);
        for (uint256 i = 0; i < strBytes.length; i++) {
            if (strBytes[i] == ",") count++;
        }

        address[] memory addresses = new address[](count);
        uint256 currentIndex = 0;
        uint256 start = 0;

        for (uint256 i = 0; i < strBytes.length; i++) {
            if (strBytes[i] == ",") {
                addresses[currentIndex] = parseAddr(substring(str, start, i));
                start = i + 1;
                currentIndex++;
            }
        }
        addresses[currentIndex] = parseAddr(substring(str, start, strBytes.length));

        return addresses;
    }

    function substring(string memory str, uint256 startIndex, uint256 endIndex) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        bytes memory result = new bytes(endIndex - startIndex);
        for (uint256 i = startIndex; i < endIndex; i++) {
            result[i - startIndex] = strBytes[i];
        }
        return string(result);
    }

    function parseAddr(string memory s) internal pure returns (address) {
        bytes memory b = bytes(s);
        uint160 iaddr = 0;
        uint160 bint;
        // Skip 0x
        for (uint256 i = 2; i < b.length; i++) {
            bint = uint160(uint8(b[i]));
            if (bint >= 48 && bint <= 57) {
                bint -= 48;
            } else if (bint >= 65 && bint <= 70) {
                bint -= 55;
            } else if (bint >= 97 && bint <= 102) {
                bint -= 87;
            } else {
                continue; // Skip invalid chars
            }
            iaddr = (iaddr << 4) + bint;
        }
        return address(iaddr);
    }
}
