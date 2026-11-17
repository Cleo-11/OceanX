/**
 * Transaction lifecycle machine — one model for every wallet / on-chain flow
 * (claim OCX, submarine upgrade, marketplace trade).
 *
 * Before this, each screen tracked a transaction with its own mix of
 * `isLoading` booleans, status strings, step numbers and error strings, and
 * each re-implemented "did the user reject?" string matching. Players saw a
 * generic "Claiming..." for a flow that actually has five distinct waits.
 *
 *   idle ─START▶ preparing ─REQUEST_SIGNATURE▶ awaitingSignature ─AUTHORIZE▶ authorizing
 *                    │                                                         │
 *                    └────────────────REQUEST_WALLET───────────────────────────┤
 *                                                                              ▼
 *   succeeded ◀SUCCEED─ syncing ◀MINED─ pending ◀BROADCAST─────────────── awaitingWallet
 *                                         │  ▲
 *                                         └──┘ REQUEST_WALLET (next tx, e.g. approve → upgrade)
 *
 *   any in-flight state ─FAIL▶ failed (keeps txHash if one was broadcast)
 *   any state ─RESET▶ idle
 *
 * The state is a discriminated union, so `txHash` only exists once a tx has
 * actually been broadcast and `error` only exists in `failed` — impossible
 * combinations (an error *and* a success, a hash before signing) cannot be
 * represented.
 */

import { getChainConfig } from "@/lib/chain-config"

export type TxErrorKind =
  | "rejected" // user dismissed the wallet prompt
  | "insufficient_gas" // not enough native token for gas
  | "insufficient_balance" // not enough OCX / allowance
  | "wrong_network"
  | "wallet_mismatch" // connected account is not the player's account
  | "no_wallet"
  | "expired" // signature deadline passed
  | "nonce" // claim nonce out of sync
  | "settling" // a previous claim is still being finalised
  | "reverted" // contract rejected the call
  | "network" // RPC / fetch failure
  | "server" // backend returned an error
  | "unknown"

export interface TxError {
  kind: TxErrorKind
  /** Safe to show to the player as-is. */
  message: string
  /** Whether simply trying again can succeed without the player changing anything. */
  retryable: boolean
}

export type TxState =
  | { status: "idle" }
  | { status: "preparing"; note?: string }
  | { status: "awaitingSignature"; note?: string }
  | { status: "authorizing"; note?: string }
  | { status: "awaitingWallet"; note?: string }
  | { status: "pending"; txHash: string; note?: string }
  | { status: "syncing"; txHash?: string; note?: string }
  | { status: "succeeded"; txHash?: string; note?: string; warning?: string }
  | { status: "failed"; error: TxError; txHash?: string }

export type TxStatus = TxState["status"]

export type TxEvent =
  | { type: "START"; note?: string }
  | { type: "REQUEST_SIGNATURE"; note?: string }
  | { type: "AUTHORIZE"; note?: string }
  | { type: "REQUEST_WALLET"; note?: string }
  | { type: "BROADCAST"; txHash: string; note?: string }
  | { type: "MINED"; note?: string }
  | { type: "SUCCEED"; txHash?: string; note?: string; warning?: string }
  | { type: "FAIL"; error: TxError }
  | { type: "RESET" }

export const TX_IDLE: TxState = Object.freeze({ status: "idle" }) as TxState

/** Which events are legal from which status. Everything else is ignored. */
const ALLOWED: Readonly<Record<TxStatus, ReadonlyArray<TxEvent["type"]>>> = {
  idle: ["START"],
  preparing: ["REQUEST_SIGNATURE", "AUTHORIZE", "REQUEST_WALLET", "SUCCEED", "FAIL", "RESET"],
  awaitingSignature: ["AUTHORIZE", "REQUEST_WALLET", "SUCCEED", "FAIL", "RESET"],
  authorizing: ["REQUEST_SIGNATURE", "REQUEST_WALLET", "SUCCEED", "FAIL", "RESET"],
  awaitingWallet: ["BROADCAST", "FAIL", "RESET"],
  pending: ["MINED", "REQUEST_WALLET", "SUCCEED", "FAIL", "RESET"],
  syncing: ["REQUEST_SIGNATURE", "SUCCEED", "FAIL", "RESET"],
  succeeded: ["START", "RESET"],
  failed: ["START", "RESET"],
}

export function canSendTx(state: TxState, type: TxEvent["type"]): boolean {
  return ALLOWED[state.status].includes(type)
}

function withNote<T extends object>(base: T, note: string | undefined): T & { note?: string } {
  return note === undefined ? base : { ...base, note }
}

function knownHash(state: TxState): string | undefined {
  return "txHash" in state ? state.txHash : undefined
}

/**
 * Pure reducer. Returns the *same object* when the event is not legal from the
 * current status, so callers can detect a rejected event by identity.
 */
export function txReducer(state: TxState, event: TxEvent): TxState {
  if (!canSendTx(state, event.type)) return state

  switch (event.type) {
    case "START":
      return withNote({ status: "preparing" as const }, event.note)
    case "REQUEST_SIGNATURE": {
      const hash = knownHash(state)
      // After a tx is mined, a follow-up signature (backend confirmation) must
      // not lose the hash the player may want to look up.
      return withNote(
        hash ? { status: "syncing" as const, txHash: hash } : { status: "awaitingSignature" as const },
        event.note,
      )
    }
    case "AUTHORIZE":
      return withNote({ status: "authorizing" as const }, event.note)
    case "REQUEST_WALLET":
      return withNote({ status: "awaitingWallet" as const }, event.note)
    case "BROADCAST":
      return withNote({ status: "pending" as const, txHash: event.txHash }, event.note)
    case "MINED": {
      const hash = knownHash(state)
      return withNote(hash ? { status: "syncing" as const, txHash: hash } : { status: "syncing" as const }, event.note)
    }
    case "SUCCEED": {
      const hash = event.txHash ?? knownHash(state)
      let next: TxState = { status: "succeeded" }
      if (hash) next = { ...next, txHash: hash }
      if (event.note !== undefined) next = { ...next, note: event.note }
      if (event.warning !== undefined) next = { ...next, warning: event.warning }
      return next
    }
    case "FAIL": {
      const hash = knownHash(state)
      return hash
        ? { status: "failed", error: event.error, txHash: hash }
        : { status: "failed", error: event.error }
    }
    case "RESET":
      return TX_IDLE
  }
}

/** True while the flow is in flight and must not be started again. */
export function isTxBusy(state: TxState): boolean {
  return state.status !== "idle" && state.status !== "succeeded" && state.status !== "failed"
}

/**
 * True once funds may have moved on-chain. Past this point the UI must never
 * tell the player "nothing happened" and must always surface the tx hash.
 */
export function isTxBroadcast(state: TxState): boolean {
  return knownHash(state) !== undefined
}

const DEFAULT_LABELS: Readonly<Record<TxStatus, string>> = {
  idle: "",
  preparing: "Preparing...",
  awaitingSignature: "Sign the message in your wallet (free, no gas)...",
  authorizing: "Waiting for the game server...",
  awaitingWallet: "Confirm the transaction in your wallet...",
  pending: "Transaction submitted — waiting for the network...",
  syncing: "Confirmed on-chain — syncing your game...",
  succeeded: "Done!",
  failed: "Something went wrong",
}

/** Human-readable description of where the transaction is right now. */
export function describeTx(state: TxState): string {
  if (state.status === "failed") return state.error.message
  if ("note" in state && state.note) return state.note
  return DEFAULT_LABELS[state.status]
}

const PROGRESS: Readonly<Record<TxStatus, number>> = {
  idle: 0,
  preparing: 0.1,
  awaitingSignature: 0.2,
  authorizing: 0.35,
  awaitingWallet: 0.5,
  pending: 0.75,
  syncing: 0.9,
  succeeded: 1,
  failed: 0,
}

/** 0..1, for progress bars. */
export function txProgress(state: TxState): number {
  return PROGRESS[state.status]
}

// ---------------------------------------------------------------------------
// Error classification — one place that knows how wallets and RPCs spell things
// ---------------------------------------------------------------------------

export function txError(kind: TxErrorKind, message: string, retryable = false): TxError {
  return { kind, message, retryable }
}

function isTxError(value: unknown): value is TxError {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as TxError).kind === "string" &&
    typeof (value as TxError).message === "string" &&
    typeof (value as TxError).retryable === "boolean"
  )
}

function collectText(err: unknown): { code: string; text: string; display: string } {
  if (typeof err === "string") return { code: "", text: err.toLowerCase(), display: err }
  if (typeof err !== "object" || err === null) return { code: "", text: "", display: "" }

  const e = err as {
    code?: unknown
    message?: unknown
    shortMessage?: unknown
    reason?: unknown
    info?: { error?: { code?: unknown; message?: unknown } }
    error?: { code?: unknown; message?: unknown }
  }
  const parts = [e.shortMessage, e.reason, e.message, e.info?.error?.message, e.error?.message].filter(
    (p): p is string => typeof p === "string" && p.length > 0,
  )
  const codes = [e.code, e.info?.error?.code, e.error?.code]
    .filter((c) => c !== undefined && c !== null)
    .map((c) => String(c))
  return {
    code: codes.join(" "),
    text: parts.join(" | ").toLowerCase(),
    display: parts[0] ?? "",
  }
}

/**
 * Turn anything thrown by ethers, an injected wallet, fetch or our own code
 * into a player-facing error. Already-classified errors pass through.
 */
export function classifyTxError(err: unknown, fallbackMessage = "Something went wrong. Please try again."): TxError {
  if (isTxError(err)) return err

  const { code, text, display } = collectText(err)
  const has = (...needles: string[]) => needles.some((n) => text.includes(n))
  const codeHas = (...needles: string[]) => needles.some((n) => code.split(" ").includes(n))

  if (codeHas("ACTION_REJECTED", "4001") || has("user rejected", "user denied", "rejected by user", "request rejected")) {
    return txError("rejected", "You cancelled the request in your wallet, so nothing was sent.", true)
  }
  if (codeHas("INSUFFICIENT_FUNDS") || has("insufficient funds")) {
    return txError("insufficient_gas", "Not enough ETH in your wallet to pay the network (gas) fee.")
  }
  if (has("signature expired")) {
    return txError("expired", "The claim authorisation expired before it was confirmed. Please try again.", true)
  }
  if (has("invalid nonce", "nonce mismatch", "nonce too low")) {
    return txError("nonce", "Your claim is out of sync with the blockchain. Please wait a moment and try again.", true)
  }
  if (has("invalid signature", "claim already used")) {
    return txError("reverted", "The blockchain rejected this claim authorisation. Please try again.", true)
  }
  if (has("transfers are disabled")) {
    return txError("reverted", "On-chain OCX payments are not enabled for this contract yet.")
  }
  if (has("sequential only")) {
    return txError("reverted", "Submarines must be upgraded one tier at a time.")
  }
  if (has("insufficient claimable balance")) {
    return txError("reverted", "The OCX reward pool is temporarily empty. Please try again later.", true)
  }
  if (has("insufficient ocx", "insufficient allowance", "exceeds balance", "erc20insufficientbalance")) {
    return txError("insufficient_balance", display || "Not enough OCX for this action.")
  }
  if (codeHas("4902") || has("unrecognized chain", "wrong network", "unsupported chain", "network changed", "underlying network changed")) {
    return txError("wrong_network", "Your wallet is on the wrong network. Switch networks and try again.", true)
  }
  if (has("no web3 wallet", "metamask not installed", "wallet not connected", "no wallet")) {
    return txError("no_wallet", "No wallet connected. Connect MetaMask or WalletConnect and try again.", true)
  }
  if (codeHas("CALL_EXCEPTION") || has("call_exception", "missing revert data", "execution reverted", "estimategas")) {
    return txError("reverted", "The blockchain rejected this transaction, so it was not completed.", true)
  }
  if (codeHas("NETWORK_ERROR", "TIMEOUT", "SERVER_ERROR") || has("failed to fetch", "networkerror", "network error", "timeout")) {
    return txError("network", "Network problem while talking to the blockchain or game server. Please try again.", true)
  }

  return txError("unknown", display || fallbackMessage, true)
}

/** Block-explorer URL for a transaction, or null for an unknown chain. */
export function explorerTxUrl(txHash: string, chainId: number): string | null {
  const chain = getChainConfig(chainId)
  if (!chain || !txHash) return null
  return `${chain.blockExplorer.replace(/\/$/, "")}/tx/${txHash}`
}
