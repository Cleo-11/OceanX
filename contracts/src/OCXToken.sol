// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title OCXToken
 * @dev The primary ERC20 token for the OceanX game ecosystem.
 * The total supply is fixed at 1 billion tokens and is distributed to
 * predefined wallets upon deployment based on the project's tokenomics.
 */
contract OCXToken is ERC20, ERC20Burnable, Ownable {
    // --- Tokenomics Wallet Addresses ---
    // These are the wallets that will receive the initial token distribution.
    address private constant DEVELOPMENT_WALLET = 0x24B7369cF816bD7Ba656e3CeF4832c208beb8C65; // 20%
    address private constant REWARD_WALLET      = 0xf9d849fDc7d7ab79e8B47F0aB6f28b1F397Ed6A5; // 40%
    address private constant LP_WALLET          = 0x0e900854Dd860a3c0254C6D90A26972946479Db1; // 20%
    address private constant MARKETING_WALLET   = 0x7eC81a27c3aa3cC1F043A7227327b4E3ae9faB09; // 20%

    // --- Total Supply ---
    // The total number of tokens that will ever be created.
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18; // 1 Billion tokens with 18 decimals

    /**
     * @dev Sets the contract owner and distributes the total supply upon deployment.
     * @param initialOwner The address that will have ownership of the contract.
     */
    constructor(address initialOwner) ERC20("OceanX Token", "OCX") Ownable(initialOwner) {
        // --- Calculate Token Distribution Amounts ---
        // We calculate the share for each wallet based on the total supply and the specified percentages.
        // Solidity doesn't use decimals, so we multiply first and then divide to maintain precision.
        uint256 rewardSupply    = (TOTAL_SUPPLY * 40) / 100; // 40% for Rewards
        uint256 devSupply       = (TOTAL_SUPPLY * 20) / 100; // 20% for Development
        uint256 lpSupply        = (TOTAL_SUPPLY * 20) / 100; // 20% for Liquidity Pool
        uint256 marketingSupply = (TOTAL_SUPPLY * 20) / 100; // 20% for Marketing

        // --- Mint and Distribute Tokens ---
        // The _mint function creates the tokens and assigns them to the specified wallet.
        _mint(REWARD_WALLET, rewardSupply);
        _mint(DEVELOPMENT_WALLET, devSupply);
        _mint(LP_WALLET, lpSupply);
        _mint(MARKETING_WALLET, marketingSupply);
    }

    /**
     * @dev Allows the current owner to mint additional tokens.
     * NOTE: This function increases the total supply. If the supply should be
     * strictly fixed at 1 billion, you should consider removing this function.
     * @param to The address to mint new tokens to.
     * @param amount The amount of new tokens to mint.
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
