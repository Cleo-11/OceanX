import { createClient } from "@supabase/supabase-js"
import { Database } from './types'
import { env, getSiteUrl as getValidatedSiteUrl } from './env'

// --- Initialize and Export the Supabase Client ---
// Using validated environment variables for better security
export const supabase = createClient<Database>(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// --- Auth Helper Functions ---

// Get the site URL from validated environment variables
const getSiteUrl = () => {
  return getValidatedSiteUrl()
}

/**
 * @deprecated Google OAuth has been removed in favor of Web3 wallet authentication.
 * Use signInWithEthereum, signInWithSolana, or signInWithCoinbase from lib/web3auth.ts instead.
 */
export const signInWithGoogle = async () => {
  console.warn("[supabase] signInWithGoogle is deprecated. Use Web3 wallet authentication instead.")
  return { 
    data: null, 
    error: new Error("Google sign-in has been disabled. Please use a Web3 wallet to authenticate.") 
  }
}

/**
 * @deprecated Email/password authentication has been removed in favor of Web3 wallet authentication.
 * Use signInWithEthereum, signInWithSolana, or signInWithCoinbase from lib/web3auth.ts instead.
 */
export const signInWithEmail = async (_email: string, _password: string) => {
  console.warn("[supabase] signInWithEmail is deprecated. Use Web3 wallet authentication instead.")
  return { 
    data: null, 
    error: new Error("Email sign-in has been disabled. Please use a Web3 wallet to authenticate.") 
  }
}

/**
 * @deprecated Email/password authentication has been removed in favor of Web3 wallet authentication.
 * Use signInWithEthereum, signInWithSolana, or signInWithCoinbase from lib/web3auth.ts instead.
 */
export const signUpWithEmail = async (_email: string, _password: string, _username?: string) => {
  console.warn("[supabase] signUpWithEmail is deprecated. Use Web3 wallet authentication instead.")
  return { 
    data: null, 
    error: new Error("Email sign-up has been disabled. Please use a Web3 wallet to authenticate.") 
  }
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
  
  // Try to refresh session if it's expired
  if (!session && !error) {
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
    return { session: refreshData.session, error: refreshError }
  }
  
  return { session, error }
}