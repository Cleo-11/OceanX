/**
 * OCX claim lifecycle tests (server/lib/claimLifecycle.js).
 *
 * Covers the pure decision function and the settlement transitions against an
 * in-memory stand-in for the Supabase query builder. No network, no chain.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  CLAIM_REFUND_MARKER,
  ClaimResolution,
  claimAmountToOcx,
  resolvePendingClaim,
  secondsUntilRefundable,
  settlePendingClaims,
  sweepPendingClaims,
} from '../server/lib/claimLifecycle.js';

// ── minimal in-memory Supabase ──────────────────────────────────────────────
function createFakeSupabase(tables, { failUpdate } = {}) {
  const calls = { updates: [] };

  function builder(table) {
    const state = { op: 'select', filters: [], patch: null, limit: null, single: false, returning: false };
    const rows = () => tables[table];
    const matches = (row) => state.filters.every((f) => f(row));

    const exec = () => {
      if (state.op === 'update') {
        calls.updates.push({ table, patch: state.patch });
        const injected = failUpdate?.(table, state.patch);
        if (injected) return { data: null, error: { message: injected } };
        const hit = rows().filter(matches);
        hit.forEach((row) => Object.assign(row, state.patch));
        return { data: state.returning ? hit.map((r) => ({ ...r })) : null, error: null };
      }
      let hit = rows().filter(matches).map((r) => ({ ...r }));
      if (state.limit !== null) hit = hit.slice(0, state.limit);
      if (state.single) {
        return hit.length === 1
          ? { data: hit[0], error: null }
          : { data: null, error: { message: 'no single row' } };
      }
      return { data: hit, error: null };
    };

    const api = {
      select() {
        if (state.op === 'update') state.returning = true;
        return api;
      },
      update(patch) {
        state.op = 'update';
        state.patch = patch;
        return api;
      },
      eq(col, val) {
        state.filters.push((row) => String(row[col]) === String(val));
        return api;
      },
      ilike(col, val) {
        state.filters.push((row) => String(row[col] ?? '').toLowerCase() === String(val).toLowerCase());
        return api;
      },
      like(col, pattern) {
        const re = new RegExp('^' + String(pattern).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*') + '$');
        state.filters.push((row) => re.test(String(row[col] ?? '')));
        return api;
      },
      is(col, val) {
        state.filters.push((row) => (val === null ? row[col] === null || row[col] === undefined : row[col] === val));
        return api;
      },
      lt(col, val) {
        state.filters.push((row) => Number(row[col]) < Number(val));
        return api;
      },
      order() {
        return api;
      },
      limit(n) {
        state.limit = n;
        return api;
      },
      single() {
        state.single = true;
        return Promise.resolve(exec());
      },
      then(resolve, reject) {
        return Promise.resolve(exec()).then(resolve, reject);
      },
    };
    return api;
  }

  return { from: (table) => builder(table), calls };
}

const WALLET = '0xAbC0000000000000000000000000000000000001';
const NOW = 1_800_000_000;
const OCX = (n) => (BigInt(n) * 10n ** 18n).toString();
const silent = () => {};

const claimTrade = (overrides = {}) => ({
  id: 't1',
  player_id: 'p1',
  wallet_address: WALLET.toLowerCase(),
  resource_type: 'ocx_claim',
  status: 'pending',
  nonce: '5',
  deadline: NOW + 300,
  ocx_amount: OCX(100),
  error_message: null,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('resolvePendingClaim', () => {
  const base = { tradeNonce: '5', deadline: NOW + 300, nowSec: NOW, graceSec: 180, minLiveSec: 30 };

  it('is LIVE while the signature can still be used', () => {
    expect(resolvePendingClaim({ ...base, onChainNonce: '5' })).toBe(ClaimResolution.LIVE);
  });

  it('is CONSUMED once the on-chain nonce has moved past it, whatever the time', () => {
    expect(resolvePendingClaim({ ...base, onChainNonce: '6' })).toBe(ClaimResolution.CONSUMED);
    expect(resolvePendingClaim({ ...base, onChainNonce: '9', nowSec: NOW + 99999 })).toBe(ClaimResolution.CONSUMED);
  });

  it('is SETTLING when too close to the deadline to hand out again', () => {
    expect(resolvePendingClaim({ ...base, onChainNonce: '5', nowSec: NOW + 280 })).toBe(ClaimResolution.SETTLING);
  });

  it('is SETTLING through the grace period after the deadline (no early refund)', () => {
    expect(resolvePendingClaim({ ...base, onChainNonce: '5', nowSec: NOW + 301 })).toBe(ClaimResolution.SETTLING);
    expect(resolvePendingClaim({ ...base, onChainNonce: '5', nowSec: NOW + 480 })).toBe(ClaimResolution.SETTLING);
  });

  it('is EXPIRED only after deadline + grace with the nonce unused', () => {
    expect(resolvePendingClaim({ ...base, onChainNonce: '5', nowSec: NOW + 481 })).toBe(ClaimResolution.EXPIRED);
  });

  it('never refunds on incomplete facts', () => {
    expect(resolvePendingClaim({ ...base, tradeNonce: null, onChainNonce: '5', nowSec: NOW + 9999 })).toBe(ClaimResolution.UNKNOWN);
    expect(resolvePendingClaim({ ...base, deadline: null, onChainNonce: '5', nowSec: NOW + 9999 })).toBe(ClaimResolution.UNKNOWN);
    expect(resolvePendingClaim({ ...base, onChainNonce: 'garbage', nowSec: NOW + 9999 })).toBe(ClaimResolution.UNKNOWN);
    expect(resolvePendingClaim({ ...base, onChainNonce: undefined, nowSec: NOW + 9999 })).toBe(ClaimResolution.UNKNOWN);
  });

  it('handles nonce 0 (first ever claim)', () => {
    expect(resolvePendingClaim({ ...base, tradeNonce: '0', onChainNonce: '0' })).toBe(ClaimResolution.LIVE);
    expect(resolvePendingClaim({ ...base, tradeNonce: 0, onChainNonce: 1n })).toBe(ClaimResolution.CONSUMED);
  });
});

describe('helpers', () => {
  it('converts wei strings to OCX', () => {
    expect(claimAmountToOcx(OCX(100))).toBe(100);
    expect(claimAmountToOcx('1500000000000000000')).toBe(1.5);
    expect(claimAmountToOcx(null)).toBe(0);
    expect(claimAmountToOcx('not-a-number')).toBe(0);
    expect(claimAmountToOcx('-5')).toBe(0);
  });

  it('reports the wait until a claim becomes refundable', () => {
    expect(secondsUntilRefundable(NOW + 300, NOW + 301, 180)).toBe(180);
    expect(secondsUntilRefundable(NOW, NOW + 9999, 180)).toBe(0);
  });
});

describe('settlePendingClaims', () => {
  let tables;
  beforeEach(() => {
    tables = {
      trades: [claimTrade()],
      players: [{ id: 'p1', total_ocx_earned: 0 }],
    };
  });

  const settle = (supabase, extra) =>
    settlePendingClaims({ supabase, wallet: WALLET, nowSec: NOW, graceSec: 180, minLiveSec: 30, log: silent, ...extra });

  it('leaves a live claim untouched and returns it so the client can resume', async () => {
    const supabase = createFakeSupabase(tables);
    const result = await settle(supabase, { onChainNonce: '5' });
    expect(result.live?.id).toBe('t1');
    expect(result.refunded).toEqual([]);
    expect(tables.trades[0].status).toBe('pending');
    expect(tables.players[0].total_ocx_earned).toBe(0);
    expect(supabase.calls.updates).toHaveLength(0);
  });

  it('confirms a claim that was mined, without touching the balance', async () => {
    const supabase = createFakeSupabase(tables);
    const result = await settle(supabase, { onChainNonce: '6', nowSec: NOW + 9999 });
    expect(result.confirmed).toEqual(['t1']);
    expect(tables.trades[0].status).toBe('confirmed');
    expect(tables.players[0].total_ocx_earned).toBe(0);
  });

  it('refunds a claim that expired unused (the rejected-wallet-prompt case)', async () => {
    const supabase = createFakeSupabase(tables);
    const result = await settle(supabase, { onChainNonce: '5', nowSec: NOW + 481 });
    expect(result.refunded).toEqual(['t1']);
    expect(result.refundedOcx).toBe(100);
    expect(tables.trades[0].status).toBe('failed');
    expect(tables.trades[0].error_message).toBe(CLAIM_REFUND_MARKER);
    expect(tables.players[0].total_ocx_earned).toBe(100);
  });

  it('adds the refund to whatever the player has earned since', async () => {
    tables.players[0].total_ocx_earned = 42;
    await settle(createFakeSupabase(tables), { onChainNonce: '5', nowSec: NOW + 481 });
    expect(tables.players[0].total_ocx_earned).toBe(142);
  });

  it('refunds exactly once when settlement runs repeatedly', async () => {
    const supabase = createFakeSupabase(tables);
    await settle(supabase, { onChainNonce: '5', nowSec: NOW + 481 });
    const again = await settle(supabase, { onChainNonce: '5', nowSec: NOW + 999 });
    expect(again.refunded).toEqual([]);
    expect(tables.players[0].total_ocx_earned).toBe(100);
  });

  it('refunds exactly once when two settlements race', async () => {
    const supabase = createFakeSupabase(tables);
    await Promise.all([
      settle(supabase, { onChainNonce: '5', nowSec: NOW + 481 }),
      settle(supabase, { onChainNonce: '5', nowSec: NOW + 481 }),
    ]);
    expect(tables.players[0].total_ocx_earned).toBe(100);
  });

  it('does not refund during the grace period', async () => {
    const result = await settle(createFakeSupabase(tables), { onChainNonce: '5', nowSec: NOW + 400 });
    expect(result.settling?.id).toBe('t1');
    expect(tables.trades[0].status).toBe('pending');
    expect(tables.players[0].total_ocx_earned).toBe(0);
  });

  it('rolls the claim back to pending if the balance credit fails', async () => {
    const supabase = createFakeSupabase(tables, {
      failUpdate: (table) => (table === 'players' ? 'db down' : null),
    });
    await expect(settle(supabase, { onChainNonce: '5', nowSec: NOW + 481 })).rejects.toThrow(/rolled back/);
    expect(tables.trades[0].status).toBe('pending');
    expect(tables.trades[0].error_message).toBeNull();
    expect(tables.players[0].total_ocx_earned).toBe(0);
  });

  it('refunds resources (not OCX) for an expired reserved marketplace trade', async () => {
    tables.players[0].nickel = 3;
    tables.trades = [
      claimTrade({ id: 'sale', resource_type: 'nickel', resource_amount: 20, idempotency_key: 'reserve:abc', ocx_amount: '2000000000000000000' }),
    ];
    const result = await settle(createFakeSupabase(tables), { onChainNonce: '5', nowSec: NOW + 9999 });
    expect(result.refunded).toEqual(['sale']);
    expect(result.refundedResources).toBe(20);
    expect(result.refundedOcx).toBe(0);
    expect(tables.players[0].nickel).toBe(23);
    expect(tables.players[0].total_ocx_earned).toBe(0);
    expect(tables.trades[0]).toMatchObject({ status: 'failed', error_message: CLAIM_REFUND_MARKER });
  });

  it('confirms a mined reserved marketplace trade without returning the resources', async () => {
    tables.players[0].nickel = 3;
    tables.trades = [claimTrade({ id: 'sale', resource_type: 'nickel', resource_amount: 20, idempotency_key: 'reserve:abc' })];
    const result = await settle(createFakeSupabase(tables), { onChainNonce: '6', nowSec: NOW + 9999 });
    expect(result.confirmed).toEqual(['sale']);
    expect(tables.players[0].nickel).toBe(3);
  });

  it('reports an open marketplace trade as live with its kind', async () => {
    tables.trades = [claimTrade({ id: 'sale', resource_type: 'copper', resource_amount: 2, idempotency_key: 'reserve:x' })];
    const result = await settle(createFakeSupabase(tables), { onChainNonce: '5' });
    expect(result.live).toMatchObject({ id: 'sale', kind: 'resource_trade' });
  });

  it('ignores resource trades, other wallets and already-settled claims', async () => {
    tables.trades = [
      // a trade from before reservations existed (no 'reserve:' key): never refunded
      claimTrade({ id: 'resource', resource_type: 'nickel', resource_amount: 5, idempotency_key: 'claim-old' }),
      claimTrade({ id: 'other', wallet_address: '0xother' }),
      claimTrade({ id: 'done', status: 'confirmed' }),
    ];
    const result = await settle(createFakeSupabase(tables), { onChainNonce: '5', nowSec: NOW + 9999 });
    expect(result).toMatchObject({ confirmed: [], refunded: [], refundedOcx: 0, live: null, settling: null });
    expect(tables.players[0].total_ocx_earned).toBe(0);
  });

  it('leaves claims with missing nonce/deadline alone', async () => {
    tables.trades = [claimTrade({ nonce: null })];
    const result = await settle(createFakeSupabase(tables), { onChainNonce: '5', nowSec: NOW + 9999 });
    expect(result.unknown).toEqual(['t1']);
    expect(tables.trades[0].status).toBe('pending');
  });

  it('settles a mixed backlog in one pass', async () => {
    tables.trades = [
      claimTrade({ id: 'mined', nonce: '3', deadline: NOW - 5000, ocx_amount: OCX(10) }),
      claimTrade({ id: 'expired', nonce: '5', deadline: NOW - 5000, ocx_amount: OCX(25) }),
    ];
    const result = await settle(createFakeSupabase(tables), { onChainNonce: '5' });
    expect(result.confirmed).toEqual(['mined']);
    expect(result.refunded).toEqual(['expired']);
    expect(tables.players[0].total_ocx_earned).toBe(25);
  });
});

describe('sweepPendingClaims', () => {
  it('settles overdue claims per wallet and survives a failing wallet', async () => {
    const tables = {
      trades: [
        claimTrade({ id: 'a', wallet_address: '0xa', player_id: 'pa', deadline: NOW - 1000 }),
        claimTrade({ id: 'b', wallet_address: '0xb', player_id: 'pb', deadline: NOW - 1000, nonce: '2' }),
        claimTrade({ id: 'c', wallet_address: '0xc', player_id: 'pc', deadline: NOW - 1000 }),
        claimTrade({ id: 'fresh', wallet_address: '0xd', player_id: 'pd', deadline: NOW + 300 }),
      ],
      players: [
        { id: 'pa', total_ocx_earned: 0 },
        { id: 'pb', total_ocx_earned: 7 },
        { id: 'pc', total_ocx_earned: 0 },
        { id: 'pd', total_ocx_earned: 0 },
      ],
    };
    const nonces = { '0xa': '5', '0xb': '3' };
    const getOnChainNonce = async (wallet) => {
      if (!(wallet in nonces)) throw new Error('rpc unavailable');
      return nonces[wallet];
    };

    const summary = await sweepPendingClaims({
      supabase: createFakeSupabase(tables),
      getOnChainNonce,
      nowSec: NOW,
      graceSec: 180,
      log: silent,
    });

    expect(summary).toEqual({ wallets: 2, confirmed: 1, refunded: 1, refundedOcx: 100, refundedResources: 0, errors: 1 });
    const byId = Object.fromEntries(tables.trades.map((t) => [t.id, t.status]));
    expect(byId).toEqual({ a: 'failed', b: 'confirmed', c: 'pending', fresh: 'pending' });
    expect(tables.players.map((p) => p.total_ocx_earned)).toEqual([100, 7, 0, 0]);
  });

  it('does nothing without its dependencies', async () => {
    expect(await sweepPendingClaims({ supabase: null, getOnChainNonce: async () => '0' })).toMatchObject({ wallets: 0 });
  });
});
