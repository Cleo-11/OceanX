import { redirect } from "next/navigation"

// The old game-start screen was an unused stub; the game starts from /home.
export default function GameStartPage() {
  redirect("/home")
}
