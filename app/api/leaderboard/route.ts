import { NextResponse } from "next/server"
import { createSupabaseAdmin } from "@/lib/supabase-server"
import { ethers } from "ethers"

export const dynamic = "force-dynamic"

const LEADERBOARD_LIMIT = 15
const DEFAULT_PAGE_SIZE = 100
const DEFAULT_MAX_PAGES = 3
const DEFAULT_CACHE_TTL_MS = 60_000

type ExplorerMode = "sepolia-etherscan" | "basescan-mainnet" | "basescan-sepolia"

interface ExplorerConfig {
  mode: ExplorerMode
  apiBaseUrl: string
  apiKey: string | undefined
}

interface ExplorerTokenTransfer {
  from?: string
  to?: string
  value?: string
  isError?: string
  txreceipt_status?: string
}

interface RankedPlayer {
  username: string
  submarineTier: number
  ocxEarned: number
}

interface CachedLeaderboard {
  expiresAt: number
  data: Array<{
    rank: number
    username: string
    ocxEarned: number
    submarineTier: number
  }>
}

let cachedLeaderboard: CachedLeaderboard | null = null

function getExplorerConfig(): ExplorerConfig {
  const mode = (process.env.LEADERBOARD_EXPLORER_MODE || "sepolia-etherscan").toLowerCase() as ExplorerMode

  if (mode === "basescan-mainnet") {
    return {
      mode,
      apiBaseUrl: "https://api.basescan.org/api",
      apiKey: process.env.BASESCAN_API_KEY || process.env.ETHERSCAN_API_KEY,
    }
  }

  if (mode === "basescan-sepolia") {
    return {
      mode,
      apiBaseUrl: "https://api-sepolia.basescan.org/api",
      apiKey: process.env.BASESCAN_API_KEY || process.env.ETHERSCAN_API_KEY,
    }
  }

  return {
    mode: "sepolia-etherscan",
    apiBaseUrl: "https://api-sepolia.etherscan.io/api",
    apiKey: process.env.ETHERSCAN_API_KEY,
  }
}

function isValidEvmAddress(value: string | null | undefined): value is string {
  if (!value) return false
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function parseAllowedSourceAddresses(raw: string | undefined): string[] {
  if (!raw) return []

  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => isValidEvmAddress(value))
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<any> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Explorer request failed with status ${response.status}`)
    }

    return response.json()
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchWalletOcxEarningsBaseUnits(
  walletAddress: string,
  ocxTokenAddress: string,
  explorer: ExplorerConfig,
  allowedSourceAddresses: Set<string>,
  pageSize: number,
  maxPages: number
): Promise<bigint> {
  let total = BigInt(0)

  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({
      module: "account",
      action: "tokentx",
      contractaddress: ocxTokenAddress,
      address: walletAddress,
      page: String(page),
      offset: String(pageSize),
      sort: "asc",
    })

    if (explorer.apiKey) {
      params.set("apikey", explorer.apiKey)
    }

    const url = `${explorer.apiBaseUrl}?${params.toString()}`
    const payload = await fetchJsonWithTimeout(url, 10_000)

    if (!payload || typeof payload !== "object") {
      throw new Error("Explorer returned an invalid payload")
    }

    const status = String(payload.status || "")
    const message = String(payload.message || "")
    const result = payload.result

    if (status === "0" && typeof result === "string") {
      const lowerResult = result.toLowerCase()
      const lowerMessage = message.toLowerCase()

      if (lowerResult.includes("no transactions") || lowerMessage.includes("no transactions")) {
        return total
      }

      throw new Error(result)
    }

    if (!Array.isArray(result)) {
      throw new Error("Explorer response missing transactions array")
    }

    for (const tx of result as ExplorerTokenTransfer[]) {
      if (tx.isError === "1") continue
      if (tx.txreceipt_status && tx.txreceipt_status !== "1") continue

      const from = tx.from?.toLowerCase()
      if (!from || !allowedSourceAddresses.has(from)) continue

      const to = tx.to?.toLowerCase()
      if (to !== walletAddress.toLowerCase()) continue

      const value = tx.value
      if (!value || !/^\d+$/.test(value)) continue

      total += BigInt(value)
    }

    if (result.length < pageSize) {
      break
    }
  }

  return total
}

/**
 * GET /api/leaderboard
 * Fetches top players by OCX tokens earned on-chain from explorer transaction history
 */
export async function GET() {
  try {
    const cacheTtlMs = Number(process.env.LEADERBOARD_CACHE_TTL_MS || DEFAULT_CACHE_TTL_MS)
    const now = Date.now()

    if (cachedLeaderboard && cachedLeaderboard.expiresAt > now) {
      return NextResponse.json({
        success: true,
        data: cachedLeaderboard.data,
      })
    }

    const tokenAddressFromEnv =
      process.env.LEADERBOARD_OCX_TOKEN_ADDRESS ||
      process.env.NEXT_PUBLIC_OCEAN_X_TOKEN_ADDRESS ||
      process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS

    if (!isValidEvmAddress(tokenAddressFromEnv)) {
      console.error("[leaderboard] Missing or invalid OCX token address for explorer lookup")
      return NextResponse.json(
        { error: "Leaderboard OCX token address is not configured" },
        { status: 500 }
      )
    }

    const explorer = getExplorerConfig()
    const enforceSourceFilter = (process.env.LEADERBOARD_ENFORCE_SOURCE_FILTER || "true") !== "false"
    const allowedSources = parseAllowedSourceAddresses(process.env.LEADERBOARD_ALLOWED_SOURCE_ADDRESSES)

    if (enforceSourceFilter && allowedSources.length === 0) {
      console.error("[leaderboard] Source filtering is enabled but no allowed source addresses are configured")
      return NextResponse.json(
        { error: "Leaderboard source filter is enabled but LEADERBOARD_ALLOWED_SOURCE_ADDRESSES is empty" },
        { status: 500 }
      )
    }

    const allowedSourceSet = new Set(allowedSources)
    const pageSize = Number(process.env.LEADERBOARD_SCAN_PAGE_SIZE || DEFAULT_PAGE_SIZE)
    const maxPages = Number(process.env.LEADERBOARD_SCAN_MAX_PAGES || DEFAULT_MAX_PAGES)
    const ocxDecimals = Number(process.env.LEADERBOARD_OCX_DECIMALS || 18)

    const supabase = createSupabaseAdmin()

    // Fetch candidate players with linked wallets, then rank by on-chain OCX transfer history
    const { data: players, error: fetchError } = await supabase
      .from("players")
      .select("username, wallet_address, submarine_tier")
      .not("username", "is", null)
      .not("wallet_address", "is", null)
      .not("username", "like", "Captain-%") // Exclude auto-generated usernames
      .limit(200)

    if (fetchError) {
      console.error("[leaderboard] Database error:", fetchError)
      return NextResponse.json(
        { error: "Failed to fetch leaderboard", details: fetchError.message },
        { status: 500 }
      )
    }

    interface PlayerRow {
      username: string | null
      wallet_address: string | null
      submarine_tier: number | null
    }

    const normalizedPlayers = ((players || []) as PlayerRow[]).filter(
      (player) => player.username && isValidEvmAddress(player.wallet_address)
    )

    const rankedPlayers: RankedPlayer[] = []

    await Promise.all(
      normalizedPlayers.map(async (player) => {
        try {
          const baseUnits = await fetchWalletOcxEarningsBaseUnits(
            player.wallet_address!,
            tokenAddressFromEnv,
            explorer,
            allowedSourceSet,
            pageSize,
            maxPages
          )

          const ocxEarned = Number(ethers.formatUnits(baseUnits, ocxDecimals))

          rankedPlayers.push({
            username: player.username!,
            ocxEarned: Number.isFinite(ocxEarned) ? ocxEarned : 0,
            submarineTier: player.submarine_tier || 1,
          })
        } catch (walletErr) {
          console.warn("[leaderboard] Failed explorer lookup for wallet:", {
            username: player.username,
            wallet: player.wallet_address,
            error: walletErr instanceof Error ? walletErr.message : String(walletErr),
          })
        }
      })
    )

    const formattedLeaderboard = rankedPlayers
      .sort((a, b) => b.ocxEarned - a.ocxEarned)
      .slice(0, LEADERBOARD_LIMIT)
      .map((player, index) => ({
        rank: index + 1,
        username: player.username || "Unknown Captain",
        ocxEarned: player.ocxEarned,
        submarineTier: player.submarineTier || 1,
      }))

    cachedLeaderboard = {
      expiresAt: now + cacheTtlMs,
      data: formattedLeaderboard,
    }

    console.info("[leaderboard] ✅ Leaderboard fetched:", {
      count: formattedLeaderboard.length,
      explorerMode: explorer.mode,
      sourceFilterEnabled: enforceSourceFilter,
      sourceCount: allowedSourceSet.size,
    })

    return NextResponse.json({
      success: true,
      data: formattedLeaderboard,
    })
  } catch (err) {
    console.error("[leaderboard] Server error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
