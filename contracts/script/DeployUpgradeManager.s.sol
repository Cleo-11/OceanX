// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {OCXToken} from "../src/OCXToken.sol";
import {UpgradeManager} from "../src/UpgradeManager.sol";

/**
 * @title DeployUpgradeManager
 * @notice Deploys the UpgradeManager and registers it as a transferAgent on OCXToken.
 *
 * Usage:
 *   forge script script/DeployUpgradeManager.s.sol:DeployUpgradeManager \
 *     --rpc-url $RPC_URL --broadcast --verify
 *
 * Environment variables:
 *   PRIVATE_KEY             - Deployer / OCXToken owner private key
 *   OCX_TOKEN_ADDRESS       - Already-deployed OCXToken address
 *   TREASURY_ADDRESS        - Address that receives OCX from upgrades
 */
contract DeployUpgradeManager is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address ocxTokenAddress = vm.envAddress("OCX_TOKEN_ADDRESS");
        address treasuryAddress = vm.envAddress("TREASURY_ADDRESS");

        require(ocxTokenAddress != address(0), "OCX_TOKEN_ADDRESS not set");
        require(treasuryAddress != address(0), "TREASURY_ADDRESS not set");

        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("OCXToken:", ocxTokenAddress);
        console.log("Treasury:", treasuryAddress);
        console.log("--------------------------------------");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy UpgradeManager
        UpgradeManager upgradeManager = new UpgradeManager(ocxTokenAddress, treasuryAddress);
        console.log(unicode"✅ UpgradeManager deployed to:", address(upgradeManager));

        // 2. Register UpgradeManager as a transferAgent on OCXToken
        //    This is REQUIRED for safeTransferFrom to work (OCXToken blocks non-agent transfers)
        OCXToken ocxToken = OCXToken(ocxTokenAddress);
        ocxToken.setTransferAgent(address(upgradeManager), true);
        console.log(unicode"✅ UpgradeManager registered as transferAgent on OCXToken");

        vm.stopBroadcast();

        console.log(unicode"\nUpgradeManager deployment complete! 🎉");
        console.log("IMPORTANT: Update your frontend CONTRACT_ADDRESSES.UPGRADE_MANAGER to:", address(upgradeManager));
    }
}
