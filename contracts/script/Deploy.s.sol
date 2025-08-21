// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/OCXToken.sol";

contract DeployOCX is Script {
    function run() external {
        // Load your deployer private key from .env
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // -----------------------------
        // Set these before deploying!
        // -----------------------------

        // Backend signer (address used to sign claim authorizations off-chain)
        address signer = 0xYourBackendSignerAddress;

        // Contract owner (your EOA for now, can renounce later)
        address owner = 0xYourDeployerWallet;

        // Deploy OCX Token
        OCXToken token = new OCXToken(owner, signer);

        console2.log("✅ OCXToken deployed at:", address(token));
        console2.log("   Owner:    ", owner);
        console2.log("   Signer:   ", signer);

        vm.stopBroadcast();
    }
}
