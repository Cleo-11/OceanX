/**
 * OCX claim lifecycle — the explicit state machine behind "Claim OCX".
 *
 * A claim moves OCX from the off-chain balance (players.total_ocx_earned) to
 * the player's wallet. The server reserves (deducts) the OCX when it issues the
 * EIP-712 signature; the player then submits OCXToken.claim() themselves.
 *
 *                     ┌──────────── resume (same signature) ───────────┐
 *                     ▼                                                │
 *   issue ──▶ LIVE (signed, OCX reserved, deadline not reached) ───────┘
 *               │                         │
 *               │ on-chain nonce > N      │ deadline passes, nonce still N
 *               ▼                         ▼
 *           CONSUMED                  SETTLING (grace period: the chain may
 *        trade → 'confirmed'              │      still be reporting the tx)
 *                                         ▼
 *                                     EXPIRED
 *                          trade → 'failed' + OCX refunded
 *
 * The same machine covers marketplace resource trades (/marketplace/sign-claim):
 * there the reservation is resources, refunded as resources (see claimKind).
 *
 * Before this module the EXPIRED → refund transition did not exist: a player
 * who dismissed the wallet prompt (or whose transaction failed) had the OCX
 * deducted from their balance permanently, and could not get the signature
 * back either. The chain is the source of truth for every decision here:
 *
 *   - OCXToken.claim() requires `nonce == nonces[msg.sender]` and increments
 *     it, so "on-chain nonce > N" proves a claim signed for nonce N was used.
 *   - OCXToken.claim() requires `block.timestamp <= deadline`, so once the
 *     deadline has passed and the nonce is still N, that signature can never
 *     be used and refunding cannot double-pay.
 *
 * `trades.status` only allows pending | confirmed | failed (CHECK constraint),
 * so EXPIRED is stored as status='failed' with CLAIM_REFUND_MARKER in
 * error_message — no migration needed.
 */

import { ethers } from "ethers";
import { updatePlayerBalances, isResourceType } from "./playerLedger.js";

export const CLAIM_TRADE_TYPE = "ocx_claim";
export const CLAIM_REFUND_MARKER = "claim_expired_refunded";

/**
 * Marketplace resource trades (/marketplace/sign-claim) follow the same
 * lifecycle, with resources instead of OCX reserved at issue time. Rows that
 * reserved resources carry this idempotency_key prefix; older rows (which
 * deducted on confirm instead) never get a resource refund.
 */
export const RESERVED_TRADE_KEY_PREFIX = "reserve:";

export const ClaimKind = Object.freeze({
  OCX_CLAIM: "ocx_claim",
  RESOURCE_TRADE: "resource_trade",
});

/** Which reservation a pending trade holds, or null if it holds none. */
export function claimKind(trade) {
  if (!trade) return null;
  if (trade.resource_type === CLAIM_TRADE_TYPE) return ClaimKind.OCX_CLAIM;
  if (
    typeof trade.idempotency_key === "string" &&
    trade.idempotency_key.startsWith(RESERVED_TRADE_KEY_PREFIX) &&
    isResourceType(trade.resource_type) &&
    Number(trade.resource_amount) > 0
  ) {
    return ClaimKind.RESOURCE_TRADE;
  }
  return null;
}

export const ClaimResolution = Object.freeze({
  LIVE: "live",
  CONSUMED: "consumed",
  SETTLING: "settling",
  EXPIRED: "expired",
  UNKNOWN: "unknown",
});

const positiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

/**
 * Seconds to wait after a signature's deadline before refunding. Covers RPC
 * lag: a claim mined just before the deadline must be visible to us (as an
 * incremented nonce) before we conclude it never happened.
 */
export const CLAIM_REFUND_GRACE_SEC = positiveInt(process.env.CLAIM_REFUND_GRACE_SEC, 180);

/**
 * A signature with less than this long to live is not handed back to the
 * client: the transaction would likely be mined after the deadline and revert.
 */
export const CLAIM_MIN_LIVE_SEC = positiveInt(process.env.CLAIM_MIN_LIVE_SEC, 30);

const toBigInt = (value) => {
  if (value === null || value === undefined || value === "") return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
};

/**
 * Pure decision function: what state is a pending claim in?
 *
 * @param {object} input
 * @param {string|number|bigint|null} input.tradeNonce   nonce the claim was signed for
 * @param {string|number|bigint|null} input.deadline     signature deadline (unix seconds)
 * @param {string|number|bigint} input.onChainNonce      current OCXToken.nonces(wallet)
 * @param {number} input.nowSec                          current unix time (seconds)
 * @param {number} [input.graceSec]
 * @param {number} [input.minLiveSec]
 * @returns {"live"|"consumed"|"settling"|"expired"|"unknown"}
 */
export function resolvePendingClaim({
  tradeNonce,
  deadline,
  onChainNonce,
  nowSec,
  graceSec = CLAIM_REFUND_GRACE_SEC,
  minLiveSec = CLAIM_MIN_LIVE_SEC,
}) {
  const nonce = toBigInt(tradeNonce);
  const chainNonce = toBigInt(onChainNonce);
  const deadlineSec = toBigInt(deadline);

  // Without all three facts no safe decision exists — leave the claim alone.
  if (nonce === null || chainNonce === null || deadlineSec === null || !Number.isFinite(nowSec)) {
    return ClaimResolution.UNKNOWN;
  }

  if (chainNonce > nonce) return ClaimResolution.CONSUMED;

  const now = BigInt(Math.floor(nowSec));
  if (now + BigInt(minLiveSec) <= deadlineSec) return ClaimResolution.LIVE;
  if (now <= deadlineSec + BigInt(graceSec)) return ClaimResolution.SETTLING;
  return ClaimResolution.EXPIRED;
}

/** Seconds until a SETTLING claim becomes refundable (never negative). */
export function secondsUntilRefundable(deadline, nowSec, graceSec = CLAIM_REFUND_GRACE_SEC) {
  const deadlineSec = Number(deadline);
  if (!Number.isFinite(deadlineSec)) return graceSec;
  return Math.max(0, Math.ceil(deadlineSec + graceSec - nowSec) + 1);
}

/** trades.ocx_amount is stored in wei; convert to whole-OCX number for the balance column. */
export function claimAmountToOcx(ocxAmountWei) {
  const wei = toBigInt(ocxAmountWei);
  if (wei === null || wei <= 0n) return 0;
  return Number(ethers.formatEther(wei));
}

async function refundClaim(supabase, trade, log) {
  const kind = claimKind(trade);
  if (!kind) return 0;
  const refundOcx = kind === ClaimKind.OCX_CLAIM ? claimAmountToOcx(trade.ocx_amount) : 0;
  const refundResources = kind === ClaimKind.RESOURCE_TRADE ? Math.floor(Number(trade.resource_amount)) : 0;

  // 1. pending → failed(refunded). The `status = 'pending'` filter makes this
  //    a compare-and-swap: of any number of concurrent settlers exactly one
  //    gets a row back, so the refund below happens at most once.
  const { data: moved, error: moveError } = await supabase
    .from("trades")
    .update({ status: "failed", error_message: CLAIM_REFUND_MARKER })
    .eq("id", trade.id)
    .eq("status", "pending")
    .select("id");

  if (moveError) throw new Error(`Failed to mark claim ${trade.id} expired: ${moveError.message}`);
  if (!moved || moved.length !== 1) return 0; // someone else settled it

  if (refundOcx <= 0 && refundResources <= 0) return 0;

  // 2. Credit the reservation back (compare-and-swap, see playerLedger.js).
  //    Resources are returned even past the hold's capacity: they were the
  //    player's before the trade and must not be lost.
  try {
    await updatePlayerBalances(supabase, {
      playerId: trade.player_id,
      compute: () =>
        refundOcx > 0 ? { ocx: refundOcx } : { resources: { [trade.resource_type]: refundResources } },
    });
  } catch (creditFailure) {
    // 3. Could not credit: put the claim back to 'pending' so the next
    //    settlement retries, rather than recording a refund that never happened.
    await supabase
      .from("trades")
      .update({ status: "pending", error_message: null })
      .eq("id", trade.id)
      .eq("status", "failed")
      .eq("error_message", CLAIM_REFUND_MARKER);
    throw new Error(`Refund for claim ${trade.id} failed and was rolled back: ${creditFailure.message}`);
  }

  if (refundOcx > 0) {
    log?.(`↩️  Refunded expired claim ${trade.id}: ${refundOcx} OCX returned to player ${trade.player_id}`);
    return { ocx: refundOcx, resources: 0 };
  }
  log?.(`↩️  Refunded expired trade ${trade.id}: ${refundResources} ${trade.resource_type} returned to player ${trade.player_id}`);
  return { ocx: 0, resources: refundResources };
}

const PENDING_COLUMNS =
  "id, player_id, nonce, deadline, ocx_amount, status, created_at, resource_type, resource_amount, idempotency_key";

/** Pending trades of one wallet that hold a reservation, oldest first. */
async function loadReservedPending(supabase, wallet) {
  const lower = wallet.toLowerCase();
  const [claims, trades] = await Promise.all([
    supabase
      .from("trades")
      .select(PENDING_COLUMNS)
      .eq("wallet_address", lower)
      .eq("resource_type", CLAIM_TRADE_TYPE)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50),
    supabase
      .from("trades")
      .select(PENDING_COLUMNS)
      .eq("wallet_address", lower)
      .like("idempotency_key", `${RESERVED_TRADE_KEY_PREFIX}%`)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50),
  ]);
  if (claims.error) throw new Error(`Failed to load pending claims: ${claims.error.message}`);
  if (trades.error) throw new Error(`Failed to load pending trades: ${trades.error.message}`);
  const seen = new Set();
  return [...(claims.data || []), ...(trades.data || [])]
    .filter((row) => (seen.has(row.id) ? false : seen.add(row.id)))
    .filter((row) => claimKind(row) !== null)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

/**
 * Bring every pending OCX claim of one wallet up to date with the chain.
 *
 * @param {object} deps
 * @param {object} deps.supabase                 service-role Supabase client
 * @param {string} deps.wallet
 * @param {string|number|bigint} deps.onChainNonce   fresh OCXToken.nonces(wallet)
 * @param {number} [deps.nowSec]
 * @param {number} [deps.graceSec]
 * @param {number} [deps.minLiveSec]
 * @param {(msg: string) => void} [deps.log]
 * @returns {Promise<{confirmed: string[], refunded: string[], refundedOcx: number,
 *                    refundedResources: number, live: object|null,
 *                    settling: object|null, unknown: string[]}>}
 *   `live` / `settling` carry `kind` ("ocx_claim" | "resource_trade").
 */
export async function settlePendingClaims({
  supabase,
  wallet,
  onChainNonce,
  nowSec = Math.floor(Date.now() / 1000),
  graceSec = CLAIM_REFUND_GRACE_SEC,
  minLiveSec = CLAIM_MIN_LIVE_SEC,
  log = console.log,
}) {
  const result = {
    confirmed: [],
    refunded: [],
    refundedOcx: 0,
    refundedResources: 0,
    live: null,
    settling: null,
    unknown: [],
  };
  if (!supabase || !wallet) return result;

  const trades = await loadReservedPending(supabase, wallet);

  for (const trade of trades) {
    trade.kind = claimKind(trade);
    const resolution = resolvePendingClaim({
      tradeNonce: trade.nonce,
      deadline: trade.deadline,
      onChainNonce,
      nowSec,
      graceSec,
      minLiveSec,
    });

    if (resolution === ClaimResolution.CONSUMED) {
      // The claim was mined. OCX was already deducted when the signature was
      // issued, so this is bookkeeping only: pending → confirmed.
      const { error: confirmError } = await supabase
        .from("trades")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
        .eq("id", trade.id)
        .eq("status", "pending");
      if (confirmError) throw new Error(`Failed to confirm claim ${trade.id}: ${confirmError.message}`);
      result.confirmed.push(trade.id);
    } else if (resolution === ClaimResolution.EXPIRED) {
      const refunded = await refundClaim(supabase, trade, log);
      if (refunded && (refunded.ocx > 0 || refunded.resources > 0)) {
        result.refunded.push(trade.id);
        result.refundedOcx += refunded.ocx;
        result.refundedResources += refunded.resources;
      }
    } else if (resolution === ClaimResolution.LIVE) {
      result.live = trade;
    } else if (resolution === ClaimResolution.SETTLING) {
      result.settling = trade;
    } else {
      result.unknown.push(trade.id);
    }
  }

  return result;
}

/**
 * Periodic safety net: settle claims whose deadline (plus grace) has passed,
 * for players who never come back to press "Claim" again. Each trade leaves
 * 'pending' when settled, so the work per run is bounded by new claims.
 *
 * @param {object} deps
 * @param {object} deps.supabase
 * @param {(wallet: string) => Promise<string>} deps.getOnChainNonce
 * @param {number} [deps.nowSec]
 * @param {number} [deps.graceSec]
 * @param {number} [deps.maxWallets]
 * @param {(msg: string) => void} [deps.log]
 * @returns {Promise<{wallets: number, confirmed: number, refunded: number, refundedOcx: number, errors: number}>}
 */
export async function sweepPendingClaims({
  supabase,
  getOnChainNonce,
  nowSec = Math.floor(Date.now() / 1000),
  graceSec = CLAIM_REFUND_GRACE_SEC,
  maxWallets = 25,
  log = console.log,
}) {
  const summary = { wallets: 0, confirmed: 0, refunded: 0, refundedOcx: 0, refundedResources: 0, errors: 0 };
  if (!supabase || typeof getOnChainNonce !== "function") return summary;

  const overdueQuery = (filter) =>
    filter(supabase.from("trades").select("wallet_address"))
      .eq("status", "pending")
      .lt("deadline", nowSec - graceSec)
      .order("created_at", { ascending: true })
      .limit(200);
  const [claims, trades] = await Promise.all([
    overdueQuery((q) => q.eq("resource_type", CLAIM_TRADE_TYPE)),
    overdueQuery((q) => q.like("idempotency_key", `${RESERVED_TRADE_KEY_PREFIX}%`)),
  ]);
  if (claims.error) throw new Error(`Failed to load overdue claims: ${claims.error.message}`);
  if (trades.error) throw new Error(`Failed to load overdue trades: ${trades.error.message}`);
  const overdue = [...(claims.data || []), ...(trades.data || [])];

  const wallets = [...new Set(overdue.map((row) => row.wallet_address).filter(Boolean))].slice(0, maxWallets);

  for (const wallet of wallets) {
    try {
      const onChainNonce = await getOnChainNonce(wallet);
      const settled = await settlePendingClaims({ supabase, wallet, onChainNonce, nowSec, graceSec, log });
      summary.wallets += 1;
      summary.confirmed += settled.confirmed.length;
      summary.refunded += settled.refunded.length;
      summary.refundedOcx += settled.refundedOcx;
      summary.refundedResources += settled.refundedResources;
    } catch (walletError) {
      // One unreachable wallet must not block the rest; it is retried next run.
      summary.errors += 1;
      log?.(`⚠️  Claim sweep skipped ${wallet}: ${walletError.message}`);
    }
  }

  return summary;
}
