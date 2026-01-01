// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {OCXToken} from "../src/OCXToken.sol";
import {OceanGameController} from "../src/OceanGameController.sol";
// NOTE: OceanResource.sol is archived - mining happens off-chain in Supabase
// See contracts/src/_archive/README.md for details

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address backendSignerAddress = vm.envAddress("BACKEND_SIGNER_ADDRESS");

        if (backendSignerAddress == address(0)) {
            revert("BACKEND_SIGNER_ADDRESS is not set in .env file");
        }

        console.log("Deployer Address:", vm.addr(deployerPrivateKey));
        console.log("Backend Signer Address:", backendSignerAddress);
        console.log("--------------------------------------");

        vm.startBroadcast(deployerPrivateKey);

        console.log("Deploying OCXToken...");
        OCXToken ocxToken = new OCXToken(vm.addr(deployerPrivateKey), backendSignerAddress);
        console.log(unicode"✅ OCXToken deployed to:", address(ocxToken));

        console.log("Deploying OceanGameController...");
        OceanGameController gameController = new OceanGameController(backendSignerAddress);
        console.log(unicode"✅ OceanGameController deployed to:", address(gameController));

        vm.stopBroadcast();
        
        console.log(unicode"\nDeployment complete! 🎉");
        console.log("NOTE: Resource tracking is off-chain (Supabase)");
    }
}