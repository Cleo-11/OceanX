/**
 * Type declarations for optional Web3 packages
 * These are declared as optional dependencies - install when needed
 */

// WalletConnect Ethereum Provider
// Install: pnpm add @walletconnect/ethereum-provider @walletconnect/modal
declare module '@walletconnect/ethereum-provider' {
  export interface EthereumProviderOptions {
    projectId: string
    chains: number[]
    showQrModal?: boolean
    optionalChains?: number[]
    methods?: string[]
    events?: string[]
    rpcMap?: Record<number, string>
    metadata?: {
      name: string
      description: string
      url: string
      icons: string[]
    }
  }

  export interface EthereumProvider {
    connect(): Promise<void>
    disconnect(): Promise<void>
    request<T = unknown>(args: { method: string; params?: unknown[] }): Promise<T>
    on(event: string, callback: (...args: unknown[]) => void): void
    removeListener(event: string, callback: (...args: unknown[]) => void): void
    accounts: string[]
    chainId: number
  }

  export const EthereumProvider: {
    init(options: EthereumProviderOptions): Promise<EthereumProvider>
  }
}

// WalletConnect Modal (UI for QR code)
declare module '@walletconnect/modal' {
  export interface WalletConnectModalConfig {
    projectId: string
    chains?: string[]
    themeMode?: 'light' | 'dark'
    themeVariables?: Record<string, string>
    desktopWallets?: Array<{
      id: string
      name: string
      links: { universal: string; native?: string }
    }>
    mobileWallets?: Array<{
      id: string
      name: string
      links: { universal: string; native?: string }
    }>
  }

  export class WalletConnectModal {
    constructor(config: WalletConnectModalConfig)
    openModal(): Promise<void>
    closeModal(): void
    subscribeModal(callback: (state: { open: boolean }) => void): () => void
  }
}
