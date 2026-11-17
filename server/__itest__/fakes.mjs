// In-memory stand-ins for Supabase (PostgREST) and an Ethereum JSON-RPC node,
// used only to exercise the real Express handlers end-to-end. Not shipped.
import http from "http";
import { randomUUID } from "crypto";

export const db = { players: [], trades: [], claim_signatures: [] };
export const chain = { nonces: {}, receipts: {}, block: 1000 };

const readBody = (req) =>
  new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => resolve(raw ? JSON.parse(raw) : null));
  });

const RESERVED = new Set(["select", "order", "limit", "offset", "columns", "on_conflict"]);

function buildFilter(params) {
  const tests = [];
  for (const [col, expr] of params) {
    if (RESERVED.has(col)) continue;
    const dot = expr.indexOf(".");
    const op = expr.slice(0, dot);
    const val = expr.slice(dot + 1);
    const cmp = (row) => row[col];
    if (op === "eq") tests.push((r) => String(cmp(r)) === val);
    else if (op === "neq") tests.push((r) => String(cmp(r)) !== val);
    else if (op === "ilike") tests.push((r) => String(cmp(r) ?? "").toLowerCase() === val.toLowerCase());
    else if (op === "lt") tests.push((r) => Number(cmp(r)) < Number(val));
    else if (op === "lte") tests.push((r) => Number(cmp(r)) <= Number(val));
    else if (op === "gt") tests.push((r) => Number(cmp(r)) > Number(val));
    else if (op === "gte") tests.push((r) => Number(cmp(r)) >= Number(val));
    else if (op === "like") {
      const re = new RegExp("^" + val.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/[%*]/g, ".*") + "$");
      tests.push((r) => re.test(String(cmp(r) ?? "")));
    } else if (op === "is") tests.push((r) => (val === "null" ? cmp(r) === null || cmp(r) === undefined : String(cmp(r)) === val));
    else throw new Error(`fake postgrest: unsupported operator ${op} on ${col}`);
  }
  return (row) => tests.every((t) => t(row));
}

export function startFakeSupabase(port) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    const send = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(body === undefined ? "" : JSON.stringify(body));
    };
    try {
      const parts = url.pathname.split("/").filter(Boolean); // rest v1 <table> | rest v1 rpc <fn>
      if (parts[2] === "rpc") return send(200, 0);
      const table = parts[2];
      if (!db[table]) db[table] = [];
      const rows = db[table];
      const match = buildFilter(url.searchParams);
      const wantObject = (req.headers.accept || "").includes("vnd.pgrst.object");
      const wantRows = (req.headers.prefer || "").includes("return=representation");
      const reply = (hit, status = 200) => {
        if (wantObject) {
          if (hit.length !== 1) return send(406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" });
          return send(status, hit[0]);
        }
        return send(status, hit);
      };

      if (req.method === "GET") {
        let hit = rows.filter(match);
        const limit = url.searchParams.get("limit");
        if (limit) hit = hit.slice(0, Number(limit));
        return reply(hit);
      }
      const body = await readBody(req);
      if (req.method === "POST") {
        const items = Array.isArray(body) ? body : [body];
        const inserted = [];
        for (const item of items) {
          if (table === "claim_signatures" && rows.some((r) => r.wallet === item.wallet && r.nonce === item.nonce)) {
            return send(409, { code: "23505", message: "duplicate key value violates unique constraint" });
          }
          const row = { id: randomUUID(), ...item };
          rows.push(row);
          inserted.push(row);
        }
        return wantRows ? reply(inserted, 201) : send(201);
      }
      if (req.method === "PATCH") {
        const hit = rows.filter(match);
        hit.forEach((r) => Object.assign(r, body));
        return wantRows ? reply(hit) : send(204);
      }
      if (req.method === "DELETE") {
        const hit = rows.filter(match);
        db[table] = rows.filter((r) => !hit.includes(r));
        return wantRows ? reply(hit) : send(204);
      }
      send(405, { message: "method not allowed" });
    } catch (err) {
      send(500, { message: String(err.message || err) });
    }
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

const hex = (n) => "0x" + BigInt(n).toString(16);
const word = (n) => "0x" + BigInt(n).toString(16).padStart(64, "0");

function rpc(method, params) {
  switch (method) {
    case "eth_chainId":
      return "0xaa36a7";
    case "net_version":
      return "11155111";
    case "eth_blockNumber":
      return hex(chain.block);
    case "eth_call": {
      const data = (params[0].data || params[0].input || "").toLowerCase();
      if (data.startsWith("0x7ecebe00")) {
        const addr = "0x" + data.slice(-40);
        return word(chain.nonces[addr] ?? 0);
      }
      return "0x";
    }
    case "eth_getTransactionReceipt":
      return chain.receipts[params[0]] ?? null;
    default:
      return null;
  }
}

export function startFakeRpc(port) {
  const server = http.createServer(async (req, res) => {
    const body = await readBody(req);
    const one = (call) => ({ jsonrpc: "2.0", id: call.id, result: rpc(call.method, call.params || []) });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(Array.isArray(body) ? body.map(one) : one(body)));
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}
