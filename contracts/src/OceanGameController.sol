// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./OCXToken.sol";
import "./OceanResource.sol";

contract OceanGameController {
    OCXToken public token;
    OceanResource public resource;

    mapping(uint256 => bool) public jackpotClaimed;

    event JackpotMined(address indexed player, uint256 nodeId, uint256 reward);

    /// @notice Initializes the controller with deployed OCXToken and OceanResource addresses
    /// @param tokenAddress Address of the deployed OCXToken contract
    /// @param resourceAddress Address of the deployed OceanResource contract
    constructor(address tokenAddress, address resourceAddress) {
        token = OCXToken(tokenAddress);
        resource = OceanResource(resourceAddress);
    }

    /// @notice Allows players to mine a jackpot node. Mints OCX if valid.
    /// @param nodeId ID of the jackpot node
    function mineJackpot(uint256 nodeId) external {
        require(!jackpotClaimed[nodeId], "Already mined");

        OceanResource.ResourceNode memory node = resource.getNode(nodeId);
        require(node.resourceType == OceanResource.ResourceType.Jackpot, "Not jackpot");
        require(!node.mined, "Already mined");

        uint256 rewardAmount = 1000 * 1e18;

        jackpotClaimed[nodeId] = true;
        resource.markMined(nodeId);
        token.mint(msg.sender, rewardAmount);

        emit JackpotMined(msg.sender, nodeId, rewardAmount);
    }

    /// @notice Spawns a jackpot node into the OceanResource map
    /// @param value The value to associate with the jackpot
    function spawnJackpot(uint256 value) external {
        resource.spawnResource(OceanResource.ResourceType.Jackpot, value);
    }
}
