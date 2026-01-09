/**
 * Type definitions for MetaMask/Ethereum provider
 */

interface EthereumProvider {
  isMetaMask?: boolean
  isCoinbaseWallet?: boolean
  request(args: { method: string; params?: any[] }): Promise<any>
  on(event: string, handler: (params: any) => void): void
  removeListener(event: string, handler: (params: any) => void): void
  removeAllListeners?(event: string): void
}

interface Window {
  ethereum?: EthereumProvider
  solana?: any
}

declare global {
  interface Window {
    ethereum?: EthereumProvider
    solana?: any
  }
}

export {}
