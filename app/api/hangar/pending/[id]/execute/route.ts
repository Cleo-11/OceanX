import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getServerProvider } from '@/lib/server-provider'
import { CONTRACT_ADDRESSES, UPGRADE_MANAGER_ABI } from '@/lib/contracts'
import { ethers } from 'ethers'
import { env } from '@/lib/env'

/**
 * TESTING MODE: Set to true to bypass authentication and blockchain verification
 * TODO: Set back to false before production deployment
 */
const TESTING_MODE_BYPASS_AUTH = true
const TESTING_MODE_BYPASS_BLOCKCHAIN = true

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createSupabaseServerClient()

    // Authenticated user (bypass in testing mode)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user && !TESTING_MODE_BYPASS_AUTH) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    const pendingId = params.id

    const { data: pending, error: fetchErr } = await supabase
      .from('pending_actions')
      .select('*')
      .eq('id', pendingId)
      .maybeSingle()

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    if (!pending) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    
    // In testing mode, skip user ID validation
    if (!TESTING_MODE_BYPASS_AUTH && pending.user_id !== user?.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (pending.status !== 'pending') {
      return NextResponse.json({ error: 'Already executed or invalid status' }, { status: 400 })
    }

    // Currently support 'purchase' action. Implement other actions as needed.
    if (pending.action_type === 'purchase') {
      const payload = pending.payload ?? {}
      // payload expected to contain targetTier (number)
      const targetTier = payload.targetTier ?? payload.desiredTier ?? payload.tier

      if (!targetTier) {
        return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
      }

      // TESTING MODE: Skip blockchain verification
      if (TESTING_MODE_BYPASS_BLOCKCHAIN) {
        // Get user ID (use dummy if in testing mode without auth)
        const userId = user?.id ?? (TESTING_MODE_BYPASS_AUTH ? pending.user_id : null)
        if (!userId) {
          return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
        }

        // Directly update player tier without blockchain verification
        const { error: updatePlayerError } = await supabase
          .from('players')
          .upsert({ 
            user_id: userId,
            submarine_tier: targetTier,
            updated_at: new Date().toISOString()
          }, { 
            onConflict: 'user_id' 
          })

        if (updatePlayerError) {
          console.error('Testing mode: player update failed', updatePlayerError)
          // In testing mode, continue even if player update fails
        }

        // Mark pending as executed
        const { error: updatePendingError } = await supabase
          .from('pending_actions')
          .update({ 
            status: 'executed', 
            executed_at: new Date().toISOString(),
            tx_hash: 'testing-mode-no-tx'
          })
          .eq('id', pendingId)

        if (updatePendingError) {
          console.error('Testing mode: pending update failed', updatePendingError)
        }

        return NextResponse.json({ ok: true, testing_mode: true })
      }

      // Original blockchain verification code (only runs when TESTING_MODE_BYPASS_BLOCKCHAIN = false)
      // Require a txHash to verify on-chain. Accept txHash from pending.payload.txHash
      const txHash = (pending.payload && pending.payload.txHash) || null
      if (!txHash) {
        return NextResponse.json({ error: 'missing_txHash', message: 'No txHash present on pending action; call /confirm with txHash first.' }, { status: 400 })
      }

      // Fetch receipt via server provider
      const provider = getServerProvider()
      const receipt = await provider.getTransactionReceipt(txHash)
      if (!receipt) {
        return NextResponse.json({ error: 'receipt_not_found' }, { status: 404 })
      }

      // Check success status
      if (receipt.status !== 1) {
        return NextResponse.json({ error: 'tx_failed', status: 400 })
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
            return NextResponse.json({ error: 'insufficient_confirmations', required: requiredConfirmations }, { status: 202 })
          }
          // wait a bit before retrying
          await new Promise((res) => setTimeout(res, 1500))
        }
      }

      // Verify tx.to matches upgrade manager
      const tx = await provider.getTransaction(txHash)
      if (!tx) {
        return NextResponse.json({ error: 'tx_not_found' }, { status: 404 })
      }

      const toAddress = tx.to ? tx.to.toLowerCase() : ''
      if (toAddress !== CONTRACT_ADDRESSES.UPGRADE_MANAGER.toLowerCase()) {
        return NextResponse.json({ error: 'invalid_target_contract' }, { status: 400 })
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
        return NextResponse.json({ error: 'missing_event', message: 'SubmarineUpgraded event not found in tx logs' }, { status: 400 })
      }

      // Ensure event args match the expected new tier and player
      const eventArgs = parsed.args || {}
      const newTier = eventArgs.newTier ? Number(eventArgs.newTier) : null
      const playerAddress = eventArgs.player ? (eventArgs.player as string).toLowerCase() : null

      if (newTier === null || playerAddress === null) {
        return NextResponse.json({ error: 'invalid_event_args' }, { status: 400 })
      }

      // Get user ID (should exist at this point since we passed blockchain verification)
      const userId = user?.id
      if (!userId) {
        return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
      }

      // If player's linked wallet exists, confirm it matches tx.from or event player
      const { data: playerRecord } = await supabase.from('players').select('wallet_address').eq('user_id', userId).maybeSingle()
      const linkedWallet = playerRecord?.wallet_address ? playerRecord.wallet_address.toLowerCase() : null

  const txFrom = tx.from ? tx.from.toLowerCase() : null
      if (linkedWallet && txFrom && linkedWallet !== txFrom) {
        return NextResponse.json({ error: 'wallet_mismatch', message: 'Transaction sender does not match linked wallet' }, { status: 403 })
      }

      if (newTier !== Number(targetTier)) {
        return NextResponse.json({ error: 'tier_mismatch', message: 'On-chain newTier does not match requested tier' }, { status: 400 })
      }

      // All verified: persist txHash and receipt, update player, and mark pending executed
      const { error: updatePlayerError } = await supabase
        .from('players')
        .update({ submarine_tier: targetTier })
        .eq('user_id', userId)

      if (updatePlayerError) {
        return NextResponse.json({ error: 'player_update_failed', detail: updatePlayerError.message }, { status: 500 })
      }

      const { error: updatePendingError } = await supabase
        .from('pending_actions')
        .update({ status: 'executed', executed_at: new Date().toISOString(), tx_hash: txHash, tx_receipt: receipt })
        .eq('id', pendingId)

      if (updatePendingError) {
        return NextResponse.json({ error: 'pending_update_failed', detail: updatePendingError.message }, { status: 500 })
      }

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  } catch (e) {
    console.error('Error executing pending', e)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
