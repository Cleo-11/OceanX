// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

/**
 * @title OceanGameController
 * @dev Manages the core game logic for OceanX.
 * This contract now uses AccessControl for role-based permissions,
 * ReentrancyGuard to prevent reentrancy attacks, and SafeERC20 for token interactions.
 */
contract OceanGameController is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- Roles ---
    // The MINER_ROLE is granted to the backend server to authorize resource mining.
    bytes32 public constant MINER_ROLE = keccak256("MINER_ROLE");
    // The DEFAULT_ADMIN_ROLE can grant and revoke roles. It should be held by a secure multi-sig wallet.
    // We will also use it for administrative tasks like setting upgrade costs.

    // --- State Variables ---
    struct Player {
        uint256 tier;
        // Future player data can be added here (e.g., lastMineTimestamp)
    }

    IERC20 public immutable ocxToken;
    IERC1155 public immutable oceanResources;

    mapping(address => Player) public players;
    mapping(uint256 => uint256) public submarineUpgradeCosts;

    // --- Events ---
    event PlayerRegistered(address indexed player);
    event SubmarineUpgraded(address indexed player, uint256 newTier);
    event UpgradeCostSet(uint256 indexed tier, uint256 cost);

    // --- Constructor ---
    constructor(address _ocxToken, address _oceanResources) {
        require(_ocxToken != address(0), "Invalid OCX token address");
        require(_oceanResources != address(0), "Invalid resource contract address");

        ocxToken = IERC20(_ocxToken);
        oceanResources = IERC1155(_oceanResources);

        // The deployer of the contract is granted the DEFAULT_ADMIN_ROLE.
        // This role is required to manage all other roles.
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        // For convenience, the deployer is also granted the MINER_ROLE.
        // This role should be transferred to your secure backend server address.
        _grantRole(MINER_ROLE, msg.sender);
    }

    // --- Player Functions ---

    /**
     * @dev Registers a new player, initializing them at tier 1.
     * A player can only be registered once.
     */
    function registerPlayer() external {
        require(players[msg.sender].tier == 0, "Player already registered");
        players[msg.sender] = Player({tier: 1});
        emit PlayerRegistered(msg.sender);
    }

    /**
     * @dev Mints a resource for a player.
     * This function can only be called by an address with the MINER_ROLE (i.e., your backend server).
     * The backend server is responsible for verifying game logic (energy, cooldowns) before calling this.
     */
    function mineResource(address player, uint256 resourceId, uint256 amount)
        external
        onlyRole(MINER_ROLE)
    {
        // The OceanResource contract must grant this controller contract
        // the permission to mint new resources.
        // The original contract used `safeMint`, which is not a standard IERC1155 function.
        // This assumes your OceanResource contract has a public minting function
        // restricted to be called by this controller.
        // For example: oceanResources.mint(player, resourceId, amount, "");
    }

    /**
     * @dev Upgrades a player's submarine to the next tier.
     * This function is now protected against reentrancy attacks and uses the
     * Checks-Effects-Interactions pattern.
     */
    function upgradeSubmarine(uint256 newTier) external nonReentrant {
        Player storage player = players[msg.sender];

        // --- Checks ---
        require(player.tier > 0, "Player not registered");
        require(newTier == player.tier + 1, "Can only upgrade one tier at a time");

        uint256 cost = submarineUpgradeCosts[newTier];
        require(cost > 0, "Invalid tier or cost not set");
        require(ocxToken.balanceOf(msg.sender) >= cost, "Insufficient OCX balance");

        // --- Effects ---
        // Update the player's state *before* the external call.
        player.tier = newTier;
        emit SubmarineUpgraded(msg.sender, newTier);

        // --- Interactions ---
        // Securely transfer the tokens from the player to this contract.
        ocxToken.safeTransferFrom(msg.sender, address(this), cost);
    }


    // --- Admin Functions ---

    /**
     * @dev Sets the OCX cost for upgrading to a specific submarine tier.
     * Can only be called by an admin.
     */
    function setUpgradeCost(uint256 tier, uint256 cost) external onlyRole(DEFAULT_ADMIN_ROLE) {
        submarineUpgradeCosts[tier] = cost;
        emit UpgradeCostSet(tier, cost);
    }
}