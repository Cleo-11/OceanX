"use client"

import { useState, useEffect } from "react"
import { Trophy, Crown, Anchor, ChevronUp, ChevronDown, Loader2, Gem } from "lucide-react"
import "@/styles/design-system.css"

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

  const getRankBadgeClass = (rank: number) => {
    switch (rank) {
      case 1: return "rank-badge-gold"
      case 2: return "rank-badge-silver"
      case 3: return "rank-badge-bronze"
      default: return "rank-badge-default"
    }
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-4 h-4" />
    return <span>{rank}</span>
  }

  return (
    <div className="card-glass">
      {/* Header */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 rounded-t-xl hover:bg-white/5 transition-colors"
        style={{ borderBottom: isExpanded ? '1px solid rgba(255,255,255,0.08)' : 'none' }}
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ 
              background: 'linear-gradient(135deg, rgba(255,215,0,0.2) 0%, rgba(255,165,0,0.2) 100%)',
              border: '1px solid rgba(255,215,0,0.3)'
            }}
          >
            <Trophy className="w-5 h-5" style={{ color: '#FFD700' }} />
          </div>
          <div className="text-left">
            <h2 className="heading-card">Top Captains</h2>
            <p className="text-overline" style={{ marginTop: '2px' }}>OCX Leaderboard</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span 
            className="text-xs font-medium px-2 py-1 rounded-full"
            style={{ background: 'rgba(5,191,219,0.1)', color: 'var(--ocean-accent)' }}
          >
            Live
          </span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
          ) : (
            <ChevronDown className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
          )}
        </div>
      </button>

      {/* Content */}
      <div 
        className={`transition-all duration-300 ease-out overflow-hidden ${
          isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-3">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--ocean-accent)' }} />
              <span className="text-body">Loading rankings...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-body" style={{ color: '#EF4444' }}>{error}</p>
              <p className="text-caption mt-1">Please try again later</p>
            </div>
          ) : players.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-body">No captains ranked yet</p>
              <p className="text-caption mt-1" style={{ color: 'var(--ocean-accent)' }}>
                Be the first to climb the ranks!
              </p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[380px] overflow-y-auto pr-1">
              {players.map((player) => {
                const isCurrentPlayer = currentUsername && player.username === currentUsername
                
                return (
                  <div
                    key={`${player.rank}-${player.username}`}
                    className={`leaderboard-row ${isCurrentPlayer ? 'ring-1 ring-[var(--ocean-accent)]' : ''}`}
                    style={isCurrentPlayer ? { background: 'rgba(5,191,219,0.08)' } : undefined}
                  >
                    {/* Rank Badge */}
                    <div className={`rank-badge ${getRankBadgeClass(player.rank)}`}>
                      {getRankIcon(player.rank)}
                    </div>

                    {/* Player Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span 
                          className="font-semibold truncate"
                          style={{ color: isCurrentPlayer ? 'var(--ocean-accent)' : 'var(--text-primary)' }}
                        >
                          {player.username}
                        </span>
                        {isCurrentPlayer && (
                          <span 
                            className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ 
                              background: 'rgba(5,191,219,0.2)', 
                              color: 'var(--ocean-accent)',
                              border: '1px solid rgba(5,191,219,0.3)'
                            }}
                          >
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Anchor className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Tier {player.submarineTier}
                        </span>
                      </div>
                    </div>

                    {/* OCX Amount */}
                    <div className="ocx-amount">
                      <Gem className="w-3 h-3" />
                      <span>{formatOCX(player.ocxEarned)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
