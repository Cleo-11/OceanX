"use client"

interface WalletConnectionModalProps {
  onConnect: () => void
  onClose: () => void
  isConnecting?: boolean
}

export function WalletConnectionModal({ onConnect, onClose, isConnecting = false }: WalletConnectionModalProps) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-slate-800 p-6 shadow-2xl">
        <h2 className="mb-4 text-2xl font-bold text-cyan-400">Connect Wallet</h2>

        <p className="mb-6 text-slate-300">
          Connect your Web3 wallet to start mining resources from the ocean floor and join multiplayer sessions.
        </p>

        <div className="space-y-3">
          <WalletOption
            name="MetaMask"
            icon="🦊"
            onClick={onConnect}
            disabled={isConnecting}
            description="Most popular Ethereum wallet"
          />
          <WalletOption
            name="WalletConnect"
            icon="🔗"
            onClick={onConnect}
            disabled={isConnecting}
            description="Connect with mobile wallets"
          />
          <WalletOption
            name="Coinbase Wallet"
            icon="🔵"
            onClick={onConnect}
            disabled={isConnecting}
            description="Coinbase's self-custody wallet"
          />
        </div>

        <div className="mt-6 rounded-lg bg-slate-700/50 p-3 text-xs text-slate-400">
          <div className="mb-2 font-semibold text-cyan-400">What you'll need:</div>
          <ul className="space-y-1">
            <li>• ETH for gas fees</li>
            <li>• OCX tokens for submarine upgrades</li>
            <li>• Signature to authenticate your wallet</li>
          </ul>
        </div>

        <button
          onClick={onClose}
          disabled={isConnecting}
          className="mt-6 w-full rounded-lg border border-slate-600 py-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

interface WalletOptionProps {
  name: string
  icon: string
  onClick: () => void
  disabled?: boolean
  description: string
}

function WalletOption({ name, icon, onClick, disabled = false, description }: WalletOptionProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center rounded-lg bg-slate-700 p-3 transition-colors hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="mr-3 text-2xl">{icon}</div>
      <div className="flex-1 text-left">
        <div className="font-medium text-white">{name}</div>
        <div className="text-xs text-slate-400">{description}</div>
      </div>
      {disabled && <div className="text-xs text-cyan-400">Connecting...</div>}
    </button>
  )
}
