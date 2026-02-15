import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getAuthFromCookies } from "@/lib/jwt-auth"
import type { Database } from "@/lib/types"

export async function POST() {
  try {
    // Authenticate using JWT
    const auth = await getAuthFromCookies()
    if (!auth || !auth.isValid) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    // Service role client for bypassing RLS
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const userId = auth.userId

    console.info("[api/player/complete-tutorial] Marking tutorial as complete:", {
      userId,
    })

    const { data, error } = await supabaseAdmin
      .from("players")
      .update({
        has_completed_tutorial: true,
      })
      .eq("user_id", userId)
      .select("has_completed_tutorial")
      .single()

    if (error) {
      console.error("[api/player/complete-tutorial] Failed to update:", error)
      return NextResponse.json(
        { error: `Failed to mark tutorial as complete: ${error.message}` },
        { status: 500 }
      )
    }

    console.info("[api/player/complete-tutorial] Updated successfully:", data)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[api/player/complete-tutorial] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
