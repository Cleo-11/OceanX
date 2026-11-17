# State machines in OceanX

An *implicit* state machine is a flow whose states exist only as a combination
of booleans, status strings, timers and "which line of the async function are
we on". They work on the happy path and fail at the edges: double clicks, a
dismissed wallet prompt, a dropped socket, a stale timer.

This document lists every one found in the app, what was wrong, and where its
explicit definition now lives.

## Building blocks

| File | What it is |
| --- | --- |
| `lib/state-machines/machine.ts` | 60-line typed transition-table helper. No dependencies. |
| `lib/state-machines/game-action.ts` | What the player is doing on the game screen. |
| `lib/state-machines/tx-lifecycle.ts` | One model for every wallet / on-chain flow, plus `classifyTxError` and `explorerTxUrl`. |
| `lib/state-machines/connection.ts` | Game-server socket status. |
| `hooks/use-game-action.ts`, `hooks/use-tx-lifecycle.ts` | React bindings. `send()` returns `false` for an illegal event and checks a ref, so it doubles as a synchronous double-submit guard. |
| `server/lib/claimLifecycle.js` | Server-side OCX claim lifecycle: resume / confirm / refund. |

Rule of thumb for new code: **if you are about to add `isXing`, `xStatus` and
`xError` next to each other, add a transition table instead.**

## Inventory

### 1. Game action — `GameState` (fixed)

`idle → mining | trading | claiming | upgrading → success state → idle`

Was: `setGameState("...")` calls and five separate `setTimeout(..., 2000)`.
- Trade and Claim did not check the current state, and the sidebar only
  disabled its buttons for 3 of the 5 busy states. Starting a claim within two
  seconds of mining let mining's timer flip the claim back to `idle`
  mid-flight, re-enabling the button — a second claim could be started.
- Holding **F** re-fired mining through a stale keyboard closure.
- `claiming` / `claimed` had no HUD text at all.

Now: `gameActionMachine` + `useGameAction`. Every action starts only from
`idle`; one timer, owned by the hook, cancelled on every transition.
`OceanMiningGame` takes `sendGameEvent` instead of `setGameState`.

### 2. Transaction lifecycle — claim, upgrade, marketplace trade (fixed)

`preparing → awaitingSignature → authorizing → awaitingWallet → pending(txHash) → syncing → succeeded | failed`

Was: per screen, some mix of `isUpgrading` + `upgradeStatus` + `upgradeError`,
or `isTrading` + `tradeStep` + `tradeStatus` + `txHash` + `tradeError`, each
with its own `includes("user rejected")` string matching and blocking
`alert()`s that froze the canvas.

Now: `txReducer` (a discriminated union — a hash cannot exist before
broadcast, an error cannot coexist with success).
- **Game claim**: each wait is named on screen with an explorer link once
  broadcast; wallet-account and contract-on-this-network preflights before any
  signature; the auth signature is reused for the confirm call (two wallet
  prompts instead of three); works with WalletConnect, not only
  `window.ethereum`.
- **Game upgrade**: "Step 1 of 2 — approve", "Step 2 of 2 — confirm". If the
  chain confirms but the DB sync fails, the message says so instead of
  "Upgrade failed".
- **Hangar**: same reducer. Also fixed: the affordability check read React
  state captured before the balance refresh, and `initialBalance` (earned,
  off-chain) was written into the on-chain balance.
- **Marketplace**: kept its step numbers; fixed the error panel (it rendered
  only while `isTrading`, which was cleared in the same tick the error was set,
  so failures were invisible), ref-based double-submit guard, tracked
  auto-close timer.

### 3. Game-server connection (fixed)

`disconnected → connecting → connected ⇄ reconnecting → disconnected`

Was: status set once after the first connect; a dropped socket still showed
"connected". Remounting the game stacked a second socket and duplicate
listeners.

Now: `lib/websocket.ts` emits `CONNECTION_STATUS_EVENT` for every socket.io
lifecycle event; the game feeds them through `connectionMachine` and cleans up
on unmount.

### 4. Wallet connection (fixed)

Was: `WalletManager.connection` cached a signer forever. Switching account or
network in the wallet left the app signing with a stale one.

Now: the manager watches `accountsChanged` / `chainChanged` / `disconnect`,
drops the cache, and exposes `walletManager.subscribe()`.
`ensureConnected()` rebuilds silently.

### 5. OCX claim, server side — `trades.status` + `claim_signatures` (fixed)

`LIVE → CONSUMED (confirmed) | SETTLING → EXPIRED (refunded)`

This was the most serious one. The server deducts `total_ocx_earned` when it
issues a claim signature. There was no transition for "the player never
submitted it":

- Dismiss the wallet prompt → balance already 0 → pressing Claim again
  returned `No OCX available to claim`. The OCX was gone for good.
- The cached-signature path returned `claim_signatures.expires_at` (reservation
  time, +1 h) as the claim `deadline`, but the signature was signed with a
  +5 min deadline — every re-issued signature reverted on-chain.
- `/marketplace/trade/confirm` ran the stored wei amount through
  `parseEther()` again, so the amount check never passed and **no trade ever
  reached `confirmed`**. (Had it passed, the next line would have added the raw
  wei figure to the player's balance.)

Now (`server/lib/claimLifecycle.js`, called from `/marketplace/claim-ocx`,
`/marketplace/sign-claim` and a 5-minute sweep):

| Chain says | Clock says | Result |
| --- | --- | --- |
| nonce moved past the claim | any | trade → `confirmed` |
| nonce unchanged | before deadline | same signature returned (`resumed: true`) |
| nonce unchanged | deadline … deadline + grace | `409 CLAIM_SETTLING` |
| nonce unchanged | after deadline + grace | trade → `failed` (`claim_expired_refunded`), OCX credited back once |

The contract makes this safe: `claim()` requires `nonce == nonces[sender]` and
`block.timestamp <= deadline`, so an unused signature past its deadline can
never be redeemed. `trades.status` keeps its existing CHECK constraint — no
migration.

Config: `CLAIM_REFUND_GRACE_SEC` (180), `CLAIM_MIN_LIVE_SEC` (30),
`CLAIM_SETTLEMENT_SWEEP=false` to disable the sweep.

### 6. `pending_actions` — `pending → executing → executed` (fixed)

Was: only one of thirteen early exits released the claim, so a missing
receipt or a thrown RPC error left the row in `executing` forever. `tx_failed`
answered HTTP 200.

Now: every non-completing exit goes through `fail()`, which releases first;
the release is disarmed once the player row is updated.

### 7. Smart contracts (already explicit — unchanged)

`OCXToken.claim` (sequential nonce + deadline + used-digest) and
`UpgradeManager` (`targetTier == current + 1`) are proper on-chain state
machines. They are deployed; nothing here changes them or their ABIs.

## Economy hardening (follow-up)

The first four "found, not changed" items were fixed in a second pass.

### 8. Mining — server-authoritative

Before: deposits were generated in the browser (a reload gave 30 fresh ones),
mined amounts were added to client state, and the totals were POSTed to
`/api/player/save-resources`, which wrote whatever it received. The socket
join never succeeded (the client signed plain text; the server expects the
JSON message from `lib/signature.ts`), so none of the server's mining or
movement code ever ran.

Now (`server/lib/authoritativeMining.js`):

```
join-game (signed JSON, or resume token after a drop)
  → game-state { sessionId, resources: this player's deposits, resumeToken }
player-move (≤ ~7/s)        first one = spawn, later ones speed-checked
mine-resource { nodeId }     deposit exists & not depleted
                             → server-known position within 100 units
                             → 1.5 s cooldown, one mine per deposit at a time
                             → amount = min(deposit, free hold space)   (same rule as before)
                             → players row updated (compare-and-swap)
                             → mining-result { amount, resources: new totals }
depleted deposit             → replaced after 3 min (resource-nodes)
```

Deposits are per player and use the client's old generator (30 deposits,
5–15 units, any type), so the game plays the same. `save-resources` ignores
resource numbers and returns the server's totals (kept for cached clients).
Movement now counts against its own rate limit only: at 60 moves/s the old
global 100/min budget would have blocked mining within seconds.

### 9. Marketplace trades — reserved at issue

`/marketplace/sign-claim` now requires a resource type and whole amount,
prices the trade on the server (the client's `ocxAmount` is ignored), and
deducts the resources before signing. The trade row carries
`idempotency_key = reserve:<uuid>`; `claimLifecycle.js` treats such rows like
OCX claims: confirmed when the nonce is consumed, **resources returned** when
the signature expires unused, resumed when the player repeats the same trade.
Older trades (no `reserve:` key) still deduct on confirm. Requests without a
resource are refused — they used to mint up to the value of everything the
player owned while deducting nothing. A live signature that no tracked trade
owns is no longer handed out again.

### 10. Balance writes — compare-and-swap

`server/lib/playerLedger.js`: every write re-checks the values it read and
retries if another writer got there first. Used by mining, trade reservation,
refunds, OCX claim deduction (now *before* signing, refunded if signing or
recording fails), and legacy confirm. The in-game "trade all"
(`/api/marketplace/trade-resources`) does the same inline. No migration.

### 11. Chain config — one chain

`getPrimaryChain()` defaults to Ethereum Sepolia (`NEXT_PUBLIC_CHAIN_ID`
overrides). `walletManager.ensurePrimaryNetwork()` switches the wallet before
every transaction (claim, upgrade, marketplace). The in-game upgrade checks
the **wallet's** OCX, and points to Claim OCX when the OCX is still in-game.

## Found, not changed

1. `components/ocean-mining-simulation.tsx` is unused and still has the old
   timer pattern.
2. Auth, onboarding and network-switch screens use `isLoading` + `error`
   pairs. They are single-step and correct today.
3. OCX-spending routes outside the claim flow (hangar purchase/execute,
   `/submarine/upgrade`) still use read-modify-write; `playerLedger.js` can
   replace them.
4. The in-game "trade all" floors each resource's value (3 nickel → 0 OCX)
   while the marketplace does not. Pricing, so left alone.
5. Server deposits and movement live in memory: a server restart gives
   players fresh deposits.

## Verifying

```bash
npx jest --config jest.config.cjs        # machines, claim lifecycle, economy, chain config
cd server && node __itest__/claim-lifecycle.e2e.mjs
cd server && node __itest__/economy.e2e.mjs
```

The second command boots the real Express server against in-memory Supabase
and JSON-RPC fakes (throwaway keys, `.env` not loaded) and walks a claim
through issue → dismissed prompt → resume → expiry → refund → mined → confirm.
The third joins over socket.io and mines (range, cooldown, capacity, depletion,
reconnect), then sells resources through the marketplace (reserve, resume,
refund on expiry, confirm without double deduction).
