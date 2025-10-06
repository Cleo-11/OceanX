// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title UpgradeManager
 * @notice Coordinates submarine upgrades by charging OCX tokens and emitting
 *         canonical events the frontend and backend can rely on. Tiers are
 *         enforced sequentially to prevent players from skipping progress.
 */
contract UpgradeManager is Ownable {
    using SafeERC20 for IERC20;

    /// @dev OCX token used for upgrade payments
    IERC20 public immutable ocxToken;

    /// @dev Treasury destination for OCX paid during upgrades
    address public treasury;

    /// @dev Minimum and maximum supported submarine tiers
    uint256 public constant MIN_TIER = 1;
    uint256 public constant MAX_TIER = 15;

    /// @dev Mapping player => latest unlocked tier (defaults to MIN_TIER)
    mapping(address => uint256) private _currentTier;

    /// @dev Cost (in OCX wei) for reaching the given tier
    mapping(uint256 => uint256) public upgradeCosts;

    /// @dev Operators allowed to execute upgrades on behalf of players
    mapping(address => bool) public operators;

    event SubmarineUpgraded(
        address indexed player,
        uint256 previousTier,
        uint256 newTier,
        uint256 costPaid,
        uint256 timestamp
    );

    event TreasuryUpdated(address indexed newTreasury);
    event UpgradeCostUpdated(uint256 indexed tier, uint256 cost);
    event TierSynced(address indexed player, uint256 tier);
    event OperatorUpdated(address indexed operator, bool active);
    modifier onlyOperator() {
        require(msg.sender == owner() || operators[msg.sender], "UpgradeManager: not operator");
        _;
    }


    constructor(address token, address treasury_) Ownable(msg.sender) {
        require(token != address(0), "UpgradeManager: token zero");
        require(treasury_ != address(0), "UpgradeManager: treasury zero");
        ocxToken = IERC20(token);
        treasury = treasury_;
        _bootstrapCosts();
    }

    // ---------------------------------------------------------------------
    // View helpers
    // ---------------------------------------------------------------------

    function getCurrentTier(address player) public view returns (uint256) {
        uint256 tier = _currentTier[player];
        return tier == 0 ? MIN_TIER : tier;
    }

    function canUpgrade(address player, uint256 targetTier) external view returns (bool) {
        uint256 current = getCurrentTier(player);
        return targetTier == current + 1 && targetTier <= MAX_TIER;
    }

    // ---------------------------------------------------------------------
    // Admin controls
    // ---------------------------------------------------------------------

    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "UpgradeManager: treasury zero");
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    function setUpgradeCost(uint256 tier, uint256 cost) external onlyOwner {
        require(tier > MIN_TIER && tier <= MAX_TIER, "UpgradeManager: invalid tier");
        upgradeCosts[tier] = cost;
        emit UpgradeCostUpdated(tier, cost);
    }

    function setOperator(address operator, bool active) external onlyOwner {
        require(operator != address(0), "UpgradeManager: operator zero");
        operators[operator] = active;
        emit OperatorUpdated(operator, active);
    }

    function syncTier(address player, uint256 tier) external onlyOwner {
        require(player != address(0), "UpgradeManager: player zero");
        require(tier >= MIN_TIER && tier <= MAX_TIER, "UpgradeManager: invalid tier");
        _currentTier[player] = tier;
        emit TierSynced(player, tier);
    }

    // ---------------------------------------------------------------------
    // Core upgrade flow
    // ---------------------------------------------------------------------

    function upgradeSubmarine(uint256 targetTier) external {
        _applyUpgrade(msg.sender, targetTier);
    }

    function upgradeSubmarineFor(address player, uint256 targetTier) external onlyOperator {
        require(player != address(0), "UpgradeManager: player zero");
        _applyUpgrade(player, targetTier);
    }

    function getUpgradeCost(uint256 targetTier) external view returns (uint256) {
        return upgradeCosts[targetTier];
    }

    // ---------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------

    function _applyUpgrade(address player, uint256 targetTier) internal {
        uint256 current = getCurrentTier(player);
        require(targetTier == current + 1, "UpgradeManager: sequential only");
        require(targetTier <= MAX_TIER, "UpgradeManager: tier too high");

        uint256 cost = upgradeCosts[targetTier];
        if (cost > 0) {
            ocxToken.safeTransferFrom(player, treasury, cost);
        }

        _currentTier[player] = targetTier;

        emit SubmarineUpgraded(player, current, targetTier, cost, block.timestamp);
    }

    function _bootstrapCosts() internal {
        // Default OCX costs expressed in 18 decimal wei. Tier 1 is free (starting tier).
        uint256[16] memory costs = [
            uint256(0), // 0 - unused
            0,          // 1 - starting tier
            100 ether,  // 2
            200 ether,  // 3
            350 ether,  // 4
            500 ether,  // 5
            750 ether,  // 6
            1000 ether, // 7
            1500 ether, // 8
            2000 ether, // 9
            2750 ether, // 10
            3500 ether, // 11
            4500 ether, // 12
            6000 ether, // 13
            7500 ether, // 14
            0           // 15 - Leviathan is prestige reward, no token cost
        ];

        for (uint256 tier = MIN_TIER + 1; tier <= MAX_TIER; tier++) {
            upgradeCosts[tier] = costs[tier];
        }
    }
}
