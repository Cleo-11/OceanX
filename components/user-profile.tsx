"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { ContractManager, getOCXBalanceReadOnly } from "@/lib/contracts"

import type { PlayerResources } from "@/lib/types"
import { Loader2, Ship, Coins, Package, Trophy, User } from "lucide-react"

interface UserProfileProps {
  walletAddress: string
  resources: PlayerResources
}

interface PlayerData {
  id: string
  username: string
  submarine_tier: number
  submarine_name?: string
  submarine_description?: string
  total_ocx_earned: number
  total_resources_mined: number
  last_login: string
  created_at: string
  max_nickel?: number
  max_cobalt?: number
  max_copper?: number
  max_manganese?: number
  special_ability?: string
}

interface SubmarineTierData {
  id: number
  tier: number
  name: string
  description: string
  max_nickel: number
  max_cobalt: number
  max_copper: number
  max_manganese: number
  health: number
  energy: number
  speed: number
  mining_rate: number
  depth_limit: number
  upgrade_cost_nickel: number
  upgrade_cost_cobalt: number
  upgrade_cost_copper: number
  upgrade_cost_manganese: number
  upgrade_cost_tokens: number
  color: string
  special_ability: string
}

export function UserProfile({ walletAddress, resources }: UserProfileProps) {
  const [playerData, setPlayerData] = useState<PlayerData | null>(null)
  const [submarineTierData, setSubmarineTierData] = useState<SubmarineTierData | null>(null)
  const [ocxBalance, setOcxBalance] = useState<string>("0")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    loadProfileData()
  }, [walletAddress])

  const loadProfileData = async () => {
    if (!walletAddress) {
      setPlayerData(null);
      setSubmarineTierData(null);
      setOcxBalance("0");
      setError("No wallet address provided.");
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true)
      setError("")


      // Debug: log wallet address being queried
      console.log("Querying player profile for wallet address:", walletAddress)

      // Load player data from Supabase (case-insensitive)
      const { data: player, error: playerError } = await supabase
        .from("players")
        .select("*")
        .ilike("wallet_address", walletAddress)
        .single()

      if (playerError) {
        console.error("Error loading player data:", playerError)
        setError("Failed to load player data. Please check if your wallet is registered.")
        return
      }

      if (!player) {
        setError("No player found for this wallet address.")
        setPlayerData(null)
        setSubmarineTierData(null)
        setOcxBalance("0")
        setIsLoading(false)
        return
      }

      setPlayerData(player)

      // Load submarine tier data
      const { data: tierData, error: tierError } = await supabase
        .from("submarine_tiers")
        .select("*")
        .eq("tier", player.submarine_tier)
        .single()

      if (tierError) {
        console.error("Error loading submarine tier data:", tierError)
        setError("Failed to load submarine data")
        return
      }

      setSubmarineTierData(tierData)

      // Load OCX token balance — try on-chain first, fall back to DB total_ocx_earned
      try {
        let balance: string = "0"
        let onChainAmount = 0
        try {
          // Try connected wallet first (faster)
          balance = await ContractManager.getTokenBalance(walletAddress)
          onChainAmount = parseFloat(balance) || 0
        } catch {
          try {
            // Fallback: read-only via public RPC (works without MetaMask)
            balance = await getOCXBalanceReadOnly(walletAddress)
            onChainAmount = parseFloat(balance) || 0
          } catch (rpcErr) {
            console.warn("Could not read on-chain OCX balance:", rpcErr)
          }
        }
        console.log("[DEBUG] Wallet Address:", walletAddress, "On-chain OCX:", onChainAmount, "DB OCX:", player.total_ocx_earned);

        // Use whichever is higher: on-chain balance or DB total_ocx_earned
        const dbAmount = player.total_ocx_earned || 0
        const effectiveBalance = Math.max(onChainAmount, dbAmount)
        setOcxBalance(effectiveBalance.toString())

        // Sync on-chain balance to DB if it's higher (captures pre-fix claims)
        if (onChainAmount > dbAmount) {
          console.log(`🔄 Syncing OCX: on-chain ${onChainAmount} > DB ${dbAmount}. Updating...`)
          const { error: syncError } = await supabase
            .from("players")
            .update({ total_ocx_earned: onChainAmount })
            .eq("id", player.id)
          if (syncError) {
            console.error("❌ Failed to sync on-chain OCX to DB:", syncError)
          } else {
            console.log(`✅ DB synced: total_ocx_earned = ${onChainAmount}`)
            setPlayerData({ ...player, total_ocx_earned: onChainAmount })
          }
        }
      } catch (balanceError) {
        console.error("Error loading OCX balance:", balanceError)
        // Fall back to DB balance instead of showing 0
        setOcxBalance((player.total_ocx_earned || 0).toString())
      }
    } catch (error) {
      console.error("Error loading profile data:", error)
      setError("Failed to load profile data")
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString()
  }

  const formatOcxBalance = (balance: string) => {
    // getOCXBalanceReadOnly already calls ethers.formatEther (converts from wei)
    // so balance is already in human-readable units — no division needed
    const num = parseFloat(balance) || 0
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        <span className="ml-2 text-slate-300">Loading profile...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="text-red-400 mb-2">⚠️</div>
        <p className="text-slate-300">{error}</p>
        <button
          onClick={loadProfileData}
          className="mt-4 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!playerData || !submarineTierData) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-300">No profile data found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Player Info */}
      <div className="rounded-lg bg-slate-800/50 p-4">
        <div className="flex items-center mb-3">
          <User className="w-5 h-5 text-cyan-400 mr-2" />
          <h3 className="text-lg font-semibold text-slate-200">Player Info</h3>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-300">Username:</span>
            <span className="text-cyan-400 font-medium">{playerData.username}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-300">Member since:</span>
            <span className="text-slate-300">{formatDate(playerData.created_at)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-300">Last login:</span>
            <span className="text-slate-300">{formatDate(playerData.last_login)}</span>
          </div>
        </div>
      </div>

      {/* Submarine Info */}
      <div className="rounded-lg bg-slate-800/50 p-4">
        <div className="flex items-center mb-3">
          <Ship className="w-5 h-5 text-cyan-400 mr-2" />
          <h3 className="text-lg font-semibold text-slate-200">Submarine</h3>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-slate-300">Type:</span>
            <span className="text-cyan-400 font-medium">{submarineTierData.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-300">Tier:</span>
            <span className="text-cyan-400 font-medium">Tier {submarineTierData.tier}</span>
          </div>
          <div className="text-sm text-slate-300 mb-3">
            {submarineTierData.description}
          </div>
          
          {/* Submarine Stats */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Health:</span>
              <span className="text-green-400">{submarineTierData.health}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Energy:</span>
              <span className="text-blue-400">{submarineTierData.energy}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Speed:</span>
              <span className="text-yellow-400">{submarineTierData.speed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Mining Rate:</span>
              <span className="text-purple-400">{submarineTierData.mining_rate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Depth Limit:</span>
              <span className="text-cyan-400">{submarineTierData.depth_limit}m</span>
            </div>
          </div>

          {submarineTierData.special_ability && (
            <div className="mt-3 p-2 bg-cyan-900/30 rounded border border-cyan-700/50">
              <div className="text-xs text-cyan-300 font-medium mb-1">Special Ability:</div>
              <div className="text-xs text-slate-300">{submarineTierData.special_ability}</div>
            </div>
          )}
        </div>
      </div>

      {/* Current Resources */}
      <div className="rounded-lg bg-slate-800/50 p-4">
        <div className="flex items-center mb-3">
          <Package className="w-5 h-5 text-cyan-400 mr-2" />
          <h3 className="text-lg font-semibold text-slate-200">Current Resources</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex justify-between">
            <span className="text-slate-300">🔋 Nickel:</span>
            <span className="text-cyan-400">{formatNumber(resources.nickel)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-300">⚡ Cobalt:</span>
            <span className="text-cyan-400">{formatNumber(resources.cobalt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-300">🔌 Copper:</span>
            <span className="text-cyan-400">{formatNumber(resources.copper)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-300">🧲 Manganese:</span>
            <span className="text-cyan-400">{formatNumber(resources.manganese)}</span>
          </div>
        </div>
      </div>

      {/* OCX Token Balance */}
      <div className="rounded-lg bg-slate-800/50 p-4">
        <div className="flex items-center mb-3">
          <Coins className="w-5 h-5 text-cyan-400 mr-2" />
          <h3 className="text-lg font-semibold text-slate-200">OCX Tokens</h3>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-300">Wallet Balance:</span>
            <span className="text-cyan-400 font-bold text-lg">{formatOcxBalance(ocxBalance)} OCX</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-300">Total Earned:</span>
            <span className="text-green-400">{formatNumber(playerData.total_ocx_earned)} OCX</span>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="rounded-lg bg-slate-800/50 p-4">
        <div className="flex items-center mb-3">
          <Trophy className="w-5 h-5 text-cyan-400 mr-2" />
          <h3 className="text-lg font-semibold text-slate-200">Statistics</h3>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-300">Total Resources Mined:</span>
            <span className="text-cyan-400">{formatNumber(playerData.total_resources_mined)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-300">Total OCX Earned:</span>
            <span className="text-green-400">{formatNumber(playerData.total_ocx_earned)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
