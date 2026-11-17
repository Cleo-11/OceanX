import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getServerProvider } from '@/lib/server-provider'
import { CONTRACT_ADDRESSES, UPGRADE_MANAGER_ABI } from '@/lib/contracts'
import { ethers } from 'ethers'
import { env } from '@/lib/env'
import { randomUUID } from 'crypto'

/**
 * pending_actions lifecycle (explicit):
 *
 *   pending ──claim (execution_token)──▶ executing ──verified + player updated──▶ executed
 *      ▲                                     │
 *      └────────── release ◀─────────────────┘  any exit that does not complete the action
 *
 * Every non-completing exit MUST release the claim. Previously only one error
 * path did, so a missing receipt, a not-yet-confirmed tx or a thrown RPC error
 * left the row in 'executing' forever and the purchase could never be retried.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  // Set once the row is claimed; cleared once the action can no longer be retried.
  let releaseClaim: (() => Promise<void>) | null = null
  try {
    const supabase = await createSupabaseServerClient()

    // Ensure user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    const pendingId = params.id

    // Generate unique execution token for atomic race condition prevention
    const executionToken = randomUUID()

    // ATOMIC OPERATION: Try to claim this action for execution
    // This prevents race conditions by using database-level constraints
    const { data: claimed, error: claimError } = await supabase
      .from('pending_actions')
      .update({ 
        execution_token: executionToken,
        status: 'executing'
      })
      .eq('id', pendingId)
      .eq('status', 'pending') // Only claim if still pending
      .is('execution_token', null) // Only claim if not already claimed
      .eq('user_id', user.id) // Ensure user owns this action
      .select()
      .single()

    if (claimError || !claimed) {
      // Action already claimed/executed by another request or doesn't exist
      return NextResponse.json({ 
        error: 'Action unavailable', 
        message: 'Action already being executed, completed, or not found' 
      }, { status: 409 })
    }

    // Action successfully claimed, proceed with execution
    const pending = claimed

    // executing → pending. Guarded by our execution_token so it can never
    // release a claim that a different request holds.
    releaseClaim = async () => {
      const { error: releaseError } = await supabase
        .from('pending_actions')
        .update({ status: 'pending', execution_token: null })
        .eq('id', pendingId)
        .eq('execution_token', executionToken)
      if (releaseError) {
        console.error('Failed to release pending action claim:', releaseError)
      }
    }

    // Respond with a non-completing result: hand the row back first.
    const fail = async (body: Record<string, unknown>, status: number) => {
      if (releaseClaim) await releaseClaim()
      releaseClaim = null
      return NextResponse.json(body, { status })
    }

    // Currently support 'purchase' action. Implement other actions as needed.
    if (pending.action_type === 'purchase') {
      const payload = pending.payload ?? {}
      // payload expected to contain targetTier (number)
      const targetTier = payload.targetTier ?? payload.desiredTier ?? payload.tier

      if (!targetTier) {
        return fail({ error: 'invalid_payload' }, 400)
      }

      // Require a txHash to verify on-chain. Accept txHash from pending.payload.txHash
      const txHash = (pending.payload && pending.payload.txHash) || null
      if (!txHash) {
        return fail({ error: 'missing_txHash', message: 'No txHash present on pending action; call /confirm with txHash first.' }, 400)
      }

      // Fetch receipt via server provider
      const provider = getServerProvider()
      const receipt = await provider.getTransactionReceipt(txHash)
      if (!receipt) {
        return fail({ error: 'receipt_not_found' }, 404)
      }

      // Check success status
      if (receipt.status !== 1) {
        return fail({ error: 'tx_failed' }, 400)
      }

      // Confirmation depth handling
      const requiredConfirmations = Number(env.ETHEREUM_CONFIRMATIONS ?? process.env.ETHEREUM_CONFIRMATIONS ?? '0')
      const confirmationTimeout = Number(env.ETHEREUM_CONFIRMATION_TIMEOUT_MS ?? process.env.ETHEREUM_CONFIRMATION_TIMEOUT_MS ?? '60000')
      if (requiredConfirmations > 0) {
        const start = Date.now()
        // Wait until required confirmations are achieved or timeout
        while (true) {
          const latest = await provider.getBlockNumber()
          const confirmations = latest - (receipt.blockNumber ?? 0) + 1
          if (confirmations >= requiredConfirmations) break
          if (Date.now() - start > confirmationTimeout) {
            return fail({ error: 'insufficient_confirmations', required: requiredConfirmations }, 202)
          }
          // wait a bit before retrying
          await new Promise((res) => setTimeout(res, 1500))
        }
      }

      // Verify tx.to matches upgrade manager
      const tx = await provider.getTransaction(txHash)
      if (!tx) {
        return fail({ error: 'tx_not_found' }, 404)
      }

      const toAddress = tx.to ? tx.to.toLowerCase() : ''
      if (toAddress !== CONTRACT_ADDRESSES.UPGRADE_MANAGER.toLowerCase()) {
        return fail({ error: 'invalid_target_contract' }, 400)
      }

      // Parse logs for SubmarineUpgraded event
      const iface = new ethers.Interface(UPGRADE_MANAGER_ABI)
      // Parse logs for SubmarineUpgraded event. Use a typed loop to avoid `any`.
      let parsed: ethers.LogDescription | null = null
      for (const rawLog of receipt.logs) {
        try {
          // `parseLog` expects a Log-like object; cast via unknown to avoid `any`.
          const p = iface.parseLog(rawLog as unknown as ethers.Log)
          if (p && p.name === 'SubmarineUpgraded') {
            parsed = p
            break
          }
        } catch {
          // ignore non-matching logs
        }
      }

      if (!parsed) {
        return fail({ error: 'missing_event', message: 'SubmarineUpgraded event not found in tx logs' }, 400)
      }

      // Ensure event args match the expected new tier and player
      const eventArgs = parsed.args || {}
      const newTier = eventArgs.newTier ? Number(eventArgs.newTier) : null
      const playerAddress = eventArgs.player ? (eventArgs.player as string).toLowerCase() : null

      if (newTier === null || playerAddress === null) {
        return fail({ error: 'invalid_event_args' }, 400)
      }

      // Get user ID (should exist at this point since we passed blockchain verification)
      const userId = user?.id
      if (!userId) {
        return fail({ error: 'Unauthenticated' }, 401)
      }

      // If player's linked wallet exists, confirm it matches tx.from or event player
      const { data: playerRecord } = await supabase.from('players').select('wallet_address').eq('user_id', userId).maybeSingle()
      const linkedWallet = playerRecord?.wallet_address ? playerRecord.wallet_address.toLowerCase() : null

  const txFrom = tx.from ? tx.from.toLowerCase() : null
      if (linkedWallet && txFrom && linkedWallet !== txFrom) {
        return fail({ error: 'wallet_mismatch', message: 'Transaction sender does not match linked wallet' }, 403)
      }

      if (newTier !== Number(targetTier)) {
        return fail({ error: 'tier_mismatch', message: 'On-chain newTier does not match requested tier' }, 400)
      }

      // All verified: persist txHash and receipt, update player, and mark pending executed
      const { error: updatePlayerError } = await supabase
        .from('players')
        .update({ submarine_tier: targetTier })
        .eq('user_id', userId)

      if (updatePlayerError) {
        // Rollback: Reset execution status if player update fails
        return fail({ error: 'player_update_failed', detail: updatePlayerError.message }, 500)
      }

      // Point of no return: the player has been upgraded. From here the row
      // must never go back to 'pending' (that would allow a second execution).
      releaseClaim = null

      // Final atomic update: Mark as executed ONLY if our execution_token matches
      const { error: updatePendingError } = await supabase
        .from('pending_actions')
        .update({ 
          status: 'executed', 
          executed_at: new Date().toISOString(), 
          tx_hash: txHash, 
          tx_receipt: receipt 
        })
        .eq('id', pendingId)
        .eq('execution_token', executionToken) // Ensure we still own this execution

      if (updatePendingError) {
        // This shouldn't happen, but if it does we've already updated the player
        console.error('Failed to mark pending as executed (player was updated):', updatePendingError)
        return NextResponse.json({ 
          error: 'pending_update_failed', 
          detail: updatePendingError.message,
          warning: 'Player tier was updated successfully' 
        }, { status: 500 })
      }

      return NextResponse.json({ ok: true })
    }

    return fail({ error: 'Unsupported action' }, 400)
  } catch (e) {
    console.error('Error executing pending', e)
    // A thrown error (RPC outage, parse failure) before completion must not
    // strand the row in 'executing'.
    if (releaseClaim) {
      try {
        await releaseClaim()
      } catch (releaseErr) {
        console.error('Failed to release pending action after error', releaseErr)
      }
    }
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
