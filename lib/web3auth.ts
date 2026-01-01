/**
 * Web3 Authentication with Supabase
 * Supports Sign-In with Ethereum (SIWE), Sign-In with Solana (SIWS), and WalletConnect
 * 
 * Web3-first authentication - no email/password or social logins
 */

import { supabase } from './supabase'
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
    type: 'solana',
    name: 'Phantom',
    icon: '👻',
    description: 'Solana wallet',
  },
  {
    type: 'ethereum',
    name: 'Coinbase Wallet',
    icon: '🔵',
    description: 'Coinbase smart wallet',
  },
  {
    type: 'walletconnect',
    name: 'WalletConnect',
    icon: '🔗',
    description: 'Connect mobile wallet via QR',
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

    // Set the session in Supabase client
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })

    if (sessionError) {
      throw sessionError
    }

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

    // Set the session in Supabase client
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })

    if (sessionError) {
      throw sessionError
    }

    return { 
      data: { session, user }, 
      error: null, 
      address: publicKey,
      isNewUser 
    }

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

    // Set the session in Supabase client
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })

    if (sessionError) {
      throw sessionError
    }

    console.log('Coinbase Wallet auth successful:', address)
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
 * WalletConnect is always available as it uses QR codes
 * Requires NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to be set
 */
export function isWalletConnectAvailable(): boolean {
  return typeof window !== 'undefined' && !!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
}

/**
 * Sign in with WalletConnect (for mobile wallets)
 * Requires @walletconnect/ethereum-provider package
 * 
 * To enable WalletConnect:
 * 1. Install: pnpm add @walletconnect/ethereum-provider @walletconnect/modal
 * 2. Get Project ID from https://cloud.walletconnect.com/
 * 3. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in .env
 */
export async function signInWithWalletConnect() {
  try {
    // Dynamic import to avoid build errors if package not installed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    let EthereumProvider: typeof import('@walletconnect/ethereum-provider').EthereumProvider
    
    try {
      const module = await import('@walletconnect/ethereum-provider')
      EthereumProvider = module.EthereumProvider
    } catch {
      throw new Error(
        'WalletConnect not configured. Install @walletconnect/ethereum-provider and set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID'
      )
    }

    const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
    if (!projectId) {
      throw new Error('WalletConnect Project ID not configured. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in your environment.')
    }

    // Initialize WalletConnect provider
    const wcProvider = await EthereumProvider.init({
      projectId,
      chains: [1], // Ethereum Mainnet
      showQrModal: true,
      optionalChains: [137, 8453, 42161], // Polygon, Base, Arbitrum
    })

    // Connect wallet
    await wcProvider.connect()
    
    // Type assertion needed as ethers expects standard provider interface
    const provider = new ethers.BrowserProvider(wcProvider as unknown as ethers.Eip1193Provider)
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
      chainId: await provider.getNetwork().then(n => Number(n.chainId)),
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

    // Set the session in Supabase client
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })

    if (sessionError) {
      throw sessionError
    }

    console.log('✅ WalletConnect auth successful:', address)
    return { 
      data: { session, user }, 
      error: null, 
      address,
      isNewUser,
      walletType: 'walletconnect' as const
    }
  } catch (error) {
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
