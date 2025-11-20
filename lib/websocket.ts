// @ts-ignore
import { io, type Socket } from "socket.io-client"

import { sanitizePlainText } from "./sanitize"

export interface GameState {
  sessionId: string
  players: Player[]
  resourceNodes: ResourceNode[]
  playerData: Player
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

export interface MineResourcePayload {
  nodeId: string
  sessionId: string
  walletAddress: string
  amount?: number
  resourceType?: ResourceNode["type"]
}

export interface JoinGamePayload {
  walletAddress: string
  sessionId?: string
  signature: string
  message: string
}

export class WebSocketManager {
  private static instance: WebSocketManager
  private socket: Socket | null = null
  private gameState: GameState | null = null
  private listeners: Map<string, Function[]> = new Map()

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
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(url, {
          transports: ["websocket"], // Disable polling for production
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5,
        })

        this.socket.on("connect", () => {
          console.log("Connected to game server")
          resolve()
        })

        this.socket.on("disconnect", () => {
          console.log("Disconnected from game server")
          this.emit("disconnected")
        })

        this.socket.on("error", (error: any) => {
          console.error("WebSocket error:", error)
          this.emit("error", error)
        })

        this.socket.on("game-state", (state: GameState) => {
          this.gameState = state
          this.emit("game-state", state)
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
      z: Number.isFinite(position.z ?? 0) ? Number(position.z) : 0,
    }
    console.log("Sending player move:", { walletAddress: sanitizedWallet, sessionId: sanitizedSession, position: sanitizedPosition })
    this.socket.emit("player-move", {
      walletAddress: sanitizedWallet,
      sessionId: sanitizedSession,
      position: sanitizedPosition,
    })
  }

  mineResource(payload: MineResourcePayload): void {
    if (!this.socket) return
    if (!payload?.nodeId || !payload?.walletAddress || !payload?.sessionId) {
      throw new Error("Invalid mine-resource payload")
    }
    const sanitizedPayload = {
      nodeId: sanitizePlainText(payload.nodeId, 128),
      sessionId: sanitizePlainText(payload.sessionId, 128),
      walletAddress: sanitizePlainText(payload.walletAddress, 64).toLowerCase(),
      resourceType: payload.resourceType,
      amount:
        typeof payload.amount === "number" && Number.isFinite(payload.amount)
          ? Math.max(1, Math.min(50, Math.floor(payload.amount)))
          : undefined,
    }
    this.socket.emit("mine-resource", sanitizedPayload)
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
