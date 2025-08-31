"use client"

interface WalletConnectionModalProps {
  onConnect: () => void
  onClose: () => void
  isConnecting?: boolean
}

export function WalletConnectionModal({ onConnect, onClose, isConnecting = false }: WalletConnectionModalProps) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md">
      <div className="w-full max-w-md rounded-xl bg-slate-800/90 p-6 shadow-glow border border-cyan-500/30 relative overflow-hidden">
        {/* Hexagon pattern background */}
        <div className="absolute inset-0 bg-hexagon-pattern opacity-5"></div>
        
        {/* Animated blockchain grid lines */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-30 animate-shimmer"></div>
          <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-30 animate-shimmer"></div>
          <div className="absolute top-0 left-0 h-full w-0.5 bg-gradient-to-b from-transparent via-cyan-400 to-transparent opacity-30 animate-shimmer"></div>
          <div className="absolute top-0 right-0 h-full w-0.5 bg-gradient-to-b from-transparent via-cyan-400 to-transparent opacity-30 animate-shimmer"></div>
        </div>
        
        <div className="relative">
          <div className="flex items-center mb-4">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Connect Wallet</h2>
            {/* Blockchain icon */}
            <svg className="w-6 h-6 ml-2 text-cyan-400 animate-spin-slow" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L22 8.5V15.5L12 22L2 15.5V8.5L12 2Z" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M12 15.5V22M12 15.5L22 8.5M12 15.5L2 8.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M12 8.5V2M12 8.5L22 15.5M12 8.5L2 15.5" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>

          <p className="mb-6 text-slate-300 text-opacity-90 backdrop-blur-sm">
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

          <div className="mt-6 rounded-lg bg-slate-700/40 backdrop-blur-md p-4 text-xs text-slate-300 border border-slate-600/50 shadow-inner-glow">
            <div className="mb-2 font-semibold text-cyan-400 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              What you'll need:
            </div>
            <ul className="space-y-2">
              <li className="flex items-center">
                <span className="mr-2 text-xs text-cyan-400">•</span>
                <span>ETH for gas fees</span>
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-xs text-cyan-400">•</span>
                <span>OCX tokens for submarine upgrades</span>
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-xs text-cyan-400">•</span>
                <span>Signature to authenticate your wallet</span>
              </li>
            </ul>
          </div>

          <button
            onClick={onClose}
            disabled={isConnecting}
            className="mt-6 w-full rounded-lg border border-slate-600 py-2.5 text-slate-300 transition-all hover:bg-slate-700 hover:text-white hover:shadow-glow disabled:opacity-50 relative overflow-hidden"
          >
            {isConnecting && <div className="absolute inset-0 bg-shimmer animate-shimmer"></div>}
            <span className="relative">Cancel</span>
          </button>
        </div>
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
      className="flex w-full items-center rounded-lg bg-slate-700/60 backdrop-blur-sm border border-slate-600/50 p-4 transition-all 
                hover:bg-slate-600/80 hover:border-cyan-500/30 hover:shadow-glow disabled:opacity-50 disabled:cursor-not-allowed
                relative overflow-hidden group"
    >
      {/* Blockchain connection effect */}
      {disabled && <div className="absolute inset-0 bg-shimmer animate-shimmer"></div>}
      
      {/* Wallet icon with hexagon background */}
      <div className="relative mr-4 flex-shrink-0">
        <div className="w-10 h-10 flex items-center justify-center relative">
          <svg className="absolute inset-0 w-full h-full text-cyan-500 opacity-20 group-hover:opacity-40 transition-opacity" viewBox="0 0 24 24">
            <path d="M12 2L22 8.5V15.5L12 22L2 15.5V8.5L12 2Z" fill="currentColor" />
          </svg>
          <div className="text-2xl">{icon}</div>
        </div>
      </div>
      
      <div className="flex-1 text-left">
        <div className="font-medium text-white group-hover:text-cyan-300 transition-colors">{name}</div>
        <div className="text-xs text-slate-300/70">{description}</div>
      </div>
      
      {disabled ? (
        <div className="flex items-center text-xs text-cyan-400 animate-pulse">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Connecting...
        </div>
      ) : (
        <svg className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </button>
  )
}
