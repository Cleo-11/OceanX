// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {UpgradeManager} from "../src/UpgradeManager.sol";

contract MockOCX is ERC20 {
    constructor() ERC20("Mock OCX", "MOCX") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract UpgradeManagerTest is Test {
    MockOCX private token;
    UpgradeManager private manager;

    address private constant TREASURY = address(0xBEEF);
    address private constant PLAYER = address(0xCAFE);

    function setUp() public {
        token = new MockOCX();
        manager = new UpgradeManager(address(token), TREASURY);

        token.mint(PLAYER, 10_000 ether);

        vm.prank(PLAYER);
        token.approve(address(manager), type(uint256).max);
    }

    function testDefaults() public {
        assertEq(manager.getCurrentTier(PLAYER), manager.MIN_TIER());
        assertEq(manager.getUpgradeCost(manager.MIN_TIER() + 1), 100 ether);
    }

    function testUpgradeTransfersTokensAndEmitsEvent() public {
        uint256 treasuryBefore = token.balanceOf(TREASURY);

        vm.expectEmit(true, false, false, false);
        emit UpgradeManager.SubmarineUpgraded(PLAYER, 1, 2, 100 ether, block.timestamp);

        vm.prank(PLAYER);
        manager.upgradeSubmarine(2);

        assertEq(manager.getCurrentTier(PLAYER), 2);
        assertEq(token.balanceOf(TREASURY), treasuryBefore + 100 ether);
    }

    function testSequentialRequirement() public {
        vm.prank(PLAYER);
        vm.expectRevert(bytes("UpgradeManager: sequential only"));
        manager.upgradeSubmarine(3);
    }

    function testOwnerCanAdjustCostsAndTreasury() public {
        manager.setUpgradeCost(2, 42 ether);
        assertEq(manager.getUpgradeCost(2), 42 ether);

        manager.setTreasury(address(0xAA));
        assertEq(manager.treasury(), address(0xAA));
    }

    function testOwnerCanAssignOperator() public {
        address operator = address(0xABCD);
        manager.setOperator(operator, true);
        assertTrue(manager.operators(operator));

        manager.setOperator(operator, false);
        assertFalse(manager.operators(operator));
    }

    function testOperatorCanUpgradeForPlayer() public {
        address operator = address(0xFEE1);
        manager.setOperator(operator, true);

        uint256 treasuryBefore = token.balanceOf(TREASURY);

        vm.expectEmit(true, false, false, false);
        emit UpgradeManager.SubmarineUpgraded(PLAYER, 1, 2, 100 ether, block.timestamp);

        vm.prank(operator);
        manager.upgradeSubmarineFor(PLAYER, 2);

        assertEq(manager.getCurrentTier(PLAYER), 2);
        assertEq(token.balanceOf(TREASURY), treasuryBefore + 100 ether);
    }

    function testUpgradeForRequiresAuthorization() public {
        address intruder = address(0xDEAD);
        vm.prank(intruder);
        vm.expectRevert(bytes("UpgradeManager: not operator"));
        manager.upgradeSubmarineFor(PLAYER, 2);
    }

    function testSyncTierAllowsMigration() public {
        manager.syncTier(PLAYER, 5);
        assertEq(manager.getCurrentTier(PLAYER), 5);

        manager.setUpgradeCost(6, 1 ether);

        vm.prank(PLAYER);
        manager.upgradeSubmarine(6);

        assertEq(manager.getCurrentTier(PLAYER), 6);
    }
}
