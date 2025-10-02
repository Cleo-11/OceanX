// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract OceanGameController is Ownable, EIP712 {
    using ECDSA for bytes32;

    uint256 private constant CLAIM_COOLDOWN = 5 minutes;

    address public backendSigner;

    mapping(address => uint256) public rewards;
    mapping(address => uint256) public nonces;
    mapping(bytes32 => bool) private consumedClaims;
    mapping(address => uint256) public lastClaimAt;

    bytes32 private constant CLAIM_REWARD_TYPEHASH =
        keccak256("ClaimReward(address player,uint256 amount,uint256 nonce,uint256 deadline)");

    event RewardClaimed(address indexed player, uint256 amount, uint256 nonce);
    event BackendSignerUpdated(address indexed newSigner);

    constructor(address _backendSigner)
        Ownable(msg.sender)
        EIP712("OceanGameController", "1")
    {
        require(_backendSigner != address(0), "Signer zero");
        backendSigner = _backendSigner;
        emit BackendSignerUpdated(_backendSigner);
    }
    
    function updateBackendSigner(address _newSigner) external onlyOwner {
        require(_newSigner != address(0), "Signer zero");
        backendSigner = _newSigner;
        emit BackendSignerUpdated(_newSigner);
    }
    
    function claimReward(
        address player,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(amount > 0, "Amount zero");
        require(block.timestamp <= deadline, "Signature expired");
        require(player != address(0), "Player zero");

        bytes32 structHash = keccak256(
            abi.encode(CLAIM_REWARD_TYPEHASH, player, amount, nonce, deadline)
        );
        bytes32 digest = _hashTypedDataV4(structHash);

        require(!consumedClaims[digest], "Claim already used");
        require(nonce == nonces[player], "Invalid nonce");

        address recoveredSigner = digest.recover(signature);
        require(recoveredSigner == backendSigner, "Invalid signature");

        require(block.timestamp >= lastClaimAt[player] + CLAIM_COOLDOWN, "Claim cooldown active");

        consumedClaims[digest] = true;
        nonces[player] = nonce + 1;
        rewards[player] += amount;
        lastClaimAt[player] = block.timestamp;

        emit RewardClaimed(player, amount, nonce);
    }
    
    function getReward(address player) external view returns (uint256) {
        return rewards[player];
    }
}