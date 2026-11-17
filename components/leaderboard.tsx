"use client"

import { useEffect, useState } from "react"
import { getSubmarineByTier } from "@/lib/submarine-tiers"

interface LeaderboardPlayer {
  rank: number
  username: string
  ocxEarned: number
  submarineTier: number
}

interface LeaderboardProps {
  currentUsername?: string
}

/** Top divers by OCX earned. Refreshes every minute. */
export function Leaderboard({ currentUsername }: LeaderboardProps) {
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchLeaderboard() {
      try {
        const response = await fetch("/api/leaderboard")
        const data = await response.json()
        if (cancelled) return
        if (data.success && data.data) {
          setPlayers(data.data)
          setError(null)
        } else {
          setError("The leaderboard could not be loaded.")
        }
      } catch (err) {
        console.error("[Leaderboard] Fetch error:", err)
        if (!cancelled) setError("The leaderboard could not be loaded.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchLeaderboard()
    const interval = setInterval(fetchLeaderboard, 60000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  if (loading) return <p className="text-sm text-[var(--ink-dim)]">Loading the leaderboard…</p>
  if (error) return <p className="text-sm text-[var(--ink-dim)]">{error}</p>
  if (players.length === 0) return <p className="text-sm text-[var(--ink-dim)]">Nobody has earned OCX yet. Be the first.</p>

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-[var(--ink-dim)]">
          <th scope="col" className="w-10 pb-2 text-left font-normal">#</th>
          <th scope="col" className="pb-2 text-left font-normal">Diver</th>
          <th scope="col" className="hidden pb-2 text-left font-normal sm:table-cell">Submarine</th>
          <th scope="col" className="pb-2 text-right font-normal">OCX earned</th>
        </tr>
      </thead>
      <tbody>
        {players.map((p) => {
          const you = !!currentUsername && p.username === currentUsername
          return (
            <tr key={`${p.rank}-${p.username}`} className={`border-t border-[var(--rule)] ${you ? "bg-[rgba(95,227,208,0.06)]" : ""}`}>
              <td className={`py-2 ${p.rank <= 3 ? "text-[var(--lamp)]" : "text-[var(--ink-dim)]"}`}>{p.rank}</td>
              <td className="py-2">
                {p.username}
                {you && <span className="ml-2 text-xs text-[var(--bio)]">you</span>}
              </td>
              <td className="hidden py-2 text-[var(--ink-dim)] sm:table-cell">{getSubmarineByTier(p.submarineTier).name}</td>
              <td className="py-2 text-right">{p.ocxEarned.toLocaleString("en-US")}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
