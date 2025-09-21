"use client"

import { useState } from "react"
import { Wallet, Package, Store, Anchor } from "lucide-react"
import { Button } from "./ui/button"
import { Card, CardContent } from "./ui/card"
import { Badge } from "./ui/badge"
import SubmarineIcon from "./SubmarineIcon"
import { SubmarineSelection } from "./submarine-selection"
import { cn } from "@/lib/utils"


interface UserDashboardProps {
  currentSubmarineTier?: number;
  tokenBalance?: number;
  resources?: {
    nickel: number;
    cobalt: number;
    copper: number;
    manganese: number;
  };
  onNavigateToGame?: () => void;
  onNavigateToStore?: () => void;
}

export function UserDashboard({
  currentSubmarineTier = 1,
  tokenBalance = 2500,
  resources = {
    nickel: 150,
    cobalt: 75,
    copper: 200,
    manganese: 50
  },
  onNavigateToGame,
  onNavigateToStore
}: UserDashboardProps) {
  const [showSubmarineStore, setShowSubmarineStore] = useState(false)
  const [showInventory, setShowInventory] = useState(false)

  const totalResources = Object.values(resources).reduce((sum, amount) => sum + amount, 0)

  const handleSubmarineSelect = (tier: number) => {
    // Handle submarine selection logic here
    console.log("Selected submarine tier:", tier)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.1),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.05),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(16,185,129,0.05),transparent_50%)]" />
      
      {/* Wallet Component - Top Right */}
      <div className="absolute top-6 right-6 z-10">
        <Card className="bg-slate-800/90 border-slate-700/50 backdrop-blur-lg shadow-xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-lg">
              <Wallet className="h-5 w-5 text-cyan-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 uppercase tracking-wide">Balance</span>
              <span className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                {tokenBalance.toLocaleString()} OCN
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="relative z-10 h-screen flex flex-col items-center justify-center p-6">
        
        {/* Center Submarine Display */}
        <div className="mb-12 relative">
          <div className="relative p-8 bg-gradient-to-br from-slate-800/40 to-slate-900/40 rounded-3xl border border-slate-700/30 backdrop-blur-md shadow-2xl">
            {/* Glow effect behind submarine */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-teal-500/20 rounded-3xl blur-xl" />
            
            <div className="relative flex flex-col items-center gap-4">
              <SubmarineIcon 
                tier={currentSubmarineTier} 
                size={200} 
                className="drop-shadow-2xl animate-pulse-subtle"
              />
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-1">Current Vessel</h2>
                <p className="text-slate-400">Tier {currentSubmarineTier} Submarine</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex gap-6 mb-8">
          {/* Submarine Store Button */}
          <Button
            onClick={onNavigateToStore}
            className="group relative px-8 py-6 bg-gradient-to-r from-slate-800/80 to-slate-700/80 hover:from-cyan-600/90 hover:to-blue-600/90 border border-slate-600/50 hover:border-cyan-500/50 rounded-2xl shadow-lg hover:shadow-cyan-500/25 transition-all duration-300 backdrop-blur-md"
            size="lg"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-lg group-hover:from-white/20 group-hover:to-white/20 transition-all duration-300">
                <Store className="h-6 w-6 text-cyan-400 group-hover:text-white" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-lg font-semibold text-white">Submarine Store</span>
                <span className="text-sm text-slate-400 group-hover:text-slate-200">Upgrade your fleet</span>
              </div>
            </div>
          </Button>

          {/* Inventory Button */}
          <Button
            onClick={() => setShowInventory(!showInventory)}
            className="group relative px-8 py-6 bg-gradient-to-r from-slate-800/80 to-slate-700/80 hover:from-emerald-600/90 hover:to-teal-600/90 border border-slate-600/50 hover:border-emerald-500/50 rounded-2xl shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 backdrop-blur-md"
            size="lg"
          >
            <div className="flex items-center gap-3">
              <div className="relative p-2 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-lg group-hover:from-white/20 group-hover:to-white/20 transition-all duration-300">
                <Package className="h-6 w-6 text-emerald-400 group-hover:text-white" />
                {totalResources > 0 && (
                  <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs px-2 py-1 rounded-full min-w-6 h-6 flex items-center justify-center">
                    {totalResources > 999 ? '999+' : totalResources}
                  </Badge>
                )}
              </div>
              <div className="flex flex-col items-start">
                <span className="text-lg font-semibold text-white">Inventory</span>
                <span className="text-sm text-slate-400 group-hover:text-slate-200">View resources</span>
              </div>
            </div>
          </Button>
        </div>

        {/* Dive Button */}
        <Button
          onClick={onNavigateToGame}
          className="group relative px-12 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-2xl shadow-lg hover:shadow-cyan-500/50 transition-all duration-300 text-lg font-bold"
          size="lg"
        >
          <div className="flex items-center gap-3">
            <Anchor className="h-6 w-6" />
            <span>DIVE INTO THE DEPTHS</span>
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/0 via-white/20 to-cyan-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 rounded-2xl" />
        </Button>

        {/* Inventory Dropdown */}
        {showInventory && (
          <div className="absolute bottom-32 right-1/2 translate-x-1/2">
            <Card className="bg-slate-800/95 border-slate-700/50 backdrop-blur-lg shadow-xl">
              <CardContent className="p-6 min-w-80">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Package className="h-5 w-5 text-emerald-400" />
                  Resource Inventory
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(resources).map(([resource, amount]) => (
                    <div key={resource} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/30">
                      <span className="text-slate-300 capitalize">{resource}</span>
                      <span className="font-semibold text-white">{amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-700/30">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Total Resources</span>
                    <span className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                      {totalResources.toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Submarine Selection Modal */}
      <SubmarineSelection
        isOpen={showSubmarineStore}
        onClose={() => setShowSubmarineStore(false)}
        onSelectSubmarine={handleSubmarineSelect}
        initialSelectedTier={currentSubmarineTier}
      />
    </div>
  )
}