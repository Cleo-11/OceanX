// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract OceanGameController is Ownable {
    using ECDSA for bytes32;

    address public backendSigner;

    mapping(address => uint256) public rewards;

    event RewardClaimed(address indexed player, uint256 amount);

    constructor(address _backendSigner) Ownable(msg.sender) {
        backendSigner = _backendSigner;
    }
    
    function updateBackendSigner(address _newSigner) external onlyOwner {
        backendSigner = _newSigner;
    }
    
    function claimReward(uint256 amount, uint256 nonce, bytes memory signature) external {
        bytes32 messageHash = keccak256(abi.encodePacked(msg.sender, amount, nonce, address(this)));
        
        // Manually create the ETH signed message hash
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));

        address recoveredSigner = ethSignedMessageHash.recover(signature);
        require(recoveredSigner == backendSigner, "Invalid signature");

        rewards[msg.sender] += amount;
        emit RewardClaimed(msg.sender, amount);
    }
    
    function getReward(address player) external view returns (uint256) {
        return rewards[player];
    }
}