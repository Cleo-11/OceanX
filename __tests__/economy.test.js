/**
 * Server-authoritative economy: atomic balance updates (playerLedger) and
 * server-decided mining (authoritativeMining). In-memory Supabase stand-in.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { updatePlayerBalances, LedgerError } from '../server/lib/playerLedger.js';
import {
  mineNode,
  PlayerWorlds,
  createNode,
  MINING_RANGE,
  MINING_COOLDOWN_MS,
} from '../server/lib/authoritativeMining.js';

function createFakeSupabase(tables, { beforeWrite } = {}) {
  const calls = { writes: 0 };
  function builder(table) {
    const state = { op: 'select', filters: [], patch: null, single: false, returning: false };
    const matches = (row) => state.filters.every((f) => f(row));
    const exec = async () => {
      if (state.op === 'update') {
        calls.writes += 1;
        await beforeWrite?.(tables);
        const hit = tables[table].filter(matches);
        hit.forEach((row) => Object.assign(row, state.patch));
        return { data: state.returning ? hit.map((r) => ({ id: r.id })) : null, error: null };
      }
      const hit = tables[table].filter(matches).map((r) => ({ ...r }));
      if (state.single) return hit.length === 1 ? { data: hit[0], error: null } : { data: null, error: { message: 'not found' } };
      return { data: hit, error: null };
    };
    const api = {
      select() { if (state.op === 'update') state.returning = true; return api; },
      update(patch) { state.op = 'update'; state.patch = patch; return api; },
      eq(col, val) { state.filters.push((r) => String(r[col]) === String(val)); return api; },
      ilike(col, val) { state.filters.push((r) => String(r[col] ?? '').toLowerCase() === String(val).toLowerCase()); return api; },
      is(col, val) { state.filters.push((r) => (val === null ? r[col] == null : r[col] === val)); return api; },
      single() { state.single = true; return exec(); },
      then(resolve, reject) { return exec().then(resolve, reject); },
    };
    return api;
  }
  return { from: builder, calls };
}

const WALLET = '0xabc0000000000000000000000000000000000001';
const player = (overrides = {}) => ({
  id: 'p1', wallet_address: WALLET, submarine_tier: 1, total_ocx_earned: 0, total_resources_mined: 0,
  nickel: 0, cobalt: 0, copper: 0, manganese: 0, ...overrides,
});
const TIER1 = { nickel: 100, cobalt: 50, copper: 50, manganese: 25 };

describe('updatePlayerBalances (compare-and-swap)', () => {
  it('applies deltas and returns before/after', async () => {
    const tables = { players: [player({ nickel: 5, total_ocx_earned: 1.5 })] };
    const { before, after } = await updatePlayerBalances(createFakeSupabase(tables), {
      playerId: 'p1',
      compute: () => ({ resources: { nickel: 3 }, ocx: 2 }),
    });
    expect(before.nickel).toBe(5);
    expect(after.nickel).toBe(8);
    expect(tables.players[0]).toMatchObject({ nickel: 8, total_ocx_earned: 3.5 });
  });

  it('never loses a concurrent write: recomputes from the fresh row', async () => {
    const tables = { players: [player({ nickel: 10 })] };
    let interfered = false;
    const supabase = createFakeSupabase(tables, {
      beforeWrite: (t) => {
        if (!interfered) { interfered = true; t.players[0].nickel += 7; } // another writer lands first
      },
    });
    await updatePlayerBalances(supabase, { playerId: 'p1', compute: () => ({ resources: { nickel: 1 } }) });
    expect(tables.players[0].nickel).toBe(18); // 10 + 7 (other writer) + 1 (ours)
    expect(supabase.calls.writes).toBe(2);
  });

  it('refuses to go negative', async () => {
    const tables = { players: [player({ cobalt: 2 })] };
    await expect(
      updatePlayerBalances(createFakeSupabase(tables), { playerId: 'p1', compute: () => ({ resources: { cobalt: -3 } }) }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_RESOURCES', details: { available: 2, requested: 3 } });
    expect(tables.players[0].cobalt).toBe(2);
  });

  it('looks players up by wallet, case-insensitively', async () => {
    const tables = { players: [player()] };
    await updatePlayerBalances(createFakeSupabase(tables), { wallet: WALLET.toUpperCase().replace('0X', '0x'), compute: () => ({ resources: { copper: 4 } }) });
    expect(tables.players[0].copper).toBe(4);
  });

  it('gives up with CONFLICT after repeated interference', async () => {
    const tables = { players: [player()] };
    const supabase = createFakeSupabase(tables, { beforeWrite: (t) => { t.players[0].nickel += 1; } });
    await expect(
      updatePlayerBalances(supabase, { playerId: 'p1', retries: 2, compute: () => ({ resources: { nickel: 1 } }) }),
    ).rejects.toBeInstanceOf(LedgerError);
  });
});

describe('mineNode (server-authoritative mining)', () => {
  let tables, nodes, node, me;
  beforeEach(() => {
    tables = { players: [player()] };
    node = { id: 'n1', type: 'copper', amount: 12, depleted: false, position: { x: 500, y: 500 } };
    nodes = new Map([[node.id, node]]);
    me = { id: WALLET, position: { x: 520, y: 500 }, positionKnown: true, lastMineAt: 0 };
  });
  const mine = (extra = {}) =>
    mineNode({ supabase: createFakeSupabase(tables), nodes, player: me, nodeId: 'n1', getMaxCapacity: () => TIER1, now: 1_000_000, ...extra });

  it('yields min(deposit, free hold space) and writes it', async () => {
    const r = await mine();
    expect(r).toMatchObject({ success: true, resourceType: 'copper', amount: 12, remainingAmount: 0, depleted: true });
    expect(tables.players[0]).toMatchObject({ copper: 12, total_resources_mined: 12 });
    expect(r.resources.copper).toBe(12);
  });

  it('caps at the tier capacity', async () => {
    tables.players[0].copper = 45;
    const r = await mine();
    expect(r.amount).toBe(5);
    expect(node.amount).toBe(7);
    expect(tables.players[0].copper).toBe(50);
  });

  it('refuses a full hold without writing or starting the cooldown', async () => {
    tables.players[0].copper = 50;
    const r = await mine();
    expect(r).toMatchObject({ success: false, reason: 'storage_full' });
    expect(node.amount).toBe(12);
    expect(me.lastMineAt).toBe(0);
  });

  it('checks range against the server-known position', async () => {
    me.position = { x: 500 + MINING_RANGE + 1, y: 500 };
    expect(await mine()).toMatchObject({ success: false, reason: 'out_of_range' });
    me.positionKnown = false;
    expect(await mine()).toMatchObject({ success: false, reason: 'position_unknown' });
  });

  it('enforces the cooldown', async () => {
    node.amount = 100;
    const big = () => ({ nickel: 1000, cobalt: 1000, copper: 1000, manganese: 1000 });
    node.amount = 1000;
    await mine({ getMaxCapacity: () => ({ ...big(), copper: 10 }) });
    tables.players[0].copper = 0;
    const again = await mine({ now: 1_000_000 + MINING_COOLDOWN_MS - 1 });
    expect(again).toMatchObject({ success: false, reason: 'cooldown' });
    const later = await mine({ now: 1_000_000 + MINING_COOLDOWN_MS });
    expect(later.success).toBe(true);
  });

  it('rejects unknown and depleted deposits', async () => {
    expect(await mine({ nodeId: 'nope' })).toMatchObject({ reason: 'node_not_found' });
    node.depleted = true;
    expect(await mine()).toMatchObject({ reason: 'node_depleted' });
  });

  it('schedules a respawn when a deposit runs out', async () => {
    await mine({ respawnMs: 1000 });
    expect(node.respawnAt).toBe(1_001_000);
  });
});

describe('PlayerWorlds', () => {
  it('creates 30 client-style deposits once per wallet and keeps them', () => {
    const worlds = new PlayerWorlds();
    const a = worlds.get(WALLET, 0);
    expect(a.nodes.size).toBe(30);
    for (const n of a.nodes.values()) {
      expect(n.amount).toBeGreaterThanOrEqual(5);
      expect(n.amount).toBeLessThanOrEqual(15);
      expect(n.position.x).toBeGreaterThanOrEqual(100);
      expect(n.position.x).toBeLessThanOrEqual(1900);
    }
    expect(worlds.get(WALLET, 1)).toBe(a); // reconnect / reload: same deposits
  });

  it('replaces a depleted deposit only after its respawn time', () => {
    const worlds = new PlayerWorlds({ nodesPerPlayer: 1 });
    const world = worlds.get(WALLET, 0);
    const [first] = world.nodes.values();
    first.depleted = true;
    first.respawnAt = 100;
    expect(worlds.refresh(WALLET, 99)).toBe(false);
    expect(worlds.refresh(WALLET, 100)).toBe(true);
    const [next] = world.nodes.values();
    expect(next.id).not.toBe(first.id);
    expect(next.depleted).toBe(false);
  });

  it('forgets idle worlds', () => {
    const worlds = new PlayerWorlds({ idleTtlMs: 10 });
    worlds.get(WALLET, 0);
    worlds.prune(11);
    expect(worlds.worlds.size).toBe(0);
  });

  it('createNode matches the old client generator ranges', () => {
    const n = createNode(() => 0.999);
    expect(n.amount).toBe(15);
    expect(['nickel', 'cobalt', 'copper', 'manganese']).toContain(n.type);
  });
});
