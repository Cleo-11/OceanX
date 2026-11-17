/**
 * Game-server connection machine.
 *
 * socket.io reconnects on its own, but the UI used to learn about the socket
 * only once (on first connect), so a dropped connection kept showing
 * "connected". Feeding every socket lifecycle event through this table keeps
 * the HUD honest and makes "offline play" an explicit state, not an accident.
 *
 *   disconnected ─CONNECT─▶ connecting ─CONNECTED─▶ connected
 *        ▲                      │                      │
 *        └──────FAILED──────────┘                      │ DROPPED
 *        ▲                                             ▼
 *        └──────────GAVE_UP───────────────────── reconnecting ─CONNECTED─▶ connected
 */

import { createMachine } from "./machine"

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting"

export type ConnectionEvent =
  | "CONNECT"
  | "CONNECTED"
  | "FAILED"
  | "DROPPED"
  | "RETRYING"
  | "GAVE_UP"
  | "DISCONNECT"

export const connectionMachine = createMachine<ConnectionState, ConnectionEvent>({
  id: "connection",
  initial: "disconnected",
  states: {
    disconnected: { CONNECT: "connecting", CONNECTED: "connected", RETRYING: "reconnecting" },
    connecting: { CONNECTED: "connected", FAILED: "disconnected", DISCONNECT: "disconnected" },
    connected: { DROPPED: "reconnecting", DISCONNECT: "disconnected", FAILED: "disconnected" },
    reconnecting: {
      CONNECTED: "connected",
      GAVE_UP: "disconnected",
      FAILED: "disconnected",
      DISCONNECT: "disconnected",
    },
  },
})

export const CONNECTION_LABELS: Readonly<Record<ConnectionState, string | null>> = {
  connected: null,
  connecting: "Connecting to game server...",
  reconnecting: "Reconnecting to game server...",
  disconnected: "Playing offline",
}
