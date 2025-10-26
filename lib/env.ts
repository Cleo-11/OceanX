import { z } from "zod"

// Environment variable schema with validation
const envSchema = z.object({
  // Next.js public environment variables (exposed to client)
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("Invalid Supabase URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "Supabase anon key is required"),
  NEXT_PUBLIC_API_URL: z.string().url().optional().default("http://localhost:5000"),
  NEXT_PUBLIC_WS_URL: z.string().url().optional(),

  // Contract addresses (should be validated)
  NEXT_PUBLIC_OCEAN_X_TOKEN_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid contract address").optional(),
  NEXT_PUBLIC_PLAYER_PROFILE_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid contract address").optional(),
  NEXT_PUBLIC_UPGRADE_MANAGER_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid contract address").optional(),
  NEXT_PUBLIC_DAILY_MINER_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid contract address").optional(),
  GAME_CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid contract address").optional(),

  // Server-side only environment variables
  DATABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  // Ethereum RPC for server-side verification. TODO: switch to BASE's RPC when migrating off Sepolia/Infura.
  ETHEREUM_RPC_URL: z.string().url().optional(),
  // Number of confirmations required before accepting an on-chain transaction.
  // Set to 0 to accept immediately (useful for dev/test). Recommended 6 for mainnet.
  ETHEREUM_CONFIRMATIONS: z.string().regex(/^\d+$/).optional(),
  // Maximum time (ms) the server will wait for confirmations when executing a pending action.
  ETHEREUM_CONFIRMATION_TIMEOUT_MS: z.string().regex(/^\d+$/).optional(),
})

// Type for validated environment variables
export type Env = z.infer<typeof envSchema>

// Function to validate and parse environment variables
export function validateEnv(): Env {
  try {
    return envSchema.parse({
  // Client-side variables
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,

  // Contract addresses
  NEXT_PUBLIC_OCEAN_X_TOKEN_ADDRESS: process.env.NEXT_PUBLIC_OCEAN_X_TOKEN_ADDRESS,
  NEXT_PUBLIC_PLAYER_PROFILE_ADDRESS: process.env.NEXT_PUBLIC_PLAYER_PROFILE_ADDRESS,
  NEXT_PUBLIC_UPGRADE_MANAGER_ADDRESS: process.env.NEXT_PUBLIC_UPGRADE_MANAGER_ADDRESS,
  NEXT_PUBLIC_DAILY_MINER_ADDRESS: process.env.NEXT_PUBLIC_DAILY_MINER_ADDRESS,
  GAME_CONTRACT_ADDRESS: process.env.GAME_CONTRACT_ADDRESS,

  // Server-side variables
  DATABASE_URL: process.env.DATABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    })
  } catch (error) {
    console.error("❌ Environment variable validation failed:")
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`)
      })
    }
    throw new Error("Invalid environment variables. Please check your .env.local file.")
  }
}

// Export validated environment variables
export const env = validateEnv()

// Helper function to get site URL safely
export const getSiteUrl = () => {
  if (typeof window !== "undefined") {
    return env.NEXT_PUBLIC_SITE_URL || window.location.origin
  }
  return env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
}