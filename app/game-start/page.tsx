"use client"

import { useState } from "react"
import { SubmarineSelection } from "@/components/submarine-selection"
import { Button } from "@/components/ui/button"

export default function GameStartPage() {
  const [showSubmarineSelection, setShowSubmarineSelection] = useState(false)
  const [selectedSubmarineTier, setSelectedSubmarineTier] = useState(1)
  
  const handleSelectSubmarine = (tier: number) => {
    setSelectedSubmarineTier(tier)
    console.log(`Selected submarine tier: ${tier}`)
    // Here you would typically:
    // 1. Save the user's submarine selection
    // 2. Initialize the game with the selected submarine
    // 3. Navigate to the game page
  }
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white p-4">
      {/* Game logo or title */}
      <div className="text-4xl font-bold mb-8 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
        OCEANX EXPLORER
      </div>
      
      <div className="flex flex-col gap-6 max-w-md w-full">
        <Button 
          className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 animate-shimmer py-6 text-lg"
          onClick={() => setShowSubmarineSelection(true)}
        >
          Start Exploration
        </Button>
        
        <Button
          variant="outline"
          className="border-cyan-800/30 text-cyan-400 hover:bg-cyan-900/20"
        >
          Settings
        </Button>
      </div>
      
      {/* Submarine Selection Modal */}
      <SubmarineSelection 
        isOpen={showSubmarineSelection}
        onClose={() => setShowSubmarineSelection(false)}
        onSelectSubmarine={handleSelectSubmarine}
        initialSelectedTier={selectedSubmarineTier}
      />
    </div>
  )
}
