// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/OceanToken.sol";

contract OceanTokenTest is Test {
    OceanToken public token;
    address public owner;
    address public user1;
    address public user2;

    function setUp() public {
        owner = address(this);
        user1 = address(0x1);
        user2 = address(0x2);
        
        token = new OceanToken();
    }

    function testInitialSetup() public {
        assertEq(token.name(), "Ocean Mining Token");
        assertEq(token.symbol(), "OCEAN");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), 1000000 * 10**18); // 1M tokens
        assertEq(token.balanceOf(owner), 1000000 * 10**18);
    }

    function testTransfer() public {
        uint256 amount = 1000 * 10**18;
        
        token.transfer(user1, amount);
        
        assertEq(token.balanceOf(user1), amount);
        assertEq(token.balanceOf(owner), 999000 * 10**18);
    }

    function testApproveAndTransferFrom() public {
        uint256 amount = 500 * 10**18;
        
        token.approve(user1, amount);
        assertEq(token.allowance(owner, user1), amount);
        
        vm.prank(user1);
        token.transferFrom(owner, user2, amount);
        
        assertEq(token.balanceOf(user2), amount);
        assertEq(token.allowance(owner, user1), 0);
    }

    function testTransferFailsWithInsufficientBalance() public {
        uint256 amount = 2000000 * 10**18; // More than total supply
        
        vm.expectRevert();
        token.transfer(user1, amount);
    }

    function testTransferFromFailsWithInsufficientAllowance() public {
        uint256 amount = 1000 * 10**18;
        
        // No approval given
        vm.prank(user1);
        vm.expectRevert();
        token.transferFrom(owner, user2, amount);
    }

    function testBurnTokens() public {
        uint256 burnAmount = 100000 * 10**18;
        uint256 initialSupply = token.totalSupply();
        uint256 initialBalance = token.balanceOf(owner);
        
        token.burn(burnAmount);
        
        assertEq(token.totalSupply(), initialSupply - burnAmount);
        assertEq(token.balanceOf(owner), initialBalance - burnAmount);
    }

    function testMintTokens() public {
        uint256 mintAmount = 50000 * 10**18;
        uint256 initialSupply = token.totalSupply();
        uint256 initialBalance = token.balanceOf(user1);
        
        token.mint(user1, mintAmount);
        
        assertEq(token.totalSupply(), initialSupply + mintAmount);
        assertEq(token.balanceOf(user1), initialBalance + mintAmount);
    }

    function testOnlyOwnerCanMint() public {
        uint256 mintAmount = 1000 * 10**18;
        
        vm.prank(user1);
        vm.expectRevert();
        token.mint(user2, mintAmount);
    }

    function testPauseAndUnpause() public {
        // Pause the contract
        token.pause();
        assertTrue(token.paused());
        
        // Transfers should fail when paused
        vm.expectRevert();
        token.transfer(user1, 1000 * 10**18);
        
        // Unpause the contract
        token.unpause();
        assertFalse(token.paused());
        
        // Transfers should work again
        token.transfer(user1, 1000 * 10**18);
        assertEq(token.balanceOf(user1), 1000 * 10**18);
    }

    function testOnlyOwnerCanPause() public {
        vm.prank(user1);
        vm.expectRevert();
        token.pause();
    }

    function testEvents() public {
        uint256 amount = 1000 * 10**18;
        
        vm.expectEmit(true, true, false, true);
        emit Transfer(owner, user1, amount);
        token.transfer(user1, amount);
        
        vm.expectEmit(true, true, false, true);
        emit Approval(owner, user1, amount);
        token.approve(user1, amount);
    }

    // Test edge cases
    function testTransferZeroAmount() public {
        token.transfer(user1, 0);
        assertEq(token.balanceOf(user1), 0);
    }

    function testTransferToSelf() public {
        uint256 initialBalance = token.balanceOf(owner);
        token.transfer(owner, 1000 * 10**18);
        assertEq(token.balanceOf(owner), initialBalance);
    }

    function testMultipleTransfers() public {
        uint256 amount1 = 1000 * 10**18;
        uint256 amount2 = 2000 * 10**18;
        
        token.transfer(user1, amount1);
        token.transfer(user2, amount2);
        
        assertEq(token.balanceOf(user1), amount1);
        assertEq(token.balanceOf(user2), amount2);
        assertEq(token.balanceOf(owner), 997000 * 10**18);
    }
}