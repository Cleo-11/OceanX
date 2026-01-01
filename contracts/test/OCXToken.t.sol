// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {OCXToken} from "../src/OCXToken.sol";

contract OCXTokenTest is Test {
    OCXToken public token;
    
    address public owner;
    address public authorizedSigner;
    uint256 public signerPrivateKey;
    
    address public user1;
    address public user2;
    
    // Constants from contract
    uint256 constant TOTAL_SUPPLY = 1_000_000_000 * 1e18;
    address constant DEVELOPMENT_WALLET = 0x24B7369cF816bD7Ba656e3CeF4832c208beb8C65;
    address constant LP_WALLET = 0x0e900854Dd860a3c0254C6D90A26972946479Db1;
    address constant MARKETING_WALLET = 0x7eC81a27c3aa3cC1F043A7227327b4E3ae9faB09;

    // EIP-712 domain separator components
    bytes32 constant CLAIM_TYPEHASH = keccak256("Claim(address account,uint256 amount,uint256 nonce,uint256 deadline)");

    function setUp() public {
        owner = address(this);
        user1 = address(0xCAFE);
        user2 = address(0xBEEF);
        
        // Create a deterministic signer for testing
        signerPrivateKey = 0xA11CE;
        authorizedSigner = vm.addr(signerPrivateKey);
        
        // Deploy token
        token = new OCXToken(owner, authorizedSigner);
    }

    // ============================================
    // DEPLOYMENT TESTS
    // ============================================

    function testInitialSetup() public view {
        assertEq(token.name(), "OceanX Token");
        assertEq(token.symbol(), "OCX");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), TOTAL_SUPPLY);
        assertEq(token.authorizedSigner(), authorizedSigner);
    }

    function testInitialDistribution() public view {
        uint256 devSupply = (TOTAL_SUPPLY * 20) / 100;
        uint256 lpSupply = (TOTAL_SUPPLY * 30) / 100;
        uint256 marketingSupply = (TOTAL_SUPPLY * 10) / 100;
        uint256 remainder = TOTAL_SUPPLY - devSupply - lpSupply - marketingSupply;

        assertEq(token.balanceOf(DEVELOPMENT_WALLET), devSupply);
        assertEq(token.balanceOf(LP_WALLET), lpSupply);
        assertEq(token.balanceOf(MARKETING_WALLET), marketingSupply);
        assertEq(token.balanceOf(address(token)), remainder);
    }

    function testContractIsTransferAgent() public view {
        assertTrue(token.transferAgents(address(token)));
    }

    // ============================================
    // CLAIM TESTS
    // ============================================

    function testSuccessfulClaim() public {
        uint256 amount = 1000 * 1e18;
        uint256 nonce = 0;
        uint256 deadline = block.timestamp + 1 hours;

        (uint8 v, bytes32 r, bytes32 s) = _signClaim(user1, amount, nonce, deadline);

        uint256 contractBalanceBefore = token.balanceOf(address(token));
        uint256 userBalanceBefore = token.balanceOf(user1);

        vm.prank(user1);
        token.claim(amount, nonce, deadline, v, r, s);

        assertEq(token.balanceOf(user1), userBalanceBefore + amount);
        assertEq(token.balanceOf(address(token)), contractBalanceBefore - amount);
        assertEq(token.nonces(user1), 1);
    }

    function testClaimEmitsEvent() public {
        uint256 amount = 500 * 1e18;
        uint256 nonce = 0;
        uint256 deadline = block.timestamp + 1 hours;

        (uint8 v, bytes32 r, bytes32 s) = _signClaim(user1, amount, nonce, deadline);

        vm.expectEmit(true, false, false, true);
        emit OCXToken.Claimed(user1, amount, nonce);

        vm.prank(user1);
        token.claim(amount, nonce, deadline, v, r, s);
    }

    function testClaimIncreasesNonce() public {
        uint256 amount = 100 * 1e18;
        
        // First claim
        (uint8 v1, bytes32 r1, bytes32 s1) = _signClaim(user1, amount, 0, block.timestamp + 1 hours);
        vm.prank(user1);
        token.claim(amount, 0, block.timestamp + 1 hours, v1, r1, s1);
        assertEq(token.nonces(user1), 1);

        // Second claim
        (uint8 v2, bytes32 r2, bytes32 s2) = _signClaim(user1, amount, 1, block.timestamp + 1 hours);
        vm.prank(user1);
        token.claim(amount, 1, block.timestamp + 1 hours, v2, r2, s2);
        assertEq(token.nonces(user1), 2);
    }

    function testCannotClaimWithExpiredSignature() public {
        uint256 amount = 1000 * 1e18;
        uint256 nonce = 0;
        uint256 deadline = block.timestamp - 1; // Already expired

        (uint8 v, bytes32 r, bytes32 s) = _signClaim(user1, amount, nonce, deadline);

        vm.prank(user1);
        vm.expectRevert("Signature expired");
        token.claim(amount, nonce, deadline, v, r, s);
    }

    function testCannotClaimZeroAmount() public {
        uint256 amount = 0;
        uint256 nonce = 0;
        uint256 deadline = block.timestamp + 1 hours;

        (uint8 v, bytes32 r, bytes32 s) = _signClaim(user1, amount, nonce, deadline);

        vm.prank(user1);
        vm.expectRevert("Amount zero");
        token.claim(amount, nonce, deadline, v, r, s);
    }

    function testCannotClaimWithInvalidNonce() public {
        uint256 amount = 1000 * 1e18;
        uint256 invalidNonce = 5; // Should be 0
        uint256 deadline = block.timestamp + 1 hours;

        (uint8 v, bytes32 r, bytes32 s) = _signClaim(user1, amount, invalidNonce, deadline);

        vm.prank(user1);
        vm.expectRevert("Invalid nonce");
        token.claim(amount, invalidNonce, deadline, v, r, s);
    }

    function testCannotReplayClaim() public {
        uint256 amount = 1000 * 1e18;
        uint256 nonce = 0;
        uint256 deadline = block.timestamp + 1 hours;

        (uint8 v, bytes32 r, bytes32 s) = _signClaim(user1, amount, nonce, deadline);

        // First claim succeeds
        vm.prank(user1);
        token.claim(amount, nonce, deadline, v, r, s);

        // Same signature replay fails (nonce incremented)
        vm.prank(user1);
        vm.expectRevert("Invalid nonce");
        token.claim(amount, nonce, deadline, v, r, s);
    }

    function testCannotClaimWithInvalidSignature() public {
        uint256 amount = 1000 * 1e18;
        uint256 nonce = 0;
        uint256 deadline = block.timestamp + 1 hours;

        // Sign for different user
        (uint8 v, bytes32 r, bytes32 s) = _signClaim(user2, amount, nonce, deadline);

        // user1 tries to use signature meant for user2
        vm.prank(user1);
        vm.expectRevert("Invalid signature");
        token.claim(amount, nonce, deadline, v, r, s);
    }

    function testCannotClaimWithUnauthorizedSigner() public {
        uint256 amount = 1000 * 1e18;
        uint256 nonce = 0;
        uint256 deadline = block.timestamp + 1 hours;

        // Sign with wrong private key
        uint256 wrongKey = 0xBAD;
        bytes32 structHash = keccak256(abi.encode(CLAIM_TYPEHASH, user1, amount, nonce, deadline));
        bytes32 digest = _getDigest(structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, digest);

        vm.prank(user1);
        vm.expectRevert("Invalid signature");
        token.claim(amount, nonce, deadline, v, r, s);
    }

    function testCannotClaimMoreThanContractBalance() public {
        uint256 contractBalance = token.balanceOf(address(token));
        uint256 amount = contractBalance + 1; // More than available
        uint256 nonce = 0;
        uint256 deadline = block.timestamp + 1 hours;

        (uint8 v, bytes32 r, bytes32 s) = _signClaim(user1, amount, nonce, deadline);

        vm.prank(user1);
        vm.expectRevert("Insufficient claimable balance");
        token.claim(amount, nonce, deadline, v, r, s);
    }

    // ============================================
    // TRANSFER RESTRICTION TESTS
    // ============================================

    function testWalletToWalletTransferBlocked() public {
        // First, give user1 some tokens via claim
        uint256 amount = 1000 * 1e18;
        (uint8 v, bytes32 r, bytes32 s) = _signClaim(user1, amount, 0, block.timestamp + 1 hours);
        vm.prank(user1);
        token.claim(amount, 0, block.timestamp + 1 hours, v, r, s);

        // Now user1 tries to transfer to user2 - should fail
        vm.prank(user1);
        vm.expectRevert("OCXToken: Transfers are disabled");
        token.transfer(user2, 100 * 1e18);
    }

    function testTransferAgentCanTransfer() public {
        // Set user1 as transfer agent
        token.setTransferAgent(user1, true);
        assertTrue(token.transferAgents(user1));

        // Give user1 tokens via claim
        uint256 amount = 1000 * 1e18;
        (uint8 v, bytes32 r, bytes32 s) = _signClaim(user1, amount, 0, block.timestamp + 1 hours);
        vm.prank(user1);
        token.claim(amount, 0, block.timestamp + 1 hours, v, r, s);

        // Now user1 (as transfer agent) can transfer
        vm.prank(user1);
        token.transfer(user2, 100 * 1e18);
        assertEq(token.balanceOf(user2), 100 * 1e18);
    }

    // ============================================
    // ADMIN TESTS
    // ============================================

    function testOwnerCanUpdateSigner() public {
        address newSigner = address(0x999);
        
        vm.expectEmit(true, false, false, false);
        emit OCXToken.SignerUpdated(newSigner);
        
        token.setAuthorizedSigner(newSigner);
        assertEq(token.authorizedSigner(), newSigner);
    }

    function testNonOwnerCannotUpdateSigner() public {
        vm.prank(user1);
        vm.expectRevert();
        token.setAuthorizedSigner(user1);
    }

    function testOwnerCanSetTransferAgent() public {
        assertFalse(token.transferAgents(user1));
        
        token.setTransferAgent(user1, true);
        assertTrue(token.transferAgents(user1));
        
        token.setTransferAgent(user1, false);
        assertFalse(token.transferAgents(user1));
    }

    function testCannotSetZeroAddressAsTransferAgent() public {
        vm.expectRevert("Agent zero");
        token.setTransferAgent(address(0), true);
    }

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    function _signClaim(
        address account,
        uint256 amount,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 structHash = keccak256(abi.encode(CLAIM_TYPEHASH, account, amount, nonce, deadline));
        bytes32 digest = _getDigest(structHash);
        (v, r, s) = vm.sign(signerPrivateKey, digest);
    }

    function _getDigest(bytes32 structHash) internal view returns (bytes32) {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("OCXToken")),
                keccak256(bytes("1")),
                block.chainid,
                address(token)
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }
}
