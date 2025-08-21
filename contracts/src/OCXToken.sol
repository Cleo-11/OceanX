// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract OCXToken is ERC20, ERC20Burnable, EIP712, Ownable {
    using ECDSA for bytes32;

    // --- Constants ---
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18;

    // Replace with your actual wallets & percentages (sum <= 100)
    address public constant DEVELOPMENT_WALLET = 0x24B7369cF816bD7Ba656e3CeF4832c208beb8C65; // 20%
    address public constant LP_WALLET          = 0x0e900854Dd860a3c0254C6D90A26972946479Db1; // 30%
    address public constant MARKETING_WALLET   = 0x7eC81a27c3aa3cC1F043A7227327b4E3ae9faB09; // 10%

    // Off-chain signer controlled by your backend
    address public authorizedSigner;

    // Replay protection: per-user nonce
    mapping(address => uint256) public nonces;

    // EIP-712 type hash
    // struct Claim { address account; uint256 amount; uint256 nonce; uint256 deadline; }
    bytes32 private constant CLAIM_TYPEHASH =
        keccak256("Claim(address account,uint256 amount,uint256 nonce,uint256 deadline)");

    event SignerUpdated(address indexed newSigner);
    event Claimed(address indexed account, uint256 amount, uint256 nonce);

    constructor(
        address initialOwner,
        address _authorizedSigner
    )
        ERC20("OceanX Token", "OCX")
        EIP712("OCXToken", "1")
        Ownable(initialOwner)
    {
        // ---- Compute allocations ----
        uint256 devSupply       = (TOTAL_SUPPLY * 20) / 100; // 20%
        uint256 lpSupply        = (TOTAL_SUPPLY * 30) / 100; // 30%
        uint256 marketingSupply = (TOTAL_SUPPLY * 10) / 100; // 10%
        uint256 distributed     = devSupply + lpSupply + marketingSupply;
        require(distributed <= TOTAL_SUPPLY, "Alloc > total");

        uint256 remainder = TOTAL_SUPPLY - distributed;

        // ---- Mint initial allocations ----
        _mint(DEVELOPMENT_WALLET, devSupply);
        _mint(LP_WALLET,          lpSupply);
        _mint(MARKETING_WALLET,   marketingSupply);

        // Remainder sits on the contract itself (locked)
        if (remainder > 0) {
            _mint(address(this), remainder);
        }

        authorizedSigner = _authorizedSigner;
        emit SignerUpdated(_authorizedSigner);

        // Optional: renounce ownership immediately
        // _transferOwnership(address(0));
    }

    // --- Admin: set signer (only before renouncing) ---
    function setAuthorizedSigner(address newSigner) external onlyOwner {
        authorizedSigner = newSigner;
        emit SignerUpdated(newSigner);
    }

    /**
     * @notice Users call this to mint tokens to themselves using a signature from your backend.
     * @dev User pays gas.
     */
    function claim(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external {
        require(block.timestamp <= deadline, "Signature expired");

        uint256 nonce = nonces[msg.sender];

        bytes32 structHash = keccak256(
            abi.encode(
                CLAIM_TYPEHASH,
                msg.sender,
                amount,
                nonce,
                deadline
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);

        address signer = ECDSA.recover(digest, v, r, s);
        require(signer == authorizedSigner, "Invalid signature");

        nonces[msg.sender] = nonce + 1;

        _mint(msg.sender, amount);

        emit Claimed(msg.sender, amount, nonce);
    }

    // No withdraw/airdrop/admin mint functions exist.
}
