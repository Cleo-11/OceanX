import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * POST /api/submarine/upgrade
 * 
 * DISABLED — All submarine upgrades must go through the blockchain.
 * Use the on-chain upgrade flow via smart contract + /api/submarine/sync-tier instead.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Database-only upgrades are disabled. All upgrades must be executed on the blockchain. Please connect your wallet and ensure you have on-chain OCX tokens.",
      code: "BLOCKCHAIN_REQUIRED",
    },
    { status: 403 }
  )
}
