import { ethers } from "ethers"
import { CHAINS, getPrimaryChain, isChainAllowed, getChainName } from "./chain-config"
import { getOCXBalance } from "./contracts/ocx-token"

export type WalletProviderType = 'metamask' | 'walletconnect'

export interface WalletConnection {
  address: string
  provider: ethers.BrowserProvider
  signer: ethers.JsonRpcSigner
  chainId: number
  providerType?: WalletProviderType
}

export class WalletManager {
  private static instance: WalletManager
  private connection: WalletConnection | null = null
  private wcProvider: any = null // WalletConnect EthereumProvider instance

  static getInstance(): WalletManager {
    if (!WalletManager.instance) {
      WalletManager.instance = new WalletManager()
    }
    return WalletManager.instance
  }

  /**
   * Get the current network chain ID from MetaMask
   */
  async getCurrentChainId(): Promise<number> {
    if (typeof window === "undefined" || !window.ethereum) {
      throw new Error("MetaMask not installed")
    }

    const chainIdHex = await window.ethereum.request({ method: "eth_chainId" })
    return parseInt(chainIdHex as string, 16)
  }

  /**
   * Check if the current network is allowed (BASE or Sepolia)
   */
  async isOnAllowedNetwork(): Promise<{ allowed: boolean; chainId: number; chainName: string }> {
    const chainId = await this.getCurrentChainId()
    const allowed = isChainAllowed(chainId)
    const chainName = getChainName(chainId)
    
    return { allowed, chainId, chainName }
  }

  /**
   * Switch to a specific network
   */
  async switchNetwork(targetChainId: number): Promise<void> {
    if (typeof window === "undefined" || !window.ethereum) {
      throw new Error("MetaMask not installed")
    }

    const chainConfig = Object.values(CHAINS).find(chain => chain.chainId === targetChainId)
    if (!chainConfig) {
      throw new Error(`Unknown chain ID: ${targetChainId}`)
    }

    try {
      // Try to switch to the network
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainConfig.chainIdHex }],
      })
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: chainConfig.chainIdHex,
                chainName: chainConfig.name,
                rpcUrls: [chainConfig.rpcUrl],
                nativeCurrency: chainConfig.nativeCurrency,
                blockExplorerUrls: [chainConfig.blockExplorer],
              },
            ],
          })
        } catch (addError) {
          throw new Error(`Failed to add network: ${chainConfig.name}`)
        }
      } else {
        throw new Error(`Failed to switch network: ${switchError.message}`)
      }
    }
  }

  /**
   * Ensure the wallet is on an allowed network (BASE or Sepolia)
   * If not, prompt the user to switch to the primary chain
   */
  async ensureAllowedNetwork(): Promise<void> {
    const { allowed, chainName } = await this.isOnAllowedNetwork()
    
    if (!allowed) {
      const primaryChain = getPrimaryChain()
      console.log(`⚠️ Current network (${chainName}) is not allowed. Switching to ${primaryChain.name}...`)
      
      await this.switchNetwork(primaryChain.chainId)
      
      // Verify the switch was successful
      const newChainId = await this.getCurrentChainId()
      if (!isChainAllowed(newChainId)) {
        throw new Error(`Network switch failed. Please manually switch to BASE or Sepolia network.`)
      }
      
      console.log(`✅ Successfully switched to ${primaryChain.name}`)
    }
  }

  async connectWallet(): Promise<WalletConnection> {
    if (typeof window === "undefined" || !window.ethereum) {
      throw new Error("MetaMask not installed. Please install MetaMask or use WalletConnect.")
    }

    try {
      // Request account access
      await window.ethereum.request({ method: "eth_requestAccounts" })

      // Ensure we're on an allowed network BEFORE completing connection
      await this.ensureAllowedNetwork()

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const address = await signer.getAddress()
      const network = await provider.getNetwork()
      const chainId = Number(network.chainId)

      this.connection = { address, provider, signer, chainId, providerType: 'metamask' }
      return this.connection
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error("Failed to connect wallet")
    }
  }

  /**
   * Connect via WalletConnect (mobile wallets, QR code scanning)
   * Requires NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to be set
   */
  async connectWalletConnect(): Promise<WalletConnection> {
    try {
      const { EthereumProvider } = await import('@walletconnect/ethereum-provider')

      const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
      if (!projectId) {
        throw new Error('WalletConnect not configured. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in your environment.')
      }

      const primaryChain = getPrimaryChain()

      this.wcProvider = await EthereumProvider.init({
        projectId,
        chains: [primaryChain.chainId],
        showQrModal: true,
        metadata: {
          name: 'OceanX',
          description: 'Web3 Ocean Mining Game',
          url: typeof window !== 'undefined' ? window.location.origin : 'https://abyssx.io',
          icons: ['https://abyssx.io/icon.png'],
        },
        optionalChains: [8453, 84532, 11155111],
        rpcMap: {
          8453: 'https://mainnet.base.org',
          84532: 'https://sepolia.base.org',
          11155111: 'https://rpc.sepolia.org',
        },
      })

      await this.wcProvider.connect()

      const provider = new ethers.BrowserProvider(this.wcProvider as any)
      const signer = await provider.getSigner()
      const address = await signer.getAddress()
      const network = await provider.getNetwork()
      const chainId = Number(network.chainId)

      this.connection = { address, provider, signer, chainId, providerType: 'walletconnect' }
      return this.connection
    } catch (error: any) {
      if (error.code === 'MODULE_NOT_FOUND' || error.message?.includes('Cannot find module')) {
        throw new Error('WalletConnect not installed. Please use MetaMask instead.')
      }
      if (error instanceof Error) throw error
      throw new Error('Failed to connect via WalletConnect')
    }
  }

  /**
   * Ensure wallet is connected — auto-reconnects if MetaMask is available
   * and the user has previously authorized this site.
   * This is the preferred method to call before any transaction.
   * Returns the existing connection if alive, or reconnects silently,
   * or prompts MetaMask to connect.
   */
  async ensureConnected(): Promise<WalletConnection> {
    // If we already have a live connection, return it
    if (this.connection) {
      return this.connection
    }

    // Try to silently reconnect to MetaMask if accounts are already authorized
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        // eth_accounts doesn't prompt — returns [] if no authorized accounts
        const accounts: string[] = await window.ethereum.request({ method: 'eth_accounts' })
        if (accounts && accounts.length > 0) {
          // User has previously authorized — reconnect silently
          const provider = new ethers.BrowserProvider(window.ethereum)
          const signer = await provider.getSigner()
          const address = await signer.getAddress()
          const network = await provider.getNetwork()
          const chainId = Number(network.chainId)

          // Verify we're on an allowed network
          if (isChainAllowed(chainId)) {
            this.connection = { address, provider, signer, chainId, providerType: 'metamask' }
            console.log('🔄 Wallet auto-reconnected:', address)
            return this.connection
          }
        }
      } catch (err) {
        console.warn('Silent reconnect failed:', err)
      }

      // If silent reconnect didn't work, prompt MetaMask
      return this.connectWallet()
    }

    throw new Error('No Web3 wallet detected. Please install MetaMask or use WalletConnect.')
  }

  async signMessage(message: string): Promise<string> {
    if (!this.connection) {
      throw new Error("Wallet not connected")
    }

    return await this.connection.signer.signMessage(message)
  }

  /**
   * Get OCX token balance for the connected wallet
   * This fetches the ERC20 OCX token balance from the blockchain
   */
  async getBalance(): Promise<string> {
    if (!this.connection) {
      throw new Error("Wallet not connected")
    }

    // Fetch OCX token balance (not native ETH balance)
    return await getOCXBalance(this.connection.address, this.connection.provider)
  }

  /**
   * Get native ETH balance for the connected wallet
   */
  async getNativeBalance(): Promise<string> {
    if (!this.connection) {
      throw new Error("Wallet not connected")
    }

    const balance = await this.connection.provider.getBalance(this.connection.address)
    return ethers.formatEther(balance)
  }

  getConnection(): WalletConnection | null {
    return this.connection
  }

  disconnect(): void {
    if (this.wcProvider) {
      try {
        this.wcProvider.disconnect()
      } catch (err) {
        console.warn('WalletConnect disconnect error:', err)
      }
      this.wcProvider = null
    }
    this.connection = null
  }

  // Contract interaction helpers
  async executeContract(contractAddress: string, abi: any[], methodName: string, params: any[] = [], value?: string) {
    if (!this.connection) {
      throw new Error("Wallet not connected")
    }

    const contract = new ethers.Contract(contractAddress, abi, this.connection.signer)
    const options = value ? { value: ethers.parseEther(value) } : {}

    return await contract[methodName](...params, options)
  }

  async readContract(contractAddress: string, abi: any[], methodName: string, params: any[] = []) {
    if (!this.connection) {
      throw new Error("Wallet not connected")
    }

    const contract = new ethers.Contract(contractAddress, abi, this.connection.provider)
    return await contract[methodName](...params)
  }
}

export const walletManager = WalletManager.getInstance()
