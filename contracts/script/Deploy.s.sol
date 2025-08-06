// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {OCXToken} from "../src/OCXToken.sol";
import {OceanGameController} from "../src/OceanGameController.sol";
import {OceanResource} from "../src/OceanResource.sol";

/**
 * @title Deploy Script for OceanX Contracts
 * @dev This script deploys all the core contracts for the OceanX game,
 * including the OCXToken with its predefined ownership and distribution.
 */
contract Deploy is Script {
    function run() external returns (OCXToken, OceanResource, OceanGameController) {
        // --- Configuration ---
        // This is the address that will become the owner of the contracts.
        // As per our discussion, this is set to your Development Wallet.
        address initialOwner = 0x24B7369cF816bD7Ba656e3CeF4832c208beb8C65;

        // Start broadcasting transactions. All subsequent calls will be sent to the network.
        vm.startBroadcast();

        // --- 1. Deploy OCXToken ---
        // We deploy the token contract, passing the initialOwner to its constructor.
        // The constructor will handle the token distribution automatically.
        OCXToken ocxToken = new OCXToken(initialOwner);
        console.log("OCXToken deployed at:", address(ocxToken));

        // --- 2. Deploy OceanResource (NFT Contract) ---
        // This contract likely manages in-game resources as NFTs.
        OceanResource oceanResource = new OceanResource(initialOwner);
        console.log("OceanResource deployed at:", address(oceanResource));

        // --- 3. Deploy OceanGameController ---
        // The constructor for OceanGameController currently only accepts one argument (the owner).
        // The call has been updated to match the contract's definition to fix the compilation error.
        OceanGameController oceanGameController = new OceanGameController(initialOwner);
        console.log("OceanGameController deployed at:", address(oceanGameController));

        // NOTE: For the game to function, the OceanGameController needs to know the addresses
        // of the OCXToken and OceanResource contracts. You will need to add a setter function
        // to your OceanGameController.sol contract (e.g., `function setAddresses(address _token, address _resource)`)
        // and then call it from this script after deployment.

        // Stop broadcasting.
        vm.stopBroadcast();

        // Return the deployed contract instances.
        return (ocxToken, oceanResource, oceanGameController);
    }
}
