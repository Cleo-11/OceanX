import { ethers } from "ethers"

export interface WalletConnection {
  address: string
  provider: ethers.BrowserProvider
  signer: ethers.JsonRpcSigner
}

export class WalletManager {
  private static instance: WalletManager
  private connection: WalletConnection | null = null

  static getInstance(): WalletManager {
    if (!WalletManager.instance) {
      WalletManager.instance = new WalletManager()
    }
    return WalletManager.instance
  }

  async connectWallet(): Promise<WalletConnection> {
    if (typeof window === "undefined" || !window.ethereum) {
      throw new Error("MetaMask not installed")
    }

    try {
      // Request account access
      await window.ethereum.request({ method: "eth_requestAccounts" })

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const address = await signer.getAddress()

      this.connection = { address, provider, signer }
      return this.connection
    } catch (error) {
      throw new Error("Failed to connect wallet")
    }
  }

  async signMessage(message: string): Promise<string> {
    if (!this.connection) {
      throw new Error("Wallet not connected")
    }

    return await this.connection.signer.signMessage(message)
  }

  async getBalance(): Promise<string> {
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
