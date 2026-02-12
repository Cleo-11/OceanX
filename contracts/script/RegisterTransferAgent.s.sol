// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {OCXToken} from "../src/OCXToken.sol";

/**
 * @title RegisterTransferAgent
 * @notice Registers the UpgradeManager as a transferAgent on an already-deployed OCXToken.
 *         Must be called by the OCXToken owner.
 *
 * Usage:
 *   forge script script/RegisterTransferAgent.s.sol:RegisterTransferAgent \
 *     --rpc-url $RPC_URL --broadcast
 *
 * Environment variables:
 *   PRIVATE_KEY              - OCXToken owner private key
 *   OCX_TOKEN_ADDRESS        - Deployed OCXToken address
 *   UPGRADE_MANAGER_ADDRESS  - Deployed UpgradeManager address to register
 */
contract RegisterTransferAgent is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address ocxTokenAddress = vm.envAddress("OCX_TOKEN_ADDRESS");
        address upgradeManagerAddress = vm.envAddress("UPGRADE_MANAGER_ADDRESS");

        require(ocxTokenAddress != address(0), "OCX_TOKEN_ADDRESS not set");
        require(upgradeManagerAddress != address(0), "UPGRADE_MANAGER_ADDRESS not set");

        console.log("Owner:", vm.addr(deployerPrivateKey));
        console.log("OCXToken:", ocxTokenAddress);
        console.log("UpgradeManager:", upgradeManagerAddress);

        vm.startBroadcast(deployerPrivateKey);

        OCXToken ocxToken = OCXToken(ocxTokenAddress);
        ocxToken.setTransferAgent(upgradeManagerAddress, true);
        console.log(unicode"✅ UpgradeManager registered as transferAgent on OCXToken");

        vm.stopBroadcast();
    }
}
