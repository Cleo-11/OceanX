/**
 * OCXToken Smart Contract Interface
 * 
 * This file provides TypeScript interfaces and utilities for interacting
 * with the OCXToken contract deployed on Sepolia testnet.
 */

import { ethers } from 'ethers';

// Contract address on Sepolia
export const OCX_TOKEN_ADDRESS = '0x0D30A0D0d4De399ED862D0509817aDE64b7d2Ea9';

// Sepolia chain ID
export const CHAIN_ID = 11155111;

// OCXToken ABI - includes only the functions we need
export const OCX_TOKEN_ABI = [
  // claim function - user calls this to claim tokens
  {
    inputs: [
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "nonce", type: "uint256" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
      { internalType: "uint8", name: "v", type: "uint8" },
      { internalType: "bytes32", name: "r", type: "bytes32" },
      { internalType: "bytes32", name: "s", type: "bytes32" }
    ],
    name: "claim",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  // balanceOf - check token balance
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  // nonces - get current nonce for an address
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "nonces",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  // name - token name
  {
    inputs: [],
    name: "name",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function"
  },
  // symbol - token symbol
  {
    inputs: [],
    name: "symbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function"
  },
  // decimals - token decimals
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function"
  },
  // Claimed event - emitted when tokens are claimed
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "account", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "nonce", type: "uint256" }
    ],
    name: "Claimed",
    type: "event"
  }
] as const;

/**
 * Get OCXToken contract instance (read-only)
 * @param provider - Ethers provider
 */
export function getOCXTokenContract(provider: ethers.Provider) {
  return new ethers.Contract(OCX_TOKEN_ADDRESS, OCX_TOKEN_ABI, provider);
}

/**
 * Get OCXToken contract instance with signer (for transactions)
 * @param signer - Ethers signer (wallet)
 */
export function getOCXTokenContractWithSigner(signer: ethers.Signer) {
  return new ethers.Contract(OCX_TOKEN_ADDRESS, OCX_TOKEN_ABI, signer);
}

/**
 * Get OCX balance for an address
 * @param address - Wallet address
 * @param provider - Ethers provider
 */
export async function getOCXBalance(address: string, provider: ethers.Provider): Promise<string> {
  const contract = getOCXTokenContract(provider);
  const balance = await contract.balanceOf(address);
  return ethers.formatEther(balance);
}

/**
 * Get current nonce for an address
 * @param address - Wallet address
 * @param provider - Ethers provider
 */
export async function getCurrentNonce(address: string, provider: ethers.Provider): Promise<bigint> {
  const contract = getOCXTokenContract(provider);
  return await contract.nonces(address);
}
