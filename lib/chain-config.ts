/**
 * Blockchain Network Configuration
 * Supports BASE Mainnet, BASE Sepolia (testnet), and Ethereum Sepolia
 */

export interface ChainConfig {
  chainId: number
  chainIdHex: string
  name: string
  rpcUrl: string
  blockExplorer: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
}

// Chain configurations
export const CHAINS: Record<string, ChainConfig> = {
  BASE_MAINNET: {
    chainId: 8453,
    chainIdHex: '0x2105',
    name: 'BASE Mainnet',
    rpcUrl: 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  BASE_SEPOLIA: {
    chainId: 84532,
    chainIdHex: '0x14a34',
    name: 'BASE Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia.basescan.org',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  SEPOLIA: {
    chainId: 11155111,
    chainIdHex: '0xaa36a7',
    name: 'Sepolia Testnet',
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.infura.io/v3/',
    blockExplorer: 'https://sepolia.etherscan.io',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
  },
}

// Allowed chains for authentication (BASE and Sepolia for now)
export const ALLOWED_CHAIN_IDS = [
  CHAINS.BASE_MAINNET.chainId,
  CHAINS.BASE_SEPOLIA.chainId,
  CHAINS.SEPOLIA.chainId, // Will be removed later
]

/**
 * Get the primary chain configuration based on environment
 */
export function getPrimaryChain(): ChainConfig {
  const useMainnet = process.env.NEXT_PUBLIC_USE_BASE_MAINNET === 'true'
  return useMainnet ? CHAINS.BASE_MAINNET : CHAINS.BASE_SEPOLIA
}

/**
 * Check if a chain ID is allowed for authentication
 */
export function isChainAllowed(chainId: number): boolean {
  return ALLOWED_CHAIN_IDS.includes(chainId)
}

/**
 * Get chain config by chain ID
 */
export function getChainConfig(chainId: number): ChainConfig | undefined {
  return Object.values(CHAINS).find(chain => chain.chainId === chainId)
}

/**
 * Get user-friendly chain name
 */
export function getChainName(chainId: number): string {
  const chain = getChainConfig(chainId)
  return chain?.name || `Unknown Chain (${chainId})`
}
