import { UserDashboard } from "@/components/user-dashboard"

export default function DashboardPage() {
  const handleNavigateToGame = () => {
    // Navigate to game page
    console.log("Navigate to game")
  }

  return (
    <UserDashboard
      currentSubmarineTier={3}
      tokenBalance={4250}
      resources={{
        nickel: 320,
        cobalt: 180,
        copper: 450,
        manganese: 125
      }}
      onNavigateToGame={handleNavigateToGame}
    />
  )
}