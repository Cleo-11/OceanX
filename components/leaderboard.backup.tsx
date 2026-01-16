"use client"

import { useState, useEffect } from "react"
import { Trophy, Medal, Crown, Anchor, ChevronUp, ChevronDown, Loader2 } from "lucide-react"
import { Card, CardContent } from "./ui/card"

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
    // Refresh leaderboard every 60 seconds
    const interval = setInterval(fetchLeaderboard, 60000)
    return () => clearInterval(interval)
  }, [])

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 text-yellow-400 animate-pulse" />
      case 2:
        return <Medal className="w-5 h-5 text-slate-300" />
      case 3:
        return <Medal className="w-5 h-5 text-amber-600" />
      default:
        return <Anchor className="w-4 h-4 text-cyan-400/60" />
    }
  }

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-yellow-500/20 via-amber-500/15 to-yellow-500/20 border-yellow-400/40"
      case 2:
        return "bg-gradient-to-r from-slate-400/15 via-slate-300/10 to-slate-400/15 border-slate-300/30"
      case 3:
        return "bg-gradient-to-r from-amber-600/15 via-orange-500/10 to-amber-600/15 border-amber-500/30"
      default:
        return "bg-slate-800/40 border-slate-600/20"
    }
  }

  const formatOCX = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`
    }
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`
    }
    return amount.toLocaleString()
  }

  return (
    <div className="relative group">
      {/* Glow Effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-cyan-500/20 rounded-2xl blur-xl opacity-30 group-hover:opacity-50 animate-pulse transition-opacity duration-500"></div>

      <Card className="relative bg-gradient-to-br from-slate-800/90 via-slate-700/90 to-slate-800/90 backdrop-blur-xl border-2 border-cyan-400/30 shadow-2xl shadow-cyan-900/40 overflow-hidden">
        {/* Header */}
        <div 
          className="relative bg-gradient-to-r from-purple-900/40 via-cyan-900/50 to-purple-900/40 p-4 border-b border-cyan-400/20 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
          
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Trophy className="w-6 h-6 text-yellow-400" />
                <div className="absolute inset-0 bg-yellow-400/30 rounded-full blur-md animate-pulse"></div>
              </div>
              <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-purple-300 to-cyan-300 tracking-wide">
                TOP CAPTAINS
              </h2>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-cyan-300/60 font-semibold">OCX LEADERS</span>
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-cyan-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-cyan-400" />
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <CardContent className={`transition-all duration-300 ease-in-out ${isExpanded ? 'p-4 max-h-[500px]' : 'p-0 max-h-0 overflow-hidden'}`}>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              <span className="ml-3 text-cyan-300 font-medium">Loading rankings...</span>
            </div>
          ) : error ? (
            <div className="text-center py-6">
              <p className="text-red-400 font-medium">{error}</p>
              <p className="text-slate-400 text-sm mt-1">Please try again later</p>
            </div>
          ) : players.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-slate-400 font-medium">No captains ranked yet</p>
              <p className="text-cyan-300/60 text-sm mt-1">Be the first to climb the ranks!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-cyan-700 scrollbar-track-slate-800">
              {players.map((player) => {
                const isCurrentPlayer = currentUsername && player.username === currentUsername
                
                return (
                  <div
                    key={`${player.rank}-${player.username}`}
                    className={`
                      relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-200
                      ${getRankStyle(player.rank)}
                      ${isCurrentPlayer ? 'ring-2 ring-cyan-400/50 ring-offset-1 ring-offset-slate-900' : ''}
                      hover:scale-[1.02] hover:bg-slate-700/50
                    `}
                  >
                    {/* Rank */}
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-900/60 border border-slate-600/30">
                      {player.rank <= 3 ? (
                        getRankIcon(player.rank)
                      ) : (
                        <span className="text-sm font-bold text-cyan-300">{player.rank}</span>
                      )}
                    </div>

                    {/* Player Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold truncate ${isCurrentPlayer ? 'text-cyan-300' : 'text-slate-200'}`}>
                          {player.username}
                        </span>
                        {isCurrentPlayer && (
                          <span className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-400/30 font-semibold">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        Tier {player.submarineTier} Captain
                      </div>
                    </div>

                    {/* OCX Amount */}
                    <div className="flex items-center gap-1 bg-gradient-to-r from-cyan-900/40 to-purple-900/40 px-3 py-1.5 rounded-lg border border-cyan-400/20">
                      <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-300">
                        {formatOCX(player.ocxEarned)}
                      </span>
                      <span className="text-xs text-cyan-300/70 font-semibold">OCX</span>
                    </div>

                    {/* Highlight Effect for Top 3 */}
                    {player.rank <= 3 && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent rounded-xl pointer-events-none animate-pulse"></div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
