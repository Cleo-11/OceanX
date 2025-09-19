"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "./ui/carousel"
import { Card, CardContent, CardFooter } from "./ui/card"
import { Button } from "./ui/button"
import { SUBMARINE_TIERS, type SubmarineTier } from "@/lib/submarine-tiers"
import SubmarineIcon from "./SubmarineIcon"
import { cn } from "@/lib/utils"

interface SubmarineSelectionProps {
  isOpen: boolean
  onClose: () => void
  onSelectSubmarine: (submarineTier: number) => void
  initialSelectedTier?: number
}

export function SubmarineSelection({
  isOpen,
  onClose,
  onSelectSubmarine,
  initialSelectedTier = 1,
}: SubmarineSelectionProps) {
  // Example: replace with real user data from context or props
  const [tokenBalance, setTokenBalance] = useState<number>(5000)
  const [ownedTiers, setOwnedTiers] = useState<number[]>([1]) // Player starts with tier 1
  const [selectedTier, setSelectedTier] = useState<number>(initialSelectedTier)

  // Show all submarines from tier 1-3
  const availableSubmarines = SUBMARINE_TIERS.filter(sub => sub.tier <= 3)

  const handleSelect = () => {
    if (ownedTiers.includes(selectedTier)) {
      onSelectSubmarine(selectedTier)
      onClose()
    }
  }

  const handlePurchase = (tier: number, price: number) => {
    if (tokenBalance >= price && !ownedTiers.includes(tier)) {
      setTokenBalance(tokenBalance - price)
      setOwnedTiers([...ownedTiers, tier])
      setSelectedTier(tier)
    }
  }

  // Format stat value for display with appropriate units
  const formatStatValue = (key: string, value: any) => {
    switch (key) {
      case 'speed':
        return `${value}x`
      case 'depth':
        return `${value}m`
      case 'miningRate':
        return `${value}x`
      default:
        return value
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="fixed inset-0 w-screen h-screen max-w-none max-h-none bg-slate-950/95 backdrop-blur-sm border-0 text-white !rounded-none flex flex-col justify-center items-center p-0 !translate-x-0 !translate-y-0 !grid-none">
        
        {/* Professional Token Balance Display */}
        <div className="absolute top-8 right-8 z-30 flex items-center gap-3 text-white bg-slate-800/80 backdrop-blur-md px-6 py-3 rounded-lg border border-slate-700/50">
          <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></div>
          <span className="font-display font-medium text-slate-300">Balance:</span>
          <span className="font-display font-bold text-teal-400">{tokenBalance.toLocaleString()}</span>
          <span className="font-display text-sm text-slate-400">TOKENS</span>
        </div>

        <div className="flex flex-col w-full h-full items-center justify-center max-w-6xl mx-auto px-8">
          {/* Clean Header */}
          <DialogHeader className="w-full text-center mb-12">
            <DialogTitle className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
              Select Your Submarine
            </DialogTitle>
            <DialogDescription className="text-lg text-slate-400 font-body">
              Choose your vessel for deep sea mining operations
            </DialogDescription>
            <div className="w-24 h-1 bg-gradient-to-r from-teal-400 to-blue-500 mx-auto mt-4 rounded-full"></div>
          </DialogHeader>
          {/* Professional Submarine Carousel */}
          <div className="flex-1 flex flex-col justify-center w-full max-w-5xl mx-auto">
            <div className="relative w-full flex items-center justify-center" style={{minHeight: 400}}>
              <Carousel>
                {/* Clean Navigation Arrows */}
                <CarouselPrevious className="bg-slate-800/80 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white w-12 h-12 rounded-lg" />
                
                {/* Carousel Content */}
                <div className="w-full">
                  <CarouselContent className="-ml-2 md:-ml-4">
                    {availableSubmarines.map((submarine) => {
                      const owned = ownedTiers.includes(submarine.tier)
                      const price = submarine.upgradeCost.tokens
                      const canAfford = tokenBalance >= price
                      return (
                        <CarouselItem key={submarine.tier} className="pl-2 md:pl-4 md:basis-1/2 lg:basis-1/3">
                          <div className="p-2">
                            <Card 
                              className={cn(
                                "border transition-all duration-300 bg-slate-900/80 backdrop-blur-sm rounded-lg",
                                selectedTier === submarine.tier 
                                  ? "border-teal-400 bg-slate-800/80 shadow-lg shadow-teal-400/20" 
                                  : "border-slate-700 hover:border-slate-600 hover:bg-slate-800/80"
                              )}
                              onClick={() => owned && setSelectedTier(submarine.tier)}
                            >
                              <CardContent className="p-6">
                                {/* Professional Submarine Display */}
                                <div className="flex items-center justify-center w-full h-32 mb-6 rounded-lg bg-slate-800/50">
                                  <SubmarineIcon tier={submarine.tier} size={100} className="drop-shadow-lg" />
                                </div>

                                {/* Clean Submarine Info */}
                                <div className="text-center mb-4">
                                  <h3 className="text-xl font-display font-bold text-white mb-1">{submarine.name}</h3>
                                  <p className="text-sm text-slate-400 font-body">Tier {submarine.tier}</p>
                                </div>

                                {/* Professional Price Display */}
                                <div className="text-center mb-4">
                                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-800/60 rounded-lg border border-slate-700/50">
                                    <span className="text-teal-400 font-display font-semibold">
                                      {price.toLocaleString()}
                                    </span>
                                    <span className="text-slate-400 text-sm font-display">TOKENS</span>
                                  </div>
                                </div>

                                {/* Clean Action Button */}
                                {!owned ? (
                                  <Button
                                    className={cn(
                                      "w-full font-display font-semibold transition-colors rounded-lg",
                                      canAfford 
                                        ? "bg-teal-600 hover:bg-teal-500 text-white" 
                                        : "bg-slate-700 text-slate-400 cursor-not-allowed"
                                    )}
                                    disabled={!canAfford}
                                    onClick={e => {
                                      e.stopPropagation()
                                      handlePurchase(submarine.tier, price)
                                    }}
                                  >
                                    {canAfford ? "Purchase" : "Insufficient Funds"}
                                  </Button>
                                ) : (
                                  <Button
                                    className={cn(
                                      "w-full font-display font-semibold transition-colors rounded-lg",
                                      selectedTier === submarine.tier
                                        ? "bg-slate-600 text-slate-300 cursor-default"
                                        : "bg-blue-600 hover:bg-blue-500 text-white"
                                    )}
                                    onClick={e => {
                                      e.stopPropagation()
                                      if (selectedTier !== submarine.tier) {
                                        setSelectedTier(submarine.tier)
                                        handleSelect()
                                      }
                                    }}
                                    disabled={selectedTier === submarine.tier}
                                  >
                                    {selectedTier === submarine.tier ? "Selected" : "Select & Dive"}
                                  </Button>
                                )}
                              </CardContent>
                            </Card>
                          </div>
                        </CarouselItem>
                      )
                    })}
                  </CarouselContent>
                </div>
                
                {/* Clean Right Arrow */}
                <CarouselNext className="bg-slate-800/80 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white w-12 h-12 rounded-lg" />
              </Carousel>
            </div>
          </div>
          
          {/* Professional Footer Buttons */}
          <DialogFooter className="flex flex-col sm:flex-row gap-4 mt-8 w-full max-w-md mx-auto">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white font-display font-medium rounded-lg"
            >
              Back
            </Button>
            <Button
              onClick={handleSelect}
              className={cn(
                "font-display font-semibold transition-colors rounded-lg",
                ownedTiers.includes(selectedTier)
                  ? "bg-teal-600 hover:bg-teal-500 text-white"
                  : "bg-slate-700 text-slate-400 cursor-not-allowed"
              )}
              disabled={!ownedTiers.includes(selectedTier)}
            >
              {ownedTiers.includes(selectedTier) ? "Select & Dive" : "Select a Submarine"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
//.