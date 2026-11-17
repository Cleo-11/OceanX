/**
 * Server-authoritative mining for the in-memory game sessions.
 *
 * The client used to add mined resources to its own state and POST the
 * totals to /api/player/save-resources, which wrote whatever numbers it was
 * given. Now the server decides:
 *
 *   mine-resource {nodeId}
 *     → node exists in the player's session and is not depleted
 *     → the player's server-tracked position is within range of it
 *     → per-player cooldown and one mine per node at a time
 *     → amount = min(node remaining, free hold space for that resource)
 *       (the same rule the client always used — gameplay is unchanged)
 *     → players row updated with a compare-and-swap (playerLedger)
 *     → node amount reduced only after the write succeeds
 *
 * The client renders the returned totals; it never sends resource numbers.
 *
 * Deposits are per player (PlayerWorlds), generated with the same rules the
 * client used to generate them locally (30 deposits, 5–15 units, any type),
 * so the game plays the same. Unlike the old client-side world they survive
 * a page reload — reloading used to hand out 30 fresh deposits every time —
 * and a depleted deposit is replaced after RESPAWN_MS instead.
 */

import { updatePlayerBalances, LedgerError, isResourceType } from "./playerLedger.js";

/** Client highlights a node within 60 units; allow for position-update lag. */
export const MINING_RANGE = 100;
/** The client cannot start a new action for 2s after a mine; keep a margin. */
export const MINING_COOLDOWN_MS = 1500;

export const NODES_PER_PLAYER = 30;
export const RESPAWN_MS = 3 * 60 * 1000;
export const WORLD_IDLE_TTL_MS = 6 * 60 * 60 * 1000;
const NODE_TYPES = ["nickel", "cobalt", "copper", "manganese"];

let nodeSeq = 0;
/** One deposit, generated exactly as the client used to (100–1900, 5–15 units). */
export function createNode(random = Math.random) {
  nodeSeq = (nodeSeq + 1) % 1e9;
  return {
    id: `node-${Date.now().toString(36)}-${nodeSeq}-${Math.floor(random() * 1e6).toString(36)}`,
    position: { x: random() * 1800 + 100, y: random() * 1800 + 100, z: 0 },
    type: NODE_TYPES[Math.floor(random() * NODE_TYPES.length)],
    amount: Math.floor(random() * 11) + 5,
    depleted: false,
    size: random() * 10 + 15,
  };
}

/** In-memory deposits per wallet, kept across reconnects and reloads. */
export class PlayerWorlds {
  constructor({ nodesPerPlayer = NODES_PER_PLAYER, respawnMs = RESPAWN_MS, idleTtlMs = WORLD_IDLE_TTL_MS, random = Math.random } = {}) {
    this.nodesPerPlayer = nodesPerPlayer;
    this.respawnMs = respawnMs;
    this.idleTtlMs = idleTtlMs;
    this.random = random;
    this.worlds = new Map();
  }

  /** The wallet's deposits (created on first use), with due respawns applied. */
  get(wallet, now = Date.now()) {
    let world = this.worlds.get(wallet);
    if (!world) {
      const nodes = new Map();
      for (let i = 0; i < this.nodesPerPlayer; i++) {
        const node = createNode(this.random);
        nodes.set(node.id, node);
      }
      world = { nodes, touchedAt: now };
      this.worlds.set(wallet, world);
    }
    world.touchedAt = now;
    this.respawn(world, now);
    return world;
  }

  /** Replace deposits whose respawn time has come. Returns true if any changed. */
  respawn(world, now = Date.now()) {
    let changed = false;
    for (const [id, node] of world.nodes) {
      if (node.depleted && node.respawnAt && node.respawnAt <= now && !node.miningBy) {
        world.nodes.delete(id);
        const fresh = createNode(this.random);
        world.nodes.set(fresh.id, fresh);
        changed = true;
      }
    }
    return changed;
  }

  /** Apply due respawns for a wallet; true if its deposits changed. */
  refresh(wallet, now = Date.now()) {
    const world = this.worlds.get(wallet);
    return world ? this.respawn(world, now) : false;
  }

  prune(now = Date.now()) {
    for (const [wallet, world] of this.worlds) {
      if (now - world.touchedAt > this.idleTtlMs) this.worlds.delete(wallet);
    }
  }
}

export const distance2D = (a, b) => Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0));

const MESSAGES = {
  node_not_found: "That deposit is gone. Find another one nearby.",
  node_depleted: "That deposit is depleted.",
  node_busy: "Someone else is mining that deposit. Try again in a moment.",
  position_unknown: "Syncing your position with the server. Try again in a second.",
  out_of_range: "Move closer to the deposit to mine it.",
  cooldown: "Your drill is cooling down.",
  storage_full: "Your hold is full for this resource. Trade resources to make space.",
  player_not_found: "Your player profile could not be found. Please reconnect.",
  invalid_node: "That deposit cannot be mined.",
  db_error: "Mining could not be saved. Please try again.",
  conflict: "Your balance changed while mining. Please try again.",
};

const fail = (reason, extra = {}) => ({ success: false, reason, message: MESSAGES[reason] || "Mining failed", ...extra });

/**
 * @param {object} deps
 * @param {object} deps.supabase
 * @param {Map<string, object>} deps.nodes  the player's deposits (PlayerWorlds#get().nodes)
 * @param {object} deps.player             session player ({ position, positionKnown, lastMineAt })
 * @param {string} deps.nodeId
 * @param {(tier: number) => {nickel:number,cobalt:number,copper:number,manganese:number}|null} deps.getMaxCapacity
 * @param {number} [deps.now]
 */
export async function mineNode({ supabase, nodes, player, nodeId, getMaxCapacity, now = Date.now(), respawnMs = RESPAWN_MS }) {
  const node = nodes?.get(nodeId);
  if (!node) return fail("node_not_found");
  if (!isResourceType(node.type)) return fail("invalid_node");
  if (node.depleted || !(node.amount > 0)) return fail("node_depleted", { nodeId, remainingAmount: 0, depleted: true });
  if (!player.positionKnown) return fail("position_unknown");
  if (distance2D(player.position, node.position) > MINING_RANGE) return fail("out_of_range");
  if (player.lastMineAt && now - player.lastMineAt < MINING_COOLDOWN_MS) {
    return fail("cooldown", { retryAfterMs: MINING_COOLDOWN_MS - (now - player.lastMineAt) });
  }
  if (player.mining) return fail("cooldown", { retryAfterMs: 250 });
  if (node.miningBy && node.miningBy !== player.id) return fail("node_busy");

  // Synchronous locks: the DB write below awaits, and nothing else may mine
  // this node or start another mine for this player until it settles.
  player.mining = true;
  node.miningBy = player.id;
  player.lastMineAt = now;

  try {
    const { before, after, changed } = await updatePlayerBalances(supabase, {
      wallet: player.id,
      selectExtra: ["submarine_tier"],
      compute: (row) => {
        const cap = getMaxCapacity(Number(row.submarine_tier) || 1);
        const capacity = Number(cap?.[node.type]) || 0;
        const free = capacity - (Number(row[node.type]) || 0);
        if (free <= 0) throw new LedgerError("STORAGE_FULL", "Hold full");
        const amount = Math.floor(Math.min(node.amount, free));
        if (amount <= 0) throw new LedgerError("STORAGE_FULL", "Hold full");
        return {
          resources: { [node.type]: amount },
          totalResourcesMined: amount,
          extra: { last_login: new Date(now).toISOString(), is_active: true },
        };
      },
    });

    const amount = changed ? (Number(after[node.type]) || 0) - (Number(before[node.type]) || 0) : 0;
    if (amount <= 0) return fail("storage_full");

    node.amount = Math.max(0, node.amount - amount);
    node.depleted = node.amount <= 0;
    if (node.depleted) node.respawnAt = now + respawnMs;

    return {
      success: true,
      reason: "success",
      nodeId,
      resourceType: node.type,
      amount,
      remainingAmount: node.amount,
      depleted: node.depleted,
      resources: {
        nickel: Number(after.nickel) || 0,
        cobalt: Number(after.cobalt) || 0,
        copper: Number(after.copper) || 0,
        manganese: Number(after.manganese) || 0,
      },
      message: `Mined ${amount} ${node.type}`,
    };
  } catch (error) {
    // A mine that did not happen must not start the cooldown.
    player.lastMineAt = 0;
    if (error instanceof LedgerError) {
      if (error.code === "STORAGE_FULL") return fail("storage_full");
      if (error.code === "PLAYER_NOT_FOUND") return fail("player_not_found");
      if (error.code === "CONFLICT") return fail("conflict");
      return fail("db_error");
    }
    throw error;
  } finally {
    player.mining = false;
    if (node.miningBy === player.id) node.miningBy = null;
  }
}
