/**
 * Web3 Authentication with Supabase
 * Supports Sign-In with Ethereum (SIWE), Sign-In with Solana (SIWS), and WalletConnect
 * 
 * Web3-first authentication - no email/password or social logins
 * Session cookies are set server-side (httpOnly) - no client-side session management needed
 */

import { ethers } from 'ethers'

export interface Web3AuthProvider {
  type: 'ethereum' | 'solana' | 'walletconnect'
  name: string
  icon: string
  description?: string
}

export const web3Providers: Web3AuthProvider[] = [
  {
    type: 'ethereum',
    name: 'MetaMask',
    icon: '🦊',
    description: 'Browser extension wallet',
  },
  {
    type: 'ethereum',
    name: 'Coinbase Wallet',
    icon: '🔵',
    description: 'Coinbase smart wallet (Base native)',
  },
  {
    type: 'walletconnect',
    name: 'WalletConnect',
    icon: '🔗',
    description: 'Mobile wallet via QR (Base)',
  },
]

/**
 * Sign in with Ethereum (SIWE/EIP-4361)
 */
export async function signInWithEthereum() {
  try {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('No Ethereum wallet detected. Please install MetaMask.')
    }

    // Request account access
    const provider = new ethers.BrowserProvider(window.ethereum)
    await provider.send('eth_requestAccounts', [])
    const signer = await provider.getSigner()
    const address = await signer.getAddress()

    // Create SIWE message
    const domain = window.location.host
    const origin = window.location.origin
    const nonce = generateNonce()
    const issuedAt = new Date().toISOString()

    const message = createSIWEMessage({
      domain,
      address,
      statement: 'Sign in to AbyssX with your Ethereum wallet',
      uri: origin,
      version: '1',
      chainId: await provider.getNetwork().then(n => Number(n.chainId)),
      nonce,
      issuedAt,
    })

    // Sign the message
    const signature = await signer.signMessage(message)

    // Call server-side SIWE endpoint for proper authentication
    // This prevents duplicate account creation and verifies signature server-side
    const response = await fetch('/api/auth/siwe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, signature, address }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'SIWE authentication failed')
    }

    const { session, user, isNewUser } = await response.json()

    // Session cookies are set server-side (httpOnly)
    // No need to call setSession - just return success
    console.log('✅ Ethereum auth successful, session cookies set server-side')

    return { 
      data: { session, user }, 
      error: null, 
      address,
      isNewUser 
    }
  } catch (error) {
    console.error('Ethereum sign-in error:', error)
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Failed to sign in with Ethereum'),
      address: null 
    }
  }
}

/**
 * Sign in with Solana (SIWS)
 */
export async function signInWithSolana() {
  try {
    if (typeof window === 'undefined' || !(window as any).solana) {
      throw new Error('No Solana wallet detected. Please install Phantom or Solflare.')
    }

    const solana = (window as any).solana
    
    // Connect to wallet
    const connectResponse = await solana.connect()
    const publicKey = connectResponse.publicKey.toString()

    // Create SIWS message
    const domain = window.location.host
    const origin = window.location.origin
    const nonce = generateNonce()
    const issuedAt = new Date().toISOString()

    const message = createSIWSMessage({
      domain,
      address: publicKey,
      statement: 'Sign in to AbyssX with your Solana wallet',
      uri: origin,
      version: '1',
      chainId: 'mainnet', // or 'devnet'
      nonce,
      issuedAt,
    })

    // Encode message
    const encodedMessage = new TextEncoder().encode(message)
    
    // Sign the message
    const signedMessage = await solana.signMessage(encodedMessage, 'utf8')
    const signature = Buffer.from(signedMessage.signature).toString('base64')

    // Call server-side SIWE endpoint (works for Solana too)
    const response = await fetch('/api/auth/siwe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, signature, address: publicKey }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Solana authentication failed')
    }

    const { session, user, isNewUser } = await response.json()

    // Session cookies are set server-side (httpOnly)
    // No need to call setSession - just return success
    console.log('✅ Solana auth successful, session cookies set server-side')

    return { 
      data: { session, user }, 
      error: null, 
      address: publicKey,
      isNewUser 
    }
  } catch (error) {
    console.error('Solana sign-in error:', error)
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Failed to sign in with Solana'),
      address: null 
    }
  }
}

/**
 * Sign in with Coinbase Wallet (SIWE/EIP-4361)
 */
export async function signInWithCoinbase() {
  try {
    if (typeof window === 'undefined') {
      throw new Error('Window object not available')
    }

    // Check for Coinbase Wallet
    const coinbaseProvider = (window as any).coinbaseWalletExtension || 
                            (window.ethereum && (window.ethereum as any).isCoinbaseWallet ? window.ethereum : null)
    
    if (!coinbaseProvider) {
      throw new Error('Coinbase Wallet not detected. Please install Coinbase Wallet extension.')
    }

    // Request account access
    const provider = new ethers.BrowserProvider(coinbaseProvider)
    await provider.send('eth_requestAccounts', [])
    const signer = await provider.getSigner()
    const address = await signer.getAddress()

    // Create SIWE message
    const domain = window.location.host
    const origin = window.location.origin
    const nonce = generateNonce()
    const issuedAt = new Date().toISOString()

    const message = createSIWEMessage({
      domain,
      address,
      statement: 'Sign in to AbyssX with your Coinbase Wallet',
      uri: origin,
      version: '1',
      chainId: 1, // Ethereum mainnet
      nonce,
      issuedAt,
    })

    // Sign the message
    const signature = await signer.signMessage(message)

    // Call server-side SIWE endpoint for proper authentication
    const response = await fetch('/api/auth/siwe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, signature, address }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Coinbase Wallet authentication failed')
    }

    const { session, user, isNewUser } = await response.json()

    // Session cookies are set server-side (httpOnly)
    // No need to call setSession - just return success
    console.log('✅ Coinbase Wallet auth successful, session cookies set server-side:', address)
    return { 
      data: { session, user }, 
      error: null, 
      address,
      isNewUser 
    }
  } catch (error) {
    console.error('Coinbase Wallet auth error:', error)
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Failed to sign in with Coinbase Wallet'),
      address: null,
    }
  }
}

/**
 * Generate a random nonce for SIWE/SIWS
 */
function generateNonce(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Create SIWE (Sign-In with Ethereum) message according to EIP-4361
 */
interface SIWEMessageParams {
  domain: string
  address: string
  statement: string
  uri: string
  version: string
  chainId: number
  nonce: string
  issuedAt: string
  expirationTime?: string
  notBefore?: string
  requestId?: string
  resources?: string[]
}

function createSIWEMessage(params: SIWEMessageParams): string {
  const {
    domain,
    address,
    statement,
    uri,
    version,
    chainId,
    nonce,
    issuedAt,
    expirationTime,
    notBefore,
    requestId,
    resources,
  } = params

  let message = `${domain} wants you to sign in with your Ethereum account:\n${address}\n\n${statement}\n\nURI: ${uri}\nVersion: ${version}\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt}`

  if (expirationTime) {
    message += `\nExpiration Time: ${expirationTime}`
  }

  if (notBefore) {
    message += `\nNot Before: ${notBefore}`
  }

  if (requestId) {
    message += `\nRequest ID: ${requestId}`
  }

  if (resources && resources.length > 0) {
    message += `\nResources:\n${resources.map(r => `- ${r}`).join('\n')}`
  }

  return message
}

/**
 * Create SIWS (Sign-In with Solana) message
 */
interface SIWSMessageParams {
  domain: string
  address: string
  statement: string
  uri: string
  version: string
  chainId: string
  nonce: string
  issuedAt: string
  expirationTime?: string
  notBefore?: string
  requestId?: string
  resources?: string[]
}

function createSIWSMessage(params: SIWSMessageParams): string {
  const {
    domain,
    address,
    statement,
    uri,
    version,
    chainId,
    nonce,
    issuedAt,
    expirationTime,
    notBefore,
    requestId,
    resources,
  } = params

  let message = `${domain} wants you to sign in with your Solana account:\n${address}\n\n${statement}\n\nURI: ${uri}\nVersion: ${version}\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt}`

  if (expirationTime) {
    message += `\nExpiration Time: ${expirationTime}`
  }

  if (notBefore) {
    message += `\nNot Before: ${notBefore}`
  }

  if (requestId) {
    message += `\nRequest ID: ${requestId}`
  }

  if (resources && resources.length > 0) {
    message += `\nResources:\n${resources.map(r => `- ${r}`).join('\n')}`
  }

  return message
}

/**
 * Check if wallet is available
 */
export function isEthereumAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.ethereum
}

export function isSolanaAvailable(): boolean {
  return typeof window !== 'undefined' && !!(window as any).solana
}

export function isCoinbaseAvailable(): boolean {
  if (typeof window === 'undefined') return false
  // Check for Coinbase Wallet extension
  return !!(window as any).coinbaseWalletExtension || 
         (!!window.ethereum && (window.ethereum as any).isCoinbaseWallet)
}

/**
 * Supported Chain Configuration
 * Base Mainnet: 8453
 * Base Sepolia (Testnet): 84532
 * Ethereum Sepolia (Testnet): 11155111
 */
export const CHAIN_CONFIG = {
  base: {
    mainnet: {
      chainId: 8453,
      name: 'Base',
      rpcUrl: 'https://mainnet.base.org',
      blockExplorer: 'https://basescan.org',
    },
    sepolia: {
      chainId: 84532,
      name: 'Base Sepolia',
      rpcUrl: 'https://sepolia.base.org',
      blockExplorer: 'https://sepolia.basescan.org',
    },
  },
  ethereum: {
    sepolia: {
      chainId: 11155111,
      name: 'Sepolia',
      rpcUrl: 'https://rpc.sepolia.org',
      blockExplorer: 'https://sepolia.etherscan.io',
    },
  },
} as const

// Legacy export for backward compatibility
export const BASE_CHAIN_CONFIG = CHAIN_CONFIG.base

// All supported chains for WalletConnect
export const SUPPORTED_CHAIN_IDS = [8453, 84532, 11155111] as const
export const SUPPORTED_CHAINS = [
  CHAIN_CONFIG.base.mainnet,
  CHAIN_CONFIG.base.sepolia,
  CHAIN_CONFIG.ethereum.sepolia,
]

// Determine active chain based on environment
export const ACTIVE_BASE_CHAIN = process.env.NEXT_PUBLIC_USE_BASE_MAINNET === 'true'
  ? CHAIN_CONFIG.base.mainnet
  : CHAIN_CONFIG.base.sepolia

/**
 * Check if WalletConnect is available
 * Returns true if WalletConnect Project ID is configured
 */
export function isWalletConnectAvailable(): boolean {
  return typeof window !== 'undefined' && !!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
}

/**
 * Sign in with WalletConnect (Mobile Wallet Support)
 * Configured for BASE blockchain only.
 * 
 * To enable:
 * 1. Install: pnpm add @walletconnect/ethereum-provider @walletconnect/modal
 * 2. Get Project ID from https://cloud.walletconnect.com/
 * 3. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in .env
 */
export async function signInWithWalletConnect(): Promise<{
  data: { session: any; user: any } | null
  error: Error | null
  address: string | null
  isNewUser?: boolean
  walletType?: 'walletconnect'
}> {
  try {
    // Dynamic import to avoid build errors if package not installed
    const { EthereumProvider } = await import('@walletconnect/ethereum-provider')

    const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
    if (!projectId) {
      throw new Error('WalletConnect Project ID not configured. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in your environment.')
    }

    // Initialize WalletConnect provider - Base + Sepolia testnets
    const wcProvider = await EthereumProvider.init({
      projectId,
      chains: [ACTIVE_BASE_CHAIN.chainId], // Primary chain (Base Sepolia or Base Mainnet)
      showQrModal: true,
      metadata: {
        name: 'AbyssX',
        description: 'Web3 Ocean Mining Game on Base',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://abyssx.io',
        icons: ['https://abyssx.io/icon.png'],
      },
      // Allow Base + Ethereum Sepolia testnets
      optionalChains: [...SUPPORTED_CHAIN_IDS],
      rpcMap: {
        8453: 'https://mainnet.base.org',
        84532: 'https://sepolia.base.org',
        11155111: 'https://rpc.sepolia.org',
      },
    })

    // Connect wallet
    await wcProvider.connect()
    
    // Check if connected to a supported chain
    const connectedChainId = wcProvider.chainId
    const isSupportedChain = SUPPORTED_CHAIN_IDS.includes(connectedChainId as typeof SUPPORTED_CHAIN_IDS[number])
    
    if (!isSupportedChain) {
      // Request chain switch to the active Base chain
      try {
        await wcProvider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${ACTIVE_BASE_CHAIN.chainId.toString(16)}` }],
        })
      } catch (switchError: any) {
        // If chain doesn't exist, add it
        if (switchError.code === 4902) {
          await wcProvider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${ACTIVE_BASE_CHAIN.chainId.toString(16)}`,
              chainName: ACTIVE_BASE_CHAIN.name,
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: [ACTIVE_BASE_CHAIN.rpcUrl],
              blockExplorerUrls: [ACTIVE_BASE_CHAIN.blockExplorer],
            }],
          })
        } else {
          throw new Error(`Please switch to a supported network: Base, Base Sepolia, or Sepolia`)
        }
      }
    }
    
    // Type assertion needed as ethers expects standard provider interface
    const provider = new ethers.BrowserProvider(wcProvider as any)
    const signer = await provider.getSigner()
    const address = await signer.getAddress()

    // Create SIWE message
    const domain = window.location.host
    const origin = window.location.origin
    const nonce = generateNonce()
    const issuedAt = new Date().toISOString()

    const message = createSIWEMessage({
      domain,
      address,
      statement: 'Sign in to AbyssX with your wallet via WalletConnect',
      uri: origin,
      version: '1',
      chainId: ACTIVE_BASE_CHAIN.chainId,
      nonce,
      issuedAt,
    })

    // Sign the message
    const signature = await signer.signMessage(message)

    // Call server-side SIWE endpoint for proper authentication
    const response = await fetch('/api/auth/siwe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, signature, address }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'WalletConnect authentication failed')
    }

    const { session, user, isNewUser } = await response.json()

    // Session cookies are set server-side (httpOnly)
    // No need to call setSession - just return success
    console.log(`✅ WalletConnect auth successful on ${ACTIVE_BASE_CHAIN.name}:`, address)
    return { 
      data: { session, user }, 
      error: null, 
      address,
      isNewUser,
      walletType: 'walletconnect'
    }
  } catch (error: any) {
    // Handle case where package isn't installed
    if (error.code === 'MODULE_NOT_FOUND' || error.message?.includes('Cannot find module')) {
      return {
        data: null,
        error: new Error('WalletConnect not installed. Run: pnpm add @walletconnect/ethereum-provider @walletconnect/modal'),
        address: null,
      }
    }
    console.error('WalletConnect auth error:', error)
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Failed to sign in with WalletConnect'),
      address: null,
    }
  }
}

/**
 * Disconnect WalletConnect session
 */
export async function disconnectWalletConnect() {
  try {
    // This is a no-op if WalletConnect isn't installed
    // The actual disconnect happens through the wallet UI
    console.log('WalletConnect session disconnect requested')
  } catch (error) {
    console.error('Error disconnecting WalletConnect:', error)
  }
}
