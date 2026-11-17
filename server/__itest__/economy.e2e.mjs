// End-to-end check of the server-authoritative economy through the REAL
// Express + socket.io handlers, against in-memory Supabase + JSON-RPC fakes:
//
//   1. mining is decided by the server (range, cooldown, capacity, node amount)
//   2. /api/player/save-resources can no longer set totals (Next route; unit-tested)
//   3. marketplace trades reserve resources when the signature is issued and
//      return them if it expires unused
//
//   cd server && node __itest__/economy.e2e.mjs
//
// Like claim-lifecycle.e2e.mjs, it never loads a real .env.
import { spawn } from "child_process";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { ethers } from "ethers";
import { db, chain, startFakeSupabase, startFakeRpc } from "./fakes.mjs";

const require = createRequire(import.meta.url);
const { io } = require("../../node_modules/socket.io-client");

const SB_PORT = 54398, RPC_PORT = 8598, API_PORT = 3997;
const TOKEN = "0x0D30A0D0d4De399ED862D0509817aDE64b7d2Ea9";
const backend = ethers.Wallet.createRandom();
const user = ethers.Wallet.createRandom();
const wallet = user.address.toLowerCase();
const API = `http://127.0.0.1:${API_PORT}`;

let failures = 0;
const check = (name, cond, detail = "") => {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name} ${detail}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Math.floor(Date.now() / 1000);

async function post(p, extra = {}) {
  const authMessage = `AbyssX claim\nWallet: ${user.address}\nTimestamp: ${Date.now()}\nNetwork: sepolia`;
  const authSignature = await user.signMessage(authMessage);
  const res = await fetch(API + p, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ walletAddress: user.address, address: user.address, authMessage, authSignature, ...extra }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const player = () => db.players[0];
const trade = (id) => db.trades.find((t) => t.id === id);

const sb = await startFakeSupabase(SB_PORT);
const rpc = await startFakeRpc(RPC_PORT);
db.players.push({ id: "player-1", wallet_address: wallet, total_ocx_earned: 0, total_resources_mined: 0,
  nickel: 0, cobalt: 0, copper: 0, manganese: 0, coins: 0, submarine_tier: 1 });
chain.nonces[wallet] = 3;

const server = spawn("node", ["--import", "tsx", "--no-warnings", "index.js"], {
  cwd: fileURLToPath(new URL("..", import.meta.url)),
  env: { ...process.env, PORT: String(API_PORT), NODE_ENV: "development",
    DOTENV_CONFIG_PATH: path.join(os.tmpdir(), "oceanx-e2e-no-such-env-file"),
    BACKEND_PRIVATE_KEY: backend.privateKey, RPC_URL: `http://127.0.0.1:${RPC_PORT}`,
    TOKEN_CONTRACT_ADDRESS: TOKEN, SUPABASE_URL: `http://127.0.0.1:${SB_PORT}`,
    SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service", CHAIN_ID: "11155111",
    CLAIM_SETTLEMENT_SWEEP: "false" },
});
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));

let socket;
const nextEvent = (name, ms = 5000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${name}`)), ms);
    socket.once(name, (data) => { clearTimeout(t); resolve(data); });
  });
let reqSeq = 0;
const mine = async (nodeId) => {
  const requestId = `r${++reqSeq}`;
  socket.emit("mine-resource", { nodeId, requestId, sessionId: "ignored", walletAddress: wallet, amount: 50, resourceType: "manganese" });
  for (;;) {
    const r = await nextEvent("mining-result");
    if (r.requestId === requestId) return r;
  }
};
const move = (x, y) => socket.emit("player-move", { walletAddress: wallet, sessionId: sessionId, position: { x, y, z: 0, rotation: 0 } });
let sessionId;

try {
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await sleep(500);
    up = await fetch(API + "/health").then((r) => r.status < 600, () => false);
  }
  if (!up) throw new Error("server did not start:\n" + serverLog.slice(-3000));

  console.log("1. mining is server-authoritative");
  socket = io(API, { transports: ["websocket"], reconnection: false });
  await nextEvent("connect");
  const message = JSON.stringify({ domain: "OceanX", action: "join-game", wallet, session: "auto", timestamp: Date.now(), version: 1 });
  socket.emit("join-game", { walletAddress: wallet, sessionId: "auto", message, signature: await user.signMessage(message) });
  const state = await nextEvent("game-state");
  sessionId = state.sessionId;
  check("game-state carries sessionId, resume token and 30 deposits", !!sessionId && !!state.resumeToken && state.resources?.length === 30);
  check("deposits are generated like the client did (5–15 units)", state.resources.every((n) => n.amount >= 5 && n.amount <= 15));
  check("every node is inside the client world (50..1950)", state.resources.every((n) => n.position.x >= 50 && n.position.x <= 1950 && n.position.y >= 50 && n.position.y <= 1950));

  const nodes = state.resources;
  const target = nodes.find((n) => n.type === "manganese") || nodes[0];
  const far = nodes.find((n) => Math.hypot(n.position.x - target.position.x, n.position.y - target.position.y) > 400);

  const r0 = await mine(target.id);
  check("before any position report → position_unknown", r0.success === false && r0.reason === "position_unknown", JSON.stringify(r0));

  move(target.position.x + 10, target.position.y);
  await sleep(100);
  const r1 = await mine(far.id);
  check("node far away → out_of_range", r1.success === false && r1.reason === "out_of_range", JSON.stringify(r1));

  const r2 = await mine(target.id);
  const cap = { nickel: 100, cobalt: 50, copper: 50, manganese: 25 }[target.type];
  check("in range → success, server decides the amount", r2.success === true && r2.amount === Math.min(cap, target.amount), JSON.stringify(r2));
  check("client's requested amount/type ignored", r2.resourceType === target.type);
  check("DB updated by the server", player()[target.type] === r2.amount && player().total_resources_mined === r2.amount, JSON.stringify(player()));
  check("reply carries new totals", r2.resources?.[target.type] === r2.amount);
  check("node reduced on the server", r2.remainingAmount === target.amount - r2.amount);


  check("deposit fully mined → depleted", r2.depleted === true && r2.remainingAmount === 0, JSON.stringify(r2));

  await sleep(1600);
  const r3b = await mine(target.id);
  check("depleted deposit → node_depleted", r3b.success === false && r3b.reason === "node_depleted", JSON.stringify(r3b));

  const second = nodes.find((n) => n.id !== target.id && n.id !== far.id);
  move(target.position.x + 10 + 1, target.position.y); // stay valid, then walk over in small steps
  let pos = { x: target.position.x + 11, y: target.position.y };
  while (Math.hypot(second.position.x - pos.x, second.position.y - pos.y) > 20) {
    const dx = second.position.x - pos.x, dy = second.position.y - pos.y, d = Math.hypot(dx, dy);
    pos = { x: pos.x + (dx / d) * Math.min(80, d), y: pos.y + (dy / d) * Math.min(80, d) };
    await sleep(40);
    move(pos.x, pos.y);
  }
  await sleep(150);
  player()[second.type] = { nickel: 100, cobalt: 50, copper: 50, manganese: 25 }[second.type];
  const before4 = player()[second.type];
  const r4 = await mine(second.id);
  check("hold full for that resource → storage_full", r4.success === false && r4.reason === "storage_full", JSON.stringify(r4));
  check("no DB change on refusal", player()[second.type] === before4);
  player()[second.type] = 0;
  const r4b = await mine(second.id);
  check("walked to another deposit (validated moves) → success", r4b.success === true && r4b.amount === second.amount, JSON.stringify(r4b));
  const lastValid = { ...pos };

  console.log("1b. movement validation");
  move(lastValid.x > 1000 ? lastValid.x - 900 : lastValid.x + 900, lastValid.y);
  const rej = await nextEvent("movement-rejected");
  check("teleport → movement-rejected with last valid position", Math.abs(rej.currentPosition.x - lastValid.x) < 0.01, JSON.stringify(rej));

  console.log("1c. 60 moves/second no longer starve mining (global rate limit)");
  for (let i = 0; i < 150; i++) move(lastValid.x + (i % 2), lastValid.y);
  await sleep(1600);
  const third = nodes.find((n) => n.id !== target.id && n.id !== second.id && Math.hypot(n.position.x - lastValid.x, n.position.y - lastValid.y) < 90);
  const r5 = third ? await mine(third.id) : await mine("no-such-node");
  check("mining still answered (not rate-limited) after a burst of moves", r5.reason !== "rate_limit_exceeded" && (third ? r5.success === true : r5.reason === "node_not_found"), JSON.stringify(r5));

  console.log("1d. reconnect with the resume token (no wallet prompt) keeps the same deposits");
  socket.close();
  socket = io(API, { transports: ["websocket"], reconnection: false });
  await nextEvent("connect");
  socket.emit("join-game", { walletAddress: wallet, resumeToken: state.resumeToken });
  const state2 = await nextEvent("game-state");
  const ids1 = new Set(nodes.map((n) => n.id));
  check("rejoined without a signature", !!state2.sessionId);
  check("same deposits after reconnect (no reload farming)", state2.resources.every((n) => ids1.has(n.id)));
  check("mined deposit still depleted", state2.resources.find((n) => n.id === target.id)?.depleted === true);
  socket.emit("join-game", { walletAddress: wallet, resumeToken: "bogus" });
  const je = await nextEvent("join-error");
  check("bad resume token → join-error RESUME_INVALID", je.code === "RESUME_INVALID", JSON.stringify(je));

  console.log("2. marketplace trade reserves resources at signature time");
  player().nickel = 30; player().copper = 4;
  const t1 = await post("/marketplace/sign-claim", { ocxAmount: 999, resourceType: "nickel", resourceAmount: 20 });
  check("200 + signature", t1.status === 200 && !!t1.body.signature, JSON.stringify(t1));
  check("OCX amount priced by the server (20 × 0.1 = 2), client's 999 ignored", t1.body.ocxAmount === 2 && t1.body.amountWei === ethers.parseEther("2").toString(), JSON.stringify(t1.body));
  check("20 nickel deducted immediately", player().nickel === 10, String(player().nickel));
  check("trade pending and marked as reserved", trade(t1.body.tradeId)?.status === "pending" && trade(t1.body.tradeId)?.idempotency_key?.startsWith("reserve:"));

  const t2 = await post("/marketplace/sign-claim", { resourceType: "nickel", resourceAmount: 20 });
  check("same trade again → resumed, no second deduction", t2.status === 200 && t2.body.resumed === true && t2.body.signature === t1.body.signature && player().nickel === 10, JSON.stringify(t2));

  const t3 = await post("/marketplace/sign-claim", { resourceType: "copper", resourceAmount: 1 });
  check("different trade while one is open → 409 TRADE_IN_PROGRESS", t3.status === 409 && t3.body.code === "TRADE_IN_PROGRESS", JSON.stringify(t3));

  const t4 = await post("/marketplace/claim-ocx");
  check("OCX claim while a trade is open → 409 TRADE_IN_PROGRESS", t4.status === 409 && t4.body.code === "TRADE_IN_PROGRESS", JSON.stringify(t4));

  console.log("2b. signature expires unused → resources come back");
  trade(t1.body.tradeId).deadline = now() - 1000;
  db.claim_signatures.forEach((s) => { if (String(s.nonce) === String(t1.body.nonce)) s.expires_at = now() - 1000; });
  const t5 = await post("/marketplace/sign-claim", { resourceType: "copper", resourceAmount: 3 });
  check("old trade refunded (failed + marker)", trade(t1.body.tradeId).status === "failed" && trade(t1.body.tradeId).error_message === "claim_expired_refunded");
  check("20 nickel returned", player().nickel === 30, String(player().nickel));
  check("new copper trade issued and reserved", t5.status === 200 && player().copper === 1 && t5.body.ocxAmount === 3, JSON.stringify(t5));

  console.log("2c. trade mined → confirm does not deduct again");
  const iface = new ethers.Interface(["event Claimed(address indexed account, uint256 amount, uint256 nonce)"]);
  const txHash = ethers.id("trade-tx-1");
  const log = iface.encodeEventLog(iface.getEvent("Claimed"), [user.address, t5.body.amountWei, t5.body.nonce]);
  const blockHash = ethers.id("block");
  chain.receipts[txHash] = { transactionHash: txHash, transactionIndex: "0x0", blockHash, blockNumber: "0x3e8",
    from: user.address, to: TOKEN, contractAddress: null, cumulativeGasUsed: "0x5208", gasUsed: "0x5208",
    effectiveGasPrice: "0x1", logsBloom: "0x" + "0".repeat(512), status: "0x1", type: "0x2",
    logs: [{ address: TOKEN, topics: log.topics, data: log.data, blockNumber: "0x3e8", blockHash,
             transactionHash: txHash, transactionIndex: "0x0", logIndex: "0x0", removed: false }] };
  chain.nonces[wallet] = Number(t5.body.nonce) + 1;
  const c1 = await post("/marketplace/trade/confirm", { txHash, tradeId: t5.body.tradeId });
  check("confirmed", c1.status === 200 && trade(t5.body.tradeId).status === "confirmed", JSON.stringify(c1));
  check("copper not deducted a second time", player().copper === 1, String(player().copper));

  console.log("2d. invalid requests");
  const bad1 = await post("/marketplace/sign-claim", { ocxAmount: 50 });
  check("no resource → 400 RESOURCE_REQUIRED (was: mint up to the value of everything, deduct nothing)", bad1.status === 400 && bad1.body.code === "RESOURCE_REQUIRED", JSON.stringify(bad1));
  player().cobalt = 0;
  const bad2 = await post("/marketplace/sign-claim", { resourceType: "cobalt", resourceAmount: 5 });
  check("more than owned → 403 INSUFFICIENT_RESOURCES, nothing reserved", bad2.status === 403 && bad2.body.code === "INSUFFICIENT_RESOURCES" && player().cobalt === 0, JSON.stringify(bad2));
  check("refused request left no pending trade", db.trades.filter((t) => t.status === "pending").length === 0);
} catch (err) {
  failures++;
  console.log("FATAL", err);
} finally {
  socket?.close();
  server.kill("SIGKILL");
  sb.close();
  rpc.close();
}
if (failures) {
  console.log(`\n${failures} check(s) FAILED\n--- server log tail ---\n${serverLog.slice(-5000)}`);
  process.exit(1);
}
console.log("\nALL CHECKS PASSED");
process.exit(0);
