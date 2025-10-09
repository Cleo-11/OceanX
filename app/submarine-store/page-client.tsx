"use client"

import { useRouter } from "next/navigation"
import { SubmarineStore } from "@/components/submarine-store"
import { StyleWrapper } from "@/components/style-wrapper"
import type { PlayerResources } from "@/lib/types"

type SubmarineStoreClientProps = {
  currentTier: number
  resources: PlayerResources
  balance: number
}

export default function SubmarineStoreClient({ currentTier, resources, balance }: SubmarineStoreClientProps) {
  const router = useRouter()

  return (
    <StyleWrapper>
      <div className="min-h-screen bg-depth-900">
        <SubmarineStore
          isOpen={true}
          onClose={() => {
            // Navigate back to home when closing the store page
            router.push("/home")
          }}
          currentTier={currentTier}
          resources={resources}
          balance={balance}
          onPurchase={(targetTier) => {
            // TODO: Wire up purchase flow if needed (contract + API)
            // For now, route players to the game after choosing a tier
            // where the full gameplay context exists.
            // You can replace this with a real purchase flow later.
            console.log("Requested purchase of tier", targetTier)
            router.push("/game")
          }}
          gameState={"idle"}
        />
      </div>
    </StyleWrapper>
  )
}
