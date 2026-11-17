"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { PlayerHUD } from "./player-hud"
// import { Compass } from "./compass"
import { SonarRadar } from "./sonar-radar"
import { ResourceSidebar } from "./resource-sidebar"
import { MineButton } from "./mine-button"
import { UpgradeModal } from "./upgrade-modal"
import { StorageFullAlert } from "./storage-full-alert"
import { EnergyDepletedAlert } from "./energy-depleted-alert"
import { apiClient, type SubmarineUpgradeResult } from "@/lib/api"
import { walletManager } from "@/lib/wallet"
import { wsManager, JOIN_ERROR_EVENT, type MiningResult } from "@/lib/websocket"
import { createJoinSignaturePayload } from "@/lib/signature"
import { ContractManager } from "@/lib/contracts"
import { ethers } from "ethers"
import { getSubmarineByTier } from "@/lib/submarine-tiers"
import { canMineResource, getStoragePercentage, getResourceColor } from "@/lib/resource-utils"
import type { GameState, ResourceNode, PlayerStats, PlayerResources, PlayerPosition } from "@/lib/types"
import type {
  AquaticState,
  ScreenShake,
  ColorGrade,
  ParticleBurst,
  MovementKeys,
  ConnectionStatus,
} from "@/lib/game-types"
import { ScubaDiverGuide } from "./ScubaDiverGuide"
import { GAME_STATE_LABELS, type GameActionEvent } from "@/lib/state-machines/game-action"
import { CONNECTION_LABELS, connectionMachine, type ConnectionEvent } from "@/lib/state-machines/connection"
import { classifyTxError, describeTx, explorerTxUrl, txError, type TxError } from "@/lib/state-machines/tx-lifecycle"
import { useTxLifecycle } from "@/hooks/use-tx-lifecycle"
import { CONNECTION_STATUS_EVENT } from "@/lib/websocket"
import { loadGameState, setupAutoSave, clearGameState, getDefaultGameState } from "@/lib/gameStateStorage"
import { getCurrentUser } from "@/lib/supabase"

interface OceanMiningGameProps {
  walletConnected: boolean
  gameState: GameState
  /**
   * Dispatch an event to the game action machine (lib/state-machines/game-action).
   * Returns false when the event is not legal from the current state — use the
   * return value of a START_* event as the re-entrancy guard for that action.
   */
  sendGameEvent: (event: GameActionEvent) => boolean
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void
  onFullDisconnect: () => void // NEW PROP
  // onConnectWallet?: () => void // (Deprecated) no longer used; game runs without wallet
  // Optional: notify parent whenever the in-session resource totals change
  onResourcesChange?: (resources: PlayerResources) => void
  // Optional: initial resources from database
  initialResources?: PlayerResources
  // Tutorial completion status from database
  hasCompletedTutorial?: boolean
  // Optional: initial wallet address from server auth
  initialWalletAddress?: string
  // Optional: initial OCX balance from database (avoids Express API dependency)
  initialBalance?: number
  // Optional: initial submarine tier from database (avoids Express API dependency)
  initialTier?: number
}

/** Non-blocking in-HUD message (replaces window.alert, which froze the game loop). */
interface GameNotice {
  tone: "success" | "error" | "info"
  message: string
  /** Block-explorer link for the related transaction, when there is one. */
  txUrl?: string | null
}

const NOTICE_DURATION_MS: Record<GameNotice["tone"], number> = {
  success: 6000,
  info: 6000,
  error: 10000,
}

/** Position updates to the game server: at most this often while moving. */
const MOVE_SEND_INTERVAL_MS = 150

/** Player-facing text for a refused mine (server reason codes). */
const MINING_FAILURE_TEXT: Record<string, string> = {
  out_of_range: "Move closer to the deposit to mine it.",
  storage_full: "Your hold is full for this resource. Trade resources to make space.",
  node_depleted: "That deposit is depleted.",
  node_not_found: "That deposit is gone. Find another one nearby.",
  cooldown: "Your drill is cooling down.",
  position_unknown: "Syncing your position with the server. Try again in a second.",
  not_joined: "Reconnecting to the game server. Try again in a moment.",
  disconnected: "Not connected to the game server. Reconnecting…",
  timeout: "The game server did not answer. Please try again.",
}

/** Reuse a wallet auth signature for follow-up calls while it is comfortably fresh. */
const AUTH_SIGNATURE_REUSE_MS = 3 * 60 * 1000

// ── Build submarine SVG string (pixel-identical to SubmarineIcon.tsx) ────────
function buildSubmarineSVG(tier: number, color: string): string {
  const highlight = `<path d="M22 24 Q50 18 82 24" stroke="rgba(255,255,255,0.35)" stroke-width="1.2" fill="none" stroke-linecap="round"/>`
  const tower = (y = 14, w = 10, h = 12) =>
    `<rect x="${48 - w / 2}" y="${y}" width="${w}" height="${h}" rx="2" fill="${color}" stroke="rgba(0,0,0,0.3)" stroke-width="0.6"/>`
  const viewport = (cx = 68, cy = 30, r = 4.5) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#vp)" stroke="rgba(0,40,60,0.6)" stroke-width="0.8"/>` +
    `<circle cx="${cx - 1}" cy="${cy - 1}" r="${r * 0.45}" fill="rgba(255,255,255,0.35)"/>`
  const propeller = (x = 10) =>
    `<g transform="translate(${x}, 30)"><ellipse rx="2" ry="7" fill="rgba(80,80,100,0.7)"/><circle r="2" fill="rgba(60,60,80,0.8)"/></g>`
  let body = ''
  switch (tier) {
    case 1:  body = `<g><path d="M14 30 Q14 18 30 16 L72 16 Q88 18 88 30 Q88 42 72 44 L30 44 Q14 42 14 30Z" fill="${color}" stroke="rgba(0,0,0,0.25)" stroke-width="1"/>${highlight}${tower()}${viewport()}${propeller()}</g>`; break
    case 2:  body = `<g><path d="M12 30 Q12 17 32 15 L74 15 Q90 17 90 30 Q90 43 74 45 L32 45 Q12 43 12 30Z" fill="${color}" stroke="rgba(0,0,0,0.25)" stroke-width="1"/><path d="M52 15 L56 6 L60 15" fill="${color}" stroke="rgba(0,0,0,0.2)" stroke-width="0.7"/>${highlight}${tower(8,12,10)}${viewport()}${propeller()}<path d="M12 22 L6 16 L6 44 L12 38" fill="${color}" stroke="rgba(0,0,0,0.2)" stroke-width="0.5"/></g>`; break
    case 3:  body = `<g><path d="M12 30 Q12 16 34 14 L70 14 Q90 16 90 30 Q90 44 70 46 L34 46 Q12 44 12 30Z" fill="${color}" stroke="rgba(0,0,0,0.3)" stroke-width="1.2"/><line x1="35" y1="14" x2="35" y2="46" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/><line x1="55" y1="14" x2="55" y2="46" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>${highlight}${tower(10,12,10)}${viewport()}${propeller()}<path d="M30 46 L70 46 L65 50 L35 50Z" fill="${color}" stroke="rgba(0,0,0,0.2)" stroke-width="0.5" opacity="0.7"/></g>`; break
    case 4:  body = `<g><path d="M12 28 Q12 14 34 12 L72 12 Q92 14 92 28 Q92 42 72 44 L34 44 Q12 42 12 28Z" fill="${color}" stroke="rgba(0,0,0,0.3)" stroke-width="1.2"/><rect x="32" y="44" width="36" height="8" rx="3" fill="${color}" stroke="rgba(0,0,0,0.25)" stroke-width="0.8" opacity="0.85"/><line x1="44" y1="44" x2="44" y2="52" stroke="rgba(0,0,0,0.15)" stroke-width="0.6"/><line x1="56" y1="44" x2="56" y2="52" stroke="rgba(0,0,0,0.15)" stroke-width="0.6"/>${highlight}${tower(6,14,10)}${viewport(72,28)}${viewport(62,28,3)}${propeller()}</g>`; break
    case 5:  body = `<g><ellipse cx="50" cy="30" rx="44" ry="22" fill="url(#heatGlow)" opacity="0.4"/><path d="M14 30 Q14 16 34 14 L72 14 Q88 16 88 30 Q88 44 72 46 L34 46 Q14 44 14 30Z" fill="${color}" stroke="rgba(0,0,0,0.3)" stroke-width="1.2"/><path d="M30 16 L30 44" stroke="rgba(255,100,0,0.25)" stroke-width="2"/><path d="M50 15 L50 45" stroke="rgba(255,100,0,0.25)" stroke-width="2"/><path d="M70 16 L70 44" stroke="rgba(255,100,0,0.25)" stroke-width="2"/>${highlight}${tower(8,12,10)}${viewport()}${propeller()}</g>`; break
    case 6:  body = `<g><path d="M10 30 Q10 14 34 12 L72 12 Q92 14 92 30 Q92 46 72 48 L34 48 Q10 46 10 30Z" fill="${color}" stroke="rgba(0,0,0,0.3)" stroke-width="1.5"/><ellipse cx="32" cy="30" rx="4" ry="15" fill="none" stroke="rgba(0,255,255,0.2)" stroke-width="1.2"/><ellipse cx="50" cy="30" rx="4" ry="16" fill="none" stroke="rgba(0,255,255,0.2)" stroke-width="1.2"/><ellipse cx="68" cy="30" rx="4" ry="15" fill="none" stroke="rgba(0,255,255,0.2)" stroke-width="1.2"/>${highlight}${tower(6,14,10)}${viewport(76,30)}${propeller(8)}</g>`; break
    case 7:  body = `<g><ellipse cx="50" cy="30" rx="46" ry="24" fill="url(#energyField)" opacity="0.3"/><path d="M12 30 Q12 15 38 12 L68 12 Q88 12 92 26 L92 30 Q92 45 68 48 L38 48 Q12 45 12 30Z" fill="${color}" stroke="rgba(0,255,255,0.3)" stroke-width="1"/><path d="M38 12 L34 30 L38 48" stroke="rgba(0,255,255,0.25)" stroke-width="0.8" fill="none"/><path d="M68 12 L72 30 L68 48" stroke="rgba(0,255,255,0.25)" stroke-width="0.8" fill="none"/>${highlight}<path d="M44 12 L48 4 L56 4 L60 12" fill="${color}" stroke="rgba(0,255,255,0.3)" stroke-width="0.7"/>${viewport(78,28,4)}${propeller(8)}<circle cx="30" cy="22" r="1.2" fill="#67e8f9" opacity="0.8"/><circle cx="70" cy="38" r="1" fill="#67e8f9" opacity="0.6"/></g>`; break
    case 8:  body = `<g><path d="M10 30 Q10 12 36 10 L70 10 Q92 10 94 26 L94 34 Q92 50 70 50 L36 50 Q10 48 10 30Z" fill="${color}" stroke="rgba(0,0,0,0.35)" stroke-width="1.5"/><rect x="25" y="12" width="22" height="36" rx="1" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1"/><rect x="50" y="11" width="22" height="38" rx="1" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1"/><path d="M20 20 Q50 14 85 20" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M20 22 Q50 16 85 22" stroke="rgba(255,255,255,0.15)" stroke-width="0.8" fill="none" stroke-linecap="round"/>${tower(4,16,10)}${viewport(80,28,5)}${viewport(70,28,3.5)}${propeller(6)}</g>`; break
    case 9:  body = `<g><path d="M6 30 Q6 10 34 8 L72 8 Q96 10 96 30 Q96 50 72 52 L34 52 Q6 50 6 30Z" fill="${color}" stroke="rgba(0,0,0,0.35)" stroke-width="1.8"/><line x1="30" y1="10" x2="30" y2="50" stroke="rgba(255,255,255,0.1)" stroke-width="1"/><line x1="50" y1="9" x2="50" y2="51" stroke="rgba(255,255,255,0.1)" stroke-width="1"/><line x1="70" y1="10" x2="70" y2="50" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>${highlight}${tower(2,18,10)}${viewport(80,26,5.5)}${viewport(80,38,4)}${propeller(4)}<path d="M30 52 L70 52 L65 56 L35 56Z" fill="${color}" opacity="0.6"/></g>`; break
    case 10: body = `<g><path d="M8 30 Q8 10 34 8 L72 8 Q94 10 94 30 Q94 50 72 52 L34 52 Q8 50 8 30Z" fill="${color}" stroke="rgba(0,0,0,0.35)" stroke-width="1.8"/><rect x="24" y="4" width="8" height="8" rx="1.5" fill="rgba(100,100,120,0.8)" stroke="rgba(0,0,0,0.3)" stroke-width="0.7"/><rect x="24" y="2" width="8" height="3" rx="1" fill="rgba(80,80,100,0.7)"/><rect x="64" y="4" width="8" height="8" rx="1.5" fill="rgba(100,100,120,0.8)" stroke="rgba(0,0,0,0.3)" stroke-width="0.7"/><rect x="64" y="2" width="8" height="3" rx="1" fill="rgba(80,80,100,0.7)"/><path d="M20 18 Q50 12 84 18" stroke="rgba(255,255,255,0.2)" stroke-width="1.2" fill="none"/>${tower(0,16,8)}${viewport(82,26,5)}${propeller(4)}</g>`; break
    case 11: body = `<g><path d="M14 30 Q14 14 36 12 L70 12 Q90 14 90 30 Q90 46 70 48 L36 48 Q14 46 14 30Z" fill="${color}" stroke="rgba(0,0,0,0.3)" stroke-width="1.2"/><path d="M30 48 Q26 54 22 56 Q20 58 24 56 Q28 54 32 50" stroke="${color}" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M50 48 Q48 56 44 58 Q42 60 46 58 Q50 54 52 50" stroke="${color}" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M68 48 Q66 54 62 56 Q60 58 64 56 Q68 52 70 48" stroke="${color}" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M36 12 Q40 8 50 7 Q60 8 64 12" fill="${color}" stroke="rgba(0,0,0,0.2)" stroke-width="0.7"/>${highlight}${viewport(76,30,5)}${propeller(10)}</g>`; break
    case 12: body = `<g><ellipse cx="50" cy="30" rx="48" ry="26" fill="url(#voidAura)" opacity="0.5"/><path d="M12 30 Q12 13 36 10 L70 10 Q90 13 90 30 Q90 47 70 50 L36 50 Q12 47 12 30Z" fill="${color}" stroke="rgba(168,85,247,0.4)" stroke-width="1.2"/><ellipse cx="50" cy="30" rx="30" ry="14" fill="rgba(168,85,247,0.08)"/><path d="M24 22 Q50 16 80 22" stroke="rgba(168,85,247,0.3)" stroke-width="1" fill="none"/><path d="M42 10 L46 2 L58 2 L62 10" fill="${color}" stroke="rgba(168,85,247,0.3)" stroke-width="0.7"/>${viewport(78,28,5)}${propeller(8)}</g>`; break
    case 13: body = `<g><ellipse cx="50" cy="30" rx="46" ry="24" fill="url(#starGlow)" opacity="0.3"/><path d="M12 30 Q12 14 36 12 L70 12 Q90 14 90 30 Q90 46 70 48 L36 48 Q12 46 12 30Z" fill="${color}" stroke="rgba(0,0,0,0.3)" stroke-width="1.2"/><polygon points="50,4 52,10 58,10 53,14 55,20 50,16 45,20 47,14 42,10 48,10" fill="#fef08a" opacity="0.8"/>${highlight}${viewport(76,28,5)}${propeller(8)}</g>`; break
    case 14: body = `<g><ellipse cx="50" cy="30" rx="48" ry="10" fill="none" stroke="rgba(168,85,247,0.3)" stroke-width="1" transform="rotate(-12 50 30)"/><ellipse cx="50" cy="30" rx="44" ry="8" fill="none" stroke="rgba(168,85,247,0.2)" stroke-width="0.7" transform="rotate(8 50 30)"/><path d="M10 30 Q10 12 36 10 L70 10 Q92 12 92 30 Q92 48 70 50 L36 50 Q10 48 10 30Z" fill="${color}" stroke="rgba(168,85,247,0.4)" stroke-width="1.2"/>${highlight}<path d="M42 10 L44 0 L56 0 L58 10" fill="${color}" stroke="rgba(168,85,247,0.35)" stroke-width="0.7"/>${viewport(80,28,5.5)}${propeller(6)}</g>`; break
    case 15: body = `<g><ellipse cx="50" cy="30" rx="50" ry="28" fill="url(#leviathanAura)" opacity="0.3"/><path d="M4 30 Q4 8 32 6 L74 6 Q98 8 98 30 Q98 52 74 54 L32 54 Q4 52 4 30Z" fill="${color}" stroke="rgba(0,0,0,0.4)" stroke-width="2"/><polygon points="40,6 42,0 44,6" fill="rgba(255,255,255,0.7)"/><polygon points="48,6 50,-2 52,6" fill="rgba(255,255,255,0.85)"/><polygon points="56,6 58,0 60,6" fill="rgba(255,255,255,0.7)"/>${viewport(70,24,5)}${viewport(82,24,5)}${viewport(76,36,4)}<path d="M18 18 Q50 10 88 18" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" fill="none" stroke-linecap="round"/>${propeller(2)}<path d="M28 54 L72 54 L66 58 L34 58Z" fill="${color}" opacity="0.5"/></g>`; break
    default: body = `<g><path d="M14 30 Q14 18 30 16 L72 16 Q88 18 88 30 Q88 42 72 44 L30 44 Q14 42 14 30Z" fill="${color}" stroke="rgba(0,0,0,0.25)" stroke-width="1"/>${highlight}${viewport()}${propeller()}</g>`
  }
  return `<svg width="100" height="60" viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg" fill="none"><defs><radialGradient id="vp" cx="35%" cy="35%"><stop offset="0%" stop-color="#a5f3fc" stop-opacity="0.95"/><stop offset="50%" stop-color="#22d3ee" stop-opacity="0.7"/><stop offset="100%" stop-color="#0e7490" stop-opacity="0.4"/></radialGradient><radialGradient id="heatGlow" cx="50%" cy="50%"><stop offset="0%" stop-color="#f97316" stop-opacity="0.5"/><stop offset="100%" stop-color="#f97316" stop-opacity="0"/></radialGradient><radialGradient id="energyField" cx="50%" cy="50%"><stop offset="0%" stop-color="#22d3ee" stop-opacity="0.4"/><stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/></radialGradient><radialGradient id="voidAura" cx="50%" cy="50%"><stop offset="0%" stop-color="#a855f7" stop-opacity="0.35"/><stop offset="100%" stop-color="#a855f7" stop-opacity="0"/></radialGradient><radialGradient id="starGlow" cx="50%" cy="50%"><stop offset="0%" stop-color="#fef08a" stop-opacity="0.4"/><stop offset="100%" stop-color="#fef08a" stop-opacity="0"/></radialGradient><radialGradient id="leviathanAura" cx="50%" cy="50%"><stop offset="0%" stop-color="#7e22ce" stop-opacity="0.35"/><stop offset="70%" stop-color="#7e22ce" stop-opacity="0.1"/><stop offset="100%" stop-color="#7e22ce" stop-opacity="0"/></radialGradient></defs>${body}</svg>`
}

export function OceanMiningGame({
  walletConnected,
  gameState,
  sendGameEvent,
  sidebarOpen,
  setSidebarOpen,
  onFullDisconnect, // NEW PROP
  // onConnectWallet removed
  onResourcesChange,
  initialResources,
  hasCompletedTutorial = false,
  initialWalletAddress = "",
  initialBalance = 0,
  initialTier = 1,
}: OceanMiningGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameLoopRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  // Server position sync: last time a move was sent, and the latest position
  // (read by socket handlers, which are registered once and would otherwise
  // see a stale value).
  const lastMoveSentRef = useRef<number>(0)
  const playerPositionRef = useRef<PlayerPosition>({ x: 500, y: 500, rotation: 0 })
  const subImgCacheRef = useRef<Record<string, HTMLImageElement>>({})

  // --- CINEMATIC FEEDBACK STATE ---
  const [screenShake, setScreenShake] = useState<ScreenShake>({ 
    active: false, 
    intensity: 0, 
    duration: 0, 
    time: 0 
  })
  const [colorGrade, setColorGrade] = useState<ColorGrade>({ 
    active: false, 
    tint: '#0ea5e9', 
    opacity: 0.0, 
    duration: 0, 
    time: 0 
  })
  const [particleBursts, setParticleBursts] = useState<ParticleBurst[]>([])

  // --- CINEMATIC FEEDBACK UTILS ---

  // Player position and movement
  const [playerPosition, setPlayerPosition] = useState<PlayerPosition>({ x: 500, y: 500, rotation: 0 })
  playerPositionRef.current = playerPosition
  const [movementKeys, setMovementKeys] = useState<MovementKeys>({
    forward: false,
    backward: false,
    left: false,
    right: false,
  })

  // Player stats and resources
  const [playerTier, setPlayerTier] = useState<number>(initialTier)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  sessionIdRef.current = sessionId
  // Joining the game server: the ocean has no deposits until it answers.
  const [world, setWorld] = useState<
    | { status: "idle" | "signing" | "joining" | "ready" }
    | { status: "error"; message: string }
  >({ status: "idle" })
  const joinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current)
  }, [])
  // Multiplayer disabled: Only single player state is used
  // const [otherPlayers, setOtherPlayers] = useState<OtherPlayer[]>([])
  const [walletAddress, setWalletAddress] = useState<string>(initialWalletAddress)
  // CRITICAL FIX: Recalculate submarine data whenever playerTier changes
  const submarineData = useMemo(() => getSubmarineByTier(playerTier), [playerTier])

  const [playerStats, setPlayerStats] = useState<PlayerStats>({
    ...submarineData.baseStats,
    energy: submarineData.baseStats.energy, // Start at max energy
    capacity: {
      nickel: 0,
      cobalt: 0,
      copper: 0,
      manganese: 0,
    },
  })

  // Keep playerStats in sync when tier changes (e.g. restored from DB on login)
  useEffect(() => {
    const newSubData = getSubmarineByTier(playerTier)
    setPlayerStats((prev) => ({
      ...prev,
      ...newSubData.baseStats,
      energy: prev.energy, // preserve current energy
      capacity: prev.capacity, // preserve current cargo
      maxCapacity: newSubData.baseStats.maxCapacity,
      tier: playerTier,
    }))
  }, [playerTier])

  const [resources, setResources] = useState<PlayerResources>({
    nickel: initialResources?.nickel ?? 0,
    cobalt: initialResources?.cobalt ?? 0,
    copper: initialResources?.copper ?? 0,
    manganese: initialResources?.manganese ?? 0,
  })

  // Notify parent when resources change (lightweight autosave hook)
  useEffect(() => {
    if (onResourcesChange) {
      onResourcesChange(resources)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources])

  const [balance, setBalance] = useState<number>(initialBalance)
  const [showUpgradeModal, setShowUpgradeModal] = useState<boolean>(false)
  const [targetNode, setTargetNode] = useState<ResourceNode | null>(null)
  const [resourceNodes, setResourceNodes] = useState<ResourceNode[]>([])
  const [showStorageAlert, setShowStorageAlert] = useState<boolean>(false)
  const [storagePercentage, setStoragePercentage] = useState<number>(0)
  const [showEnergyAlert, setShowEnergyAlert] = useState<boolean>(false)
  const [viewportOffset, setViewportOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected")
  // All connection changes go through the connection machine so the HUD can
  // never claim "connected" after the socket has dropped.
  const sendConnectionEvent = useCallback((event: ConnectionEvent) => {
    setConnectionStatus((prev) => connectionMachine.transition(prev, event))
  }, [])

  // Wallet / on-chain progress of the action in flight (claim or upgrade).
  // The game action machine guarantees there is only ever one.
  const actionTx = useTxLifecycle()
  const [actionChainId, setActionChainIdState] = useState<number | null>(null)
  const actionChainIdRef = useRef<number | null>(null)
  const setActionChainId = useCallback((chainId: number | null) => {
    actionChainIdRef.current = chainId
    setActionChainIdState(chainId)
  }, [])

  // Close the upgrade modal when the "upgraded" success state settles to idle
  const prevGameStateRef = useRef<GameState>(gameState)
  useEffect(() => {
    if (prevGameStateRef.current === "upgraded" && gameState === "idle") {
      setShowUpgradeModal(false)
    }
    prevGameStateRef.current = gameState
  }, [gameState])

  const [notice, setNotice] = useState<GameNotice | null>(null)
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showNotice = useCallback((next: GameNotice) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    setNotice(next)
    noticeTimerRef.current = setTimeout(() => {
      noticeTimerRef.current = null
      setNotice(null)
    }, NOTICE_DURATION_MS[next.tone])
  }, [])
  const dismissNotice = useCallback(() => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = null
    setNotice(null)
  }, [])
  useEffect(
    () => () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    },
    [],
  )
  const [showGuide, setShowGuide] = useState<boolean>(!hasCompletedTutorial);
  const [userId, setUserId] = useState<string | null>(null);

  // --- AQUATIC FEATURE STATE ---
  const [aquaticState] = useState<AquaticState>(() => {
    // Sunlight rays
    const sunRays = Array.from({ length: 6 }, () => ({
      x: Math.random() * window.innerWidth,
      width: 80 + Math.random() * 60,
      opacity: 0.10 + Math.random() * 0.10,
      speed: 0.4 + Math.random() * 0.4,
    }))
    // No kelp, seaweed, bubbles, or coral/flowers
    const seaweed: never[] = []
    const kelp: never[] = []
    const coral: never[] = []
    const fish = Array.from({ length: 10 }, () => ({
      x: Math.random() * window.innerWidth,
      y: 100 + Math.random() * (window.innerHeight - 200),
      size: 12 + Math.random() * 8,
      speed: 0.7 + Math.random() * 0.7,
      direction: Math.random() > 0.5 ? 1 : -1,
      opacity: 0.5 + Math.random() * 0.5,
      swimOffset: Math.random() * Math.PI * 2,
    }))
    const bubbles: never[] = []
    const particles = Array.from({ length: 30 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      speedX: (Math.random() - 0.5) * 0.3,
      speedY: (Math.random() - 0.5) * 0.3,
      opacity: 0.2 + Math.random() * 0.3,
      life: 100,
    }))
    return { sunRays, seaweed, kelp, coral, fish, bubbles, particles }
  })

  // Generate initial resource nodes immediately when component mounts
  // Restore backend and database connectivity, but keep multiplayer visuals disabled
  useEffect(() => {
    // Deposits come from the game server (game-state), which owns them: they
    // are no longer generated in the browser, where a reload produced a fresh
    // set and mined amounts were whatever the client said.

    // Load userId and restore game state from localStorage
    const initGameState = async () => {
      try {
        const { user } = await getCurrentUser();
        if (user) {
          setUserId(user.id);
          
          // Try to load saved game state from localStorage
          const savedState = loadGameState(user.id);
          if (savedState) {
            console.log("✅ Restored game state from localStorage:", savedState);
            setPlayerPosition({
              x: savedState.position.x,
              y: savedState.position.y,
              rotation: 0,
            });
            setPlayerStats((prev) => ({
              ...prev,
              energy: savedState.energy,
              health: savedState.hull,
            }));
            // sessionId is assigned by the server on join, never restored.
          } else {
            console.log("ℹ️ No saved game state found, using defaults");
            const defaults = getDefaultGameState();
            setPlayerPosition({ x: defaults.position.x, y: defaults.position.y, rotation: 0 });
          }
        }
      } catch (error) {
        console.error("Failed to load game state:", error);
      }
    };
    
    initGameState();
    
    const init = async () => {
      try {
        sendConnectionEvent("CONNECT");
        // Subscribe before connecting so no socket lifecycle event is missed
        // (drops and reconnects keep arriving for the life of the socket).
        wsManager.on(CONNECTION_STATUS_EVENT, sendConnectionEvent);
        await wsManager.connect();
        // Only listen for resource/game state and player data, not multiplayer events
        wsManager.on("game-state", handleGameState);
        wsManager.on("resource-nodes", handleResourceNodes);
        wsManager.on("movement-rejected", handleMovementRejected);
        wsManager.on(JOIN_ERROR_EVENT, handleJoinError);
        wsManager.on("error", handleWebSocketError);
        // After a page reload the wallet connection is not cached yet:
        // restore it (silently when the site is already authorised) instead
        // of skipping the join, which left the ocean empty with no message.
        let connection = walletManager.getConnection();
        if (!connection) {
          try {
            connection = await walletManager.ensureConnected();
          } catch (connectErr) {
            console.warn("[OceanMiningGame] Wallet not available:", connectErr);
          }
        }
        if (connection) {
          setWalletAddress(connection.address);
          await joinWorld(connection.address);
          loadPlayerData(connection.address).catch((err) => console.error("Failed to load player data:", err));
        } else {
          setWorld({ status: "error", message: "Connect your wallet to load the ocean." });
        }
        sendConnectionEvent("CONNECTED");
      } catch (error) {
        console.error("Failed to initialize game:", error);
        sendConnectionEvent("FAILED");
      }
    };
    if (walletConnected) {
      init();
    }
    return () => {
      // Leaving the game screen: stop listening and close the socket so a
      // later visit starts from a clean "disconnected" state instead of
      // stacking a second socket and duplicate handlers.
      wsManager.off(CONNECTION_STATUS_EVENT, sendConnectionEvent);
      wsManager.off("game-state", handleGameState);
      wsManager.off("resource-nodes", handleResourceNodes);
      wsManager.off("movement-rejected", handleMovementRejected);
      wsManager.off(JOIN_ERROR_EVENT, handleJoinError);
      wsManager.off("error", handleWebSocketError);
      wsManager.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletConnected]);

  // SubmarineStore auto-open removed (store is now a dedicated route)

  // Setup auto-save for game state to localStorage
  useEffect(() => {
    if (!userId) return;

    const getGameState = () => ({
      position: { x: playerPosition.x, y: playerPosition.y, z: 0 },
      energy: playerStats.energy,
      hull: playerStats.health,
      sessionId: sessionId || "global",
    });

    const cleanup = setupAutoSave(userId, getGameState);
    console.log("✅ Auto-save enabled for user:", userId);

    return () => {
      cleanup();
      console.log("ℹ️ Auto-save disabled");
    };
  }, [userId, playerPosition.x, playerPosition.y, playerStats.energy, playerStats.health, sessionId]);

  /**
   * Join the game server with a signed join message (one wallet prompt).
   * The server expects the JSON message from createJoinSignaturePayload; the
   * plain-text message used before was always rejected, so the game never
   * actually joined and ran entirely in the browser. After a dropped
   * connection the socket rejoins with a resume token, without a prompt.
   */
  /**
   * Sign in to the game server and wait for the world, reporting each step
   * on screen. Deposits only exist once the server has sent them.
   */
  const joinWorld = async (address: string) => {
    if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current)
    setWorld({ status: "signing" })
    try {
      await signAndJoin(address)
    } catch (err: any) {
      const rejected = err?.code === 4001 || err?.code === "ACTION_REJECTED" || /reject|denied/i.test(String(err?.message))
      setWorld({
        status: "error",
        message: rejected
          ? "The sign-in request was declined. Sign it to load the ocean."
          : "Could not sign in to the game server.",
      })
      return
    }
    setWorld((prev) => (prev.status === "ready" ? prev : { status: "joining" }))
    joinTimeoutRef.current = setTimeout(() => {
      joinTimeoutRef.current = null
      setWorld((prev) =>
        prev.status === "ready"
          ? prev
          : { status: "error", message: "The game server did not respond. It may be waking up — try again in a moment." },
      )
    }, 20000)
  }

  const retryJoin = async () => {
    try {
      const connection = walletManager.getConnection() ?? (await walletManager.ensureConnected())
      if (!wsManager.isConnected()) {
        await wsManager.connect()
      }
      await joinWorld(connection.address)
    } catch (err) {
      console.error("Retry join failed:", err)
      setWorld({ status: "error", message: "Could not reach the game server. Check your connection and try again." })
    }
  }

  const signAndJoin = async (address: string) => {
    const payload = createJoinSignaturePayload(address)
    const signature = await walletManager.signMessage(payload.message)
    wsManager.joinSession({
      walletAddress: address,
      sessionId: payload.session,
      message: payload.message,
      signature,
    })
  }

  /** Send the current position to the server (throttled unless forced). */
  const syncPositionToServer = (position: PlayerPosition, force = false) => {
    const connection = walletManager.getConnection()
    if (!connection || !wsManager.isConnected()) return
    const nowMs = Date.now()
    if (!force && nowMs - lastMoveSentRef.current < MOVE_SEND_INTERVAL_MS) return
    if (nowMs - lastMoveSentRef.current < 20) return // server minimum interval
    lastMoveSentRef.current = nowMs
    wsManager.sendPlayerMove(position, connection.address, sessionIdRef.current || "auto")
  }

  const cleanup = () => {
    wsManager.disconnect()
    sendConnectionEvent("DISCONNECT")
    setSessionId(null)
    // Clear saved game state from localStorage on disconnect
    if (userId) {
      clearGameState(userId);
      console.log("🗑️ Cleared game state from localStorage");
    }
    // Note: Multiplayer disabled - no other players to clear
    // Don't clear resource nodes on cleanup - keep them for offline play
  }

  const loadPlayerData = async (walletAddress: string) => {
    try {
      let balanceLoaded = false
      
      // Try Express server API first
      try {
        const balancePayload = await createSignaturePayload(
          walletAddress,
          "get balance",
        )
        // Load player balance
        const balanceResponse = await apiClient.getPlayerBalance(walletAddress, balancePayload.signature, balancePayload.message)
        if (balanceResponse.success && balanceResponse.data) {
          // Prefer 'balance' (total_ocx_earned) over legacy 'coins' field
          const ocxValue = Number.parseFloat(balanceResponse.data.balance) || 0
          if (Number.isFinite(ocxValue) && ocxValue > 0) {
            setBalance(ocxValue)
            balanceLoaded = true
          }
        }
      } catch (apiErr) {
        console.warn("Express API balance fetch failed, falling back to Supabase:", apiErr)
      }

      // Fallback: fetch total_ocx_earned directly from Supabase
      if (!balanceLoaded) {
        try {
          const { supabase } = await import("@/lib/supabase")
          const { data: player } = await supabase
            .from("players")
            .select("total_ocx_earned")
            .ilike("wallet_address", walletAddress)
            .single()
          if (player?.total_ocx_earned) {
            const dbOcx = Number(player.total_ocx_earned) || 0
            if (dbOcx > 0) {
              setBalance(dbOcx)
              console.log("✅ Balance loaded from Supabase fallback:", dbOcx)
            }
          }
        } catch (dbErr) {
          console.warn("Supabase balance fallback also failed:", dbErr)
        }
      }

      const submarinePayload = await createSignaturePayload(
        walletAddress,
        "get submarine",
      )
      // Load player submarine info
      const submarineResponse = await apiClient.getPlayerSubmarine(walletAddress, submarinePayload.signature, submarinePayload.message)
      if (submarineResponse.success && submarineResponse.data) {
        const { current: currentSubmarine } = submarineResponse.data
        setPlayerTier(currentSubmarine.id)
        setPlayerStats({
          health: 100, // Default health
          energy: submarineData.baseStats.energy, // Ensure energy is max on load
          capacity: {
            nickel: 0,
            cobalt: 0,
            copper: 0,
            manganese: 0,
          },
          // Per-resource limits for the tier — the same table the game server
          // enforces. (The single `storage` figure is the nickel limit; using
          // it for every resource let the HUD promise space the server refuses.)
          maxCapacity: { ...getSubmarineByTier(currentSubmarine.id).baseStats.maxCapacity },
          depth: 0, // Default depth
          speed: currentSubmarine.speed,
          miningRate: currentSubmarine.miningPower,
          tier: currentSubmarine.id,
        })
      }
    } catch (error) {
      console.error("Failed to load player data:", error)
    }
  }

  // WebSocket event handlers
  const handleGameState = (state: any) => {
    console.log("Received game state:", state);

    if (typeof state?.sessionId === "string") {
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current)
        joinTimeoutRef.current = null
      }
      setWorld({ status: "ready" })
      setSessionId(state.sessionId)
      sessionIdRef.current = state.sessionId
      // The server needs a position before it allows mining.
      syncPositionToServer(playerPositionRef.current, true)
    }
    
    // Handle resource nodes
    if (state.resources && state.resources.length > 0) {
      setResourceNodes(state.resources);
    } else if (state.resourceNodes && state.resourceNodes.length > 0) {
      setResourceNodes(state.resourceNodes);
    }
    
    // Handle players - map server player format to OtherPlayer format
    if (state.players && Array.isArray(state.players)) {
      const currentWalletAddress = walletManager.getConnection()?.address;
      console.log("Current wallet address:", currentWalletAddress);
      console.log("All players in state:", state.players);
      
      // Restore submarine tier from server game-state for the current player
      if (currentWalletAddress) {
        const myPlayer = state.players.find(
          (p: any) => p.id?.toLowerCase() === currentWalletAddress.toLowerCase()
        );
        if (myPlayer?.submarineTier && myPlayer.submarineTier > 1) {
          console.log("✅ Restoring submarine tier from game-state:", myPlayer.submarineTier);
          setPlayerTier(myPlayer.submarineTier);
        }
      }
      
      // Note: Multiplayer disabled - otherPlayersData computed but not used
      
    }
  }

  // Multiplayer disabled: no other players to add

  // Multiplayer disabled: no other players to remove

  // Multiplayer disabled: no other players to update

  // Depleted deposits were replaced by the server.
  const handleResourceNodes = (data: { resources?: ResourceNode[] }) => {
    if (Array.isArray(data?.resources)) setResourceNodes(data.resources)
  }

  // The server refused a move (too fast / teleport): snap back to its position
  // so the client and server agree again (mining range is checked server-side).
  const handleMovementRejected = (data: any) => {
    const p = data?.currentPosition
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return
    setPlayerPosition((prev) => {
      const next = { ...prev, x: p.x, y: p.y }
      playerPositionRef.current = next
      return next
    })
  }

  // The resume token was refused after a reconnect: sign in again (one prompt).
  const handleJoinError = (data: { code?: string; message?: string }) => {
    const connection = walletManager.getConnection()
    if (data?.code === "RESUME_INVALID" && connection) {
      joinWorld(connection.address)
      return
    }
    if (joinTimeoutRef.current) {
      clearTimeout(joinTimeoutRef.current)
      joinTimeoutRef.current = null
    }
    setWorld({ status: "error", message: `The game server refused the sign-in${data?.message ? `: ${data.message}` : "."}` })
  }

  const handleWebSocketError = (error: any) => {
    console.error("WebSocket error:", error)
    sendConnectionEvent("FAILED")
  }

  // Update storage percentage when resources change
  useEffect(() => {
    const percentage = getStoragePercentage(resources, playerStats)
    setStoragePercentage(percentage)

    if (percentage >= 90 && percentage < 100) {
      setShowStorageAlert(true)
      setTimeout(() => setShowStorageAlert(false), 5000)
    }
  }, [resources, playerStats])

  // Check for energy depletion
  useEffect(() => {
    if (playerStats.energy <= 0) {
      setShowEnergyAlert(true)
      // Hide alert after 5 seconds
      setTimeout(() => setShowEnergyAlert(false), 5000)
    }
  }, [playerStats.energy])

  // Energy regeneration over time
  useEffect(() => {
    if (playerStats.energy > 0) return; // Only start regen when energy is 0
    // Calculate fill time in seconds for this tier
    const minFill = 20 * 60 // 20 min
    const maxFill = 45 * 60 // 45 min
    const tier = submarineData.baseStats.tier
    const fillTime = minFill + ((maxFill - minFill) * (tier - 1) / 14) // linear interpolation
    const regenRate = submarineData.baseStats.energy / fillTime // energy per second

    const energyRegenInterval = setInterval(() => {
      setPlayerStats((prev) => {
        const maxEnergy = submarineData.baseStats.energy
        if (prev.energy < maxEnergy) {
          return {
            ...prev,
            energy: Math.min(prev.energy + regenRate, maxEnergy),
          }
        }
        return prev;
      })
    }, 1000)
    return () => clearInterval(energyRegenInterval)
  }, [playerStats.energy, submarineData.baseStats.energy, submarineData.baseStats.tier])

  // Handle keyboard input for submarine movement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow movement even when not connected to server
      if (!walletConnected) return

      switch (e.key.toLowerCase()) {
        case "w":
        case "arrowup":
          setMovementKeys((prev) => ({ ...prev, forward: true }))
          break
        case "s":
        case "arrowdown":
          setMovementKeys((prev) => ({ ...prev, backward: true }))
          break
        case "a":
        case "arrowleft":
          setMovementKeys((prev) => ({ ...prev, left: true }))
          break
        case "d":
        case "arrowright":
          setMovementKeys((prev) => ({ ...prev, right: true }))
          break
        case "f":
          if (targetNode) handleMine(targetNode)
          break
        case "u":
          setShowUpgradeModal(true)
          break
        // case "p": submarine store removed from game page
        case "i":
          setSidebarOpen((prev) => !prev)
          break
        // case "p": // open store (removed: store is a dedicated route now)
        //   break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case "w":
        case "arrowup":
          setMovementKeys((prev) => ({ ...prev, forward: false }))
          break
        case "s":
        case "arrowdown":
          setMovementKeys((prev) => ({ ...prev, backward: false }))
          break
        case "a":
        case "arrowleft":
          setMovementKeys((prev) => ({ ...prev, left: false }))
          break
        case "d":
        case "arrowright":
          setMovementKeys((prev) => ({ ...prev, right: false }))
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [walletConnected, targetNode, setSidebarOpen])

  // Game loop - runs even when not connected to server for offline play
  useEffect(() => {
    if (!walletConnected) return

    const gameLoop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp
      // Capped: after a background tab resumes, one huge frame would jump the
      // submarine far enough for the server to reject it as a teleport.
      const deltaTime = Math.min(timestamp - lastTimeRef.current, 50)
      lastTimeRef.current = timestamp

      if (gameState !== "mining") {
        updatePlayerPosition(deltaTime)
      }

      checkNearbyNodes()
      renderGame()

      gameLoopRef.current = requestAnimationFrame(gameLoop)
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop)

    return () => {
      cancelAnimationFrame(gameLoopRef.current)
    }
  }, [walletConnected, playerPosition, movementKeys, gameState, resourceNodes, playerStats.speed, playerTier])

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const handleResize = () => {
      if (canvas) {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Preload submarine SVG image for the current tier into cache
  useEffect(() => {
    const cacheKey = `${playerTier}-${submarineData.color}`
    if (subImgCacheRef.current[cacheKey]) return
    const svgStr = buildSubmarineSVG(playerTier, submarineData.color)
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new window.Image()
    img.onload = () => {
      subImgCacheRef.current[cacheKey] = img
      URL.revokeObjectURL(url)
    }
    img.src = url
  }, [playerTier, submarineData.color])

  const updatePlayerPosition = (deltaTime: number) => {
    if (playerStats.energy === 0) return; // Block movement when energy is 0
    const speed = playerStats.speed * 0.2 * (deltaTime / 16)
    let newX = playerPosition.x
    let newY = playerPosition.y
    let newRotation = playerPosition.rotation

    if (movementKeys.left) {
      newRotation -= 0.05
    }
    if (movementKeys.right) {
      newRotation += 0.05
    }
    if (movementKeys.forward) {
      newX += Math.cos(newRotation) * speed
      newY += Math.sin(newRotation) * speed
    }
    if (movementKeys.backward) {
      newX -= Math.cos(newRotation) * speed
      newY -= Math.sin(newRotation) * speed
    }

    newX = Math.max(50, Math.min(1950, newX))
    newY = Math.max(50, Math.min(1950, newY))

    const newPosition = { x: newX, y: newY, rotation: newRotation }
    const moved = newX !== playerPosition.x || newY !== playerPosition.y || newRotation !== playerPosition.rotation
    setPlayerPosition(newPosition)
    playerPositionRef.current = newPosition

    // Position updates to the server (throttled): it checks mining range
    // against the position it last accepted.
    if (moved && connectionStatus === "connected" && sessionId) {
      syncPositionToServer(newPosition)
    }

    const canvas = canvasRef.current
    if (canvas) {
      setViewportOffset({
        x: newX - canvas.width / 2,
        y: newY - canvas.height / 2,
      })
    }
  }

  const checkNearbyNodes = () => {
    const nearbyNode = resourceNodes.find((node) => {
      if (node.depleted) return false

      const dx = node.position.x - playerPosition.x
      const dy = node.position.y - playerPosition.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      return distance < 60
    })

    setTargetNode(nearbyNode || null)
  }

  // ...existing code...

  const renderGame = () => {
    try {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      const time = Date.now() / 1000

    // --- SCREEN SHAKE ---
    let shakeX = 0, shakeY = 0
    if (screenShake.active) {
      const shake = screenShake.intensity * Math.sin(screenShake.time * 40 + Math.random() * 10)
      shakeX = shake * (Math.random() - 0.5)
      shakeY = shake * (Math.random() - 0.5)
      // Use functional update to avoid stale closure
      setScreenShake((prev) => {
        const newTime = prev.time + 0.016
        if (newTime > prev.duration) {
          return { ...prev, active: false, intensity: 0, duration: 0, time: 0 }
        }
        return { ...prev, time: newTime }
      })
    }
    ctx.save()
    ctx.translate(shakeX, shakeY)

  // --- OCEAN GRADIENT BACKGROUND ---
  // Modern ocean gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
  gradient.addColorStop(0, "#0f172a")
  gradient.addColorStop(0.2, "#164e63")
  gradient.addColorStop(0.5, "#2563eb")
  gradient.addColorStop(0.8, "#38bdf8")
  gradient.addColorStop(1, "#a5f3fc")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)
    // --- PARTICLE BURSTS ---
    setParticleBursts((prev: typeof particleBursts) => prev.map((burst) => {
      burst.particles.forEach((p: typeof burst.particles[0]) => {
        p.x += p.vx
        p.y += p.vy
        p.life -= 1
      })
      burst.particles = burst.particles.filter((p: typeof burst.particles[0]) => p.life > 0)
      return burst
    }).filter((b) => b.particles.length > 0))
    particleBursts.forEach((burst) => {
      burst.particles.forEach((p) => {
        ctx.save()
        ctx.globalAlpha = Math.max(0, p.life / 30)
        ctx.fillStyle = burst.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })
    })
    ctx.restore() // end screen shake
    // --- COLOR GRADING OVERLAY ---
    if (colorGrade.active) {
      ctx.save()
      ctx.globalAlpha = colorGrade.opacity
      ctx.fillStyle = colorGrade.tint
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.restore()
      setColorGrade((prev) => {
        const newTime = prev.time + 0.016
        if (newTime > prev.duration) {
          return { ...prev, active: false, opacity: 0, duration: 0, time: 0 }
        }
        return { ...prev, time: newTime }
      })
    }
  // Example: trigger effects on mining (replace with actual event hooks)
  // useEffect(() => { triggerScreenShake(); triggerColorGrade(); triggerParticleBurst(300, 300); }, [])

    // --- SUNLIGHT RAYS ---
    aquaticState.sunRays.forEach((ray) => {
      ctx.save()
      ctx.globalAlpha = ray.opacity * (0.7 + 0.3 * Math.sin(time * ray.speed))
      const rayGradient = ctx.createLinearGradient(ray.x, 0, ray.x, canvas.height)
      rayGradient.addColorStop(0, "rgba(255, 255, 255, 0.18)")
      rayGradient.addColorStop(0.5, "rgba(255, 255, 255, 0.07)")
      rayGradient.addColorStop(1, "rgba(255, 255, 255, 0)")
      ctx.fillStyle = rayGradient
      ctx.fillRect(ray.x - ray.width / 2, 0, ray.width, canvas.height)
      ctx.restore()
    })

    // --- SEAWEED ---
  // No seaweed

    // --- KELP ---
  // No kelp

    // --- CORAL ---
  // No coral/flower features

    // --- FISH ---
    aquaticState.fish.forEach((f) => {
      f.x += f.speed * f.direction
      f.y += Math.sin(time * 2 + f.swimOffset) * 0.5
      if (f.direction > 0 && f.x > canvas.width + f.size) {
        f.x = -f.size
      } else if (f.direction < 0 && f.x < -f.size) {
        f.x = canvas.width + f.size
      }
      ctx.save()
      ctx.globalAlpha = f.opacity
      ctx.fillStyle = "#1e293b"
      ctx.save()
      ctx.translate(f.x, f.y)
      ctx.scale(f.direction, 1)
      ctx.beginPath()
      ctx.ellipse(0, 0, f.size, f.size * 0.6, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(-f.size, 0)
      ctx.lineTo(-f.size * 1.5, -f.size * 0.3)
      ctx.lineTo(-f.size * 1.5, f.size * 0.3)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
      ctx.restore()
    })

    // --- BUBBLES ---
  // No bubbles

    // --- WATER PARTICLES ---
    aquaticState.particles.forEach((particle) => {
      particle.x += particle.speedX
      particle.y += particle.speedY
      particle.life -= 0.5
      if (particle.life <= 0) {
        particle.x = Math.random() * canvas.width
        particle.y = Math.random() * canvas.height
        particle.life = 100
      }
      ctx.save()
      ctx.globalAlpha = particle.opacity * (particle.life / 100)
      ctx.fillStyle = "rgba(173, 216, 230, 0.4)"
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, 1.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    })

    // Draw grid
    ctx.strokeStyle = "#1e40af30"
    ctx.lineWidth = 1
    const gridSize = 100
    const offsetX = -viewportOffset.x % gridSize
    const offsetY = -viewportOffset.y % gridSize

    for (let x = offsetX; x < canvas.width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvas.height)
      ctx.stroke()
    }

    for (let y = offsetY; y < canvas.height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width, y)
      ctx.stroke()
    }

    // Draw resource nodes as colored circles
    let visibleNodes = 0
    resourceNodes.forEach((node) => {
      drawResourceNode(ctx, node, viewportOffset, targetNode)
    })

    // Debug info for resource nodes
    if (resourceNodes.length > 0) {
      ctx.fillStyle = "#00ff00"
      ctx.font = "12px Arial"
      ctx.fillText(`Nodes: ${resourceNodes.length} | Visible: ${visibleNodes}`, 10, 30)
    }

  // Multiplayer disabled: no other players to draw

    // Draw player submarine
    const screenX = playerPosition.x - viewportOffset.x
    const screenY = playerPosition.y - viewportOffset.y
  drawSubmarine(ctx, screenX, screenY, playerPosition.rotation, submarineData.color, playerTier, movementKeys.forward)

    // Draw bubbles if moving
    if (movementKeys.forward || movementKeys.backward) {
      for (let i = 0; i < 3; i++) {
        const bubbleX = screenX - Math.cos(playerPosition.rotation) * 30 + (Math.random() - 0.5) * 20
        const bubbleY = screenY - Math.sin(playerPosition.rotation) * 30 + (Math.random() - 0.5) * 20
        const bubbleSize = Math.random() * 5 + 2

        ctx.fillStyle = "#7dd3fc60"
        ctx.beginPath()
        ctx.arc(bubbleX, bubbleY, bubbleSize, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    } catch (error) {
      console.error("Render error:", error);
      // Graceful degradation - continue rendering on next frame
    }
  }

  // Modular submarine drawing with shadow, highlight, and engine glow
  const drawSubmarine = (ctx: CanvasRenderingContext2D, x: number, y: number, rotation: number, color: string, tier: number, movingForward: boolean) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rotation)
    
    // Scale factor to make submarines larger on canvas (SVG uses size 40, we want ~80-100 on canvas)
    const size = 80
    
    // Draw submarine using preloaded SVG image (exact replica of SubmarineIcon.tsx)
    const cacheKey = `${tier}-${color}`
    const cachedImg = subImgCacheRef.current[cacheKey]
    if (cachedImg && cachedImg.complete) {
      ctx.drawImage(cachedImg, -50, -30, 100, 60)
    } else {
      // Fallback while image loads (simple hull shape)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.ellipse(0, 0, 38, 18, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#7dd3fc'
      ctx.beginPath()
      ctx.arc(18, 0, 6, 0, Math.PI * 2)
      ctx.fill()
    }
    
    // Engine glow when moving (positioned behind submarine based on tier size)
    if (movingForward) {
      ctx.save()
      ctx.globalAlpha = 0.45 + 0.15 * Math.sin(Date.now() / 120)
      const engineX = tier >= 9 ? -size*0.55 : -size*0.45 // Adjust for larger submarines
      ctx.beginPath()
      ctx.ellipse(engineX, 0, 16, 8, 0, 0, Math.PI * 2)
      ctx.fillStyle = tier >= 5 ? '#fbbf24' : tier >= 3 ? '#f97316' : '#22d3ee'
      ctx.shadowColor = ctx.fillStyle
      ctx.shadowBlur = 16
      ctx.fill()
      ctx.restore()
    }
    
    ctx.restore()
  }

  // Modular resource node drawing with glow, shading, and info
  const drawResourceNode = (
    ctx: CanvasRenderingContext2D,
    node: ResourceNode,
    viewportOffset: { x: number; y: number },
    targetNode: ResourceNode | null
  ) => {
    if (node.depleted) return
    const screenX = node.position.x - viewportOffset.x
    const screenY = node.position.y - viewportOffset.y
    // Only render nodes that are visible on screen
    if (screenX > -100 && screenX < ctx.canvas.width + 100 && screenY > -100 && screenY < ctx.canvas.height + 100) {
      const resourceColor = getResourceColor(node.type)
      const nodeSize = node.size || 20
      // HSL shifting glow
      const hue = (Date.now() / 30 + node.position.x) % 360
      ctx.save()
      ctx.globalAlpha = 0.7
      const grad = ctx.createRadialGradient(screenX, screenY, nodeSize * 0.5, screenX, screenY, nodeSize * 1.2)
      grad.addColorStop(0, `hsl(${hue}, 90%, 70%)`)
      grad.addColorStop(1, `hsl(${hue}, 90%, 40%, 0)`)
      ctx.beginPath()
      ctx.arc(screenX, screenY, nodeSize * 1.2, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()
      // 3D shading
      const lightAngle = Math.sin(Date.now() / 1200)
      const grad2 = ctx.createRadialGradient(
        screenX + nodeSize * 0.3 * lightAngle,
        screenY - nodeSize * 0.3 * lightAngle,
        nodeSize * 0.2,
        screenX,
        screenY,
        nodeSize
      )
      grad2.addColorStop(0, `hsl(${hue}, 100%, 90%)`)
      grad2.addColorStop(1, `hsl(${hue}, 80%, 40%)`)
      ctx.beginPath()
      ctx.arc(screenX, screenY, nodeSize, 0, Math.PI * 2)
      ctx.fillStyle = grad2
      ctx.fill()
      ctx.restore()
      // Add subtle pulsing effect
      const pulseSize = nodeSize + Math.sin(Date.now() / 1000) * 2
      ctx.strokeStyle = resourceColor + "AA"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(screenX, screenY, pulseSize, 0, Math.PI * 2)
      ctx.stroke()
      // Draw resource type indicator
      ctx.fillStyle = "#ffffff"
      ctx.font = "bold 14px Arial"
      ctx.textAlign = "center"
      ctx.shadowColor = "#000000"
      ctx.shadowBlur = 2
      ctx.fillText(getResourceEmoji(node.type), screenX, screenY + 4)
      ctx.shadowBlur = 0
      // Highlight target node
      if (targetNode && node.id === targetNode.id) {
        ctx.strokeStyle = "#ffffff"
        ctx.lineWidth = 3
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        ctx.arc(screenX, screenY, nodeSize + 8, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
        // Show resource info
        ctx.fillStyle = "#ffffff"
        ctx.font = "bold 12px Arial"
        ctx.textAlign = "center"
        ctx.shadowColor = "#000000"
        ctx.shadowBlur = 2
        ctx.fillText(
          `${node.type.charAt(0).toUpperCase() + node.type.slice(1)} (${node.amount})`,
          screenX,
          screenY - nodeSize - 15,
        )
        ctx.shadowBlur = 0
      }
    }
  }

  const handleMine = async (node: ResourceNode) => {
    if (!walletConnected || !targetNode) return

    // Quick local check so a full hold answers instantly. The server makes the
    // real decision (range, capacity, deposit amount) below.
    const { canMine } = canMineResource(playerStats, resources, node.type, node.amount)
    if (!canMine) {
      if (gameState !== "idle") return
      setShowStorageAlert(true)
      setTimeout(() => setShowStorageAlert(false), 2000)
      return
    }

    // Mining is decided and saved by the game server; without a connection
    // nothing would be saved, so do not pretend.
    if (connectionStatus !== "connected" || !sessionId) {
      if (gameState === "idle") {
        showNotice({ tone: "info", message: MINING_FAILURE_TEXT.disconnected })
      }
      return
    }

    // Single entry point for mining: ignored unless the game is idle. The
    // check is synchronous, so key-repeat on "F" cannot start a second mine.
    if (!sendGameEvent("START_MINING")) return

    // Make sure the server has our latest position before it checks range
    // (socket.io keeps order, so this move is processed first).
    syncPositionToServer(playerPositionRef.current, true)

    let result: MiningResult
    try {
      result = await wsManager.requestMine(node.id)
    } catch (error) {
      console.error("Mining failed:", error)
      result = { success: false, reason: "error", message: "Mining failed. Please try again." }
    }

    if (!result.success) {
      if (result.reason === "storage_full") {
        setShowStorageAlert(true)
        setTimeout(() => setShowStorageAlert(false), 2000)
      } else {
        showNotice({
          tone: result.reason === "cooldown" ? "info" : "error",
          message: (result.reason && MINING_FAILURE_TEXT[result.reason]) || result.message || "Mining failed.",
        })
      }
      if (result.reason === "node_depleted" || result.reason === "node_not_found") {
        setResourceNodes((prev) =>
          prev.map((n) => (n.id === node.id ? { ...n, amount: 0, depleted: true } : n)),
        )
      }
      sendGameEvent("FAIL")
      return
    }

    // Render the server's numbers: authoritative totals and deposit state.
    if (result.resources) {
      setResources(result.resources)
    }
    const minedType = result.resourceType ?? node.type
    const minedAmount = result.amount ?? 0
    setPlayerStats((prev) => ({
      ...prev,
      energy: Math.max(prev.energy - 5, 0),
      capacity: {
        ...prev.capacity,
        [minedType]: prev.capacity[minedType] + minedAmount,
      },
    }))
    setResourceNodes((prev) =>
      prev.map((n) =>
        n.id === node.id
          ? { ...n, amount: result.remainingAmount ?? Math.max(0, n.amount - minedAmount), depleted: Boolean(result.depleted) }
          : n,
      ),
    )

    // mining → resourceGained; the machine returns to idle on its own timer
    sendGameEvent("SUCCEED")
  }

  // Calculate total storage used
  const totalUsed = resources.nickel + resources.cobalt + resources.copper + resources.manganese;

  const handleTradeAll = async () => {
    if (totalUsed === 0) return; // Only allow if player has resources

    // Require wallet connection
    if (!walletConnected || !initialWalletAddress) {
      showNotice({ tone: "error", message: "Please connect your wallet to trade resources for OCX tokens!" });
      return;
    }

    // One action at a time: ignored while mining, claiming, upgrading or
    // while a previous trade is still in flight (prevents double submits).
    if (!sendGameEvent("START_TRADING")) return;

    try {
      // Use Next.js API route with JWT cookie auth — NO MetaMask popup needed
      const response = await fetch('/api/marketplace/trade-resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Trade failed' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Trade failed");
      }

      // Update frontend state — resources are zeroed, OCX balance updated
      setResources({ nickel: 0, cobalt: 0, copper: 0, manganese: 0 });
      setPlayerStats((prev) => ({
        ...prev,
        capacity: { nickel: 0, cobalt: 0, copper: 0, manganese: 0 },
      }));
      setBalance((prev) => result.newOcxBalance || (prev + (result.ocxEarned || 0)));
      sendGameEvent("SUCCEED");
    } catch (e: any) {
      console.error("Trade error:", e);
      showNotice({ tone: "error", message: e?.message || "Trade failed. Please try again." });
      sendGameEvent("FAIL");
    }
  };

  const shortAddress = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;

  /**
   * Claim OCX: Withdraw accumulated OCX from DB to the user's wallet on-chain.
   *
   * Lifecycle (lib/state-machines/tx-lifecycle.ts):
   *   preparing → awaitingSignature → authorizing → awaitingWallet → pending → syncing → succeeded
   * Every step is shown to the player, and any failure is classified into a
   * plain-language message that says whether funds moved.
   */
  const handleClaimOcx = async () => {
    if (!walletConnected || !initialWalletAddress) {
      showNotice({ tone: "error", message: "Please connect your wallet to claim OCX tokens!" });
      return;
    }

    // One claim at a time. A second click — or a click while another action
    // is in flight — is rejected here, synchronously, before any request.
    if (!sendGameEvent("START_CLAIMING")) return;
    actionTx.send({ type: "RESET" });
    actionTx.send({ type: "START", note: "Connecting to your wallet..." });
    dismissNotice();

    let chainId: number | null = null;
    // True once the server has issued (and reserved OCX for) a claim signature.
    let claimAuthorised = false;

    try {
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const { getOCXTokenContractWithSigner, OCX_TOKEN_ADDRESS } = await import("@/lib/contracts/ocx-token");

      // Works for MetaMask and WalletConnect, silently restores the session
      // after a page reload, and switches the wallet to the contracts' chain.
      const connection = await walletManager.ensurePrimaryNetwork();
      const { signer, provider } = connection;
      const address = await signer.getAddress();
      chainId = Number((await provider.getNetwork()).chainId);
      setActionChainId(chainId);

      // Preflight 1: the wallet account must be the player's account,
      // otherwise the server looks up the wrong (or no) player.
      if (address.toLowerCase() !== initialWalletAddress.toLowerCase()) {
        throw txError(
          "wallet_mismatch",
          `Your wallet is on account ${shortAddress(address)}, but this game profile belongs to ${shortAddress(initialWalletAddress)}. Switch accounts in your wallet and try again.`,
        );
      }

      // Preflight 2: the OCX contract must exist on the wallet's network. A
      // claim sent to a network without the contract "succeeds" as an empty
      // transaction: the player pays gas and receives nothing.
      let contractCode: string | null = null;
      try {
        contractCode = await provider.getCode(OCX_TOKEN_ADDRESS);
      } catch (codeErr) {
        console.warn("Could not verify OCX contract on current network:", codeErr);
      }
      if (contractCode === "0x") {
        throw txError(
          "wrong_network",
          "OCX is not available on the network your wallet is using. Switch your wallet to the game's network and try again.",
          true,
        );
      }

      // Step 1: prove wallet ownership to the game server (free signature)
      const signAuth = async () => {
        const message = `AbyssX claim\nWallet: ${address}\nTimestamp: ${Date.now()}\nNetwork: sepolia`;
        const signature = await signer.signMessage(message);
        return { message, signature, signedAt: Date.now() };
      };
      actionTx.send({ type: "REQUEST_SIGNATURE" });
      let auth = await signAuth();

      // Step 2: request claim signature from backend (checks DB balance)
      actionTx.send({ type: "AUTHORIZE", note: "Authorising your claim with the game server..." });
      const signResponse = await fetch(`${BACKEND_URL}/marketplace/claim-ocx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          address: address,
          authMessage: auth.message,
          authSignature: auth.signature,
        }),
      });

      if (!signResponse.ok) {
        const errorData = await signResponse.json().catch(() => ({ error: 'Claim failed' }));
        const message = errorData.error || `Server error: ${signResponse.status}`;
        if (errorData.code === "CLAIM_SETTLING") {
          throw txError("settling", message, true);
        }
        throw txError("server", message, signResponse.status >= 500);
      }

      const signatureData = await signResponse.json();

      if (!signatureData.success) {
        throw txError("server", signatureData.error || "Failed to get claim signature", true);
      }

      claimAuthorised = true;
      const claimedAmount = Number(signatureData.claimableOcx) || 0;
      console.log(`📝 Claim signature received for ${claimedAmount} OCX`);

      // Step 3: submit on-chain claim transaction (user pays gas)
      actionTx.send({
        type: "REQUEST_WALLET",
        note: `Confirm the claim of ${claimedAmount.toLocaleString()} OCX in your wallet...`,
      });
      const contract = getOCXTokenContractWithSigner(signer);

      const tx = await contract.claim(
        signatureData.amountWei,
        signatureData.nonce,
        signatureData.deadline,
        signatureData.v,
        signatureData.r,
        signatureData.s
      );

      console.log("Transaction submitted:", tx.hash);
      actionTx.send({ type: "BROADCAST", txHash: tx.hash });
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error("Transaction receipt is null");
      }

      console.log("✅ Claim transaction confirmed in block:", receipt.blockNumber);
      actionTx.send({ type: "MINED" });

      // Step 4: confirm with backend (best effort — the tokens are already in
      // the wallet). The auth signature from step 1 is reused while it is
      // fresh, so the player is not asked to sign a third time.
      try {
        const confirmWithServer = (credentials: { message: string; signature: string }) =>
          fetch(`${BACKEND_URL}/marketplace/trade/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              walletAddress: address,
              address: address,
              authMessage: credentials.message,
              authSignature: credentials.signature,
              txHash: tx.hash,
              tradeId: signatureData.tradeId,
            }),
          });

        let reusedAuth = true;
        if (Date.now() - auth.signedAt > AUTH_SIGNATURE_REUSE_MS) {
          actionTx.send({ type: "REQUEST_SIGNATURE", note: "Sign once more to sync your game (free, no gas)..." });
          auth = await signAuth();
          reusedAuth = false;
        }

        let confirmResponse = await confirmWithServer(auth);
        if (reusedAuth && (confirmResponse.status === 401 || confirmResponse.status === 403)) {
          // Server no longer accepts the earlier signature — ask for a new one.
          actionTx.send({ type: "REQUEST_SIGNATURE", note: "Sign once more to sync your game (free, no gas)..." });
          auth = await signAuth();
          confirmResponse = await confirmWithServer(auth);
        }
        if (!confirmResponse.ok) {
          console.warn("Backend confirmation returned", confirmResponse.status, "(tx already on-chain)");
        }
      } catch (confirmErr) {
        console.warn("Backend confirmation failed (tx already on-chain):", confirmErr);
      }

      // Update frontend state. Prefer the server's authoritative remaining
      // balance; fall back to subtracting the claimed amount.
      const remainingOcx = Number(signatureData.remainingOcx);
      setBalance((prev) =>
        signatureData.remainingOcx !== undefined && signatureData.remainingOcx !== null && Number.isFinite(remainingOcx)
          ? Math.max(0, remainingOcx)
          : Math.max(0, prev - claimedAmount),
      );

      actionTx.send({ type: "SUCCEED" });
      showNotice({
        tone: "success",
        message: `Claimed ${claimedAmount.toLocaleString()} OCX to your wallet.`,
        txUrl: explorerTxUrl(tx.hash, chainId),
      });
      sendGameEvent("SUCCEED");
    } catch (e: unknown) {
      console.error("Claim error:", e);
      const error = classifyTxError(e, "Claim failed. Please try again.");
      const txBefore = actionTx.current();
      const broadcastHash = "txHash" in txBefore ? txBefore.txHash : undefined;
      actionTx.send({ type: "FAIL", error });

      if (broadcastHash) {
        // Funds may have moved: never tell the player "nothing happened".
        showNotice({
          tone: "error",
          message:
            "Your claim transaction was sent, but we could not confirm it yet. Check it on the block explorer before trying again — if it succeeded, your OCX is already in your wallet.",
          txUrl: chainId !== null ? explorerTxUrl(broadcastHash, chainId) : null,
        });
      } else if (claimAuthorised) {
        showNotice({
          tone: error.kind === "rejected" ? "info" : "error",
          message: `${error.message} Your OCX is safe: press Claim again within a few minutes to finish this claim, otherwise it is returned to your game balance.`,
        });
      } else {
        showNotice({ tone: error.kind === "rejected" ? "info" : "error", message: error.message });
      }
      sendGameEvent("FAIL");
    }
  };

  const applyUpgradeStateFromResponse = (upgradeData: SubmarineUpgradeResult) => {
    const tierNumber = upgradeData.tierDetails?.tier ?? upgradeData.newTier

    if (tierNumber) {
      setPlayerTier(tierNumber)
    }

    const statsSource = upgradeData.tierDetails?.baseStats ?? getSubmarineByTier(tierNumber)?.baseStats

    if (statsSource) {
      setPlayerStats((prev) => ({
        ...prev,
        health: statsSource.health ?? prev.health,
        energy: statsSource.energy ?? prev.energy,
        capacity: { ...prev.capacity },
        maxCapacity: statsSource.maxCapacity ? { ...statsSource.maxCapacity } : { ...prev.maxCapacity },
        depth: statsSource.depth ?? prev.depth,
        speed: statsSource.speed ?? prev.speed,
        miningRate: statsSource.miningRate ?? prev.miningRate,
        tier: tierNumber ?? prev.tier,
      }))
    }

    if (typeof upgradeData.coins === "number" && Number.isFinite(upgradeData.coins)) {
      setBalance(upgradeData.coins)
    }
  }

  const executeSubmarineUpgrade = async (targetTierOverride?: number): Promise<SubmarineUpgradeResult> => {
    const targetTier = targetTierOverride ?? playerTier + 1

    actionTx.send({ type: "RESET" })
    actionTx.send({ type: "START", note: "Connecting to your wallet..." })

    // Wallet MUST be connected, on the contracts' chain — auto-reconnects,
    // prompts to connect, or asks the wallet to switch network.
    let connection
    try {
      connection = await walletManager.ensurePrimaryNetwork()
    } catch (err: any) {
      if (!walletManager.getConnection()) {
        throw txError(
          "no_wallet",
          "Wallet not connected. Please connect MetaMask or WalletConnect to authorize the transaction.",
          true,
        )
      }
      throw txError("wrong_network", err?.message || "Please switch your wallet to the game's network.", true)
    }

    const walletAddress = connection.address
    if (!walletAddress) {
      throw txError("no_wallet", "No wallet address available. Please reconnect your wallet.", true)
    }
    setActionChainId(connection.chainId)

    const tierDefinition = getSubmarineByTier(targetTier)
    const upgradeCost = tierDefinition.upgradeCost.tokens

    // The upgrade spends OCX from the WALLET (on-chain). The in-game balance
    // is unclaimed OCX that is not in the wallet yet, so checking it let a
    // player with in-game OCX but an empty wallet approve, then fail.
    let walletOcx: number | null = null
    try {
      walletOcx = Number(ethers.formatEther(await ContractManager.getTokenBalance(walletAddress)))
    } catch (balanceErr) {
      console.warn("Could not read wallet OCX balance; the wallet will check it:", balanceErr)
    }
    if (walletOcx !== null && walletOcx < upgradeCost) {
      const unclaimed = balance > 0 ? ` You have ${balance} OCX in the game — use Claim OCX to move it to your wallet first.` : ""
      throw txError(
        "insufficient_balance",
        `Upgrading needs ${upgradeCost} OCX in your wallet; it holds ${walletOcx}.${unclaimed}`,
      )
    }

    // Blockchain transaction is mandatory — no database fallback.
    // Two wallet confirmations: (1) allow the UpgradeManager to spend OCX,
    // (2) the upgrade itself. Each is surfaced as its own step.
    console.log(`🔐 Executing on-chain upgrade to tier ${targetTier}...`)
    actionTx.send({ type: "REQUEST_WALLET", note: `Step 1 of 2 — approve ${upgradeCost} OCX in your wallet...` })
    const approvalTx = await ContractManager.approveTokens(
      ethers.parseEther(upgradeCost.toString()).toString()
    )
    actionTx.send({
      type: "BROADCAST",
      txHash: approvalTx.hash,
      note: "Step 1 of 2 — waiting for the approval to confirm...",
    })
    await approvalTx.wait()
    console.log("✅ Token approval successful")

    actionTx.send({
      type: "REQUEST_WALLET",
      note: `Step 2 of 2 — confirm the upgrade to tier ${targetTier} in your wallet...`,
    })
    const contractTx = await ContractManager.upgradeSubmarine(targetTier)
    actionTx.send({
      type: "BROADCAST",
      txHash: contractTx.hash,
      note: "Step 2 of 2 — waiting for the upgrade to confirm...",
    })
    await contractTx.wait()
    console.log("✅ Smart contract upgrade confirmed on blockchain")
    actionTx.send({ type: "MINED" })

    // Sync tier in DB (tokens already deducted on-chain)
    let upgradeResponse: any = { success: false }
    try {
      const resp = await fetch("/api/submarine/sync-tier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTier }),
      })
      const data = await resp.json()
      if (resp.ok && data.success) {
        upgradeResponse = data
      }
    } catch (syncErr) {
      console.warn("Tier sync after on-chain upgrade failed:", syncErr)
    }

    if (!upgradeResponse.success || !upgradeResponse.data) {
      // The chain is the source of truth and it says the upgrade happened.
      // Say so, instead of a generic failure that invites paying twice.
      throw txError(
        "server",
        "Your upgrade is confirmed on-chain, but the game server has not synced it yet. Reload the page to finish syncing — you will not be charged again.",
      )
    }

    const upgradeData = upgradeResponse.data
    applyUpgradeStateFromResponse(upgradeData)

    // Update balance from server response (may be in 'balance' or 'coins')
    const newBal = upgradeData.balance ?? upgradeData.coins
    if (typeof newBal === "number" && Number.isFinite(newBal)) {
      setBalance(newBal)
    }

    console.info("✅ Submarine upgrade confirmed", {
      wallet: upgradeData.wallet,
      tier: upgradeData.newTier,
      balanceRemaining: newBal,
      onChain: true,
    })

    await loadPlayerData(walletAddress)

    return upgradeData
  }

  const handleUpgradeSubmarine = async () => {
    if (playerTier >= 15) return

    // Ignored unless the game is idle — no double upgrades, no upgrade while
    // a claim or trade is in flight.
    if (!sendGameEvent("START_UPGRADING")) return
    dismissNotice()

    try {
      await executeSubmarineUpgrade(playerTier + 1)

      actionTx.send({ type: "SUCCEED" })
      // upgrading → upgraded; the modal closes when the machine settles to idle
      sendGameEvent("SUCCEED")
    } catch (err) {
      console.error("Upgrade failed:", err)
      const error: TxError = classifyTxError(err, "Upgrade failed. Please try again.")
      const txBefore = actionTx.current()
      const broadcastHash = "txHash" in txBefore ? txBefore.txHash : undefined
      actionTx.send({ type: "FAIL", error })
      showNotice({
        tone: error.kind === "rejected" ? "info" : "error",
        message: error.message,
        txUrl: broadcastHash && actionChainIdRef.current !== null ? explorerTxUrl(broadcastHash, actionChainIdRef.current) : null,
      })
      sendGameEvent("FAIL")
    }
  }

  // Submarine purchase handled via dedicated /submarine-store page now

  const createSignaturePayload = async (address: string, action: string) => {
    const message = `Sign this message to ${action} with your account ${address}`
    const signature = await walletManager.signMessage(message)

    return { message, signature }
  }

  const getResourceEmoji = (resourceType: string) => {
    switch (resourceType) {
      case "nickel":
        return "Ni"
      case "cobalt":
        return "Co"
      case "copper":
        return "Cu"
      case "manganese":
        return "Mn"
      default:
        return "?"
    }
  }

  const handleDisconnect = () => {
    cleanup();
    sendGameEvent("RESET");
    setSidebarOpen(false);
    onFullDisconnect(); // Call parent to fully disconnect and return to landing page
  };

  // Add debug logs for Mine button conditions

  // Handle tutorial completion
  const handleTutorialFinish = async () => {
    setShowGuide(false)
    
    // Mark tutorial as complete in database
    try {
      const response = await fetch("/api/player/complete-tutorial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        console.error("[OceanMiningGame] Failed to mark tutorial as complete")
      } else {
        console.info("[OceanMiningGame] Tutorial marked as complete")
      }
    } catch (error) {
      console.error("[OceanMiningGame] Error marking tutorial as complete:", error)
    }
  }


  // What the HUD says about the action in flight. Claims and upgrades have
  // several wallet/on-chain waits, so their text comes from the tx lifecycle.
  const txInFlight = (gameState === "claiming" || gameState === "upgrading") && actionTx.isBusy
  const actionStatusText = txInFlight ? describeTx(actionTx.tx) : GAME_STATE_LABELS[gameState]
  const actionTxHash = txInFlight && "txHash" in actionTx.tx ? actionTx.tx.txHash : undefined
  const actionTxUrl = actionTxHash && actionChainId !== null ? explorerTxUrl(actionTxHash, actionChainId) : null

  return (
    <>
      {showGuide && (
        <ScubaDiverGuide onFinish={handleTutorialFinish} />
      )}
      <div className="relative h-full w-full">
        {/* Game Canvas */}
        <canvas ref={canvasRef} className="absolute inset-0" />

        {/* HUD Overlay */}
        <div className="pointer-events-none absolute inset-0 z-10">
          {/* Connection Status */}
          {connectionStatus !== "connected" && walletConnected && (
            <div className="absolute left-1/2 top-4 -translate-x-1/2 transform rounded-lg bg-slate-900/80 px-4 py-2 text-cyan-400 backdrop-blur-sm">
              {CONNECTION_LABELS[connectionStatus]}
            </div>
          )}

          {/* World loading: deposits come from the game server */}
          {walletConnected && world.status !== "ready" && world.status !== "idle" && (
            <div className="pointer-events-auto absolute left-1/2 top-1/3 -translate-x-1/2 transform rounded-xl border border-cyan-500/30 bg-slate-900/90 px-6 py-4 text-center text-cyan-100 shadow-lg backdrop-blur-sm max-w-md">
              {world.status === "signing" && <p>Approve the sign-in request in your wallet to load the ocean…</p>}
              {world.status === "joining" && <p>Loading deposits from the game server…</p>}
              {world.status === "error" && (
                <>
                  <p className="mb-3">{world.message}</p>
                  <button
                    type="button"
                    onClick={retryJoin}
                    className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
                  >
                    Try again
                  </button>
                </>
              )}
            </div>
          )}

          {/* Player Stats HUD */}
          <PlayerHUD stats={playerStats} tier={playerTier} resources={resources} />

          {/* Sonar/Mini-map at bottom left */}
          <div className="absolute left-4 bottom-4 z-20">
            <SonarRadar
              playerPosition={playerPosition}
              resourceNodes={resourceNodes}
              otherPlayers={[]}
            />
          </div>

          {/* Wallet info now shown in ResourceSidebar only */}
          {/* Resource Sidebar Toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="pointer-events-auto absolute right-4 top-16 z-50 rounded-lg bg-slate-800/80 p-2 text-cyan-400 backdrop-blur-sm transition-all hover:bg-slate-700/80"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 8h14M5 12h14M5 16h14" />
            </svg>
          </button>



  {/* Compass removed */}

  {/* Sidebar and Overlay Container */}
        <div className="pointer-events-none">
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar overlay"
            />
          )}
          <div className="pointer-events-auto">
            <ResourceSidebar
              isOpen={sidebarOpen}
              resources={resources}
              balance={balance}
              onTradeAll={handleTradeAll}
              onClaimOcx={handleClaimOcx}
              gameState={gameState}
              playerStats={playerStats}
              walletAddress={walletAddress}
              walletConnected={walletConnected}
              onDisconnect={handleDisconnect}
            />
          </div>
        </div>

        {/* Show MineButton only when submarine is hovering over a resource node */}
        {targetNode && !targetNode.depleted && (
          <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 99999 }}>
            <MineButton
              onClick={() => handleMine(targetNode)}
              disabled={!walletConnected || gameState !== "idle"}
              gameState={gameState}
              resourceType={targetNode.type}
              resourceAmount={targetNode.amount}
            />
          </div>
        )}

        {/* Storage Full Alert */}
        {showStorageAlert && <StorageFullAlert percentage={storagePercentage} />}

        {/* Energy Depleted Alert */}
        {showEnergyAlert && <EnergyDepletedAlert energy={playerStats.energy} />}

        {/* Game State Notifications */}
        {gameState !== "idle" && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute left-1/2 top-1/4 max-w-[90vw] -translate-x-1/2 transform rounded-lg bg-slate-900/80 px-6 py-3 text-center text-lg font-bold text-cyan-400 backdrop-blur-sm"
          >
            {actionStatusText}
            {actionTxUrl && (
              <a
                href={actionTxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="pointer-events-auto mt-1 block text-sm font-normal text-cyan-300 underline"
              >
                View transaction
              </a>
            )}
          </div>
        )}

        {/* Session Info */}
        {sessionId && (
          <div className="absolute bottom-4 left-4 rounded-lg bg-slate-900/70 p-3 text-xs text-slate-300 backdrop-blur-sm">
            <div className="mb-1 font-bold text-cyan-400">SESSION INFO</div>
            <div>Session: {sessionId.slice(-8)}</div>
            <div>Players: 1/1 (Single Player Mode)</div>
            <div>Status: {connectionStatus}</div>
          </div>
        )}

        {/* Wallet connection is optional in gameplay; overlay removed */}
        </div> {/* Close HUD Overlay div */}
      </div> {/* Close main container div */}

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <UpgradeModal
          currentTier={playerTier}
          resources={resources}
          balance={balance}
          onUpgrade={handleUpgradeSubmarine}
          onClose={() => setShowUpgradeModal(false)}
          gameState={gameState}
          {...(gameState === "upgrading" && actionStatusText ? { statusText: actionStatusText } : {})}
        />
      )}

      {/* Action notices (non-blocking replacement for window.alert) */}
      {notice && (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          aria-live={notice.tone === "error" ? "assertive" : "polite"}
          style={{ zIndex: 100000 }}
          className={`fixed left-1/2 top-4 w-[min(92vw,30rem)] -translate-x-1/2 transform rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur-sm ${
            notice.tone === "error"
              ? "border-red-500/50 bg-red-950/90 text-red-100"
              : notice.tone === "success"
                ? "border-emerald-500/50 bg-emerald-950/90 text-emerald-100"
                : "border-cyan-500/50 bg-slate-900/90 text-cyan-100"
          }`}
        >
          <div className="flex items-start gap-3">
            <p className="flex-1 leading-snug">{notice.message}</p>
            <button
              type="button"
              onClick={dismissNotice}
              aria-label="Dismiss message"
              className="-mr-1 rounded px-1 text-base leading-none opacity-70 transition-opacity hover:opacity-100"
            >
              ✕
            </button>
          </div>
          {notice.txUrl && (
            <a href={notice.txUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block underline">
              View transaction
            </a>
          )}
        </div>
      )}
    </>
  );
}