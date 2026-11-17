// @ts-ignore
import { io, type Socket } from "socket.io-client"

import { sanitizePlainText } from "./sanitize"
import type { ConnectionEvent } from "./state-machines/connection"

/**
 * Local event carrying socket lifecycle changes as `ConnectionEvent`s
 * (see lib/state-machines/connection.ts). Subscribe with
 * `wsManager.on(CONNECTION_STATUS_EVENT, handler)` *before* calling `connect()`.
 */
export const CONNECTION_STATUS_EVENT = "connection-status"

export interface GameState {
  sessionId: string
  players: Player[]
  /** The player's own deposits (server-authoritative). */
  resources?: ResourceNode[]
  resourceNodes?: ResourceNode[]
  playerData?: Player
  myPlayerId?: string
  /** Lets the client rejoin after a dropped connection without a new wallet prompt. */
  resumeToken?: string
}

export interface Player {
  walletAddress: string
  position: { x: number; y: number; rotation: number; z?: number }
  submarine: number
  joinedAt: string
}

export interface ResourceNode {
  id: string
  position: { x: number; y: number; z?: number }
  type: "nickel" | "cobalt" | "copper" | "manganese"
  amount: number
  depleted: boolean
  size: number
}

/** Server's answer to a mine request (server/lib/authoritativeMining.js). */
export interface MiningResult {
  success: boolean
  reason?: string
  message?: string
  nodeId?: string
  resourceType?: ResourceNode["type"]
  amount?: number
  remainingAmount?: number
  depleted?: boolean
  /** The player's new authoritative totals (on success). */
  resources?: { nickel: number; cobalt: number; copper: number; manganese: number }
  retryAfterMs?: number
  requestId?: string
}

export interface JoinGamePayload {
  walletAddress: string
  sessionId?: string
  signature: string
  message: string
}

/** Event emitted when the server refuses a join (e.g. expired resume token). */
export const JOIN_ERROR_EVENT = "join-error"

export class WebSocketManager {
  private static instance: WebSocketManager
  private socket: Socket | null = null
  private gameState: GameState | null = null
  private listeners: Map<string, Function[]> = new Map()
  private pendingMines: Map<string, (result: MiningResult) => void> = new Map()
  private mineSeq = 0
  /** Set from game-state; used to rejoin silently after socket.io reconnects. */
  private resume: { walletAddress: string; token: string } | null = null

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager()
    }
    return WebSocketManager.instance
  }

  // Use NEXT_PUBLIC_WS_URL if set, otherwise fallback to API URL
  private getServerUrl(): string {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (wsUrl) {
      console.log("WebSocket URL being used (env):", wsUrl);
      return wsUrl;
    }
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    const fallback = apiUrl.replace(/^http/, "ws");
    console.log("WebSocket URL being used (fallback):", fallback);
    return fallback;
  }

  connect(serverUrl?: string): Promise<void> {
    console.log("Attempting to connect to WebSocket...");
    const url = serverUrl || this.getServerUrl()

    // Never keep two sockets alive (e.g. React strict-mode remounts, or a
    // caller retrying connect()). The old socket's handlers are dropped with it.
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
    }

    return new Promise((resolve, reject) => {
      try {
        const socket: Socket = io(url, {
          transports: ["polling", "websocket"], // Start with polling, upgrade to websocket (required for Render proxy)
          upgrade: true,
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5,
        })
        this.socket = socket

        // Tracks whether this socket has ever been connected, so a failed
        // *first* attempt (FAILED) is told apart from a failed retry.
        let everConnected = false
        let initialFailureReported = false
        const status = (event: ConnectionEvent) => {
          // Ignore late events from a socket that has since been replaced.
          if (this.socket === socket) this.emit(CONNECTION_STATUS_EVENT, event)
        }

        socket.on("connect", () => {
          console.log("Connected to game server")
          const isReconnect = everConnected
          everConnected = true
          // The server forgets a player whose socket dropped; rejoin with the
          // resume token so the game keeps working without a wallet prompt.
          if (isReconnect && this.resume) {
            socket.emit("join-game", { walletAddress: this.resume.walletAddress, resumeToken: this.resume.token })
          }
          status("CONNECTED")
          resolve()
        })

        socket.on("disconnect", (reason: string) => {
          console.log("Disconnected from game server:", reason)
          // "io client disconnect" = we called disconnect(); anything else is a
          // drop that socket.io will try to recover from on its own.
          status(reason === "io client disconnect" ? "DISCONNECT" : "DROPPED")
          this.failPendingMines("disconnected", "Connection to the game server was lost. Try again in a moment.")
          this.emit("disconnected")
        })

        // Manager-level reconnection lifecycle
        socket.io.on("reconnect_attempt", () => status("RETRYING"))
        socket.io.on("reconnect_failed", () => {
          console.warn("Game server unreachable after retries; continuing offline")
          status("GAVE_UP")
        })

        this.socket.on("error", (error: any) => {
          console.error("WebSocket error:", error)
          this.emit("error", error)
        })

        this.socket.on("game-state", (state: GameState) => {
          this.gameState = state
          if (state?.resumeToken && state?.myPlayerId) {
            this.resume = { walletAddress: state.myPlayerId, token: state.resumeToken }
          }
          this.emit("game-state", state)
        })

        this.socket.on("mining-result", (result: MiningResult) => {
          const settle = result?.requestId ? this.pendingMines.get(result.requestId) : undefined
          if (settle) {
            this.pendingMines.delete(result.requestId!)
            settle(result)
          }
        })

        this.socket.on("resource-nodes", (data: { resources?: ResourceNode[] }) => {
          this.emit("resource-nodes", data)
        })

        this.socket.on(JOIN_ERROR_EVENT, (data: { code?: string; message?: string }) => {
          if (data?.code === "RESUME_INVALID") this.resume = null
          this.emit(JOIN_ERROR_EVENT, data)
        })

        this.socket.on("player-joined", (data: any) => {
          this.emit("player-joined", data)
        })

        this.socket.on("player-left", (data: any) => {
          this.emit("player-left", data)
        })

        this.socket.on("player-moved", (data: any) => {
          this.emit("player-moved", data)
        })

        this.socket.on("movement-rejected", (data: any) => {
          console.warn("⚠️ Movement rejected by server:", data.reason, data.details)
          this.emit("movement-rejected", data)
        })

        this.socket.on("resource-mined", (data: any) => {
          this.emit("resource-mined", data)
        })

        this.socket.on("connect_error", (error: unknown) => {
          console.error("Connection error:", error)
          // Report only the first failure: socket.io keeps retrying in the
          // background and those retries surface as RETRYING / GAVE_UP.
          if (!everConnected && !initialFailureReported) {
            initialFailureReported = true
            status("FAILED")
          }
          reject(error)
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  joinSession(payload: JoinGamePayload): void {
    if (!this.socket) {
      throw new Error("WebSocket not connected")
    }
    if (!payload?.walletAddress || !payload?.signature || !payload?.message) {
      throw new Error("Incomplete join-game payload: walletAddress, signature, and message are required")
    }

    const walletAddress = sanitizePlainText(payload.walletAddress, 64).toLowerCase()
    const sessionId = payload.sessionId ? sanitizePlainText(payload.sessionId, 128) : undefined
    const signature = sanitizePlainText(payload.signature, 512)
    const message = sanitizePlainText(payload.message, 2048)
    const signaturePreview = signature ? `${signature.slice(0, 10)}...` : undefined
    console.log(`[CLIENT] Emitting 'join-game' with payload:`, {
      walletAddress,
      sessionId,
      signaturePreview,
    })

    this.socket.emit("join-game", { walletAddress, sessionId, signature, message })
  }

  sendPlayerMove(position: { x: number; y: number; rotation: number; z?: number }, walletAddress: string, sessionId: string): void {
    if (!this.socket) return
    const sanitizedWallet = sanitizePlainText(walletAddress, 64).toLowerCase()
    const sanitizedSession = sanitizePlainText(sessionId, 128)
    const sanitizedPosition = {
      x: Number.isFinite(position.x) ? Number(position.x) : 0,
      y: Number.isFinite(position.y) ? Number(position.y) : 0,
      rotation: Number.isFinite(position.rotation) ? Number(position.rotation) : 0,
      // `position.z` is usually absent: Number(undefined) is NaN, which JSON
      // turns into null and the server then rejected every move.
      z: Number.isFinite(position.z) ? Number(position.z) : 0,
    }
    this.socket.emit("player-move", {
      walletAddress: sanitizedWallet,
      sessionId: sanitizedSession,
      position: sanitizedPosition,
    })
  }

  /**
   * Ask the server to mine a deposit. The server decides whether it is allowed
   * and how much it yields; resolves with its answer (never rejects).
   */
  requestMine(nodeId: string, timeoutMs = 8000): Promise<MiningResult> {
    if (!this.socket?.connected) {
      return Promise.resolve({
        success: false,
        reason: "disconnected",
        message: "Not connected to the game server. Reconnecting…",
      })
    }
    const requestId = `mine-${Date.now().toString(36)}-${++this.mineSeq}`
    return new Promise<MiningResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingMines.delete(requestId)
        resolve({ success: false, reason: "timeout", message: "The game server did not answer. Please try again." })
      }, timeoutMs)
      this.pendingMines.set(requestId, (result) => {
        clearTimeout(timer)
        resolve(result)
      })
      this.socket!.emit("mine-resource", { nodeId: sanitizePlainText(nodeId, 128), requestId })
    })
  }

  private failPendingMines(reason: string, message: string): void {
    const pending = Array.from(this.pendingMines.values())
    this.pendingMines.clear()
    pending.forEach((settle) => settle({ success: false, reason, message }))
  }

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  off(event: string, callback: Function): void {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      const index = eventListeners.indexOf(callback)
      if (index > -1) {
        eventListeners.splice(index, 1)
      }
    }
  }

  private emit(event: string, data?: any): void {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach((callback) => callback(data))
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.failPendingMines("disconnected", "Disconnected from the game server.")
    this.resume = null
    this.gameState = null
    this.listeners.clear()
  }

  getGameState(): GameState | null {
    return this.gameState
  }

  isConnected(): boolean {
    return this.socket?.connected || false
  }
}

export const wsManager = WebSocketManager.getInstance()
