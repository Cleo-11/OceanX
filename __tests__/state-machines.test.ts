/**
 * Unit tests for the explicit state machines in lib/state-machines.
 * Pure logic only — no React, no wallet, no network.
 */
import { describe, it, expect } from "@jest/globals"
import { createMachine } from "@/lib/state-machines/machine"
import {
  GAME_STATE_LABELS,
  gameActionMachine,
  isGameBusy,
  isSuccessState,
  type GameActionEvent,
} from "@/lib/state-machines/game-action"
import { connectionMachine } from "@/lib/state-machines/connection"
import {
  TX_IDLE,
  classifyTxError,
  describeTx,
  explorerTxUrl,
  isTxBroadcast,
  isTxBusy,
  txError,
  txProgress,
  txReducer,
  type TxEvent,
  type TxState,
} from "@/lib/state-machines/tx-lifecycle"
import type { GameState } from "@/lib/types"

const run = (events: TxEvent[], from: TxState = TX_IDLE) => events.reduce(txReducer, from)

describe("createMachine", () => {
  const light = createMachine<"red" | "green", "GO" | "STOP">({
    id: "light",
    initial: "red",
    states: { red: { GO: "green" }, green: { STOP: "red" } },
  })

  it("follows legal transitions", () => {
    expect(light.transition("red", "GO")).toBe("green")
    expect(light.can("red", "GO")).toBe(true)
  })

  it("ignores illegal events and returns the same state", () => {
    expect(light.transition("red", "STOP")).toBe("red")
    expect(light.can("red", "STOP")).toBe(false)
  })

  it("lists the events available from a state", () => {
    expect(light.events("green")).toEqual(["STOP"])
  })
})

describe("gameActionMachine", () => {
  const m = gameActionMachine
  const starts: GameActionEvent[] = ["START_MINING", "START_TRADING", "START_CLAIMING", "START_UPGRADING", "START_VOTING"]
  const allStates = Object.keys(m.states) as GameState[]

  it("starts idle", () => {
    expect(m.initial).toBe("idle")
  })

  it("only starts an action from idle (one action at a time)", () => {
    for (const state of allStates) {
      for (const start of starts) {
        expect(m.can(state, start)).toBe(state === "idle")
      }
    }
  })

  it("rejects a second click on the same action", () => {
    const claiming = m.transition("idle", "START_CLAIMING")
    expect(claiming).toBe("claiming")
    expect(m.transition(claiming, "START_CLAIMING")).toBe("claiming")
    expect(m.can(claiming, "START_CLAIMING")).toBe(false)
  })

  it("cannot trade or mine while a claim is waiting on the wallet", () => {
    expect(m.can("claiming", "START_TRADING")).toBe(false)
    expect(m.can("claiming", "START_MINING")).toBe(false)
    expect(m.can("mining", "START_CLAIMING")).toBe(false)
    expect(m.can("resourceGained", "START_TRADING")).toBe(false)
  })

  const happyPaths: Array<[GameActionEvent, GameState, GameState]> = [
    ["START_MINING", "mining", "resourceGained"],
    ["START_TRADING", "trading", "resourceTraded"],
    ["START_CLAIMING", "claiming", "claimed"],
    ["START_UPGRADING", "upgrading", "upgraded"],
    ["START_VOTING", "voting", "voteSubmitted"],
  ]
  for (const [start, busy, done] of happyPaths) {
    it(`${start} runs ${busy} → ${done} → idle`, () => {
      expect(m.transition("idle", start)).toBe(busy)
      expect(m.transition(busy, "SUCCEED")).toBe(done)
      expect(isSuccessState(done)).toBe(true)
      expect(m.transition(done, "SETTLE")).toBe("idle")
    })
  }

  it("returns to idle on failure", () => {
    for (const busy of ["mining", "trading", "claiming", "upgrading", "voting"] as const) {
      expect(m.transition(busy, "FAIL")).toBe("idle")
    }
  })

  it("a stale SETTLE cannot reset an action that is in flight", () => {
    // The old bug: mining's 2s timeout fired after a claim had started.
    for (const busy of ["mining", "trading", "claiming", "upgrading", "voting"] as const) {
      expect(m.transition(busy, "SETTLE")).toBe(busy)
    }
  })

  it("a late SUCCEED/FAIL cannot move a settled state", () => {
    expect(m.transition("idle", "SUCCEED")).toBe("idle")
    expect(m.transition("idle", "FAIL")).toBe("idle")
    expect(m.transition("claimed", "FAIL")).toBe("claimed")
  })

  it("RESET always returns to idle", () => {
    for (const state of allStates) {
      expect(m.transition(state, "RESET")).toBe("idle")
    }
  })

  it("every state is reachable from idle and can get back to idle", () => {
    const reachable = new Set<GameState>(["idle"])
    const queue: GameState[] = ["idle"]
    while (queue.length) {
      const s = queue.shift() as GameState
      for (const e of m.events(s)) {
        const n = m.transition(s, e)
        if (!reachable.has(n)) {
          reachable.add(n)
          queue.push(n)
        }
      }
    }
    expect(Array.from(reachable).sort()).toEqual(allStates.slice().sort())
    for (const state of allStates) {
      expect(m.can(state, "RESET")).toBe(true)
    }
  })

  it("labels every non-idle state", () => {
    for (const state of allStates) {
      if (state === "idle") expect(GAME_STATE_LABELS[state]).toBeNull()
      else expect(GAME_STATE_LABELS[state]).toEqual(expect.any(String))
    }
    expect(isGameBusy("idle")).toBe(false)
    expect(isGameBusy("claimed")).toBe(true)
  })
})

describe("connectionMachine", () => {
  const m = connectionMachine

  it("connects", () => {
    expect(m.transition(m.transition("disconnected", "CONNECT"), "CONNECTED")).toBe("connected")
  })

  it("reports a dropped connection instead of staying 'connected'", () => {
    expect(m.transition("connected", "DROPPED")).toBe("reconnecting")
    expect(m.transition("reconnecting", "CONNECTED")).toBe("connected")
    expect(m.transition("reconnecting", "GAVE_UP")).toBe("disconnected")
  })

  it("falls back to offline when the first connection fails", () => {
    expect(m.transition("connecting", "FAILED")).toBe("disconnected")
  })

  it("ignores a stale DROPPED after an intentional disconnect", () => {
    expect(m.transition("disconnected", "DROPPED")).toBe("disconnected")
  })
})

describe("txReducer", () => {
  const HASH = "0x" + "ab".repeat(32)

  it("walks the full claim flow and keeps the hash to the end", () => {
    const steps: TxState[] = []
    let s = TX_IDLE
    for (const e of [
      { type: "START" },
      { type: "REQUEST_SIGNATURE" },
      { type: "AUTHORIZE" },
      { type: "REQUEST_WALLET" },
      { type: "BROADCAST", txHash: HASH },
      { type: "MINED" },
      { type: "SUCCEED" },
    ] as TxEvent[]) {
      s = txReducer(s, e)
      steps.push(s)
    }
    expect(steps.map((x) => x.status)).toEqual([
      "preparing",
      "awaitingSignature",
      "authorizing",
      "awaitingWallet",
      "pending",
      "syncing",
      "succeeded",
    ])
    expect(s).toEqual({ status: "succeeded", txHash: HASH })
  })

  it("supports a two-transaction flow (approve → upgrade)", () => {
    const s = run([
      { type: "START" },
      { type: "REQUEST_WALLET", note: "Approve OCX" },
      { type: "BROADCAST", txHash: "0x1" },
      { type: "REQUEST_WALLET", note: "Confirm upgrade" },
      { type: "BROADCAST", txHash: "0x2" },
    ])
    expect(s).toEqual({ status: "pending", txHash: "0x2" })
  })

  it("supports an off-chain flow with no transaction", () => {
    const s = run([{ type: "START" }, { type: "AUTHORIZE" }, { type: "SUCCEED", note: "Upgraded" }])
    expect(s).toEqual({ status: "succeeded", note: "Upgraded" })
    expect(isTxBroadcast(s)).toBe(false)
  })

  it("rejects a second START while in flight (double-submit guard)", () => {
    const busy = run([{ type: "START" }, { type: "REQUEST_WALLET" }])
    expect(txReducer(busy, { type: "START" })).toBe(busy)
    expect(isTxBusy(busy)).toBe(true)
  })

  it("cannot broadcast before the wallet was asked", () => {
    const s = run([{ type: "START" }])
    expect(txReducer(s, { type: "BROADCAST", txHash: HASH })).toBe(s)
  })

  it("cannot succeed or fail from idle (late async results are dropped)", () => {
    expect(txReducer(TX_IDLE, { type: "SUCCEED" })).toBe(TX_IDLE)
    expect(txReducer(TX_IDLE, { type: "FAIL", error: txError("unknown", "x") })).toBe(TX_IDLE)
  })

  it("keeps the tx hash when failing after broadcast", () => {
    const s = run([
      { type: "START" },
      { type: "REQUEST_WALLET" },
      { type: "BROADCAST", txHash: HASH },
      { type: "FAIL", error: txError("network", "RPC dropped", true) },
    ])
    expect(s).toEqual({ status: "failed", txHash: HASH, error: txError("network", "RPC dropped", true) })
    expect(isTxBroadcast(s)).toBe(true)
  })

  it("has no hash when failing before broadcast", () => {
    const s = run([{ type: "START" }, { type: "REQUEST_WALLET" }, { type: "FAIL", error: txError("rejected", "no") }])
    expect(s).toEqual({ status: "failed", error: txError("rejected", "no") })
    expect(isTxBroadcast(s)).toBe(false)
  })

  it("a post-mining signature request stays in syncing and keeps the hash", () => {
    const s = run([
      { type: "START" },
      { type: "REQUEST_WALLET" },
      { type: "BROADCAST", txHash: HASH },
      { type: "MINED" },
      { type: "REQUEST_SIGNATURE", note: "Confirming with server" },
    ])
    expect(s).toEqual({ status: "syncing", txHash: HASH, note: "Confirming with server" })
  })

  it("can retry after failure and reset from anywhere", () => {
    const failed = run([{ type: "START" }, { type: "FAIL", error: txError("server", "down") }])
    expect(txReducer(failed, { type: "START" }).status).toBe("preparing")
    expect(txReducer(failed, { type: "RESET" })).toBe(TX_IDLE)
    expect(txReducer(run([{ type: "START" }, { type: "REQUEST_WALLET" }]), { type: "RESET" })).toBe(TX_IDLE)
  })

  it("describes every status and reports progress", () => {
    expect(describeTx(TX_IDLE)).toBe("")
    expect(describeTx(run([{ type: "START" }, { type: "REQUEST_WALLET" }]))).toMatch(/wallet/i)
    expect(describeTx(run([{ type: "START", note: "Checking balance" }]))).toBe("Checking balance")
    expect(describeTx({ status: "failed", error: txError("server", "Server said no") })).toBe("Server said no")
    expect(txProgress(TX_IDLE)).toBe(0)
    expect(txProgress({ status: "succeeded" })).toBe(1)
    expect(txProgress({ status: "pending", txHash: HASH })).toBeGreaterThan(txProgress({ status: "awaitingWallet" }))
  })
})

describe("classifyTxError", () => {
  it("recognises a wallet rejection in every spelling", () => {
    expect(classifyTxError({ code: "ACTION_REJECTED", message: "user rejected action" }).kind).toBe("rejected")
    expect(classifyTxError({ code: 4001, message: "User denied transaction signature." }).kind).toBe("rejected")
    expect(classifyTxError({ info: { error: { code: 4001 } }, message: "x" }).kind).toBe("rejected")
    expect(classifyTxError(new Error("Transaction rejected by user")).kind).toBe("rejected")
    expect(classifyTxError({ code: "ACTION_REJECTED" }).retryable).toBe(true)
  })

  it("recognises missing gas", () => {
    expect(classifyTxError({ code: "INSUFFICIENT_FUNDS", message: "insufficient funds for gas" }).kind).toBe("insufficient_gas")
    expect(classifyTxError(new Error("insufficient funds for intrinsic transaction cost")).retryable).toBe(false)
  })

  it("maps contract revert reasons", () => {
    expect(classifyTxError(new Error('execution reverted: "Signature expired"')).kind).toBe("expired")
    expect(classifyTxError(new Error("execution reverted: Invalid nonce")).kind).toBe("nonce")
    expect(classifyTxError(new Error("Nonce mismatch! Expected 3, got 4")).kind).toBe("nonce")
    expect(classifyTxError(new Error("execution reverted: Invalid signature")).kind).toBe("reverted")
    expect(classifyTxError(new Error("UpgradeManager: sequential only")).message).toMatch(/one tier at a time/)
    expect(classifyTxError(new Error("OCXToken: Transfers are disabled")).kind).toBe("reverted")
    expect(classifyTxError({ code: "CALL_EXCEPTION", message: "missing revert data" }).kind).toBe("reverted")
  })

  it("recognises network trouble", () => {
    expect(classifyTxError(new TypeError("Failed to fetch")).kind).toBe("network")
    expect(classifyTxError({ code: "NETWORK_ERROR", message: "could not detect network" }).kind).toBe("network")
  })

  it("passes through already-classified errors and keeps unknown messages", () => {
    const e = txError("wallet_mismatch", "Wrong account")
    expect(classifyTxError(e)).toBe(e)
    expect(classifyTxError(new Error("Player not found"))).toEqual(txError("unknown", "Player not found", true))
    expect(classifyTxError(undefined, "Fallback").message).toBe("Fallback")
  })

  it("prefers the ethers shortMessage for display", () => {
    const err = { shortMessage: "Short and clear", message: "very long (action=..., data=...)" }
    expect(classifyTxError(err).message).toBe("Short and clear")
  })
})

describe("explorerTxUrl", () => {
  it("builds a URL for known chains and null otherwise", () => {
    expect(explorerTxUrl("0xabc", 11155111)).toBe("https://sepolia.etherscan.io/tx/0xabc")
    expect(explorerTxUrl("0xabc", 8453)).toBe("https://basescan.org/tx/0xabc")
    expect(explorerTxUrl("0xabc", 999999)).toBeNull()
    expect(explorerTxUrl("", 8453)).toBeNull()
  })
})
