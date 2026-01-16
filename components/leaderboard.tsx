"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Trophy, Crown, Anchor, ChevronUp, ChevronDown, Loader2, Gem, Medal, Star } from "lucide-react"

interface LeaderboardPlayer {
  rank: number
  username: string
  ocxEarned: number
  submarineTier: number
}

interface LeaderboardProps {
  currentUsername?: string
}

export function Leaderboard({ currentUsername }: LeaderboardProps) {
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(true)

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        setLoading(true)
        const response = await fetch("/api/leaderboard")
        const data = await response.json()

        if (data.success && data.data) {
          setPlayers(data.data)
          setError(null)
        } else {
          setError("Failed to load leaderboard")
        }
      } catch (err) {
        console.error("[Leaderboard] Fetch error:", err)
        setError("Failed to load leaderboard")
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboard()
    const interval = setInterval(fetchLeaderboard, 60000)
    return () => clearInterval(interval)
  }, [])

  const formatOCX = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`
    return amount.toLocaleString()
  }

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1: 
        return {
          bg: 'bg-gradient-to-br from-yellow-500/30 to-amber-600/30',
          border: 'border-yellow-500/50',
          text: 'text-yellow-400',
          shadow: 'shadow-yellow-500/30'
        }
      case 2: 
        return {
          bg: 'bg-gradient-to-br from-slate-300/20 to-slate-400/20',
          border: 'border-slate-400/50',
          text: 'text-slate-300',
          shadow: 'shadow-slate-400/20'
        }
      case 3: 
        return {
          bg: 'bg-gradient-to-br from-amber-700/30 to-orange-700/30',
          border: 'border-amber-600/50',
          text: 'text-amber-500',
          shadow: 'shadow-amber-600/20'
        }
      default: 
        return {
          bg: 'bg-slate-800/50',
          border: 'border-slate-700/50',
          text: 'text-slate-400',
          shadow: ''
        }
    }
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="w-4 h-4 text-yellow-400" />
      case 2: return <Medal className="w-4 h-4 text-slate-300" />
      case 3: return <Star className="w-4 h-4 text-amber-500" />
      default: return <span className="text-sm font-bold">{rank}</span>
    }
  }

  return (
    <div className="relative group">
      {/* Outer glow */}
      <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500/10 via-cyan-500/10 to-yellow-500/10 rounded-3xl blur-xl opacity-50 group-hover:opacity-80 transition-opacity duration-500" />
      
      <div className="relative rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-slate-700/50 overflow-hidden">
        {/* Header */}
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-4">
            {/* Trophy with glow */}
            <div className="relative">
              <div className="absolute inset-0 bg-yellow-500/40 rounded-xl blur-lg animate-pulse" />
              <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/30 to-amber-600/30 border border-yellow-500/40 flex items-center justify-center shadow-lg shadow-yellow-500/20">
                <Trophy className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
            
            <div className="text-left">
              <h2 className="text-xl font-bold bg-gradient-to-r from-yellow-300 to-amber-400 bg-clip-text text-transparent">
                Top Captains
              </h2>
              <p className="text-xs text-slate-400 uppercase tracking-wider mt-0.5">OCX Leaderboard</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Live indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-green-400">Live</span>
            </div>
            
            <div className="w-8 h-8 rounded-lg bg-slate-800/50 border border-slate-700/50 flex items-center justify-center">
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </div>
          </div>
        </button>

        {/* Divider */}
        {isExpanded && (
          <div className="mx-5 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
        )}

        {/* Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="p-5">
                {loading ? (
                  <div className="flex items-center justify-center py-12 gap-3">
                    <div className="relative">
                      <div className="absolute inset-0 bg-cyan-500 rounded-full blur-md opacity-30 animate-pulse" />
                      <Loader2 className="relative w-8 h-8 animate-spin text-cyan-400" />
                    </div>
                    <span className="text-slate-300">Loading rankings...</span>
                  </div>
                ) : error ? (
                  <div className="text-center py-12">
                    <p className="text-red-400 font-medium">{error}</p>
                    <p className="text-slate-500 text-sm mt-1">Please try again later</p>
                  </div>
                ) : players.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-slate-300">No captains ranked yet</p>
                    <p className="text-cyan-400 text-sm mt-1">Be the first to climb the ranks!</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    {players.map((player, index) => {
                      const isCurrentPlayer = currentUsername && player.username === currentUsername
                      const rankStyle = getRankStyle(player.rank)
                      
                      return (
                        <motion.div
                          key={`${player.rank}-${player.username}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={`relative flex items-center gap-4 p-4 rounded-xl border transition-all duration-300
                            ${isCurrentPlayer 
                              ? 'bg-cyan-500/10 border-cyan-500/40 ring-1 ring-cyan-500/30' 
                              : `bg-slate-800/30 ${rankStyle.border} hover:bg-slate-800/50`
                            }`}
                        >
                          {/* Rank Badge */}
                          <div className={`relative w-10 h-10 rounded-xl ${rankStyle.bg} border ${rankStyle.border} flex items-center justify-center ${rankStyle.shadow} shadow-lg`}>
                            {player.rank <= 3 && (
                              <div className={`absolute inset-0 ${rankStyle.bg} rounded-xl blur-md opacity-50`} />
                            )}
                            <span className="relative">{getRankIcon(player.rank)}</span>
                          </div>

                          {/* Player Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`font-semibold truncate ${isCurrentPlayer ? 'text-cyan-300' : 'text-white'}`}>
                                {player.username}
                              </span>
                              {isCurrentPlayer && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 uppercase tracking-wider">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <Anchor className="w-3 h-3 text-slate-500" />
                              <span className="text-xs text-slate-500">Tier {player.submarineTier}</span>
                            </div>
                          </div>

                          {/* OCX Amount */}
                          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900/50 border border-slate-700/50">
                            <Gem className="w-4 h-4 text-cyan-400" />
                            <span className="font-bold text-cyan-300">{formatOCX(player.ocxEarned)}</span>
                            <span className="text-xs text-slate-500">OCX</span>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
