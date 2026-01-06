"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Play, Store, User, Waves, ChevronDown, Wifi, ShoppingBag, TrendingUp } from "lucide-react"
import SubmarineIcon from "./SubmarineIcon"
import { getSubmarineByTier } from "@/lib/submarine-tiers"
import { apiClient, createSignaturePayload } from "@/lib/api"
import { WalletManager } from "@/lib/wallet"
import { Button } from "./ui/button"
import { Card, CardContent } from "./ui/card"
// @ts-ignore
import "../styles/user-home-animations.css"

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
  }
  onPlayClick: () => void
  onSubmarineStoreClick: () => void
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
  const [walletChecked, setWalletChecked] = useState(false) // Track if we've checked actual wallet state
  
  // Captain's log messages rotation
  const captainLogMessages = [
    "The depths await, Captain. Our sonar is detecting rich mineral deposits in the abyssal plains.",
    "Current oceanic conditions optimal. All submarine systems operational and ready for deployment.",
    "Intelligence reports indicate new treasure caches discovered in the deepest trenches.",
    "The ocean's mysteries call to us, Captain. Our advanced mining equipment stands ready.",
    "Submarine fleet status: All vessels primed for deep-sea expedition. Awaiting your command.",
    "Seabed analysis complete. High-value resources detected in previously unexplored regions.",
    "Captain's log: The crew reports excellent morale. Ready to venture into the unknown depths.",
    "Our cutting-edge technology gives us the edge in the competitive waters of ocean mining.",
    "The tide favors the bold, Captain. Fortune awaits those who dare to dive deeper.",
    "Pressure suits checked, navigation systems calibrated. The abyss beckons with untold riches."
  ]
  const [currentLogIndex, setCurrentLogIndex] = useState(0)
  const router = useRouter()
  const currentSubmarine = getSubmarineByTier(playerData.submarine_tier)

  // Floating animation trigger
  useEffect(() => {
    const interval = setInterval(() => {
      setIsFloating((prev: boolean) => !prev)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Fetch OCX balance and detect network
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
        
        // Detect current network
        const network = await connection.provider.getNetwork()
        const networkName = network.chainId === BigInt(8453) ? "Base" : network.chainId === BigInt(11155111) ? "Sepolia" : "Unknown"
        setCurrentNetwork(networkName)
        
        const { message } = createSignaturePayload(connection.address, "get-balance")
        const signature = await walletManager.signMessage(message)
        const resp = await apiClient.getPlayerBalance(connection.address, signature, message)
        if (resp.success && resp.data) {
          setOcxBalance(resp.data.balance)
          setOcxSymbol(resp.data.symbol || "OCX")
        }
      } catch (e) {
        setOcxBalance(null)
        setCurrentNetwork("Disconnected")
      } finally {
        setBalanceLoading(false)
      }
    }
    fetchBalanceAndNetwork()
  }, [playerData.wallet_address, isWalletConnected])

  // Redirect to auth if wallet is disconnected (only after we've checked actual state)
  useEffect(() => {
    if (walletChecked && !isWalletConnected) {
      console.log("[UserHome] Wallet disconnected, redirecting to /auth")
      // Use router.replace to avoid back navigation showing protected page
      router.replace("/auth")
      // Hard redirect as a fallback to handle any router/hydration edge cases
      if (typeof window !== "undefined") {
        window.location.href = "/auth"
      }
    }
  }, [isWalletConnected, walletChecked, router])

  // Detect wallet disconnects (MetaMask accountsChanged)
  useEffect(() => {
    async function syncAccounts(accounts?: string[]) {
      try {
        const walletManager = WalletManager.getInstance()
        let nextAccounts = accounts

        if (!nextAccounts && typeof window !== "undefined" && window.ethereum?.request) {
          nextAccounts = await window.ethereum.request({ method: "eth_accounts" }) as string[]
        }

        if (nextAccounts && nextAccounts.length > 0) {
          const addr = nextAccounts[0]
          setIsWalletConnected(true)
          setDisplayWallet(addr)
        } else {
          setIsWalletConnected(false)
          setDisplayWallet(null)
          setOcxBalance(null)
          setCurrentNetwork("Disconnected")
          walletManager.disconnect()
        }
        setWalletChecked(true) // Mark that we've checked the wallet state
      } catch (err) {
        setWalletChecked(true) // Still mark as checked even if error
        // Silent fail to avoid noisy console in UI
      }
    }

    syncAccounts()

    if (typeof window !== "undefined" && window.ethereum) {
      const handler = (accs: string[]) => syncAccounts(accs)
      window.ethereum.on("accountsChanged", handler)
      return () => {
        try {
          window.ethereum?.removeListener("accountsChanged", handler)
        } catch (err) {
          /* ignore */
        }
      }
    }
    return undefined
  }, [])

  // Handle dropdown close on outside click
  useEffect(() => {
    const handleClickOutside = () => setShowNetworkDropdown(false)
    if (showNetworkDropdown) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
    return undefined
  }, [showNetworkDropdown])

  // Captain's log rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentLogIndex((prevIndex) => (prevIndex + 1) % captainLogMessages.length)
    }, 8000) // Rotate every 8 seconds
    return () => clearInterval(interval)
  }, [captainLogMessages.length])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-teal-950 overflow-hidden relative">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Floating Particles */}
        <div className="absolute animate-float-slow top-16 left-8 w-3 h-3 bg-cyan-400/40 rounded-full blur-sm shadow-lg shadow-cyan-400/50"></div>
        <div className="absolute animate-float-medium top-32 right-16 w-4 h-4 bg-blue-400/50 rounded-full blur-sm shadow-lg shadow-blue-400/50"></div>
        <div className="absolute animate-float-fast top-48 left-1/4 w-2 h-2 bg-teal-400/60 rounded-full blur-sm shadow-lg shadow-teal-400/50"></div>
        <div className="absolute animate-float-slow bottom-32 right-1/3 w-5 h-5 bg-cyan-300/30 rounded-full blur-sm shadow-lg shadow-cyan-300/50"></div>
        <div className="absolute animate-float-medium top-64 right-1/4 w-3 h-3 bg-purple-400/40 rounded-full blur-sm shadow-lg shadow-purple-400/50"></div>
        <div className="absolute animate-float-fast bottom-48 left-1/3 w-4 h-4 bg-emerald-400/35 rounded-full blur-sm shadow-lg shadow-emerald-400/50"></div>
        
        {/* Dynamic Light Rays */}
        <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-cyan-400/20 via-transparent to-transparent animate-pulse"></div>
        <div className="absolute top-0 right-1/3 w-px h-full bg-gradient-to-b from-blue-400/15 via-transparent to-transparent animate-pulse delay-1000"></div>
        <div className="absolute top-0 left-2/3 w-px h-full bg-gradient-to-b from-teal-400/10 via-transparent to-transparent animate-pulse delay-2000"></div>
        
        {/* Radial Glow Effect */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(6,182,212,0.08)_0%,transparent_50%)] animate-pulse"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_80%,rgba(59,130,246,0.06)_0%,transparent_50%)] animate-pulse delay-3000"></div>
        
        {/* Ocean Floor Effect with Animation */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-slate-900/60 via-slate-800/20 to-transparent">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-900/10 via-blue-900/15 to-teal-900/10 animate-pulse"></div>
        </div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          {/* Gamified Welcome Banner */}
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-teal-500/20 rounded-2xl blur-xl scale-110 animate-pulse"></div>
            <div className="relative bg-gradient-to-r from-slate-800/80 via-slate-700/80 to-slate-800/80 backdrop-blur-md rounded-2xl border border-cyan-400/30 p-6 shadow-2xl shadow-cyan-900/30">
              <h1 className="text-5xl font-black bg-gradient-to-r from-cyan-300 via-blue-300 to-teal-300 bg-clip-text text-transparent mb-3 drop-shadow-lg">
                Welcome Back, Captain
              </h1>
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
                <p className="text-cyan-200 text-xl font-bold tracking-wide">{playerData.username}</p>
                <div className="w-2 h-2 bg-green-400 rounded-full animate-ping delay-1000"></div>
              </div>
              
              {/* Rank/Level Display */}
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-full px-4 py-2 border border-yellow-400/30 mb-4">
                <div className="w-3 h-3 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full animate-pulse"></div>
                <span className="text-yellow-200 font-semibold text-sm">
                  SUBMARINE CAPTAIN • TIER {playerData.submarine_tier}
                </span>
              </div>
              
              {/* Rotating Captain's Log */}
              <div className="relative bg-gradient-to-r from-slate-900/60 via-slate-800/60 to-slate-900/60 rounded-xl border border-cyan-500/20 p-4 mt-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                  <span className="text-cyan-300 font-bold text-xs uppercase tracking-wider">Captain's Log</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-cyan-400/50 via-transparent to-transparent"></div>
                </div>
                <p className="text-slate-200 text-sm italic leading-relaxed font-medium transition-all duration-1000 ease-in-out">
                  "{captainLogMessages[currentLogIndex]}"
                </p>
                <div className="flex justify-end mt-2">
                  <div className="flex gap-1">
                    {captainLogMessages.map((_, index) => (
                      <div 
                        key={index}
                        className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                          index === currentLogIndex ? 'bg-cyan-400 scale-125' : 'bg-slate-600 scale-100'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Enhanced Wallet Display */}
          <div className="inline-flex items-center gap-3 bg-slate-800/50 backdrop-blur-md rounded-full px-6 py-3 border border-cyan-900/50 shadow-lg">
            <Waves className={`w-5 h-5 ${isWalletConnected ? "text-cyan-400 animate-pulse" : "text-slate-500"}`} />
            <span className="text-slate-300 font-mono text-sm">
              {displayWallet ? `${displayWallet.slice(0, 8)}...${displayWallet.slice(-6)}` : "Wallet not connected"}
            </span>
            <div className={`w-2 h-2 rounded-full ${isWalletConnected ? "bg-green-400 animate-pulse" : "bg-red-400"}`}></div>
            
            {/* Network Indicator */}
            <div className="relative">
              <button 
                onClick={() => setShowNetworkDropdown(!showNetworkDropdown)}
                className="flex items-center gap-1 text-cyan-300 font-semibold text-sm bg-slate-700/60 hover:bg-slate-600/60 px-2 py-1 rounded-full border border-cyan-400/20 transition-colors"
              >
                <Wifi className="w-3 h-3" />
                <span>{currentNetwork}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              
              {showNetworkDropdown && (
                <div className="absolute top-full mt-2 right-0 w-44 bg-slate-900/95 border border-cyan-500/30 rounded-lg shadow-xl backdrop-blur-sm z-50">
                  <div className="p-2">
                    <div className="px-3 py-2 text-xs text-cyan-300/70 uppercase tracking-wider border-b border-slate-700/50 mb-1">
                      Switch Network
                    </div>
                    <button className="w-full text-left px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/10 rounded transition-colors">
                      🟢 Base (Mainnet)
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/10 rounded transition-colors">
                      🔵 Sepolia (Testnet)
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* OCX Balance */}
            <span className="ml-4 flex items-center gap-1 text-cyan-300 font-bold text-base bg-cyan-900/30 px-3 py-1 rounded-full border border-cyan-400/20">
              {balanceLoading ? <span className="animate-pulse">...</span> : (ocxBalance ?? "-")}
              <span className="text-xs font-semibold">{ocxSymbol}</span>
            </span>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Left Side - Submarine Display */}
          <div className="flex flex-col items-center space-y-6">
            {/* Enhanced Submarine Showcase */}
            <div className="relative group">
              {/* Animated Glow Ring */}
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-teal-500 rounded-3xl blur-md opacity-30 group-hover:opacity-50 animate-pulse transition-opacity duration-500"></div>
              
              <Card className="relative bg-gradient-to-br from-slate-800/90 via-slate-700/90 to-slate-800/90 backdrop-blur-xl border-2 border-cyan-400/30 shadow-2xl shadow-cyan-900/40 w-full max-w-md overflow-hidden">
                {/* Card Header with Holographic Effect */}
                <div className="relative bg-gradient-to-r from-cyan-900/30 via-blue-900/40 to-teal-900/30 p-4 border-b border-cyan-400/20">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
                  <div className="text-center relative z-10">
                    <div className="inline-flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping"></div>
                      <h2 className="text-2xl font-black text-cyan-300 tracking-wide">YOUR SUBMARINE</h2>
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping delay-500"></div>
                    </div>
                    <h3 className="text-2xl text-white font-bold bg-gradient-to-r from-white via-cyan-200 to-white bg-clip-text text-transparent">
                      {currentSubmarine.name}
                    </h3>
                    <div className="inline-flex items-center gap-2 mt-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full px-3 py-1 border border-purple-400/30">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                      <p className="text-purple-200 font-semibold text-sm">TIER {currentSubmarine.tier}</p>
                    </div>
                  </div>
                </div>
                
                <CardContent className="p-8 relative">
                  {/* Submarine with Enhanced Floating Animation */}
                  <div className="flex justify-center mb-8 relative">
                    <div className="absolute inset-0 bg-gradient-radial from-cyan-400/20 via-cyan-400/10 to-transparent rounded-full blur-2xl scale-150 animate-pulse"></div>
                    <div 
                      className={`relative transition-all duration-4000 ease-in-out ${
                        isFloating 
                          ? 'transform translate-y-[-12px] rotate-2 scale-110' 
                          : 'transform translate-y-[6px] rotate-[-1deg] scale-105'
                      }`}
                    >
                      <div className="relative">
                        {/* Enhanced Glow Effect */}
                        <div className="absolute -inset-4 bg-gradient-to-r from-cyan-400/30 via-blue-400/20 to-teal-400/30 rounded-full blur-xl animate-pulse"></div>
                        <div className="absolute -inset-2 bg-gradient-to-r from-cyan-300/20 via-blue-300/15 to-teal-300/20 rounded-full blur-lg animate-pulse delay-1000"></div>
                        
                        <SubmarineIcon 
                          tier={currentSubmarine.tier} 
                          size={200} 
                          className="relative z-10 drop-shadow-2xl filter brightness-110 contrast-110 saturate-110"
                        />
                        
                        {/* Energy Particles */}
                        <div className="absolute top-4 left-4 w-1 h-1 bg-cyan-400 rounded-full animate-ping"></div>
                        <div className="absolute top-8 right-6 w-1 h-1 bg-blue-400 rounded-full animate-ping delay-500"></div>
                        <div className="absolute bottom-6 left-8 w-1 h-1 bg-teal-400 rounded-full animate-ping delay-1000"></div>
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Stats Display */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="group/stat relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-xl group-hover/stat:from-cyan-500/20 group-hover/stat:to-blue-500/20 transition-all duration-300"></div>
                      <div className="relative text-center p-4 bg-slate-700/40 backdrop-blur-sm rounded-xl border border-cyan-500/20 group-hover/stat:border-cyan-400/40 transition-all duration-300">
                        <div className="absolute top-1 right-1 w-1 h-1 bg-cyan-400 rounded-full animate-pulse"></div>
                        <p className="text-slate-400 mb-2 text-xs font-semibold uppercase tracking-wide">Max Depth</p>
                        <p className="text-cyan-300 font-black text-xl">{currentSubmarine.baseStats.depth}m</p>
                        <div className="w-full bg-slate-600/50 rounded-full h-1 mt-2">
                          <div className="bg-gradient-to-r from-cyan-400 to-blue-400 h-1 rounded-full animate-pulse" style={{width: `${Math.min(currentSubmarine.baseStats.depth / 10, 100)}%`}}></div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="group/stat relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-teal-500/10 rounded-xl group-hover/stat:from-blue-500/20 group-hover/stat:to-teal-500/20 transition-all duration-300"></div>
                      <div className="relative text-center p-4 bg-slate-700/40 backdrop-blur-sm rounded-xl border border-blue-500/20 group-hover/stat:border-blue-400/40 transition-all duration-300">
                        <div className="absolute top-1 right-1 w-1 h-1 bg-blue-400 rounded-full animate-pulse delay-300"></div>
                        <p className="text-slate-400 mb-2 text-xs font-semibold uppercase tracking-wide">Speed</p>
                        <p className="text-blue-300 font-black text-xl">{currentSubmarine.baseStats.speed}x</p>
                        <div className="w-full bg-slate-600/50 rounded-full h-1 mt-2">
                          <div className="bg-gradient-to-r from-blue-400 to-teal-400 h-1 rounded-full animate-pulse delay-500" style={{width: `${Math.min(currentSubmarine.baseStats.speed * 20, 100)}%`}}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Special Ability Badge */}
                  {currentSubmarine.specialAbility && (
                    <div className="mt-6 text-center">
                      <div className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-full px-4 py-2 border border-emerald-400/30 shadow-lg">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                        <span className="text-emerald-200 font-semibold text-sm">SPECIAL ABILITY READY</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Enhanced Stats Card */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-3xl blur-md opacity-25 group-hover:opacity-40 animate-pulse transition-opacity duration-500"></div>
              
              <Card className="relative bg-gradient-to-br from-slate-800/90 via-slate-700/90 to-slate-800/90 backdrop-blur-xl border-2 border-emerald-400/20 shadow-2xl shadow-emerald-900/30 w-full max-w-md overflow-hidden">
                <div className="relative bg-gradient-to-r from-emerald-900/20 via-teal-900/30 to-cyan-900/20 p-4 border-b border-emerald-400/20">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
                  <h3 className="text-xl font-black text-emerald-300 text-center tracking-wide relative z-10">
                    CAPTAIN STATISTICS
                  </h3>
                </div>
                
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-gradient-to-r from-slate-700/40 to-slate-600/40 rounded-xl border border-slate-500/30 group/stat hover:border-emerald-400/40 transition-all duration-300">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full animate-pulse"></div>
                        <span className="text-slate-300 font-semibold">Resources Mined</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-black text-lg">{playerData.total_resources_mined.toLocaleString()}</span>
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping"></div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-gradient-to-r from-slate-700/40 to-slate-600/40 rounded-xl border border-slate-500/30 group/stat hover:border-green-400/40 transition-all duration-300">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full animate-pulse delay-300"></div>
                        <span className="text-slate-300 font-semibold">OCX Earned</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-green-400 font-black text-lg">{playerData.total_ocx_earned.toLocaleString()}</span>
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-ping delay-300"></div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-gradient-to-r from-slate-700/40 to-slate-600/40 rounded-xl border border-slate-500/30 group/stat hover:border-purple-400/40 transition-all duration-300">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full animate-pulse delay-600"></div>
                        <span className="text-slate-300 font-semibold">Last Dive</span>
                      </div>
                      <span className="text-purple-300 font-bold text-sm">
                        {new Date(playerData.last_login).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mt-6 p-4 bg-slate-800/50 rounded-xl border border-slate-600/30">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-slate-300 text-sm font-semibold">Experience Progress</span>
                      <span className="text-cyan-300 text-sm font-bold">{Math.min(playerData.total_resources_mined / 100, 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-2 bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 rounded-full animate-pulse transition-all duration-1000"
                        style={{width: `${Math.min(playerData.total_resources_mined / 100, 100)}%`}}
                      ></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right Side - Enhanced Action Buttons */}
          <div className="flex flex-col items-center space-y-8">
            {/* Epic Main Play Button */}
            <div className="relative group">
                {/* Outer Glow Ring (decorative - don't block clicks) */}
                <div className="absolute -inset-2 bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-400 rounded-3xl blur-lg opacity-40 group-hover:opacity-70 animate-pulse transition-opacity duration-500 pointer-events-none"></div>
              
              <Button
                onClick={onPlayClick}
                className="relative group/btn bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 
                           hover:from-teal-500 hover:via-cyan-500 hover:to-blue-500 
                           text-white font-black text-2xl px-16 py-8 rounded-3xl 
                           shadow-2xl shadow-cyan-900/50 hover:shadow-cyan-400/30
                           transform hover:scale-110 active:scale-95 
                           transition-all duration-300 ease-out
                           border-4 border-cyan-300/30 hover:border-cyan-300/60
                           w-full max-w-sm min-h-[100px]
                           overflow-hidden"
              >
                {/* Inner Animated Background (decorative - don't block clicks) */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/10 transform skew-x-12 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000 ease-out pointer-events-none"></div>
                
                <div className="flex items-center justify-center gap-4 relative z-10">
                  <div className="relative">
                    <Play className="w-10 h-10 group-hover/btn:scale-125 transition-transform duration-300" fill="currentColor" />
                    <div className="absolute inset-0 bg-white/30 rounded-full blur-md animate-ping pointer-events-none"></div>
                  </div>
                  <span className="text-3xl tracking-wide drop-shadow-lg">DIVE DEEP</span>
                </div>
                
                {/* Floating Particles (decorative) */}
                <div className="absolute top-2 right-4 w-1 h-1 bg-white rounded-full animate-ping delay-300 pointer-events-none"></div>
                <div className="absolute bottom-3 left-6 w-1 h-1 bg-cyan-200 rounded-full animate-ping delay-700 pointer-events-none"></div>
                <div className="absolute top-4 left-8 w-1 h-1 bg-blue-200 rounded-full animate-ping delay-1000 pointer-events-none"></div>
              </Button>
            </div>

            {/* Marketplace Shortcut */}
            <div className="relative group">
              {/* Outer Glow Ring (decorative - don't block clicks) */}
              <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 rounded-2xl blur-md opacity-30 group-hover:opacity-60 animate-pulse transition-opacity duration-500 pointer-events-none"></div>
              
              <Button
                onClick={() => router.push('/marketplace')}
                className="relative group/btn bg-gradient-to-r from-yellow-600/90 via-orange-600/90 to-red-600/90 
                           hover:from-yellow-500 hover:via-orange-500 hover:to-red-500 
                           text-white font-bold text-lg px-12 py-6 rounded-2xl 
                           shadow-2xl shadow-orange-900/50 hover:shadow-orange-400/30
                           transform hover:scale-105 active:scale-95 
                           transition-all duration-300 ease-out
                           border-2 border-orange-300/40 hover:border-orange-300/70
                           w-full max-w-sm
                           overflow-hidden"
              >
                {/* Inner Animated Background (decorative - don't block clicks) */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/10 transform skew-x-12 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 ease-out pointer-events-none"></div>
                
                <div className="flex items-center justify-center gap-3 relative z-10">
                  <div className="relative">
                    <ShoppingBag className="w-7 h-7 group-hover/btn:scale-110 group-hover/btn:rotate-6 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-orange-300/30 rounded-full blur-sm animate-pulse pointer-events-none"></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl tracking-wide drop-shadow-lg">TRADE OCX</span>
                    <TrendingUp className="w-5 h-5 group-hover/btn:scale-125 transition-transform duration-300" />
                  </div>
                </div>
                
                {/* Floating Particles (decorative) */}
                <div className="absolute top-2 right-4 w-1 h-1 bg-yellow-200 rounded-full animate-ping delay-200 pointer-events-none"></div>
                <div className="absolute bottom-3 left-6 w-1 h-1 bg-orange-200 rounded-full animate-ping delay-600 pointer-events-none"></div>
                <div className="absolute top-4 left-8 w-1 h-1 bg-red-200 rounded-full animate-ping delay-900 pointer-events-none"></div>
              </Button>
            </div>

            {/* Enhanced Secondary Buttons - Now moved to fixed side panel */}
            {/* See floating side panel at bottom of component */}

            {/* Enhanced Flavor Text */}
            <div className="text-center max-w-sm mt-12 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-800/30 to-transparent rounded-2xl blur-lg"></div>
              <div className="relative p-6 bg-slate-800/20 backdrop-blur-sm rounded-2xl border border-slate-700/30">
                <div className="mb-4">
                  <div className="w-12 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent mx-auto mb-2"></div>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse"></div>
                    <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse delay-300"></div>
                    <div className="w-1 h-1 bg-teal-400 rounded-full animate-pulse delay-600"></div>
                  </div>
                </div>
                
                <p className="text-slate-300 text-sm italic leading-relaxed font-medium">
                  "The abyss beckons, Captain. Your {currentSubmarine.name} awaits your command.
                  {currentSubmarine.specialAbility ? ` Special abilities are primed and ready for deployment.` : ' The depths hold untold treasures for those brave enough to seek them.'}"
                </p>
                
                <div className="mt-4 flex items-center justify-center gap-1">
                  <div className="w-1 h-1 bg-cyan-400 rounded-full animate-ping"></div>
                  <div className="w-8 h-px bg-gradient-to-r from-cyan-400 to-blue-400"></div>
                  <div className="w-1 h-1 bg-blue-400 rounded-full animate-ping delay-500"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Bottom Status Bar */}
        <div className="mt-16 text-center">
          <div className="relative inline-block">
            {/* Glow Effect */}
            <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-teal-500/20 rounded-full blur-xl animate-pulse"></div>
            
            <div className="relative flex items-center gap-6 bg-gradient-to-r from-slate-800/80 via-slate-700/90 to-slate-800/80 backdrop-blur-xl rounded-full px-8 py-4 border-2 border-cyan-400/30 shadow-2xl shadow-cyan-900/30">
              {/* Network Status */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <div className="absolute inset-0 w-3 h-3 bg-green-400/50 rounded-full animate-ping"></div>
                </div>
                <span className="text-green-300 font-bold text-sm tracking-wide">OCEAN NETWORK ONLINE</span>
              </div>
              
              {/* Divider */}
              <div className="w-px h-6 bg-gradient-to-b from-transparent via-slate-400 to-transparent"></div>
              
              {/* Submarine Status */}
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse delay-500"></div>
                <span className="text-cyan-300 font-bold text-sm tracking-wide">
                  SUBMARINE TIER {playerData.submarine_tier} • READY FOR DEPLOYMENT
                </span>
              </div>
              
              {/* Divider */}
              <div className="w-px h-6 bg-gradient-to-b from-transparent via-slate-400 to-transparent"></div>
              
              {/* Energy Status */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse delay-1000"></div>
                  <div className="absolute -inset-1 w-5 h-5 border border-yellow-400/50 rounded-full animate-spin"></div>
                </div>
                <span className="text-yellow-300 font-bold text-sm tracking-wide">ENERGY: FULL</span>
              </div>
            </div>
            
            {/* Floating Status Indicators */}
            <div className="absolute -top-2 -right-2 w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
            <div className="absolute -bottom-2 -left-2 w-2 h-2 bg-cyan-400 rounded-full animate-ping delay-700"></div>
          </div>
        </div>
      </div>

      {/* Floating Side Navigation Panel */}
      <div className="fixed right-4 top-1/2 transform -translate-y-1/2 z-20">
        <div className="flex flex-col space-y-4">
          {/* Submarine Hangar */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur-md opacity-20 group-hover:opacity-50 transition-opacity duration-300 pointer-events-none"></div>
            
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  console.debug("[UserHome] Marketplace button clicked", { pathname: window.location.pathname })
                }
                onSubmarineStoreClick()
              }}
              className="relative group/btn bg-gradient-to-r from-slate-800/90 to-slate-700/90 
                         hover:from-slate-700 hover:to-slate-600
                         text-cyan-300 hover:text-white border-2 border-cyan-800/50 hover:border-cyan-400/70
                         p-4 rounded-2xl 
                         shadow-xl shadow-slate-900/50 hover:shadow-cyan-900/30
                         transform hover:scale-110 active:scale-95 transition-all duration-300
                         overflow-hidden backdrop-blur-sm"
              title="Submarine Hangar"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-transparent to-cyan-500/10 transform skew-x-12 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 pointer-events-none"></div>
              
              <Store className="w-7 h-7 group-hover/btn:scale-110 group-hover/btn:rotate-12 transition-all duration-300 relative z-10" />
              
              <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse pointer-events-none"></div>
            </button>
          </div>

          {/* Captain Profile */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur-md opacity-15 group-hover:opacity-40 transition-opacity duration-300 pointer-events-none"></div>
            
            <button
              onClick={() => router.push(`/profile?wallet=${playerData.wallet_address}`)}
              className="relative group/btn bg-gradient-to-r from-slate-800/90 to-slate-700/90 
                         hover:from-slate-700 hover:to-slate-600
                         text-slate-300 hover:text-emerald-200 border-2 border-slate-600/50 hover:border-emerald-500/50
                         p-4 rounded-2xl 
                         shadow-xl shadow-slate-900/40
                         transform hover:scale-110 active:scale-95 transition-all duration-300
                         overflow-hidden backdrop-blur-sm"
              title="Captain Profile"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-emerald-500/5 transform skew-x-12 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 pointer-events-none"></div>
              
              <User className="w-7 h-7 group-hover/btn:scale-110 transition-all duration-300 relative z-10" />
              
              <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse delay-500 pointer-events-none"></div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}