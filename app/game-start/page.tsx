"use client"

import { useState } from "react"
import { SubmarineSelection } from "@/components/submarine-selection"
import { Button } from "@/components/ui/button"

export default function GameStartPage() {
  // Submarine selection temporarily disabled
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white p-4">
      {/* Game logo or title */}
      <div className="text-4xl font-bold mb-8 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
        ABYSSX EXPLORER
      </div>
      
      <div className="flex flex-col gap-6 max-w-md w-full">
        <Button
          variant="outline"
          className="border-cyan-800/30 text-cyan-400 hover:bg-cyan-900/20"
        >
          Settings
        </Button>
      </div>
      
      {/* Submarine Selection Modal temporarily disabled */}
    </div>
  )
}
