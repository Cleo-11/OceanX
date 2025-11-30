import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import type { Database } from "@/lib/types"

// Service role client for bypassing RLS
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    // Get user session from cookies
    const supabase = createServerComponentClient<Database>({ cookies })
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const userId = session.user.id
    const body = await request.json()
    const { nickel, cobalt, copper, manganese } = body

    const total = (nickel || 0) + (cobalt || 0) + (copper || 0) + (manganese || 0)

    console.info("[api/player/save-resources] Saving resources:", {
      userId,
      resources: { nickel, cobalt, copper, manganese },
      total,
    })

    const { data, error } = await supabaseAdmin
      .from("players")
      .update({
        nickel: nickel || 0,
        cobalt: cobalt || 0,
        copper: copper || 0,
        manganese: manganese || 0,
        total_resources_mined: total,
        last_login: new Date().toISOString(),
        is_active: true,
      })
      .eq("user_id", userId)
      .select("nickel, cobalt, copper, manganese, total_resources_mined")
      .single()

    if (error) {
      console.error("[api/player/save-resources] Failed to save:", error)
      return NextResponse.json(
        { error: `Failed to save resources: ${error.message}` },
        { status: 500 }
      )
    }

    console.info("[api/player/save-resources] Saved successfully:", data)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[api/player/save-resources] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
