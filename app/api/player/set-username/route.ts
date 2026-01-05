import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import type { Database } from "@/lib/types"

export async function POST(request: NextRequest) {
  try {
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

    // Get session
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }

    // Get request body
    const { username } = await request.json()

    // Validate username
    if (!username || typeof username !== "string") {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 }
      )
    }

    const trimmedUsername = username.trim()

    if (trimmedUsername.length < 3) {
      return NextResponse.json(
        { error: "Username must be at least 3 characters" },
        { status: 400 }
      )
    }

    if (trimmedUsername.length > 20) {
      return NextResponse.json(
        { error: "Username must be 20 characters or less" },
        { status: 400 }
      )
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      return NextResponse.json(
        { error: "Username can only contain letters, numbers, underscores, and hyphens" },
        { status: 400 }
      )
    }

    // Check if username is already taken (case-insensitive)
    const { data: existingUser } = await supabase
      .from("players")
      .select("id")
      .ilike("username", trimmedUsername)
      .neq("user_id", session.user.id)
      .maybeSingle()

    if (existingUser) {
      return NextResponse.json(
        { error: "Username is already taken" },
        { status: 409 }
      )
    }

    // Update the player record with the new username
    const { data: updatedPlayer, error: updateError } = await supabase
      .from("players")
      .update({ username: trimmedUsername })
      .eq("user_id", session.user.id)
      .select()
      .single()

    if (updateError) {
      console.error("[set-username] Error updating username:", updateError)
      return NextResponse.json(
        { error: "Failed to update username" },
        { status: 500 }
      )
    }

    console.log("[set-username] Username set successfully:", {
      userId: session.user.id,
      username: trimmedUsername,
    })

    return NextResponse.json({
      success: true,
      player: updatedPlayer,
    })
  } catch (error) {
    console.error("[set-username] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
