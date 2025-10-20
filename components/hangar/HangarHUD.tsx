"use client"

import { X, Wallet } from "lucide-react"
import type { PlayerResources } from "@/lib/types"
import { getSubmarineByTier } from "@/lib/submarine-tiers"

/**
 * HangarHUD Component
 * 
 * Floating holographic dashboard displaying:
 * - User wallet balance
 * - Current submarine tier
 * - Resource inventory
 * - Total owned submarines
 * 
 * Styled as a transparent glowing HUD panel
 */

interface HangarHUDProps {
  balance: number
  resources: PlayerResources
  currentTier: number
  walletAddress: string
  onClose: () => void
}

export function HangarHUD({ balance, resources, currentTier, walletAddress, onClose }: HangarHUDProps) {
  const currentSubmarine = getSubmarineByTier(currentTier)
  
  // Calculate total resources
  const totalResources = resources.nickel + resources.cobalt + resources.copper + resources.manganese

  return (
    <div className="w-full pointer-events-none">
      <div className="w-full px-6 py-6">
        <div className="pointer-events-auto">
          {/* Main HUD Panel */}
          <div className="relative rounded-2xl bg-gradient-to-r from-slate-900/80 via-slate-800/80 to-slate-900/80 
                          backdrop-blur-xl border-2 border-cyan-500/30 shadow-2xl shadow-cyan-500/20 overflow-hidden">
            {/* Animated border glow */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/0 via-cyan-500/20 to-cyan-500/0 
                            animate-pulse pointer-events-none" />
            
            <div className="relative p-6">
              <div className="flex items-center justify-between">
                {/* Left Section - Title */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="absolute inset-0 bg-cyan-500 rounded-lg blur-lg opacity-50 animate-pulse" />
                      <div className="relative w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg 
                                      flex items-center justify-center shadow-lg">
                        <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
                        </svg>
                      </div>
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                        SUBMARINE HANGAR
                      </h1>
                      <p className="text-sm text-slate-400">Command Center · Dock Alpha-7</p>
                    </div>
                  </div>
                </div>

                {/* Center Section - Stats */}
                <div className="flex items-center gap-8">
                  {/* Current Submarine */}
                  <div className="text-center">
                    <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Active Vessel</div>
                    <div className="text-lg font-bold text-cyan-300">
                      {currentSubmarine.name}
                    </div>
                    <div className="text-xs text-slate-500">Tier {currentTier}</div>
                  </div>

                  {/* Divider */}
                  <div className="w-px h-12 bg-gradient-to-b from-transparent via-cyan-500/50 to-transparent" />

                  {/* Balance */}
                  <div className="text-center">
                    <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Wallet Balance</div>
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-cyan-400" />
                      <span className="text-xl font-bold text-cyan-300">{balance.toLocaleString()}</span>
                      <span className="text-sm text-slate-400">OCE</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="w-px h-12 bg-gradient-to-b from-transparent via-cyan-500/50 to-transparent" />

                  {/* Resources */}
                  <div className="text-center">
                    <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Resources</div>
                    <div className="text-xl font-bold text-blue-300">{totalResources.toLocaleString()}</div>
                    <div className="flex gap-2 mt-1 text-xs">
                      <span className="text-slate-300">{resources.nickel} Ni</span>
                      <span className="text-blue-300">{resources.cobalt} Co</span>
                      <span className="text-orange-300">{resources.copper} Cu</span>
                      <span className="text-purple-300">{resources.manganese} Mn</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="w-px h-12 bg-gradient-to-b from-transparent via-cyan-500/50 to-transparent" />

                  {/* Wallet Address */}
                  <div className="text-center">
                    <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Connected Wallet</div>
                    <div className="text-sm font-mono text-slate-300">
                      {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                    </div>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-xs text-green-400">Connected</span>
                    </div>
                  </div>
                </div>

                {/* Right Section - Close Button */}
                <button
                  onClick={onClose}
                  className="group relative p-3 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 
                             border border-slate-600/50 hover:border-cyan-500/50 
                             transition-all duration-300"
                  title="Exit Hangar"
                >
                  <X className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                </button>
              </div>

              {/* Bottom Status Bar */}
              <div className="mt-4 pt-4 border-t border-slate-700/50">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-4 text-slate-400">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span>Systems Online</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                      <span>Hangar Bay Pressurized</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                      <span>All Vessels Ready</span>
                    </div>
                  </div>
                  <div className="text-slate-500">
                    Dock Alpha-7 · OceanX Command
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
