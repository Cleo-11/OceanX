"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Play, Store, Settings, User, Waves } from "lucide-react"
import SubmarineIcon from "./SubmarineIcon"
import { getSubmarineByTier } from "@/lib/submarine-tiers"
import { Button } from "./ui/button"
import { Card, CardContent } from "./ui/card"
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
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-full px-4 py-2 border border-yellow-400/30">
                <div className="w-3 h-3 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full animate-pulse"></div>
                <span className="text-yellow-200 font-semibold text-sm">
                  SUBMARINE CAPTAIN • TIER {playerData.submarine_tier}
                </span>
              </div>
            </div>
          </div>
          
          {/* Enhanced Wallet Display */}
          <div className="inline-flex items-center gap-3 bg-slate-800/50 backdrop-blur-md rounded-full px-6 py-3 border border-cyan-900/50 shadow-lg">
            <Waves className="w-5 h-5 text-cyan-400 animate-pulse" />
            <span className="text-slate-300 font-mono text-sm">
              {playerData.wallet_address.slice(0, 8)}...{playerData.wallet_address.slice(-6)}
            </span>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
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
              {/* Outer Glow Ring */}
              <div className="absolute -inset-2 bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-400 rounded-3xl blur-lg opacity-40 group-hover:opacity-70 animate-pulse transition-opacity duration-500"></div>
              
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
                {/* Inner Animated Background */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/10 transform skew-x-12 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000 ease-out"></div>
                
                <div className="flex items-center justify-center gap-4 relative z-10">
                  <div className="relative">
                    <Play className="w-10 h-10 group-hover/btn:scale-125 transition-transform duration-300" fill="currentColor" />
                    <div className="absolute inset-0 bg-white/30 rounded-full blur-md animate-ping"></div>
                  </div>
                  <span className="text-3xl tracking-wide drop-shadow-lg">DIVE DEEP</span>
                </div>
                
                {/* Floating Particles */}
                <div className="absolute top-2 right-4 w-1 h-1 bg-white rounded-full animate-ping delay-300"></div>
                <div className="absolute bottom-3 left-6 w-1 h-1 bg-cyan-200 rounded-full animate-ping delay-700"></div>
                <div className="absolute top-4 left-8 w-1 h-1 bg-blue-200 rounded-full animate-ping delay-1000"></div>
              </Button>
            </div>

            {/* Enhanced Secondary Buttons */}
            <div className="space-y-6 w-full max-w-sm">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur-md opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
                
                <Button
                  onClick={onSubmarineStoreClick}
                  className="relative group/btn w-full bg-gradient-to-r from-slate-700/80 to-slate-600/80 
                             hover:from-slate-600/90 hover:to-slate-500/90
                             text-cyan-300 hover:text-white border-2 border-cyan-800/50 hover:border-cyan-400/70
                             font-bold py-6 px-8 rounded-2xl 
                             shadow-xl shadow-slate-900/50 hover:shadow-cyan-900/30
                             transform hover:scale-105 active:scale-95 transition-all duration-300
                             overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-transparent to-cyan-500/10 transform skew-x-12 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"></div>
                  
                  <div className="flex items-center justify-center gap-4 relative z-10">
                    <Store className="w-6 h-6 group-hover/btn:scale-110 group-hover/btn:rotate-12 transition-all duration-300" />
                    <span className="text-lg">Submarine Hangar</span>
                  </div>
                  
                  <div className="absolute top-2 right-3 w-1 h-1 bg-cyan-400 rounded-full animate-pulse"></div>
                </Button>
              </div>

              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur-md opacity-15 group-hover:opacity-30 transition-opacity duration-300"></div>
                
                <Button
                  onClick={() => router.push('/profile')}
                  className="relative group/btn w-full bg-gradient-to-r from-slate-700/70 to-slate-600/70 
                             hover:from-slate-600/80 hover:to-slate-500/80
                             text-slate-300 hover:text-emerald-200 border-2 border-slate-600/50 hover:border-emerald-500/50
                             font-bold py-6 px-8 rounded-2xl 
                             shadow-xl shadow-slate-900/40
                             transform hover:scale-105 active:scale-95 transition-all duration-300
                             overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-emerald-500/5 transform skew-x-12 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"></div>
                  
                  <div className="flex items-center justify-center gap-4 relative z-10">
                    <User className="w-6 h-6 group-hover/btn:scale-110 transition-all duration-300" />
                    <span className="text-lg">Captain Profile</span>
                  </div>
                  
                  <div className="absolute top-2 right-3 w-1 h-1 bg-emerald-400 rounded-full animate-pulse delay-500"></div>
                </Button>
              </div>
            </div>

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
    </div>
  )
}