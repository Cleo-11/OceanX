// @ts-ignore
import { io, type Socket } from "socket.io-client"

export interface GameState {
  sessionId: string
  players: Player[]
  resourceNodes: ResourceNode[]
  playerData: Player
}

export interface Player {
  walletAddress: string
  position: { x: number; y: number; rotation: number }
  submarine: number
  joinedAt: string
}

export interface ResourceNode {
  id: string
  position: { x: number; y: number }
  type: "nickel" | "cobalt" | "copper" | "manganese"
  amount: number
  depleted: boolean
  size: number
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

  // ✅ Fixed: Use process.env directly
  private getServerUrl(): string {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
  }

  connect(serverUrl?: string): Promise<void> {
    const url = serverUrl || this.getServerUrl()
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(url, {
          transports: ["websocket", "polling"],
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

  joinSession(walletAddress: string, sessionId: string): void {
    if (!this.socket) {
      throw new Error("WebSocket not connected")
    }
    this.socket.emit("join-session", { walletAddress, sessionId })
  }

  sendPlayerMove(position: { x: number; y: number; rotation: number }, walletAddress: string, sessionId: string): void {
    if (!this.socket) return
    this.socket.emit("player-move", { walletAddress, sessionId, position })
  }

  mineResource(nodeId: string): void {
    if (!this.socket) return
    this.socket.emit("mine-resource", { nodeId })
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
