import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/lib/types"

export async function POST() {
  try {
    // Service role client for bypassing RLS
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get user session from cookies
    const cookieStore = cookies()
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const userId = session.user.id

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
