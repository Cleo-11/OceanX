/**
 * Player ledger — atomic balance changes without a database migration.
 *
 * Every balance change used to be read → compute → write the absolute value.
 * Two writers interleaving (mining while trading, two tabs, a refund landing
 * mid-claim) silently lost one of the changes. Here each write is a
 * compare-and-swap: the UPDATE only matches if every column it changes still
 * holds the value we read. If another writer got there first, zero rows match
 * and we re-read and recompute (bounded retries).
 *
 *   const { before, after } = await updatePlayerBalances(supabase, {
 *     playerId,
 *     compute: (row) => ({ resources: { nickel: +5 } }),
 *   });
 *
 * `compute` receives the freshly read row on every attempt, so derived amounts
 * (capacity limits, "trade everything") are always based on current values.
 * Throw a LedgerError from `compute` to abort without writing.
 */

export const RESOURCE_TYPES = Object.freeze(["nickel", "cobalt", "copper", "manganese"]);

export class LedgerError extends Error {
  /** @param {string} code  e.g. INSUFFICIENT_RESOURCES, STORAGE_FULL, CONFLICT */
  constructor(code, message, details) {
    super(message);
    this.name = "LedgerError";
    this.code = code;
    this.details = details;
  }
}

export const isResourceType = (value) => RESOURCE_TYPES.includes(value);

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const BASE_COLUMNS = ["id", "wallet_address", "nickel", "cobalt", "copper", "manganese", "total_ocx_earned"];

/**
 * @param {object} supabase  service-role client
 * @param {object} opts
 * @param {string} [opts.playerId]
 * @param {string} [opts.wallet]           used when playerId is unknown (case-insensitive)
 * @param {(row: object) => {resources?: Record<string, number>, ocx?: number,
 *          totalResourcesMined?: number, extra?: object} | null} opts.compute
 *        Return deltas. Return null to write nothing.
 * @param {string[]} [opts.selectExtra]    extra columns to read (e.g. submarine_tier)
 * @param {number} [opts.retries]
 * @returns {Promise<{before: object, after: object, changed: boolean, deltas: object}>}
 */
export async function updatePlayerBalances(supabase, { playerId, wallet, compute, selectExtra = [], retries = 6 }) {
  if (!supabase) throw new LedgerError("DB_UNAVAILABLE", "Database not available");
  if (!playerId && !wallet) throw new LedgerError("PLAYER_NOT_FOUND", "Player not specified");

  const columns = [...new Set([...BASE_COLUMNS, "total_resources_mined", ...selectExtra])].join(", ");

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let query = supabase.from("players").select(columns);
    query = playerId ? query.eq("id", playerId) : query.ilike("wallet_address", wallet);
    const { data: row, error: readError } = await query.single();
    if (readError || !row) {
      throw new LedgerError("PLAYER_NOT_FOUND", readError?.message || "Player not found");
    }
    playerId = row.id;

    const deltas = compute(row);
    if (!deltas) return { before: row, after: row, changed: false, deltas: null };

    const update = {};
    const guards = [];

    for (const [type, delta] of Object.entries(deltas.resources || {})) {
      if (!isResourceType(type)) throw new LedgerError("INVALID_RESOURCE", `Unknown resource ${type}`);
      if (!Number.isInteger(delta)) throw new LedgerError("INVALID_AMOUNT", `Resource delta must be an integer`);
      if (delta === 0) continue;
      const current = num(row[type]);
      const next = current + delta;
      if (next < 0) {
        throw new LedgerError("INSUFFICIENT_RESOURCES", `Not enough ${type}: have ${current}, need ${-delta}`, {
          type,
          available: current,
          requested: -delta,
        });
      }
      update[type] = next;
      guards.push([type, row[type]]);
    }

    if (deltas.ocx) {
      const current = num(row.total_ocx_earned);
      // Round to 1e-9 to keep float noise out of the balance column.
      const next = Math.round((current + deltas.ocx) * 1e9) / 1e9;
      if (next < 0) {
        throw new LedgerError("INSUFFICIENT_OCX", `Not enough OCX: have ${current}, need ${-deltas.ocx}`, {
          available: current,
          requested: -deltas.ocx,
        });
      }
      update.total_ocx_earned = next;
      guards.push(["total_ocx_earned", row.total_ocx_earned]);
    }

    if (deltas.totalResourcesMined) {
      update.total_resources_mined = num(row.total_resources_mined) + deltas.totalResourcesMined;
      guards.push(["total_resources_mined", row.total_resources_mined]);
    }

    if (Object.keys(update).length === 0) return { before: row, after: row, changed: false, deltas };

    Object.assign(update, deltas.extra || {}, { updated_at: new Date().toISOString() });

    let write = supabase.from("players").update(update).eq("id", row.id);
    for (const [column, value] of guards) {
      write = value === null || value === undefined ? write.is(column, null) : write.eq(column, value);
    }
    const { data: written, error: writeError } = await write.select("id");
    if (writeError) throw new LedgerError("DB_ERROR", writeError.message);
    if (written && written.length === 1) {
      return { before: row, after: { ...row, ...update }, changed: true, deltas };
    }
    // Another writer changed the row between our read and write: recompute.
  }

  throw new LedgerError("CONFLICT", "The balance changed too many times at once. Please try again.");
}
