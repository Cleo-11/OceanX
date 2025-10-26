import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { ethers } from 'ethers'
import UpgradeManagerABI from '@/server/abis/UpgradeManager.json'

const UPGRADE_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_UPGRADE_MANAGER_ADDRESS
const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || 'https://rpc.sepolia.org' // Fallback to Sepolia testnet

interface PurchaseRequest {
  txHash: string
  playerAddress: string
  targetTier: number
}

// In-memory cache for processed transactions (prevents replay attacks)
// In production, use Redis or database
const processedTransactions = new Set<string>()

/**
 * POST /api/hangar/purchase
 * 
 * Verifies on-chain submarine upgrade transaction and updates Supabase
 * 
 * Security:
 * - Verifies transaction exists on blockchain
 * - Validates transaction sender matches player
 * - Checks transaction calls correct contract method
 * - Prevents replay attacks via transaction hash tracking
 * - Validates tier progression
 */
export async function POST(req: NextRequest) {
  try {
    const body: PurchaseRequest = await req.json()
    const { txHash, playerAddress, targetTier } = body

    // Validate inputs
    if (!txHash || !ethers.isHexString(txHash, 32)) {
      return NextResponse.json(
        { error: 'Invalid transaction hash' },
        { status: 400 }
      )
    }

    if (!playerAddress || !ethers.isAddress(playerAddress)) {
      return NextResponse.json(
        { error: 'Invalid player address' },
        { status: 400 }
      )
    }

    if (!targetTier || targetTier < 1 || targetTier > 15) {
      return NextResponse.json(
        { error: 'Invalid target tier' },
        { status: 400 }
      )
    }

    // Check for replay attack
    if (processedTransactions.has(txHash.toLowerCase())) {
      return NextResponse.json(
        { error: 'Transaction already processed' },
        { status: 409 }
      )
    }

    // Verify contract address is configured
    if (!UPGRADE_MANAGER_ADDRESS) {
      console.error('UPGRADE_MANAGER_ADDRESS not configured')
      return NextResponse.json(
        { error: 'Contract address not configured' },
        { status: 500 }
      )
    }

    // Create provider to verify transaction
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    
    // Fetch transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash)
    if (!receipt) {
      return NextResponse.json(
        { error: 'Transaction not found or not confirmed' },
        { status: 404 }
      )
    }

    // Verify transaction was successful
    if (receipt.status !== 1) {
      return NextResponse.json(
        { error: 'Transaction failed on blockchain' },
        { status: 400 }
      )
    }

    // Fetch transaction details
    const tx = await provider.getTransaction(txHash)
    if (!tx) {
      return NextResponse.json(
        { error: 'Transaction details not found' },
        { status: 404 }
      )
    }

    // Verify transaction sender matches player
    if (tx.from.toLowerCase() !== playerAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Transaction sender does not match player address' },
        { status: 403 }
      )
    }

    // Verify transaction was sent to UpgradeManager contract
    if (tx.to?.toLowerCase() !== UPGRADE_MANAGER_ADDRESS.toLowerCase()) {
      return NextResponse.json(
        { error: 'Transaction was not sent to UpgradeManager contract' },
        { status: 400 }
      )
    }

    // Parse transaction data to verify it's an upgradeSubmarine call
    const upgradeContract = new ethers.Contract(
      UPGRADE_MANAGER_ADDRESS,
      UpgradeManagerABI,
      provider
    )

    let parsedTx
    try {
      parsedTx = upgradeContract.interface.parseTransaction({
        data: tx.data,
        value: tx.value,
      })
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid transaction data - not an upgrade call' },
        { status: 400 }
      )
    }

    // Verify function name
    if (parsedTx?.name !== 'upgradeSubmarine') {
      return NextResponse.json(
        { error: 'Transaction is not an upgradeSubmarine call' },
        { status: 400 }
      )
    }

    // Verify target tier matches
    const txTargetTier = Number(parsedTx.args[0])
    if (txTargetTier !== targetTier) {
      return NextResponse.json(
        { error: 'Target tier mismatch between request and transaction' },
        { status: 400 }
      )
    }

    // Parse SubmarineUpgraded event from logs
    const upgradeEvent = receipt.logs
      .map((log) => {
        try {
          return upgradeContract.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          })
        } catch {
          return null
        }
      })
      .find((event) => event?.name === 'SubmarineUpgraded')

    if (!upgradeEvent) {
      return NextResponse.json(
        { error: 'SubmarineUpgraded event not found in transaction' },
        { status: 400 }
      )
    }

    const eventPlayer = upgradeEvent.args.player
    const previousTier = Number(upgradeEvent.args.previousTier)
    const newTier = Number(upgradeEvent.args.newTier)
    const costPaid = upgradeEvent.args.costPaid.toString()

    // Verify player address from event
    if (eventPlayer.toLowerCase() !== playerAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Event player address does not match request' },
        { status: 403 }
      )
    }

    // Verify tier progression is sequential
    if (newTier !== previousTier + 1 || newTier !== targetTier) {
      return NextResponse.json(
        { error: 'Invalid tier progression' },
        { status: 400 }
      )
    }

    // ✅ Transaction verified successfully
    // Now update Supabase with new tier

    const supabase = await createSupabaseServerClient()

    // Find player by wallet address
    const { data: player, error: fetchError } = await supabase
      .from('players')
      .select('id, tier, wallet_address')
      .eq('wallet_address', playerAddress.toLowerCase())
      .single()

    if (fetchError || !player) {
      return NextResponse.json(
        { error: 'Player not found in database' },
        { status: 404 }
      )
    }

    // Verify database tier matches contract previous tier
    if (player.tier !== previousTier) {
      console.warn(
        `Tier mismatch: DB tier=${player.tier}, contract previousTier=${previousTier}`
      )
      // Continue anyway but log warning (contract is source of truth)
    }

    // Update player tier in database
    const { error: updateError } = await supabase
      .from('players')
      .update({
        tier: newTier,
        updated_at: new Date().toISOString(),
      })
      .eq('id', player.id)

    if (updateError) {
      console.error('Failed to update player tier:', updateError)
      return NextResponse.json(
        { error: 'Failed to update player tier in database' },
        { status: 500 }
      )
    }

    // Record transaction hash to prevent replay
    processedTransactions.add(txHash.toLowerCase())

    // Optional: Store transaction record in database for audit trail
    const { error: auditError } = await supabase.from('upgrade_transactions').insert({
      player_id: player.id,
      tx_hash: txHash.toLowerCase(),
      from_tier: previousTier,
      to_tier: newTier,
      cost_paid: costPaid,
      block_number: receipt.blockNumber,
      verified_at: new Date().toISOString(),
    })
    
    if (auditError) {
      console.warn('Failed to store transaction record:', auditError)
      // Don't fail the request if audit log fails
    }

    return NextResponse.json({
      success: true,
      message: 'Submarine upgrade verified and applied',
      data: {
        playerAddress,
        previousTier,
        newTier,
        costPaid,
        txHash,
        blockNumber: receipt.blockNumber,
      },
    })
  } catch (error) {
    console.error('Purchase verification error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error during purchase verification',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
