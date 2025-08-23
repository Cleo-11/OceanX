// script/Deploy.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {OCXToken} from "../src/OCXToken.sol";
import {OceanGameController} from "../src/OceanGameController.sol";
import {OceanResource} from "../src/OceanResource.sol";

contract Deploy is Script {
    function run() external {
        // --- 1. Load Environment Variables ---
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address backendSignerAddress = vm.envAddress("BACKEND_SIGNER_ADDRESS");

        if (backendSignerAddress == address(0)) {
            revert("BACKEND_SIGNER_ADDRESS is not set in .env file");
        }

        console.log("Deployer Address:", vm.addr(deployerPrivateKey));
        console.log("Backend Signer Address:", backendSignerAddress);
        console.log("--------------------------------------");

        // --- 2. Start Broadcasting Transactions ---
        vm.startBroadcast(deployerPrivateKey);

        // --- 3. Deploy Contracts ---

        console.log("Deploying OCXToken...");
        OCXToken ocxToken = new OCXToken(vm.addr(deployerPrivateKey), backendSignerAddress);
        // CORRECTED LINE:
        console.log(unicode"✅ OCXToken deployed to:", address(ocxToken));

        console.log("Deploying OceanGameController...");
        OceanGameController gameController = new OceanGameController(backendSignerAddress);
        // CORRECTED LINE:
        console.log(unicode"✅ OceanGameController deployed to:", address(gameController));

        console.log("Deploying OceanResource...");
        OceanResource oceanResource = new OceanResource(address(gameController));
        // CORRECTED LINE:
        console.log(unicode"✅ OceanResource deployed to:", address(oceanResource));

        // --- 4. Stop Broadcasting ---
        vm.stopBroadcast();
        
        // CORRECTED LINE:
        console.log(unicode"\nDeployment complete! 🎉");
    }
}