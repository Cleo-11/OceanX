// End-to-end check of the OCX claim lifecycle through the REAL Express
// handlers (/marketplace/claim-ocx, /sign-claim, /trade/confirm), against
// in-memory Supabase + JSON-RPC fakes. No database, chain or secrets needed.
//
//   cd server && node __itest__/claim-lifecycle.e2e.mjs
//
// The server child process is started with throwaway keys and with dotenv
// pointed at a non-existent file, so a real server/.env is never loaded and
// nothing here can reach a real database or network.
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";
import { db, chain, startFakeSupabase, startFakeRpc } from "./fakes.mjs";

const SB_PORT = 54399, RPC_PORT = 8599, API_PORT = 3998;
const TOKEN = "0x0D30A0D0d4De399ED862D0509817aDE64b7d2Ea9";
const backend = ethers.Wallet.createRandom();
const user = ethers.Wallet.createRandom();
const wallet = user.address.toLowerCase();
const API = `http://127.0.0.1:${API_PORT}`;
const tokenAbi = JSON.parse(fs.readFileSync(new URL("../abis/OCXToken.json", import.meta.url), "utf8")).abi;
const iface = new ethers.Interface(tokenAbi);

let failures = 0;
const check = (name, cond, detail = "") => {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name} ${detail}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Math.floor(Date.now() / 1000);

async function post(path, extra = {}) {
  const authMessage = `AbyssX claim\nWallet: ${user.address}\nTimestamp: ${Date.now()}\nNetwork: sepolia`;
  const authSignature = await user.signMessage(authMessage);
  const res = await fetch(API + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ walletAddress: user.address, address: user.address, authMessage, authSignature, ...extra }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const player = () => db.players[0];
const trade = (id) => db.trades.find((t) => t.id === id);

function verifySignature(body) {
  const domain = { name: "OCXToken", version: "1", chainId: 11155111, verifyingContract: TOKEN };
  const types = { Claim: [
    { name: "account", type: "address" }, { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" } ] };
  const message = { account: user.address, amount: body.amountWei, nonce: body.nonce, deadline: body.deadline };
  return ethers.verifyTypedData(domain, types, message, body.signature) === backend.address;
}

function minedReceipt(txHash, amountWei, nonce) {
  const log = iface.encodeEventLog(iface.getEvent("Claimed"), [user.address, amountWei, nonce]);
  const blockHash = ethers.id("block");
  return {
    transactionHash: txHash, transactionIndex: "0x0", blockHash, blockNumber: "0x3e8",
    from: user.address, to: TOKEN, contractAddress: null, cumulativeGasUsed: "0x5208", gasUsed: "0x5208",
    effectiveGasPrice: "0x1", logsBloom: "0x" + "0".repeat(512), status: "0x1", type: "0x2",
    logs: [{ address: TOKEN, topics: log.topics, data: log.data, blockNumber: "0x3e8", blockHash,
             transactionHash: txHash, transactionIndex: "0x0", logIndex: "0x0", removed: false }],
  };
}

const sb = await startFakeSupabase(SB_PORT);
const rpc = await startFakeRpc(RPC_PORT);
db.players.push({ id: "player-1", wallet_address: wallet, total_ocx_earned: 100, nickel: 0, cobalt: 0, copper: 0, manganese: 0, coins: 0, submarine_tier: 1 });
chain.nonces[wallet] = 5;

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

try {
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await sleep(500);
    up = await fetch(API + "/health").then((r) => r.status < 600, () => false);
  }
  if (!up) throw new Error("server did not start:\n" + serverLog.slice(-3000));

  console.log("A. first claim reserves the balance and signs with a 5-minute deadline");
  const a = await post("/marketplace/claim-ocx");
  check("200 + signature", a.status === 200 && a.body.success && !!a.body.signature, JSON.stringify(a));
  check("signature is valid EIP-712 for (amount, nonce, deadline)", a.status === 200 && verifySignature(a.body));
  check("nonce = on-chain nonce", a.body.nonce === "5");
  check("claimableOcx 100, remainingOcx 0", a.body.claimableOcx === 100 && a.body.remainingOcx === 0);
  check("balance reserved in DB", player().total_ocx_earned === 0);
  check("trade is pending", trade(a.body.tradeId)?.status === "pending");
  const sigRow = db.claim_signatures[0];
  check("claim_signatures.expires_at == signed deadline (was +1h)", sigRow?.expires_at === a.body.deadline, `${sigRow?.expires_at} vs ${a.body.deadline}`);
  check("deadline ≈ now + 5 min", Math.abs(a.body.deadline - (now() + 300)) < 20);

  console.log("B. player dismissed the wallet prompt and presses Claim again → same claim resumes");
  const b = await post("/marketplace/claim-ocx");
  check("200 resumed (was 400 NO_OCX_TO_CLAIM)", b.status === 200 && b.body.resumed === true, JSON.stringify(b));
  check("identical signature / amount / nonce / deadline", b.body.signature === a.body.signature && b.body.amountWei === a.body.amountWei && b.body.nonce === a.body.nonce && b.body.deadline === a.body.deadline);
  check("resumed signature verifies with returned deadline", b.status === 200 && verifySignature(b.body));
  check("same tradeId, claimableOcx 100", b.body.tradeId === a.body.tradeId && b.body.claimableOcx === 100);
  check("no second deduction, no second trade", player().total_ocx_earned === 0 && db.trades.length === 1);

  console.log("B2. marketplace sign-claim is refused while that claim is open");
  const b2 = await post("/marketplace/sign-claim", { ocxAmount: 1, resourceType: "copper", resourceAmount: 1 });
  check("409 CLAIM_IN_PROGRESS", b2.status === 409 && b2.body.code === "CLAIM_IN_PROGRESS", JSON.stringify(b2));

  console.log("C. just past the deadline (grace period) → wait, no refund yet");
  trade(a.body.tradeId).deadline = now() - 10;
  sigRow.expires_at = now() - 10;
  const c = await post("/marketplace/claim-ocx");
  check("409 CLAIM_SETTLING with retryAfterSec", c.status === 409 && c.body.code === "CLAIM_SETTLING" && c.body.retryAfterSec > 0, JSON.stringify(c));
  check("still pending, balance still reserved", trade(a.body.tradeId).status === "pending" && player().total_ocx_earned === 0);

  console.log("D. signature expired unused → OCX refunded, then a fresh claim is issued");
  trade(a.body.tradeId).deadline = now() - 1000;
  const d = await post("/marketplace/claim-ocx");
  check("200 with a NEW claim (new trade, not resumed)", d.status === 200 && d.body.success && d.body.tradeId !== a.body.tradeId && !d.body.resumed, JSON.stringify(d));
  check("old trade → failed (claim_expired_refunded)", trade(a.body.tradeId).status === "failed" && trade(a.body.tradeId).error_message === "claim_expired_refunded");
  check("new claim is for the refunded 100 OCX", d.body.claimableOcx === 100 && d.body.amountWei === ethers.parseEther("100").toString());
  check("balance: refunded then reserved again = 0", player().total_ocx_earned === 0);
  check("new signature verifies", d.status === 200 && verifySignature(d.body));
  check("exactly one pending trade", db.trades.filter((t) => t.status === "pending").length === 1);

  console.log("E. claim mined → /trade/confirm verifies amount (wei) and confirms without re-crediting");
  const txHash = ethers.id("claim-tx-1");
  chain.receipts[txHash] = minedReceipt(txHash, d.body.amountWei, d.body.nonce);
  chain.nonces[wallet] = 6;
  const e = await post("/marketplace/trade/confirm", { txHash, tradeId: d.body.tradeId });
  check("200 success (was 500 'Amount mismatch')", e.status === 200 && e.body.success === true, JSON.stringify(e));
  check("trade → confirmed with tx hash", trade(d.body.tradeId).status === "confirmed" && trade(d.body.tradeId).tx_hash === txHash);
  check("balance NOT re-credited", player().total_ocx_earned === 0, String(player().total_ocx_earned));
  const e2 = await post("/marketplace/trade/confirm", { txHash, tradeId: d.body.tradeId });
  check("confirm is idempotent", e2.status === 200 && e2.body.alreadyConfirmed === true, JSON.stringify(e2));

  console.log("F. nothing left to claim");
  const f = await post("/marketplace/claim-ocx");
  check("400 NO_OCX_TO_CLAIM", f.status === 400 && f.body.code === "NO_OCX_TO_CLAIM", JSON.stringify(f));

  console.log("G. mined but the client never confirmed → next claim settles it from the chain");
  player().total_ocx_earned = 40;
  const g1 = await post("/marketplace/claim-ocx");
  check("claim issued for 40 at nonce 6", g1.status === 200 && g1.body.claimableOcx === 40 && g1.body.nonce === "6", JSON.stringify(g1));
  chain.nonces[wallet] = 7; // mined on-chain, client crashed before /confirm
  player().total_ocx_earned = 15; // earned more since
  const g2 = await post("/marketplace/claim-ocx");
  check("previous trade auto-confirmed", trade(g1.body.tradeId).status === "confirmed");
  check("new claim is for the 15 only (no refund of mined claim)", g2.status === 200 && g2.body.claimableOcx === 15 && g2.body.nonce === "7", JSON.stringify(g2));
  check("balance 0 after reserving", player().total_ocx_earned === 0);

  console.log("H. wrong-amount receipt is rejected by /trade/confirm");
  const badHash = ethers.id("claim-tx-bad");
  chain.receipts[badHash] = minedReceipt(badHash, ethers.parseEther("999").toString(), g2.body.nonce);
  chain.nonces[wallet] = 8;
  const h = await post("/marketplace/trade/confirm", { txHash: badHash, tradeId: g2.body.tradeId });
  check("not confirmed", h.status >= 400 && trade(g2.body.tradeId).status === "pending", JSON.stringify(h));
} catch (err) {
  failures++;
  console.log("FATAL", err);
} finally {
  server.kill("SIGKILL");
  sb.close();
  rpc.close();
}
if (failures) {
  console.log(`\n${failures} check(s) FAILED\n--- server log tail ---\n${serverLog.slice(-4000)}`);
  process.exit(1);
}
console.log("\nALL CHECKS PASSED");
process.exit(0);
