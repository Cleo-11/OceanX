// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./OCXToken.sol";
import "./OceanResource.sol";

contract OceanGameController {
    OCXToken public token;
    OceanResource public resource;

    mapping(uint256 => bool) public jackpotClaimed;

    event JackpotMined(address indexed player, uint256 nodeId, uint256 reward);

    constructor(address tokenAddress) {
        token = OCXToken(tokenAddress);
        resource = new OceanResource(address(this));
    }

    function mineJackpot(uint256 nodeId) external {
        require(!jackpotClaimed[nodeId], "Already mined");

        OceanResource.ResourceNode memory node = resource.getNode(nodeId);
        require(node.resourceType == OceanResource.ResourceType.Jackpot, "Not jackpot");
        require(!node.mined, "Already mined");

        // Example fixed cargo fill amount
        uint256 rewardAmount = 1000 * 1e18;

        jackpotClaimed[nodeId] = true;
        resource.markMined(nodeId);

        token.mint(msg.sender, rewardAmount);
        emit JackpotMined(msg.sender, nodeId, rewardAmount);
    }

    function spawnJackpot(uint256 value) external {
        resource.spawnResource(OceanResource.ResourceType.Jackpot, value);
    }
}
