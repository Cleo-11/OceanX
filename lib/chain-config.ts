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
    // The old default ('https://sepolia.infura.io/v3/' without a key) could
    // not serve requests, so "add network" in the wallet produced a broken RPC.
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
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
 * The chain the game's contracts (OCXToken, UpgradeManager) are deployed on.
 * Every transaction is sent here. Defaults to Ethereum Sepolia, matching
 * lib/contracts/ocx-token.ts (CHAIN_ID) and the server (CHAIN_ID=11155111).
 *
 *   NEXT_PUBLIC_CHAIN_ID=11155111   explicit (recommended)
 *   NEXT_PUBLIC_USE_BASE_MAINNET=true   legacy switch, honoured only when
 *                                       NEXT_PUBLIC_CHAIN_ID is not set
 *
 * It used to default to BASE Sepolia, where the contracts do not exist: the
 * wallet was asked to switch there and transactions went nowhere.
 */
export const DEFAULT_PRIMARY_CHAIN_ID = CHAINS.SEPOLIA.chainId

export function getPrimaryChain(): ChainConfig {
  const configured = Number.parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? '', 10)
  if (Number.isFinite(configured)) {
    const chain = getChainConfig(configured)
    if (chain) return chain
    console.warn(`NEXT_PUBLIC_CHAIN_ID=${configured} is not a known chain; using ${CHAINS.SEPOLIA.name}`)
  } else if (process.env.NEXT_PUBLIC_USE_BASE_MAINNET === 'true') {
    return CHAINS.BASE_MAINNET
  }
  return CHAINS.SEPOLIA
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
