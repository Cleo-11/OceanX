"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Play, Store, Settings, User, Waves } from "lucide-react"
import SubmarineIcon from "./SubmarineIcon"
import { getSubmarineByTier } from "@/lib/submarine-tiers"
import { Button } from "./ui/button"
import { Card, CardContent } from "./ui/card"

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
  const router = useRouter()
  
  const currentSubmarine = getSubmarineByTier(playerData.submarine_tier)
  
  // Floating animation trigger
  useEffect(() => {
    const interval = setInterval(() => {
      setIsFloating(prev => !prev)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900 overflow-hidden relative">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Floating Bubbles */}
        <div className="absolute animate-pulse top-20 left-10 w-4 h-4 bg-cyan-400/20 rounded-full blur-sm"></div>
        <div className="absolute animate-bounce top-40 right-20 w-6 h-6 bg-blue-400/30 rounded-full blur-sm"></div>
        <div className="absolute animate-pulse top-60 left-1/4 w-3 h-3 bg-teal-400/25 rounded-full blur-sm"></div>
        <div className="absolute animate-bounce bottom-40 right-1/4 w-5 h-5 bg-cyan-300/20 rounded-full blur-sm"></div>
        
        {/* Subtle Grid Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.03)_0%,transparent_50%)]"></div>
        
        {/* Ocean Floor Effect */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-800/30 to-transparent"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-teal-400 bg-clip-text text-transparent mb-2">
            Welcome Back, Captain
          </h1>
          <p className="text-slate-300 text-lg">{playerData.username}</p>
          <div className="flex items-center justify-center gap-2 mt-2 text-slate-400">
            <Waves className="w-4 h-4" />
            <span className="text-sm">
              {playerData.wallet_address.slice(0, 6)}...{playerData.wallet_address.slice(-4)}
            </span>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Left Side - Submarine Display */}
          <div className="flex flex-col items-center space-y-6">
            {/* Submarine Showcase */}
            <Card className="bg-slate-800/40 backdrop-blur-md border-cyan-900/30 shadow-2xl shadow-cyan-900/20 w-full max-w-md">
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-cyan-300 mb-2">Your Submarine</h2>
                  <h3 className="text-xl text-white">{currentSubmarine.name}</h3>
                  <p className="text-sm text-slate-400 mt-1">Tier {currentSubmarine.tier}</p>
                </div>
                
                {/* Submarine with Floating Animation */}
                <div className="flex justify-center mb-6">
                  <div 
                    className={`transition-transform duration-3000 ease-in-out ${
                      isFloating 
                        ? 'transform translate-y-[-8px] rotate-1 scale-105' 
                        : 'transform translate-y-[4px] rotate-[-0.5deg] scale-100'
                    }`}
                  >
                    <div className="relative">
                      <SubmarineIcon 
                        tier={currentSubmarine.tier} 
                        size={180} 
                        className="drop-shadow-2xl filter brightness-110"
                      />
                      {/* Glow Effect */}
                      <div className="absolute inset-0 bg-gradient-radial from-cyan-400/20 via-cyan-400/5 to-transparent rounded-full blur-xl scale-150"></div>
                    </div>
                  </div>
                </div>

                {/* Submarine Stats Preview */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-center p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
                    <p className="text-slate-400 mb-1">Max Depth</p>
                    <p className="text-cyan-300 font-bold">{currentSubmarine.baseStats.depth}m</p>
                  </div>
                  <div className="text-center p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
                    <p className="text-slate-400 mb-1">Speed</p>
                    <p className="text-blue-300 font-bold">{currentSubmarine.baseStats.speed}x</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats Card */}
            <Card className="bg-slate-800/40 backdrop-blur-md border-cyan-900/30 w-full max-w-md">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-cyan-300 mb-4 text-center">Captain Statistics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Resources Mined</span>
                    <span className="text-white font-bold">{playerData.total_resources_mined.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">OCX Earned</span>
                    <span className="text-green-400 font-bold">{playerData.total_ocx_earned.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Last Dive</span>
                    <span className="text-slate-300 text-sm">
                      {new Date(playerData.last_login).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Side - Action Buttons */}
          <div className="flex flex-col items-center space-y-6">
            {/* Main Play Button */}
            <Button
              onClick={onPlayClick}
              className="group relative bg-gradient-to-r from-teal-500 via-cyan-600 to-blue-600 
                         hover:from-teal-400 hover:via-cyan-500 hover:to-blue-500 
                         text-white font-bold text-xl px-12 py-6 rounded-2xl 
                         shadow-2xl shadow-cyan-900/30 hover:shadow-cyan-900/50 
                         transform hover:scale-105 transition-all duration-300 ease-out
                         border-2 border-cyan-400/20 hover:border-cyan-400/40
                         w-full max-w-sm min-h-[80px]"
            >
              <div className="flex items-center justify-center gap-4">
                <Play className="w-8 h-8 group-hover:scale-110 transition-transform duration-200" fill="currentColor" />
                <span className="text-2xl">Dive Deep</span>
              </div>
              
              {/* Animated Glow */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-teal-500/20 via-cyan-600/20 to-blue-600/20 
                            opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl scale-110"></div>
            </Button>

            {/* Secondary Buttons */}
            <div className="space-y-4 w-full max-w-sm">
              <Button
                onClick={onSubmarineStoreClick}
                className="group w-full bg-slate-700/50 hover:bg-slate-600/60 
                           text-cyan-300 hover:text-white border border-cyan-900/50 hover:border-cyan-600/50
                           font-semibold py-4 px-6 rounded-xl 
                           shadow-lg shadow-slate-900/30 hover:shadow-cyan-900/20
                           transform hover:scale-[1.02] transition-all duration-200"
              >
                <div className="flex items-center justify-center gap-3">
                  <Store className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                  <span>Submarine Hangar</span>
                </div>
              </Button>

              <Button
                onClick={() => router.push('/profile')}
                className="group w-full bg-slate-700/50 hover:bg-slate-600/60 
                           text-slate-300 hover:text-white border border-slate-600/50 hover:border-slate-500/50
                           font-semibold py-4 px-6 rounded-xl 
                           shadow-lg shadow-slate-900/30
                           transform hover:scale-[1.02] transition-all duration-200"
              >
                <div className="flex items-center justify-center gap-3">
                  <User className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                  <span>Captain Profile</span>
                </div>
              </Button>
            </div>

            {/* Flavor Text */}
            <div className="text-center max-w-sm mt-8">
              <p className="text-slate-400 text-sm italic leading-relaxed">
                "The ocean depths await your return, Captain. 
                {currentSubmarine.specialAbility ? ` Your ${currentSubmarine.name} is ready to unleash its special abilities.` : ' Chart your course and claim the treasures below.'}"
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Status Bar */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-4 bg-slate-800/30 backdrop-blur-md rounded-full px-6 py-3 border border-cyan-900/30">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-slate-300">Ocean Network Online</span>
            </div>
            <div className="w-px h-4 bg-slate-600"></div>
            <span className="text-sm text-slate-400">
              Submarine Tier {playerData.submarine_tier} • Ready for Deployment
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}