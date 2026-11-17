/**
 * Game action machine — the single source of truth for "what is the player
 * doing right now" on the game screen.
 *
 * One action at a time: every action starts from `idle`, so a trade cannot
 * start while a claim is awaiting the wallet, and a second click on the same
 * button is rejected synchronously instead of firing a duplicate request.
 *
 *   idle ──START_MINING────▶ mining ────SUCCEED──▶ resourceGained ─┐
 *        ──START_TRADING───▶ trading ───SUCCEED──▶ resourceTraded ─┤
 *        ──START_CLAIMING──▶ claiming ──SUCCEED──▶ claimed ────────┼─SETTLE─▶ idle
 *        ──START_UPGRADING─▶ upgrading ─SUCCEED──▶ upgraded ───────┤
 *        ──START_VOTING────▶ voting ────SUCCEED──▶ voteSubmitted ──┘
 *
 *   any in-flight state ──FAIL──▶ idle        any state ──RESET──▶ idle
 */

import type { GameState } from "@/lib/types"
import { createMachine } from "./machine"

export type GameActionEvent =
  | "START_MINING"
  | "START_TRADING"
  | "START_CLAIMING"
  | "START_UPGRADING"
  | "START_VOTING"
  | "SUCCEED"
  | "FAIL"
  | "SETTLE"
  | "RESET"

export const gameActionMachine = createMachine<GameState, GameActionEvent>({
  id: "gameAction",
  initial: "idle",
  states: {
    idle: {
      START_MINING: "mining",
      START_TRADING: "trading",
      START_CLAIMING: "claiming",
      START_UPGRADING: "upgrading",
      START_VOTING: "voting",
      RESET: "idle",
    },
    mining: { SUCCEED: "resourceGained", FAIL: "idle", RESET: "idle" },
    resourceGained: { SETTLE: "idle", RESET: "idle" },
    trading: { SUCCEED: "resourceTraded", FAIL: "idle", RESET: "idle" },
    resourceTraded: { SETTLE: "idle", RESET: "idle" },
    claiming: { SUCCEED: "claimed", FAIL: "idle", RESET: "idle" },
    claimed: { SETTLE: "idle", RESET: "idle" },
    voting: { SUCCEED: "voteSubmitted", FAIL: "idle", RESET: "idle" },
    voteSubmitted: { SETTLE: "idle", RESET: "idle" },
    upgrading: { SUCCEED: "upgraded", FAIL: "idle", RESET: "idle" },
    upgraded: { SETTLE: "idle", RESET: "idle" },
  },
})

/** States that only exist to show a success message before returning to idle. */
const SUCCESS_STATES: ReadonlySet<GameState> = new Set<GameState>([
  "resourceGained",
  "resourceTraded",
  "claimed",
  "voteSubmitted",
  "upgraded",
])

/** How long a success state stays on screen before auto-settling to idle. */
export const GAME_ACTION_SETTLE_MS = 2000

export function isSuccessState(state: GameState): boolean {
  return SUCCESS_STATES.has(state)
}

/** True while any action is in flight or its success message is showing. */
export function isGameBusy(state: GameState): boolean {
  return state !== "idle"
}

/** Default HUD copy for every state, so no state is ever silently unlabeled. */
export const GAME_STATE_LABELS: Readonly<Record<GameState, string | null>> = {
  idle: null,
  mining: "Mining in progress...",
  resourceGained: "Resource acquired!",
  trading: "Trading resource...",
  resourceTraded: "Resource traded successfully!",
  claiming: "Claiming OCX...",
  claimed: "OCX claimed to your wallet!",
  voting: "Submitting vote...",
  voteSubmitted: "Vote submitted!",
  upgrading: "Upgrading submarine...",
  upgraded: "Submarine upgraded successfully!",
}
