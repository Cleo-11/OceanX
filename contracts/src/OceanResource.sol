// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract OceanResource {
    enum ResourceType { Metal, Rare, Jackpot }

    struct ResourceNode {
        uint256 id;
        ResourceType resourceType;
        uint256 value;
        bool mined;
    }

    mapping(uint256 => ResourceNode) public nodes;
    uint256 public nextId = 1;
    address public gameController;

    modifier onlyGameController() {
        require(msg.sender == gameController, "Unauthorized");
        _;
    }

    constructor(address _gameController) {
        gameController = _gameController;
    }

    function spawnResource(ResourceType resourceType, uint256 value) external onlyGameController {
        nodes[nextId] = ResourceNode(nextId, resourceType, value, false);
        nextId++;
    }

    function markMined(uint256 nodeId) external onlyGameController {
        nodes[nodeId].mined = true;
    }

    function getNode(uint256 nodeId) external view returns (ResourceNode memory) {
        return nodes[nodeId];
    }
}
