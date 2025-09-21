"use client"

import { useRouter } from "next/navigation"
import { UserDashboard } from "@/components/user-dashboard"

export default function DashboardPage() {
  const router = useRouter();

  const handleNavigateToGame = () => {
    router.push("/game");
  };

  const handleNavigateToStore = () => {
    router.push("/submarines");
  };

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
      onNavigateToStore={handleNavigateToStore}
    />
  );
}