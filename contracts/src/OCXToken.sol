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

    // Wallets for initial distribution
    address public constant DEVELOPMENT_WALLET = 0x24B7369cF816bD7Ba656e3CeF4832c208beb8C65; // 20%
    address public constant LP_WALLET          = 0x0e900854Dd860a3c0254C6D90A26972946479Db1; // 30%
    address public constant MARKETING_WALLET   = 0x7eC81a27c3aa3cC1F043A7227327b4E3ae9faB09; // 10%

    // Off-chain signer controlled by your backend
    address public authorizedSigner;
    mapping(address => uint256) public nonces;

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
        // ---- Compute and mint initial allocations ----
        uint256 devSupply       = (TOTAL_SUPPLY * 20) / 100;
        uint256 lpSupply        = (TOTAL_SUPPLY * 30) / 100;
        uint256 marketingSupply = (TOTAL_SUPPLY * 10) / 100;
        uint256 distributed     = devSupply + lpSupply + marketingSupply;
        require(distributed <= TOTAL_SUPPLY, "Alloc > total");

        uint256 remainder = TOTAL_SUPPLY - distributed;

        _mint(DEVELOPMENT_WALLET, devSupply);
        _mint(LP_WALLET,          lpSupply);
        _mint(MARKETING_WALLET,   marketingSupply);
        
        // Remainder is "locked" in the contract, available for future claims
        if (remainder > 0) {
            _mint(address(this), remainder);
        }

        authorizedSigner = _authorizedSigner;
        emit SignerUpdated(_authorizedSigner);
    }

    /**
     * @notice Users call this to mint tokens to themselves using a signature from your backend.
     * @dev User pays gas. This is the ONLY way for users to receive tokens after deployment.
     */
    function claim(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external {
        require(block.timestamp <= deadline, "Signature expired");

        uint256 nonce = nonces[msg.sender];

        bytes32 structHash = keccak256(
            abi.encode(CLAIM_TYPEHASH, msg.sender, amount, nonce, deadline)
        );
        bytes32 digest = _hashTypedDataV4(structHash);

        address signer = ECDSA.recover(digest, v, r, s);
        require(signer == authorizedSigner, "Invalid signature");

        nonces[msg.sender] = nonce + 1;

        // Mint new tokens from the contract's locked supply to the user
        _mint(msg.sender, amount);

        emit Claimed(msg.sender, amount, nonce);
    }
    
    /**
     * @dev
     * Overrides the internal _update function from ERC20 to disable wallet-to-wallet transfers.
     * This is the core of the new logic. It ensures that tokens can only be moved
     * when they are being minted (from address(0)) or burned (to address(0)).
     */
    function _update(address from, address to, uint256 value) internal override {
        // Allow minting (from zero address) and burning (to zero address)
        if (from == address(0) || to == address(0)) {
            // Also allow the initial distribution from the contract itself
            if (from == address(this)) {
                 super._update(from, to, value);
            } else {
                 super._update(from, to, value);
            }
        } else {
            // Revert any other transfer attempt (i.e., wallet-to-wallet)
            revert("OCXToken: Transfers are disabled");
        }
    }

    // --- Admin Functions ---
    function setAuthorizedSigner(address newSigner) external onlyOwner {
        authorizedSigner = newSigner;
        emit SignerUpdated(newSigner);
    }
}