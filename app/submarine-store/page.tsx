import { redirect } from "next/navigation"

// Upgrades live in the hangar; this older store page duplicated it.
export default function SubmarineStorePage() {
  redirect("/submarine-hangar")
}
