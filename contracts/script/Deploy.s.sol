// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol"; // Import console for logging
import "../src/OCXToken.sol";
import "../src/OceanResource.sol";
import "../src/OceanGameController.sol";

contract Deploy is Script {
    // Address of your ALREADY DEPLOYED OCXToken on Sepolia
    address constant OCX_TOKEN_ADDRESS = 0x20cb1040D1f85c69d937A90eF2ee3cA73a3d4052;

    function run() external {
        // Get the deployer's private key from the environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Start broadcasting transactions signed with this key
        vm.startBroadcast(deployerPrivateKey);

        // --- We don't deploy OCXToken, we get an interface to it ---
        OCXToken token = OCXToken(OCX_TOKEN_ADDRESS);
        console.log("Using existing OCXToken at:", address(token));

        // --- Step 1: Deploy OceanResource ---
        // Deploy with address(0) so setGameController can be called later.
        OceanResource resource = new OceanResource(address(0));
        console.log("Deploying OceanResource...");
        console.log("OceanResource deployed at:", address(resource));

        // --- Step 2: Deploy the controller with the correct addresses ---
        console.log("Deploying OceanGameController...");
        OceanGameController controller = new OceanGameController(
            address(token),     // The existing token address
            address(resource)   // The newly deployed resource address
        );
        console.log("OceanGameController deployed at:", address(controller));

        // --- Step 3: Link the resource contract to the new controller ---
        console.log("Setting game controller on OceanResource...");
        resource.setGameController(address(controller));
        console.log("Controller set successfully.");

        vm.stopBroadcast();
        console.log("Deployment complete!");
    }
}