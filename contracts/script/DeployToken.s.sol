// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/OCXToken.sol"; // adjust path if needed

contract DeployToken is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        address initialOwner = vm.envAddress("DEPLOYER_ADDRESS");    // your EOA
        address authorizedSigner = vm.envAddress("BACKEND_SIGNER");  // backend wallet

        vm.startBroadcast(deployerPrivateKey);

        OCXToken token = new OCXToken(initialOwner, authorizedSigner);
        console.log("OCXToken deployed at:", address(token));

        vm.stopBroadcast();
    }
}
