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
        require(msg.sender == gameController, "Unauthorized: Only GameController");
        _;
    }

    event ResourceSpawned(uint256 indexed id, ResourceType resourceType, uint256 value);
    event ResourceMined(uint256 indexed id);

    constructor(address _gameController) {
        gameController = _gameController;
    }

    /// @notice Allows spawning of a new resource node (only from GameController)
    function spawnResource(ResourceType resourceType, uint256 value) external onlyGameController {
        nodes[nextId] = ResourceNode(nextId, resourceType, value, false);
        emit ResourceSpawned(nextId, resourceType, value);
        nextId++;
    }

    /// @notice Marks a resource as mined (only from GameController)
    function markMined(uint256 nodeId) external onlyGameController {
        require(!nodes[nodeId].mined, "Already mined");
        nodes[nodeId].mined = true;
        emit ResourceMined(nodeId);
    }

    /// @notice Fetch details of a resource node
    function getNode(uint256 nodeId) external view returns (ResourceNode memory) {
        return nodes[nodeId];
    }

    /// @notice Update the GameController contract (in case you redeploy)
    function updateGameController(address newController) external onlyGameController {
        require(newController != address(0), "Invalid address");
        gameController = newController;
    }
}
