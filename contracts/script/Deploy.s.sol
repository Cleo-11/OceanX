// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/OCXToken.sol";
import "../src/OceanGameController.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        OCXToken token = new OCXToken();
        OceanGameController controller = new OceanGameController(address(token));

        // Transfer ownership of OCXToken to game controller
        token.transferOwnership(address(controller));

        vm.stopBroadcast();
    }
}
