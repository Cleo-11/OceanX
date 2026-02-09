"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
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
  Gem,
  Shield,
  Fuel,
  LogOut
} from "lucide-react"
import SubmarineIcon from "./SubmarineIcon"
import { getSubmarineByTier } from "@/lib/submarine-tiers"
import { apiClient, createSignaturePayload } from "@/lib/api"
import { WalletManager } from "@/lib/wallet"
import { getOCXBalanceReadOnly } from "@/lib/contracts"
import { supabase } from "@/lib/supabase"
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
function ResourceStat({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <motion.div 
      whileHover={{ scale: 1.02, backgroundColor: 'rgba(8, 131, 149, 0.15)' }}
      className="relative flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-cyan-500/20 overflow-hidden group"
    >
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
          {icon}
        </div>
        <span className="text-sm text-slate-400 font-medium">{label}</span>
      </div>
      <span className="relative font-bold text-lg" style={{ color }}>{value.toLocaleString()}</span>
    </motion.div>
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
    <motion.div 
      whileHover={{ x: 4, backgroundColor: 'rgba(8, 131, 149, 0.1)' }}
      className="flex items-center justify-between p-4 rounded-xl border border-slate-700/50 hover:border-cyan-500/30 transition-all duration-300"
    >
      <div className="flex items-center gap-4">
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-cyan-500/20 to-blue-500/20 shadow-lg shadow-cyan-500/10"
          style={{ color }}
        >
          {icon}
        </div>
        <span className="text-slate-300 font-medium">{label}</span>
      </div>
      <span className="font-bold text-lg" style={{ color }}>{value}</span>
    </motion.div>
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
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [syncedOcxEarned, setSyncedOcxEarned] = useState<number>(playerData.total_ocx_earned)
  
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

  // Sync on-chain OCX balance to DB (captures pre-fix claims)
  useEffect(() => {
    async function syncOnChainOCX() {
      if (!playerData.wallet_address) return
      try {
        const onChainBalanceStr = await getOCXBalanceReadOnly(playerData.wallet_address)
        const onChainBalance = parseFloat(onChainBalanceStr) || 0
        const dbBalance = playerData.total_ocx_earned || 0

        if (onChainBalance > dbBalance) {
          console.log(`🔄 Home: syncing OCX on-chain ${onChainBalance} > DB ${dbBalance}`)
          const { error } = await supabase
            .from("players")
            .update({ total_ocx_earned: onChainBalance })
            .eq("id", playerData.id)
          if (!error) {
            console.log(`✅ Home: DB synced total_ocx_earned = ${onChainBalance}`)
            setSyncedOcxEarned(onChainBalance)
          }
        }
      } catch (err) {
        console.error("Failed to sync on-chain OCX on home:", err)
      }
    }
    syncOnChainOCX()
  }, [playerData.wallet_address, playerData.id, playerData.total_ocx_earned])

  // Fetch OCX balance and network
  useEffect(() => {
    async function fetchBalanceAndNetwork() {
      if (isDisconnecting) return // Skip if manually disconnecting
      
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
          // Use total_ocx_earned (balance) from server; fall back to legacyTokenBalance
          const bal = resp.data.balance || resp.data.legacyTokenBalance || '0'
          setOcxBalance(bal)
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
  }, [playerData.wallet_address, isWalletConnected, isDisconnecting])

  // Redirect on disconnect
  useEffect(() => {
    if (walletChecked && !isWalletConnected && typeof window !== "undefined") {
      window.location.href = "/auth"
    }
  }, [isWalletConnected, walletChecked])

  // Wallet disconnect detection
  useEffect(() => {
    async function syncAccounts(accounts?: string[]) {
      if (isDisconnecting) return // Skip if manually disconnecting
      
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
  }, [isDisconnecting])

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

  const handleDisconnectWallet = async () => {
    setIsDisconnecting(true) // Prevent other effects from running
    
    try {
      // Request MetaMask to revoke permissions (triggers popup)
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          // Use wallet_revokePermissions to trigger MetaMask disconnect popup
          await window.ethereum.request({
            method: 'wallet_revokePermissions',
            params: [
              {
                eth_accounts: {}
              }
            ]
          })
          console.log('Wallet permissions revoked successfully')
        } catch (error: any) {
          // Handle user rejection or unsupported method
          if (error.code === 4001) {
            console.log('User rejected the disconnect request')
            setIsDisconnecting(false)
            return // Exit if user cancelled
          }
          // If wallet_revokePermissions is not supported, continue with session cleanup
          console.log('Wallet revoke not supported or failed, continuing with session cleanup:', error.message)
        }
      }

      // Call the signout API to clear JWT cookies
      try {
        const response = await fetch('/api/auth/signout', { 
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        
        if (!response.ok) {
          throw new Error('Signout API failed')
        }
        
        console.log('Session cleared successfully')
      } catch (fetchError) {
        console.error('Failed to clear session:', fetchError)
        // Continue anyway to ensure local cleanup happens
      }

      // Disconnect wallet manager
      const walletManager = WalletManager.getInstance()
      walletManager.disconnect()
      
      // Redirect to auth page
      router.push('/')
    } catch (error) {
      console.error('Error disconnecting wallet:', error)
      setIsDisconnecting(false)
      // Even if there's an error, try to redirect
      router.push('/')
    }
  }

  const depthProgress = Math.min((currentSubmarine.baseStats.depth / 1000) * 100, 100)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* Animated Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Gradient orbs */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/5 rounded-full blur-[150px]" />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" 
          style={{ 
            backgroundImage: 'linear-gradient(rgba(6,182,212,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.3) 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }} 
        />
      </div>

      <div className="relative z-10 container mx-auto px-6 py-8 pb-28 max-w-7xl">
        {/* Animated Header */}
        <motion.header 
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-12"
        >
          {/* Main Title with Glow */}
          <div className="relative inline-block mb-4">
            <div className="absolute inset-0 bg-cyan-500/30 blur-3xl animate-pulse" />
            <h1 className="relative text-5xl md:text-6xl font-black bg-gradient-to-r from-cyan-300 via-blue-400 to-cyan-300 bg-clip-text text-transparent tracking-tight">
              COMMAND CENTER
            </h1>
          </div>

          {/* Subtitle with decorative lines */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="h-px w-16 md:w-24 bg-gradient-to-r from-transparent to-cyan-500/50" />
            <div className="flex items-center gap-2 text-slate-400">
              <Anchor className="w-4 h-4" />
              <span className="text-sm uppercase tracking-[0.2em]">Welcome, Captain {playerData.username}</span>
              <Waves className="w-4 h-4" />
            </div>
            <div className="h-px w-16 md:w-24 bg-gradient-to-l from-transparent to-cyan-500/50" />
          </div>

          {/* Status HUD Bar */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="relative inline-block"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-2xl blur-xl" />
            <div className="relative flex items-center gap-4 md:gap-6 px-6 py-4 rounded-2xl bg-slate-900/70 backdrop-blur-xl border border-cyan-500/30 shadow-2xl shadow-cyan-500/10">
              {/* Wallet Status */}
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${isWalletConnected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
                <div className="text-left">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Wallet</div>
                  <div className="text-sm font-mono text-slate-300">
                    {displayWallet ? `${displayWallet.slice(0, 6)}...${displayWallet.slice(-4)}` : "Disconnected"}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="w-px h-10 bg-gradient-to-b from-transparent via-cyan-500/40 to-transparent" />

              {/* Network */}
              <div className="relative">
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowNetworkDropdown(!showNetworkDropdown) }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-cyan-500/50 transition-all"
                >
                  <Wifi className={`w-4 h-4 ${currentNetwork !== 'Disconnected' ? 'text-cyan-400' : 'text-slate-500'}`} />
                  <span className="text-sm text-slate-300">{currentNetwork}</span>
                  <ChevronDown className="w-3 h-3 text-slate-500" />
                </button>
                
                {showNetworkDropdown && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full mt-2 right-0 w-48 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-cyan-500/30 shadow-2xl overflow-hidden z-50"
                  >
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider px-4 py-3 border-b border-slate-700/50">
                      Switch Network
                    </div>
                    <button className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-300 transition-colors flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full" />
                      Base (Mainnet)
                    </button>
                    <button className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-300 transition-colors flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full" />
                      Sepolia (Testnet)
                    </button>
                  </motion.div>
                )}
              </div>

              {/* Divider */}
              <div className="w-px h-10 bg-gradient-to-b from-transparent via-cyan-500/40 to-transparent" />

              {/* OCX Balance */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-cyan-500 blur-md opacity-40 animate-pulse" />
                  <div className="relative w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Gem className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Balance</div>
                  <div className="text-lg font-bold text-cyan-300">
                    {balanceLoading ? '...' : (ocxBalance ?? '0')} <span className="text-sm text-slate-400">{ocxSymbol}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Decorative dots */}
          <div className="mt-6 flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.3s' }} />
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: '0.6s' }} />
          </div>
        </motion.header>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-12">
          {/* Left Column - Submarine Card */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="lg:col-span-5 space-y-6"
          >
            {/* Submarine Display Card */}
            <div className="relative group">
              {/* Outer glow */}
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/30 via-blue-500/30 to-cyan-500/30 rounded-3xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-cyan-500/30 p-8 overflow-hidden">
                {/* Animated border highlight */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/0 via-cyan-500/10 to-cyan-500/0 animate-pulse pointer-events-none" />
                
                {/* Header */}
                <div className="relative text-center mb-6">
                  <div className="text-[10px] text-cyan-400 uppercase tracking-[0.3em] mb-1">Currently Deployed</div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
                    {currentSubmarine.name}
                  </h2>
                  <div className="mt-2 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30">
                    <Shield className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm font-medium text-cyan-300">TIER {currentSubmarine.tier}</span>
                  </div>
                </div>

                {/* Submarine Icon with Floating Animation */}
                <div className="relative h-48 flex items-center justify-center mb-6">
                  {/* Glow behind submarine */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
                  </div>
                  
                  <motion.div 
                    animate={{ 
                      y: isFloating ? -12 : 8,
                      rotate: isFloating ? 2 : -2
                    }}
                    transition={{ duration: 3, ease: "easeInOut" }}
                    className="relative"
                  >
                    <SubmarineIcon 
                      tier={currentSubmarine.tier} 
                      size={180} 
                      className="drop-shadow-[0_0_30px_rgba(6,182,212,0.4)]"
                    />
                  </motion.div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                      <Anchor className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white">{currentSubmarine.baseStats.depth}m</div>
                      <div className="text-xs text-slate-400 uppercase tracking-wider">Max Depth</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                      <Gauge className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white">{currentSubmarine.baseStats.speed}x</div>
                      <div className="text-xs text-slate-400 uppercase tracking-wider">Speed</div>
                    </div>
                  </div>
                </div>

                {/* Depth Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-slate-400 uppercase tracking-wider">Depth Capability</span>
                    <span className="text-sm font-bold text-cyan-300">{depthProgress.toFixed(0)}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-800 overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-700/50 to-transparent" />
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${depthProgress}%` }}
                      transition={{ delay: 0.8, duration: 1, ease: "easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 relative"
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/20 rounded-full" />
                      <div className="absolute right-0 top-0 bottom-0 w-4 bg-white/30 rounded-full blur-sm" />
                    </motion.div>
                  </div>
                </div>

                {/* Special Ability */}
                {currentSubmarine.specialAbility && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30"
                  >
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-cyan-300">Special Ability Ready</div>
                      <div className="text-xs text-slate-400">{currentSubmarine.specialAbility}</div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Captain's Log - Holographic Terminal */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="relative"
            >
              <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-2xl blur-lg" />
              <div className="relative rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-cyan-500/30 overflow-hidden">
                {/* Terminal Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-800/50">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                    </div>
                    <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">Captain's Log</span>
                  </div>
                  <span className="text-xs font-mono text-slate-500">
                    Entry #{String(logEntryNumber).padStart(4, '0')} · {getCurrentTimestamp()}
                  </span>
                </div>
                
                {/* Terminal Body */}
                <div className="p-4 font-mono text-sm">
                  <div className="flex items-start gap-2 text-slate-300">
                    <span className="text-cyan-400 select-none">&gt;</span>
                    <span className="leading-relaxed">{captainLogMessages[currentLogIndex]}</span>
                    <span className="w-2 h-5 bg-cyan-400 animate-pulse ml-1" />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Column - Actions & Stats */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="lg:col-span-7 space-y-6"
          >
            {/* Action Buttons Panel */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-3xl blur-xl opacity-50 group-hover:opacity-80 transition-opacity duration-500" />
              
              <div className="relative rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-cyan-500/20 p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-cyan-400 to-blue-500" />
                  Mission Control
                </h3>
                
                <div className="space-y-4">
                  {/* Hero CTA - Dive Deep */}
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onPlayClick}
                    className="relative w-full group overflow-hidden rounded-xl"
                  >
                    {/* Animated glow */}
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500 opacity-80 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500 blur-xl opacity-50 group-hover:opacity-80 transition-opacity" />
                    
                    <div className="relative flex items-center justify-center gap-3 py-5 px-8">
                      <Play className="w-7 h-7 text-white" fill="white" />
                      <span className="text-xl font-bold text-white tracking-wide">DIVE DEEP</span>
                    </div>
                    
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  </motion.button>

                  {/* Secondary Actions */}
                  <div className="grid grid-cols-2 gap-3">
                    <motion.button 
                      whileHover={{ scale: 1.02, borderColor: 'rgba(6,182,212,0.6)' }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => router.push('/marketplace')}
                      className="flex items-center justify-center gap-2 py-4 px-6 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700/60 transition-all group"
                    >
                      <ShoppingBag className="w-5 h-5 text-cyan-400 group-hover:rotate-6 transition-transform" />
                      <span className="font-semibold text-white">Trade OCX</span>
                      <TrendingUp className="w-4 h-4 text-green-400" />
                    </motion.button>
                    
                    <motion.button 
                      whileHover={{ scale: 1.02, borderColor: 'rgba(6,182,212,0.6)' }}
                      whileTap={{ scale: 0.98 }}
                      onClick={onSubmarineStoreClick}
                      className="flex items-center justify-center gap-2 py-4 px-6 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700/60 transition-all group"
                    >
                      <Store className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
                      <span className="font-semibold text-white">Hangar Bay</span>
                    </motion.button>
                  </div>

                  {/* Tertiary Actions */}
                  <motion.button 
                    whileHover={{ scale: 1.01, borderColor: 'rgba(6,182,212,0.4)' }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => router.push(`/profile?wallet=${playerData.wallet_address}`)}
                    className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-slate-800/30 border border-slate-700/30 hover:bg-slate-800/50 transition-all"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-300">View Profile</span>
                  </motion.button>

                  {/* Disconnect Wallet Button */}
                  <motion.button 
                    whileHover={{ scale: 1.01, borderColor: 'rgba(239,68,68,0.4)' }}
                    whileTap={{ scale: 0.99 }}
                    onClick={handleDisconnectWallet}
                    className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-slate-800/30 border border-slate-700/30 hover:bg-red-900/30 hover:border-red-500/40 transition-all group"
                  >
                    <LogOut className="w-4 h-4 text-slate-400 group-hover:text-red-400 transition-colors" />
                    <span className="text-sm text-slate-300 group-hover:text-red-300 transition-colors">Disconnect Wallet</span>
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Statistics Card */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-3xl blur-xl opacity-50" />
              
              <div className="relative rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-blue-400 to-purple-500" />
                  Captain Statistics
                </h3>
                
                {/* Resource Inventory */}
                <div className="mb-6 p-4 rounded-xl bg-slate-800/50 border border-slate-700/30">
                  <div className="text-[10px] text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                    <Fuel className="w-3 h-3" />
                    Resource Inventory
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <ResourceStat 
                      label="Nickel" 
                      value={playerData.nickel ?? 0} 
                      color="#06B6D4"
                      icon={<div className="w-2 h-2 rounded-full bg-cyan-400" />}
                    />
                    <ResourceStat 
                      label="Cobalt" 
                      value={playerData.cobalt ?? 0} 
                      color="#3B82F6"
                      icon={<div className="w-2 h-2 rounded-full bg-blue-400" />}
                    />
                    <ResourceStat 
                      label="Copper" 
                      value={playerData.copper ?? 0} 
                      color="#F97316"
                      icon={<div className="w-2 h-2 rounded-full bg-orange-400" />}
                    />
                    <ResourceStat 
                      label="Manganese" 
                      value={playerData.manganese ?? 0} 
                      color="#A855F7"
                      icon={<div className="w-2 h-2 rounded-full bg-purple-400" />}
                    />
                  </div>
                </div>

                {/* Key Stats */}
                <div className="space-y-3">
                  <StatRow 
                    icon={<Target className="w-5 h-5" />}
                    label="Total Mined"
                    value={playerData.total_resources_mined.toLocaleString()}
                    color="#06B6D4"
                  />
                  <StatRow 
                    icon={<Gem className="w-5 h-5" />}
                    label="OCX Earned"
                    value={syncedOcxEarned.toLocaleString()}
                    color="#22C55E"
                  />
                  <StatRow 
                    icon={<Clock className="w-5 h-5" />}
                    label="Last Dive"
                    value={new Date(playerData.last_login).toLocaleDateString()}
                    color="#94A3B8"
                  />
                </div>

                {/* Experience Progress */}
                <div className="mt-6 pt-4 border-t border-slate-700/50">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-slate-400 uppercase tracking-wider">Experience Progress</span>
                    <span className="text-sm font-bold text-cyan-300">
                      {Math.min(playerData.total_resources_mined / 100, 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-800 overflow-hidden relative">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(playerData.total_resources_mined / 100, 100)}%` }}
                      transition={{ delay: 1, duration: 1, ease: "easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-green-500 to-cyan-500 relative"
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/20 rounded-full" />
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Leaderboard Section */}
        <motion.section 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="mb-12"
        >
          <Leaderboard currentUsername={playerData.username} />
        </motion.section>
      </div>

      {/* Fixed Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        {/* Gradient fade effect */}
        <div className="absolute inset-x-0 -top-12 h-12 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none" />
        
        <div className="relative bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl border-t border-cyan-500/20">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Left - System Status */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-sm text-slate-300 font-medium">Systems Online</span>
                </div>
                <div className="w-px h-4 bg-slate-700" />
                <div className="flex items-center gap-2">
                  <Anchor className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm text-slate-300">Tier {playerData.submarine_tier}</span>
                </div>
              </div>

              {/* Center - Decorative */}
              <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 font-mono">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                <span>OCEAN·X COMMAND</span>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
              </div>

              {/* Right - Energy Status */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                  <span className="text-sm text-slate-300">Energy Full</span>
                </div>
                <div className="w-px h-4 bg-slate-700" />
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                  <span className="text-sm text-slate-300">Ready to Dive</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
