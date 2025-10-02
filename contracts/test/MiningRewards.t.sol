// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/MiningRewards.sol";
import "../src/OceanToken.sol";

contract MiningRewardsTest is Test {
    MiningRewards public rewards;
    OceanToken public token;
    address public owner;
    address public player1;
    address public player2;
    address public gameServer;

    uint256 constant INITIAL_REWARD_RATE = 100 * 10**18; // 100 tokens per hour
    uint256 constant INITIAL_TOKEN_SUPPLY = 1000000 * 10**18;

    function setUp() public {
        owner = address(this);
        player1 = address(0x1);
        player2 = address(0x2);
        gameServer = address(0x999);
        
        // Deploy token first
        token = new OceanToken();
        
        // Deploy rewards contract
        rewards = new MiningRewards(address(token), INITIAL_REWARD_RATE);
        
        // Transfer tokens to rewards contract
        token.transfer(address(rewards), 500000 * 10**18);
        
        // Set game server as authorized
        rewards.setGameServer(gameServer, true);
    }

    function testInitialSetup() public {
        assertEq(rewards.rewardToken(), address(token));
        assertEq(rewards.rewardRatePerHour(), INITIAL_REWARD_RATE);
        assertTrue(rewards.authorizedServers(gameServer));
        assertEq(token.balanceOf(address(rewards)), 500000 * 10**18);
    }

    function testStartMining() public {
        vm.prank(gameServer);
        rewards.startMining(player1);
        
        (uint256 startTime, bool isActive) = rewards.miningState(player1);
        assertGt(startTime, 0);
        assertTrue(isActive);
    }

    function testStopMining() public {
        // Start mining first
        vm.prank(gameServer);
        rewards.startMining(player1);
        
        // Advance time by 1 hour
        vm.warp(block.timestamp + 3600);
        
        vm.prank(gameServer);
        uint256 earnedRewards = rewards.stopMining(player1);
        
        // Should earn approximately 1 hour worth of rewards
        assertApproxEqAbs(earnedRewards, INITIAL_REWARD_RATE, 1e15); // Allow small precision errors
        
        (uint256 startTime, bool isActive) = rewards.miningState(player1);
        assertEq(startTime, 0);
        assertFalse(isActive);
    }

    function testCalculateRewards() public {
        vm.prank(gameServer);
        rewards.startMining(player1);
        
        // Test different time intervals
        vm.warp(block.timestamp + 1800); // 30 minutes
        uint256 rewards30min = rewards.calculateRewards(player1);
        assertApproxEqAbs(rewards30min, INITIAL_REWARD_RATE / 2, 1e15);
        
        vm.warp(block.timestamp + 1800); // Another 30 minutes (1 hour total)
        uint256 rewards1hour = rewards.calculateRewards(player1);
        assertApproxEqAbs(rewards1hour, INITIAL_REWARD_RATE, 1e15);
        
        vm.warp(block.timestamp + 3600); // Another hour (2 hours total)
        uint256 rewards2hours = rewards.calculateRewards(player1);
        assertApproxEqAbs(rewards2hours, INITIAL_REWARD_RATE * 2, 1e15);
    }

    function testMultiplePlayersMining() public {
        // Start mining for both players
        vm.prank(gameServer);
        rewards.startMining(player1);
        
        vm.warp(block.timestamp + 1800); // 30 minutes later
        
        vm.prank(gameServer);
        rewards.startMining(player2);
        
        vm.warp(block.timestamp + 1800); // Another 30 minutes (1 hour for player1, 30 min for player2)
        
        uint256 rewards1 = rewards.calculateRewards(player1);
        uint256 rewards2 = rewards.calculateRewards(player2);
        
        assertApproxEqAbs(rewards1, INITIAL_REWARD_RATE, 1e15); // 1 hour
        assertApproxEqAbs(rewards2, INITIAL_REWARD_RATE / 2, 1e15); // 30 minutes
    }

    function testClaimRewards() public {
        uint256 initialBalance = token.balanceOf(player1);
        
        vm.prank(gameServer);
        rewards.startMining(player1);
        
        vm.warp(block.timestamp + 3600); // 1 hour
        
        vm.prank(gameServer);
        uint256 claimedAmount = rewards.claimRewards(player1);
        
        assertApproxEqAbs(claimedAmount, INITIAL_REWARD_RATE, 1e15);
        assertEq(token.balanceOf(player1), initialBalance + claimedAmount);
        
        // Should reset mining state after claiming
        (uint256 startTime, bool isActive) = rewards.miningState(player1);
        assertEq(startTime, 0);
        assertFalse(isActive);
    }

    function testUpdateRewardRate() public {
        uint256 newRate = 200 * 10**18;
        
        rewards.updateRewardRate(newRate);
        assertEq(rewards.rewardRatePerHour(), newRate);
        
        // Test that new rate applies to new mining sessions
        vm.prank(gameServer);
        rewards.startMining(player1);
        
        vm.warp(block.timestamp + 3600); // 1 hour
        
        uint256 calculatedRewards = rewards.calculateRewards(player1);
        assertApproxEqAbs(calculatedRewards, newRate, 1e15);
    }

    function testSetGameServer() public {
        address newServer = address(0x888);
        
        // Initially not authorized
        assertFalse(rewards.authorizedServers(newServer));
        
        // Authorize new server
        rewards.setGameServer(newServer, true);
        assertTrue(rewards.authorizedServers(newServer));
        
        // New server can start mining
        vm.prank(newServer);
        rewards.startMining(player1);
        
        // Deauthorize server
        rewards.setGameServer(newServer, false);
        assertFalse(rewards.authorizedServers(newServer));
    }

    function testOnlyAuthorizedServersCanCallFunctions() public {
        address unauthorizedServer = address(0x777);
        
        vm.prank(unauthorizedServer);
        vm.expectRevert("Not authorized game server");
        rewards.startMining(player1);
        
        vm.prank(unauthorizedServer);
        vm.expectRevert("Not authorized game server");
        rewards.stopMining(player1);
        
        vm.prank(unauthorizedServer);
        vm.expectRevert("Not authorized game server");
        rewards.claimRewards(player1);
    }

    function testOnlyOwnerCanUpdateSettings() public {
        vm.prank(player1);
        vm.expectRevert();
        rewards.updateRewardRate(200 * 10**18);
        
        vm.prank(player1);
        vm.expectRevert();
        rewards.setGameServer(address(0x888), true);
    }

    function testCannotStartMiningIfAlreadyActive() public {
        vm.prank(gameServer);
        rewards.startMining(player1);
        
        vm.prank(gameServer);
        vm.expectRevert("Mining already active");
        rewards.startMining(player1);
    }

    function testCannotStopMiningIfNotActive() public {
        vm.prank(gameServer);
        vm.expectRevert("Mining not active");
        rewards.stopMining(player1);
    }

    function testEmergencyWithdraw() public {
        uint256 contractBalance = token.balanceOf(address(rewards));
        uint256 ownerBalanceBefore = token.balanceOf(owner);
        
        rewards.emergencyWithdraw();
        
        assertEq(token.balanceOf(address(rewards)), 0);
        assertEq(token.balanceOf(owner), ownerBalanceBefore + contractBalance);
    }

    function testEvents() public {
        vm.expectEmit(true, false, false, true);
        emit MiningStarted(player1, block.timestamp);
        
        vm.prank(gameServer);
        rewards.startMining(player1);
        
        vm.warp(block.timestamp + 3600);
        
        vm.expectEmit(true, false, false, true);
        emit MiningEnded(player1, INITIAL_REWARD_RATE);
        
        vm.prank(gameServer);
        rewards.stopMining(player1);
    }

    // Define events for testing
    event MiningStarted(address indexed player, uint256 startTime);
    event MiningEnded(address indexed player, uint256 rewardsEarned);
}