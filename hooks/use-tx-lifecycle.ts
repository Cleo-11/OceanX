"use client"

import { useCallback, useRef, useState } from "react"
import { TX_IDLE, isTxBusy, txReducer, type TxEvent, type TxState } from "@/lib/state-machines/tx-lifecycle"

export interface TxLifecycleController {
  /** Current transaction state — drives rendering. */
  tx: TxState
  /**
   * Send an event. Returns `false` when the event is illegal from the current
   * status (e.g. START while a transaction is already in flight). Synchronous:
   * safe to use as a double-submit guard.
   */
  send: (event: TxEvent) => boolean
  /** Synchronous read of the latest state (for use inside async handlers). */
  current: () => TxState
  isBusy: boolean
}

/** React binding for the transaction lifecycle reducer. */
export function useTxLifecycle(): TxLifecycleController {
  const [tx, setTx] = useState<TxState>(TX_IDLE)
  const ref = useRef<TxState>(TX_IDLE)

  const send = useCallback((event: TxEvent): boolean => {
    const next = txReducer(ref.current, event)
    if (next === ref.current) return false
    ref.current = next
    setTx(next)
    return true
  }, [])

  const current = useCallback(() => ref.current, [])

  return { tx, send, current, isBusy: isTxBusy(tx) }
}
