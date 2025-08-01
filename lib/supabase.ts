import { createClient } from "@supabase/supabase-js"
import { Database } from './types'; // Assuming you have a types file for your DB schema

// --- Supabase Environment Variables ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// --- Pre-flight Checks (IMPROVEMENT) ---
// Instead of using '!', we explicitly check if the variables exist.
// This provides a clearer error message if they are missing from your .env.local file.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key are not set. Please check your .env.local file.");
}

// --- Initialize and Export the Supabase Client (IMPROVEMENT) ---
// We use the <Database> generic to give you full TypeScript support and autocompletion
// for your specific database tables and columns.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// --- Auth Helper Functions (Your existing code is great!) ---

// Get the site URL from environment variable or fallback to current origin
const getSiteUrl = () => {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
  }
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
}

export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${getSiteUrl()}/auth/callback`,
    },
  })
  return { data, error }
}

export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  return { data, error }
}

export const signUpWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback`,
    },
  })
  return { data, error }
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export const getCurrentUser = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  return { user, error }
}

export const getSession = async () => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()
  return { session, error }
}