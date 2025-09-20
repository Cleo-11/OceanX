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

  // Show all submarines
  const availableSubmarines = SUBMARINE_TIERS

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
      <DialogContent className="fixed inset-0 w-screen h-screen max-w-none max-h-none bg-black/90 border-0 text-white submarine-selection-backdrop !rounded-none flex flex-col justify-center items-center p-0 !translate-x-0 !translate-y-0 !grid-none">
        <div className="caustics-overlay"></div>
        {/* Token balance at top right */}
        <div className="absolute top-6 right-10 z-30 flex items-center gap-2 text-cyan-200 text-lg font-semibold bg-black/60 px-4 py-2 rounded-xl border border-cyan-700 shadow-lg">
          <span>Balance:</span>
          <span className="text-cyan-400 font-bold">{tokenBalance.toLocaleString()} TOKENS</span>
        </div>
        <div className="flex flex-col w-full h-full items-center justify-center">
          <DialogHeader className="w-full max-w-3xl mx-auto">
            <DialogTitle className="text-center text-3xl font-bold tracking-wider bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent pb-2 title-glow">
              CHOOSE YOUR SUBMARINE
            </DialogTitle>
            <DialogDescription className="text-center text-cyan-300/80">
              Buy and select your vessel for deep sea exploration and mining operations
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 flex flex-col justify-center w-full max-w-3xl mx-auto">
            <div className="relative w-full flex flex-col justify-center items-center">
              {/* Carousel with absolutely positioned arrows */}
              <div className="relative w-full flex items-center justify-center" style={{minHeight: 340}}>
                <Carousel>
                  {/* Left Arrow */}
                  <CarouselPrevious className="bg-cyan-950/50 border-cyan-500/30 text-cyan-400 hover:bg-cyan-900/50 hover:text-white w-12 h-12 rounded-full flex items-center justify-center" />
                  {/* Carousel Content */}
                  <div className="w-full max-w-2xl">
                    <CarouselContent>
                      {availableSubmarines.map((submarine) => {
                        const owned = ownedTiers.includes(submarine.tier)
                        const price = submarine.upgradeCost.tokens
                        const canAfford = tokenBalance >= price
                        return (
                          <CarouselItem key={submarine.tier} className="md:basis-1/2 lg:basis-1/3">
                            <div className="p-1">
                              <Card 
                                className={cn(
                                  "border-2 transition-all duration-300 bg-black/60 submarine-glow",
                                  selectedTier === submarine.tier 
                                    ? "border-cyan-400 animate-glow active" 
                                    : "border-gray-600 hover:border-cyan-400/50"
                                )}
                                onClick={() => owned && setSelectedTier(submarine.tier)}
                              >
                                <CardContent className="flex flex-col items-center p-6">
                                  <div className="flex items-center justify-center w-full aspect-video mb-4">
                                    <SubmarineIcon tier={submarine.tier} size={120} className="drop-shadow-lg" />
                                  </div>
                                  <div className="text-center mb-2">
                                    <h3 className="text-xl font-bold text-cyan-300">{submarine.name}</h3>
                                    <p className="text-sm text-gray-400">Tier {submarine.tier}</p>
                                  </div>
                                  {/* Price display */}
                                  <div className="mb-2">
                                    <span className="text-cyan-400 font-semibold text-lg">
                                      {price.toLocaleString()} TOKENS
                                    </span>
                                  </div>
                                  {/* Purchase/Select button */}
                                  {!owned ? (
                                    <Button
                                      className="w-full bg-gradient-to-r from-cyan-600 to-blue-700 text-white font-bold mb-2"
                                      disabled={!canAfford}
                                      onClick={e => {
                                        e.stopPropagation()
                                        handlePurchase(submarine.tier, price)
                                      }}
                                    >
                                      {canAfford ? "Purchase" : "Insufficient Tokens"}
                                    </Button>
                                  ) : (
                                    <Button
                                      className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold mb-2"
                                      onClick={e => {
                                        e.stopPropagation()
                                        setSelectedTier(submarine.tier)
                                        handleSelect()
                                      }}
                                      disabled={selectedTier === submarine.tier}
                                    >
                                      {selectedTier === submarine.tier ? "Selected" : "Select & Dive"}
                                    </Button>
                                  )}
                                </CardContent>
                                <CardFooter className="flex flex-col p-4 pt-0 gap-2 border-t border-cyan-900/30">
                                  <div className="grid grid-cols-2 gap-2 w-full">
                                    <div className="stat-item">
                                      <span className="stat-label">SPEED</span>
                                      <div className="flex items-center gap-1">
                                        <div className="submarine-stats-bar w-full">
                                          <div 
                                            className="fill"
                                            style={{ width: `${submarine.baseStats.speed * 20}%` }}
                                          />
                                        </div>
                                        <span className="text-xs text-cyan-300 min-w-8 text-right">
                                          {formatStatValue('speed', submarine.baseStats.speed)}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="stat-item">
                                      <span className="stat-label">STORAGE</span>
                                      <div className="flex items-center gap-1">
                                        <div className="submarine-stats-bar w-full">
                                          <div 
                                            className="fill"
                                            style={{ 
                                              width: `${(Object.values(submarine.baseStats.maxCapacity).reduce((a, b) => a + b, 0) / 1000) * 100}%` 
                                            }}
                                          />
                                        </div>
                                        <span className="text-xs text-cyan-300 min-w-8 text-right">
                                          {Object.values(submarine.baseStats.maxCapacity).reduce((a, b) => a + b, 0)}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="stat-item">
                                      <span className="stat-label">MINING</span>
                                      <div className="flex items-center gap-1">
                                        <div className="submarine-stats-bar w-full">
                                          <div 
                                            className="fill"
                                            style={{ width: `${submarine.baseStats.miningRate * 20}%` }}
                                          />
                                        </div>
                                        <span className="text-xs text-cyan-300 min-w-8 text-right">
                                          {formatStatValue('miningRate', submarine.baseStats.miningRate)}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="stat-item">
                                      <span className="stat-label">DEPTH</span>
                                      <div className="flex items-center gap-1">
                                        <div className="submarine-stats-bar w-full">
                                          <div 
                                            className="fill"
                                            style={{ width: `${(submarine.baseStats.depth / 5000) * 100}%` }}
                                          />
                                        </div>
                                        <span className="text-xs text-cyan-300 min-w-8 text-right">
                                          {formatStatValue('depth', submarine.baseStats.depth)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  {submarine.specialAbility && (
                                    <div className="w-full mt-1">
                                      <span className="text-xs text-gray-400">SPECIAL</span>
                                      <p className="text-xs text-cyan-300">{submarine.specialAbility}</p>
                                    </div>
                                  )}
                                </CardFooter>
                              </Card>
                            </div>
                          </CarouselItem>
                        )
                      })}
                    </CarouselContent>
                  </div>
                  {/* Right Arrow */}
                  <CarouselNext className="bg-cyan-950/50 border-cyan-500/30 text-cyan-400 hover:bg-cyan-900/50 hover:text-white w-12 h-12 rounded-full flex items-center justify-center" />
                </Carousel>
              </div>
            </div>
          </div>
          {/* Single instance of footer buttons */}
          <DialogFooter className="flex flex-col sm:flex-row gap-4 mt-6 w-full max-w-3xl mx-auto">
            <Button
              variant="outline"
              onClick={onClose}
              className="sm:w-1/3 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              Back
            </Button>
            <Button
              onClick={handleSelect}
              className="sm:w-2/3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 play-button font-bold tracking-wide"
              disabled={!ownedTiers.includes(selectedTier)}
            >
              {ownedTiers.includes(selectedTier) ? "SELECT & DIVE" : "OWN A SUBMARINE TO DIVE"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
//.