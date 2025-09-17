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
  const [selectedTier, setSelectedTier] = useState<number>(initialSelectedTier)

  // Get submarines the player has access to (could be based on progression)
  // For now, we'll show all submarines from tier 1-3
  const availableSubmarines = SUBMARINE_TIERS.filter(sub => sub.tier <= 3)
  
  const handleSelect = () => {
    onSelectSubmarine(selectedTier)
    onClose()
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
  <DialogContent className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-3xl w-full bg-black/90 border border-cyan-500/30 text-white submarine-selection-backdrop rounded-xl p-0">
        <div className="caustics-overlay"></div>
        <DialogHeader>
          <DialogTitle className="text-center text-3xl font-bold tracking-wider bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent pb-2 title-glow">
            CHOOSE YOUR SUBMARINE
          </DialogTitle>
          <DialogDescription className="text-center text-cyan-300/80">
            Select your vessel for deep sea exploration and mining operations
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          <Carousel className="w-full max-w-2xl mx-auto">
            <CarouselContent>
              {availableSubmarines.map((submarine) => (
                <CarouselItem key={submarine.tier} className="md:basis-1/2 lg:basis-1/3">
                  <div className="p-1">
                    <Card 
                      className={cn(
                        "border-2 transition-all duration-300 bg-black/60 submarine-glow",
                        selectedTier === submarine.tier 
                          ? "border-cyan-400 animate-glow active" 
                          : "border-gray-600 hover:border-cyan-400/50"
                      )}
                      onClick={() => setSelectedTier(submarine.tier)}
                    >
                      <CardContent className="flex flex-col items-center p-6">
                        {/* Submarine 3D model or image */}
                        <div className="flex items-center justify-center w-full aspect-video mb-4">
                          <SubmarineIcon tier={submarine.tier} size={120} className="drop-shadow-lg" />
                        </div>
                        
                        {/* Submarine name and tier */}
                        <div className="text-center mb-4">
                          <h3 className="text-xl font-bold text-cyan-300">{submarine.name}</h3>
                          <p className="text-sm text-gray-400">Tier {submarine.tier}</p>
                        </div>
                      </CardContent>
                      
                      {/* Stats */}
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
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-1 bg-cyan-950/50 border-cyan-500/30 text-cyan-400 hover:bg-cyan-900/50 hover:text-white" />
            <CarouselNext className="right-1 bg-cyan-950/50 border-cyan-500/30 text-cyan-400 hover:bg-cyan-900/50 hover:text-white" />
          </Carousel>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-4 mt-6">
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
          >
            SELECT & DIVE
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
//.