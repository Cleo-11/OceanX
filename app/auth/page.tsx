import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import AuthPageClient from "./auth-page-client"
import type { Database } from "@/lib/types"

export default async function AuthPage() {
  const supabase = createServerComponentClient<Database>({ cookies })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session) {
    redirect("/connect-wallet")
  }

  return <AuthPageClient />
}
