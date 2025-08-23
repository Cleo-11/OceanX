// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract OceanGameController is Ownable {
    // This line attaches the ECDSA library functions to the bytes32 type
    using ECDSA for bytes32;

    // Address of your backend signer
    address public backendSigner;

    // Example: track player mining rewards
    mapping(address => uint256) public rewards;

    event RewardClaimed(address indexed player, uint256 amount);

    constructor(address _backendSigner) Ownable(msg.sender) {
        backendSigner = _backendSigner;
    }

    /// @notice Update signer if you rotate backend keys
    function updateBackendSigner(address _newSigner) external onlyOwner {
        backendSigner = _newSigner;
    }

    /// @notice Claim reward if valid backend signature provided
    function claimReward(uint256 amount, uint256 nonce, bytes memory signature) external {
        // Construct the message hash
        bytes32 messageHash = keccak256(abi.encodePacked(msg.sender, amount, nonce, address(this)));
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();

        // Recover signer
        address recoveredSigner = ethSignedMessageHash.recover(signature);
        require(recoveredSigner == backendSigner, "Invalid signature");

        // Update player rewards
        rewards[msg.sender] += amount;
        emit RewardClaimed(msg.sender, amount);
    }

    /// @notice View player rewards
    function getReward(address player) external view returns (uint256) {
        return rewards[player];
    }
}