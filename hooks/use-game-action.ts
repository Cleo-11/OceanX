"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { GameState } from "@/lib/types"
import {
  GAME_ACTION_SETTLE_MS,
  gameActionMachine,
  isSuccessState,
  type GameActionEvent,
} from "@/lib/state-machines/game-action"

export interface GameActionController {
  /** Current state — drives rendering. */
  state: GameState
  /**
   * Send an event. Returns `true` if it caused a transition and `false` if it
   * was ignored (illegal from the current state). The check is synchronous —
   * it reads a ref, not React state — so two clicks in the same tick cannot
   * both start an action.
   */
  send: (event: GameActionEvent) => boolean
}

/**
 * React binding for `gameActionMachine`.
 *
 * Owns the one timer that returns a success state to `idle`, and cancels it on
 * every transition and on unmount, so a stale timer can never reset a newer
 * action (previously a finished "mining" timeout could flip an in-flight claim
 * back to idle and re-enable its button).
 */
export function useGameAction(): GameActionController {
  const [state, setState] = useState<GameState>(gameActionMachine.initial)
  const stateRef = useRef<GameState>(gameActionMachine.initial)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearSettleTimer = useCallback(() => {
    if (settleTimer.current !== null) {
      clearTimeout(settleTimer.current)
      settleTimer.current = null
    }
  }, [])

  const send = useCallback(
    (event: GameActionEvent): boolean => {
      const current = stateRef.current
      if (!gameActionMachine.can(current, event)) return false

      const next = gameActionMachine.transition(current, event)
      clearSettleTimer()
      stateRef.current = next
      setState(next)

      if (isSuccessState(next)) {
        settleTimer.current = setTimeout(() => {
          settleTimer.current = null
          if (stateRef.current === next) {
            const settled = gameActionMachine.transition(next, "SETTLE")
            stateRef.current = settled
            setState(settled)
          }
        }, GAME_ACTION_SETTLE_MS)
      }
      return true
    },
    [clearSettleTimer],
  )

  useEffect(() => clearSettleTimer, [clearSettleTimer])

  return { state, send }
}
