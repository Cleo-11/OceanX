"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { 
  Play, 
  Store, 
  User, 
  Waves, 
  ChevronDown, 
  Wifi, 
  ShoppingBag, 
  TrendingUp,
  Anchor,
  Gauge,
  Zap,
  Target,
  Clock,
  Gem
} from "lucide-react"
import SubmarineIcon from "./SubmarineIcon"
import { getSubmarineByTier } from "@/lib/submarine-tiers"
import { apiClient, createSignaturePayload } from "@/lib/api"
import { WalletManager } from "@/lib/wallet"
import { Leaderboard } from "./leaderboard"
import "@/styles/design-system.css"

interface UserHomeProps {
  playerData: {
    id: string
    user_id: string
    wallet_address: string
    username: string
    submarine_tier: number
    total_resources_mined: number
    total_ocx_earned: number
    last_login: string
    nickel?: number
    cobalt?: number
    copper?: number
    manganese?: number
  }
  onPlayClick: () => void
  onSubmarineStoreClick: () => void
}

// Helper Components
function ResourceStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-md bg-black/20">
      <span className="text-sm text-[var(--text-tertiary)]">{label}</span>
      <span className="font-bold text-sm" style={{ color }}>{value.toLocaleString()}</span>
    </div>
  )
}

function StatRow({ 
  icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ReactNode
  label: string
  value: string
  color: string 
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-[rgba(255,255,255,0.08)] transition-colors hover:bg-white/5">
      <div className="flex items-center gap-3">
        <div 
          className="w-8 h-8 rounded-md flex items-center justify-center bg-[rgba(5,191,219,0.1)]"
          style={{ color }}
        >
          {icon}
        </div>
        <span className="text-[var(--text-secondary)]">{label}</span>
      </div>
      <span className="font-bold" style={{ color }}>{value}</span>
    </div>
  )
}

export function UserHome({ playerData, onPlayClick, onSubmarineStoreClick }: UserHomeProps) {
  const [isFloating, setIsFloating] = useState(false)
  const [ocxBalance, setOcxBalance] = useState<string | null>(null)
  const [ocxSymbol, setOcxSymbol] = useState<string>("OCX")
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [currentNetwork, setCurrentNetwork] = useState<string>("Disconnected")
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false)
  const [isWalletConnected, setIsWalletConnected] = useState<boolean>(!!playerData.wallet_address)
  const [displayWallet, setDisplayWallet] = useState<string | null>(playerData.wallet_address || null)
  const [walletChecked, setWalletChecked] = useState(false)
  const [currentLogIndex, setCurrentLogIndex] = useState(0)
  const [logEntryNumber, setLogEntryNumber] = useState(1)
  
  const router = useRouter()
  const currentSubmarine = getSubmarineByTier(playerData.submarine_tier)

  const captainLogMessages = useMemo(() => [
    "The depths await, Captain. Sonar detecting rich mineral deposits in the abyssal plains.",
    "Oceanic conditions optimal. All submarine systems operational and ready for deployment.",
    "Intelligence reports new treasure caches discovered in the deepest trenches.",
    "The ocean's mysteries call. Advanced mining equipment stands ready for extraction.",
    "Fleet status: All vessels primed for deep-sea expedition. Awaiting your command.",
  ], [])

  // Floating animation
  useEffect(() => {
    const interval = setInterval(() => setIsFloating(prev => !prev), 3000)
    return () => clearInterval(interval)
  }, [])

  // Fetch OCX balance and network
  useEffect(() => {
    async function fetchBalanceAndNetwork() {
      setBalanceLoading(true)
      try {
        const walletManager = WalletManager.getInstance()
        const connection = walletManager.getConnection()
        if (!connection || !isWalletConnected) {
          setCurrentNetwork("Disconnected")
          return
        }
        
        const network = await connection.provider.getNetwork()
        const networkName = network.chainId === BigInt(8453) ? "Base" 
          : network.chainId === BigInt(11155111) ? "Sepolia" : "Unknown"
        setCurrentNetwork(networkName)
        
        const { message } = createSignaturePayload(connection.address, "get-balance")
        const signature = await walletManager.signMessage(message)
        const resp = await apiClient.getPlayerBalance(connection.address, signature, message)
        if (resp.success && resp.data) {
          setOcxBalance(resp.data.balance)
          setOcxSymbol(resp.data.symbol || "OCX")
        }
      } catch {
        setOcxBalance(null)
        setCurrentNetwork("Disconnected")
      } finally {
        setBalanceLoading(false)
      }
    }
    fetchBalanceAndNetwork()
  }, [playerData.wallet_address, isWalletConnected])

  // Redirect on disconnect
  useEffect(() => {
    if (walletChecked && !isWalletConnected && typeof window !== "undefined") {
      window.location.href = "/auth"
    }
  }, [isWalletConnected, walletChecked])

  // Wallet disconnect detection
  useEffect(() => {
    async function syncAccounts(accounts?: string[]) {
      try {
        const walletManager = WalletManager.getInstance()
        let nextAccounts = accounts

        if (!nextAccounts && typeof window !== "undefined" && window.ethereum?.request) {
          nextAccounts = await window.ethereum.request({ method: "eth_accounts" }) as string[]
        }

        if (nextAccounts && nextAccounts.length > 0) {
          setIsWalletConnected(true)
          setDisplayWallet(nextAccounts[0])
        } else {
          setIsWalletConnected(false)
          setDisplayWallet(null)
          setOcxBalance(null)
          setCurrentNetwork("Disconnected")
          walletManager.disconnect()
          try { await fetch('/api/auth/signout', { method: 'POST' }) } catch { /* ignore */ }
        }
        setWalletChecked(true)
      } catch {
        setWalletChecked(true)
      }
    }

    syncAccounts()

    if (typeof window !== "undefined" && window.ethereum) {
      const handler = (accs: string[]) => syncAccounts(accs)
      window.ethereum.on("accountsChanged", handler)
      return () => { 
        try { window.ethereum?.removeListener("accountsChanged", handler) } catch { /* ignore */ }
      }
    }
    return undefined
  }, [])

  // Captain's log rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentLogIndex(prev => (prev + 1) % captainLogMessages.length)
      setLogEntryNumber(prev => prev + 1)
    }, 8000)
    return () => clearInterval(interval)
  }, [captainLogMessages.length])

  // Close dropdown on outside click
  useEffect(() => {
    if (showNetworkDropdown) {
      const handler = () => setShowNetworkDropdown(false)
      document.addEventListener('click', handler)
      return () => document.removeEventListener('click', handler)
    }
    return undefined
  }, [showNetworkDropdown])

  const getCurrentTimestamp = () => {
    return new Date().toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })
  }

  const depthProgress = Math.min((currentSubmarine.baseStats.depth / 1000) * 100, 100)

  return (
    <div className="ocean-home relative overflow-hidden">
      {/* Subtle depth gradient overlay */}
      <div className="depth-gradient" />
      
      {/* Ambient glow effects */}
      <div className="ocean-glow" style={{ top: '10%', left: '20%' }} />
      <div className="ocean-glow" style={{ bottom: '20%', right: '10%', opacity: 0.5 }} />

      <div className="container-ocean relative z-10 py-8 pb-24">
        {/* Header Section */}
        <header className="section-gap">
          <div className="text-center mb-8">
            <h1 className="heading-hero mb-2">
              Welcome Back, Captain
            </h1>
            <p className="text-body text-lg" style={{ color: 'var(--ocean-accent)' }}>
              {playerData.username}
            </p>
          </div>

          {/* Wallet & Balance Bar */}
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <div className="status-pill">
              <Waves 
                className={`w-4 h-4 ${isWalletConnected ? 'text-[var(--ocean-accent)]' : 'text-[var(--text-muted)]'}`} 
              />
              <span className="text-mono text-sm">
                {displayWallet ? `${displayWallet.slice(0, 6)}...${displayWallet.slice(-4)}` : "Not connected"}
              </span>
              <span 
                className="status-indicator" 
                style={{ background: isWalletConnected ? '#22C55E' : '#EF4444' }} 
              />
            </div>

            {/* Network Selector */}
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowNetworkDropdown(!showNetworkDropdown) }}
                className="status-pill interactive cursor-pointer"
              >
                <Wifi className="w-4 h-4" />
                <span>{currentNetwork}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              
              {showNetworkDropdown && (
                <div 
                  className="absolute top-full mt-2 right-0 w-48 card-elevated z-50"
                  style={{ padding: 'var(--space-2)' }}
                >
                  <div className="text-overline px-3 py-2 border-b border-[rgba(255,255,255,0.08)]">
                    Switch Network
                  </div>
                  <button className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-white/5 transition-colors">
                    🟢 Base (Mainnet)
                  </button>
                  <button className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-white/5 transition-colors">
                    🔵 Sepolia (Testnet)
                  </button>
                </div>
              )}
            </div>

            {/* OCX Balance */}
            <div className="ocx-amount">
              <Gem className="w-4 h-4" />
              <span className="font-bold">
                {balanceLoading ? '...' : (ocxBalance ?? '0')}
              </span>
              <span className="text-xs opacity-70">{ocxSymbol}</span>
            </div>
          </div>
        </header>

        {/* Main Grid Layout */}
        <div className="grid-main section-gap">
          {/* Left Column - Submarine Card */}
          <div className="space-y-6">
            {/* Submarine Display Card */}
            <div className="card-glass submarine-card">
              <div className="text-overline mb-1" style={{ color: 'var(--ocean-accent)' }}>
                Your Vessel
              </div>
              <h2 className="heading-card mb-1">{currentSubmarine.name}</h2>
              <p className="text-caption mb-6">Tier {currentSubmarine.tier}</p>

              {/* Submarine Icon */}
              <div className="submarine-icon-wrapper mb-6">
                <div 
                  className={`transition-transform duration-[3000ms] ease-in-out ${
                    isFloating ? 'translate-y-[-8px] rotate-1' : 'translate-y-[4px] -rotate-1'
                  }`}
                >
                  <SubmarineIcon 
                    tier={currentSubmarine.tier} 
                    size={160} 
                    className="drop-shadow-lg"
                  />
                </div>
              </div>

              {/* Stats Grid */}
              <div className="stats-grid mb-4">
                <div className="stat-item">
                  <div className="stat-icon">
                    <Anchor className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="stat-value">{currentSubmarine.baseStats.depth}m</div>
                    <div className="stat-label">Max Depth</div>
                  </div>
                </div>
                <div className="stat-item">
                  <div className="stat-icon">
                    <Gauge className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="stat-value">{currentSubmarine.baseStats.speed}x</div>
                    <div className="stat-label">Speed</div>
                  </div>
                </div>
              </div>

              {/* Depth Progress */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-caption">Depth Capability</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--ocean-accent)' }}>
                    {depthProgress.toFixed(0)}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-bar-fill" 
                    style={{ width: `${depthProgress}%` }}
                  />
                </div>
              </div>

              {/* Special Ability */}
              {currentSubmarine.specialAbility && (
                <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(5,191,219,0.1)] border border-[rgba(5,191,219,0.2)]">
                  <Zap className="w-4 h-4 text-[var(--ocean-accent)]" />
                  <span className="text-sm font-medium">Special Ability Ready</span>
                </div>
              )}
            </div>

            {/* Captain's Log - Terminal Style */}
            <div className="captains-log">
              <div className="captains-log-header">
                <span className="captains-log-indicator" />
                <span className="captains-log-title">Captain's Log</span>
                <span className="captains-log-timestamp">
                  Entry #{String(logEntryNumber).padStart(4, '0')} | {getCurrentTimestamp()}
                </span>
              </div>
              <div className="captains-log-entry">
                <span style={{ color: 'var(--ocean-accent)' }}>&gt;</span>{' '}
                {captainLogMessages[currentLogIndex]}
                <span className="captains-log-cursor" />
              </div>
            </div>
          </div>

          {/* Right Column - Actions & Stats */}
          <div className="space-y-6">
            {/* Action Buttons */}
            <div className="card-base" style={{ padding: 'var(--space-8)' }}>
              <div className="space-y-4">
                {/* Hero CTA - Dive Deep */}
                <button 
                  onClick={onPlayClick}
                  className="btn-primary btn-hero w-full group"
                >
                  <Play className="w-6 h-6 transition-transform group-hover:scale-110" fill="currentColor" />
                  <span>Dive Deep</span>
                </button>

                {/* Secondary CTA - Trade OCX */}
                <button 
                  onClick={() => router.push('/marketplace')}
                  className="btn-secondary w-full group"
                >
                  <ShoppingBag className="w-5 h-5 transition-transform group-hover:rotate-6" />
                  <span>Trade OCX</span>
                  <TrendingUp className="w-4 h-4 opacity-60" />
                </button>

                {/* Tertiary Actions */}
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={onSubmarineStoreClick}
                    className="btn-secondary flex-1"
                  >
                    <Store className="w-4 h-4" />
                    <span>Hangar</span>
                  </button>
                  <button 
                    onClick={() => router.push(`/profile?wallet=${playerData.wallet_address}`)}
                    className="btn-secondary flex-1"
                  >
                    <User className="w-4 h-4" />
                    <span>Profile</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Statistics Card */}
            <div className="card-base">
              <h3 className="heading-card mb-4">Captain Statistics</h3>
              
              {/* Resource Inventory */}
              <div className="mb-4 p-4 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)]">
                <div className="text-overline mb-3">Resource Inventory</div>
                <div className="grid grid-cols-2 gap-2">
                  <ResourceStat label="Nickel" value={playerData.nickel ?? 0} color="#05BFDB" />
                  <ResourceStat label="Cobalt" value={playerData.cobalt ?? 0} color="#3B82F6" />
                  <ResourceStat label="Copper" value={playerData.copper ?? 0} color="#F97316" />
                  <ResourceStat label="Manganese" value={playerData.manganese ?? 0} color="#A855F7" />
                </div>
              </div>

              {/* Key Stats */}
              <div className="space-y-3">
                <StatRow 
                  icon={<Target className="w-4 h-4" />}
                  label="Total Mined"
                  value={playerData.total_resources_mined.toLocaleString()}
                  color="var(--ocean-accent)"
                />
                <StatRow 
                  icon={<Gem className="w-4 h-4" />}
                  label="OCX Earned"
                  value={playerData.total_ocx_earned.toLocaleString()}
                  color="#22C55E"
                />
                <StatRow 
                  icon={<Clock className="w-4 h-4" />}
                  label="Last Dive"
                  value={new Date(playerData.last_login).toLocaleDateString()}
                  color="var(--text-tertiary)"
                />
              </div>

              {/* Experience Progress */}
              <div className="mt-6 pt-4 border-t border-[rgba(255,255,255,0.08)]">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-caption">Experience Progress</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--ocean-accent)' }}>
                    {Math.min(playerData.total_resources_mined / 100, 100).toFixed(0)}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-bar-fill" 
                    style={{ width: `${Math.min(playerData.total_resources_mined / 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Leaderboard Section */}
        <section className="section-gap">
          <Leaderboard currentUsername={playerData.username} />
        </section>
      </div>

      {/* Fixed Status Bar */}
      <div className="status-bar">
        <div className="status-bar-content">
          <div className="status-pill">
            <span className="status-indicator status-indicator-online" />
            <span className="font-medium">Online</span>
          </div>
          
          <div className="status-pill">
            <Anchor className="w-4 h-4 text-[var(--ocean-accent)]" />
            <span>Tier {playerData.submarine_tier}</span>
          </div>
          
          <div className="status-pill">
            <span className="status-indicator status-indicator-energy" />
            <span>Energy Full</span>
          </div>
        </div>
      </div>
    </div>
  )
}
