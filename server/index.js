const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const cors = require("cors")
const { ethers } = require("ethers")
const { createClient } = require("@supabase/supabase-js")
require("dotenv").config()

const app = express()
const server = http.createServer(app)

console.log("🌊 Starting OceanX Backend Server...")
console.log("Environment:", process.env.NODE_ENV || "development")
console.log("Port:", process.env.PORT || 5000)

// CORS configuration for production
const allowedOrigins = [
  /^https:\/\/ocean.*\.vercel\.app$/,
  "http://localhost:3000",
  "https://localhost:3000",
  "https://oceanx.onrender.com",
]

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.some((o) => (typeof o === "string" ? o === origin : o.test(origin)))) {
      callback(null, true)
    } else {
      callback(new Error("Not allowed by CORS"))
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
}

app.use(cors(corsOptions))
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Socket.IO setup with CORS
const io = socketIo(server, {
  cors: corsOptions,
  transports: ["websocket", "polling"],
})

// Initialize Supabase client with error handling
let supabase = null
try {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.log("⚠️ Missing Supabase environment variables - running in mock mode")
    console.log("Required: SUPABASE_URL, SUPABASE_ANON_KEY")
  } else {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
    console.log("✅ Supabase client initialized")
  }
} catch (error) {
  console.error("❌ Failed to initialize Supabase:", error)
}

// Test database connection
async function testDatabaseConnection() {
  if (!supabase) {
    console.log("⚠️ Supabase not configured - running in mock mode")
    return false
  }

  try {
    const { data, error } = await supabase.from("players").select("count").limit(1)
    if (error) {
      console.error("❌ Database connection test failed:", error.message)
      return false
    }
    console.log("✅ Database connection successful")
    return true
  } catch (error) {
    console.error("❌ Database connection error:", error)
    return false
  }
}

// Contract addresses on Sepolia testnet
const CONTRACTS = {
  OceanXToken: "0x7082bd37ea9552faf0549abb868602135aada705",
  PlayerProfile: "0x3b4682e9e31c0fb9391967ce51c58e8b4cc02063",
  UpgradeManager: "0xb8ca16e41aac1e17dc5ddd22c5f20b35860f9a0c",
  DailyMiner: "0x8b0f0580fe26554bbfa2668ee042f20301c3ced3",
}

// Submarine tiers
const SUBMARINE_TIERS = [
  { id: 0, name: "Basic Submarine", cost: 0, speed: 1, storage: 10, miningPower: 1, hull: 100, energy: 100 },
  { id: 1, name: "Enhanced Submarine", cost: 100, speed: 1.2, storage: 15, miningPower: 1.5, hull: 125, energy: 120 },
  { id: 2, name: "Deep-Sea Submarine", cost: 250, speed: 1.4, storage: 20, miningPower: 2, hull: 150, energy: 140 },
  { id: 3, name: "Heavy-Duty Submarine", cost: 500, speed: 1.6, storage: 30, miningPower: 3, hull: 175, energy: 160 },
  { id: 4, name: "Thermal Submarine", cost: 1000, speed: 1.8, storage: 40, miningPower: 4, hull: 200, energy: 180 },
  { id: 5, name: "Pressure Submarine", cost: 2000, speed: 2, storage: 50, miningPower: 5, hull: 250, energy: 220 },
  { id: 6, name: "Kraken Submarine", cost: 4000, speed: 2.5, storage: 75, miningPower: 7, hull: 300, energy: 260 },
  { id: 7, name: "Cosmic Submarine", cost: 8000, speed: 3, storage: 100, miningPower: 10, hull: 400, energy: 320 },
  { id: 8, name: "Omega Submarine", cost: 15000, speed: 3.5, storage: 150, miningPower: 15, hull: 500, energy: 400 },
  {
    id: 9,
    name: "Leviathan Submarine",
    cost: 30000,
    speed: 4,
    storage: 200,
    miningPower: 20,
    hull: 1000,
    energy: 1000,
  },
]

// Game sessions storage
const gameSessions = new Map() // Map<sessionId, { id, players: Map<walletAddress, { socketId, position, resources }>, resourceNodes }>
const playerSessions = new Map() // Map<walletAddress, sessionId>
const mockPlayers = new Map()
const MAX_PLAYERS_PER_SESSION = 20

// Resource node generation parameters
const MAP_SIZE = 1000 // Example map size
const NUM_RESOURCE_NODES = 50 // Number of nodes to generate initially
const RESOURCE_TYPES = ["nickel", "cobalt", "copper", "manganese"]
const MIN_RESOURCE_AMOUNT = 500
const MAX_RESOURCE_AMOUNT = 2000
const MIN_NODE_SIZE = 10
const MAX_NODE_SIZE = 30

function generateInitialResourceNodes() {
  const nodes = []
  for (let i = 0; i < NUM_RESOURCE_NODES; i++) {
    const type = RESOURCE_TYPES[Math.floor(Math.random() * RESOURCE_TYPES.length)]
    const amount = Math.floor(Math.random() * (MAX_RESOURCE_AMOUNT - MIN_RESOURCE_AMOUNT + 1)) + MIN_RESOURCE_AMOUNT
    const size = Math.floor(Math.random() * (MAX_NODE_SIZE - MIN_NODE_SIZE + 1)) + MIN_NODE_SIZE
    nodes.push({
      id: `node-${Date.now()}-${i}`,
      type,
      position: {
        x: Math.random() * MAP_SIZE - MAP_SIZE / 2,
        y: Math.random() * MAP_SIZE - MAP_SIZE / 2,
        z: Math.random() * 500 - 250, // Depth
      },
      amount: amount,
      maxAmount: amount, // Initial amount is max amount
      size: size,
      depleted: false,
    })
  }
  return nodes
}

// Utility function to verify wallet signature
const verifyWallet = async (req, res, next) => {
  try {
    const { address, signature, message } = req.body

    if (!address || !signature || !message) {
      return res.status(400).json({ error: "Missing required fields: address, signature, message" })
    }

    const recoveredAddress = ethers.verifyMessage(message, signature)

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ error: "Invalid signature" })
    }

    req.walletAddress = address.toLowerCase()
    next()
  } catch (error) {
    console.error("Wallet verification error:", error)
    res.status(401).json({ error: "Authentication failed" })
  }
}

// Database helper functions
async function getPlayer(walletAddress) {
  if (!supabase) {
    return mockPlayers.get(walletAddress) || null
  }

  try {
    const { data, error } = await supabase.from("players").select("*").eq("wallet_address", walletAddress).single()

    if (error && error.code !== "PGRST116") {
      throw error
    }

    return data
  } catch (error) {
    console.error("Get player error:", error)
    return null
  }
}

async function createPlayer(walletAddress) {
  const playerData = {
    wallet_address: walletAddress,
    submarine_tier: 0,
    total_ocx_earned: 0,
    total_resources_mined: 0,
    last_reward_claim: new Date().toISOString(),
    created_at: new Date().toISOString(),
    last_login: new Date().toISOString(),
  }

  if (!supabase) {
    mockPlayers.set(walletAddress, { id: Date.now(), ...playerData })
    return mockPlayers.get(walletAddress)
  }

  try {
    const { data, error } = await supabase.from("players").insert(playerData).select().single()

    if (error) {
      throw error
    }

    return data
  } catch (error) {
    console.error("Create player error:", error)
    mockPlayers.set(walletAddress, { id: Date.now(), ...playerData })
    return mockPlayers.get(walletAddress)
  }
}

async function updatePlayer(walletAddress, updates) {
  if (!supabase) {
    const player = mockPlayers.get(walletAddress)
    if (player) {
      Object.assign(player, updates)
      mockPlayers.set(walletAddress, player)
    }
    return player
  }

  try {
    const { data, error } = await supabase
      .from("players")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("wallet_address", walletAddress)
      .select()
      .single()

    if (error) {
      throw error
    }

    return data
  } catch (error) {
    console.error("Update player error:", error)
    return null
  }
}

// Daily Mining/Trading System
const DAILY_TRADE_COOLDOWN = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

// Resource to OCX conversion rates (per unit)
const RESOURCE_RATES = {
  nickel: { min: 5, max: 15 },
  cobalt: { min: 10, max: 25 },
  copper: { min: 8, max: 20 },
  manganese: { min: 15, max: 35 },
}

async function getPlayerLastTradeTime(walletAddress) {
  if (!supabase) {
    const player = mockPlayers.get(walletAddress)
    return player ? player.last_daily_trade : null
  }

  try {
    const { data, error } = await supabase
      .from("players")
      .select("last_daily_trade")
      .eq("wallet_address", walletAddress)
      .single()

    if (error && error.code !== "PGRST116") {
      throw error
    }

    return data ? data.last_daily_trade : null
  } catch (error) {
    console.error("Get last trade time error:", error)
    return null
  }
}

async function updatePlayerLastTradeTime(walletAddress, tradeTime) {
  if (!supabase) {
    const player = mockPlayers.get(walletAddress)
    if (player) {
      player.last_daily_trade = tradeTime
      player.total_ocx_earned = (player.total_ocx_earned || 0) + arguments[2] || 0
      mockPlayers.set(walletAddress, player)
    }
    return player
  }

  try {
    const { data, error } = await supabase
      .from("players")
      .update({
        last_daily_trade: tradeTime,
        total_ocx_earned: supabase.raw(`total_ocx_earned + ${arguments[2] || 0}`),
        updated_at: new Date().toISOString(),
      })
      .eq("wallet_address", walletAddress)
      .select()
      .single()

    if (error) {
      throw error
    }

    return data
  } catch (error) {
    console.error("Update last trade time error:", error)
    return null
  }
}

function canPlayerTrade(lastTradeTime) {
  if (!lastTradeTime) return true

  const now = new Date().getTime()
  const lastTrade = new Date(lastTradeTime).getTime()
  const timeDiff = now - lastTrade

  return timeDiff >= DAILY_TRADE_COOLDOWN
}

function getTimeUntilNextTrade(lastTradeTime) {
  if (!lastTradeTime) return 0

  const now = new Date().getTime()
  const lastTrade = new Date(lastTradeTime).getTime()
  const timeDiff = now - lastTrade

  if (timeDiff >= DAILY_TRADE_COOLDOWN) return 0

  return DAILY_TRADE_COOLDOWN - timeDiff
}

function calculateResourceValue(resources) {
  let totalValue = 0
  const breakdown = {}

  for (const [resourceType, amount] of Object.entries(resources)) {
    if (amount > 0 && RESOURCE_RATES[resourceType]) {
      const rate = RESOURCE_RATES[resourceType]
      // Use random rate between min and max for market fluctuation
      const currentRate = Math.floor(Math.random() * (rate.max - rate.min + 1)) + rate.min
      const value = amount * currentRate
      totalValue += value
      breakdown[resourceType] = {
        amount,
        rate: currentRate,
        value,
      }
    }
  }

  return { totalValue, breakdown }
}

// Routes

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "🌊 OceanX Backend API",
    version: "1.0.0",
    status: "Running",
    endpoints: {
      health: "/health",
      auth: "/auth/connect",
      game: "/game/join",
      submarines: "/submarines",
      balance: "/player/balance",
      upgrade: "/submarine/upgrade",
      rewards: "/rewards/claim",
    },
    timestamp: new Date().toISOString(),
  })
})

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    const dbConnected = await testDatabaseConnection()

    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      network: "Sepolia Testnet",
      version: "1.0.0",
      database: dbConnected ? "Connected" : "Mock Mode",
      activeSessions: gameSessions.size,
      totalPlayers: Array.from(gameSessions.values()).reduce((total, session) => total + session.players.size, 0),
      environment: {
        nodeEnv: process.env.NODE_ENV || "development",
        port: process.env.PORT || 5000,
        supabaseConfigured: !!supabase,
        rpcConfigured: !!process.env.RPC_URL,
        frontendUrl: process.env.FRONTEND_URL || "not set",
      },
    })
  } catch (error) {
    console.error("Health check error:", error)
    res.status(500).json({
      status: "ERROR",
      error: error.message,
      timestamp: new Date().toISOString(),
    })
  }
})

// Authentication endpoint
app.post("/auth/connect", verifyWallet, async (req, res) => {
  try {
    const walletAddress = req.walletAddress

    console.log(`🔐 Authenticating wallet: ${walletAddress}`)

    let player = await getPlayer(walletAddress)

    if (!player) {
      console.log(`👤 Creating new player profile for: ${walletAddress}`)
      player = await createPlayer(walletAddress)

      if (!player) {
        return res.status(500).json({ error: "Failed to create player profile" })
      }
    } else {
      await updatePlayer(walletAddress, { last_login: new Date().toISOString() })
    }

    const submarine = SUBMARINE_TIERS[player.submarine_tier || 0]

    res.json({
      success: true,
      player,
      submarine,
      message: !player.last_login ? "New player profile created! Welcome to OceanX!" : "Welcome back to OceanX!",
      databaseMode: supabase ? "connected" : "mock",
    })

    console.log(`✅ Authentication successful for: ${walletAddress}`)
  } catch (error) {
    console.error("Auth error:", error)
    res.status(500).json({ error: "Authentication failed", details: error.message })
  }
})

// Game session join endpoint
app.post("/game/join", verifyWallet, async (req, res) => {
  try {
    const walletAddress = req.walletAddress
    console.log(`🎮 Player ${walletAddress} attempting to join game...`)

    // Check if player is already in a session
    if (playerSessions.has(walletAddress)) {
      const sessionId = playerSessions.get(walletAddress)
      const session = gameSessions.get(sessionId)
      if (session) {
        console.log(`Player ${walletAddress} already in session ${sessionId}. Rejoining.`)
        const player = await getPlayer(walletAddress)
        const submarine = SUBMARINE_TIERS[player.submarine_tier || 0]
        return res.json({
          success: true,
          data: {
            sessionId: session.id,
            playerCount: session.players.size,
            maxPlayers: MAX_PLAYERS_PER_SESSION,
            resourceNodes: Array.from(session.resourceNodes.values()),
            playerSubmarine: submarine,
          },
        })
      } else {
        // Session not found, clear player session and proceed to create new
        playerSessions.delete(walletAddress)
      }
    }

    let sessionToJoin = null
    // Find an available session
    for (const [sessionId, session] of gameSessions.entries()) {
      if (session.players.size < MAX_PLAYERS_PER_SESSION) {
        sessionToJoin = session
        break
      }
    }

    // If no available session, create a new one
    if (!sessionToJoin) {
      const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      const newResourceNodes = generateInitialResourceNodes()
      sessionToJoin = {
        id: newSessionId,
        players: new Map(), // Map<walletAddress, { socketId, position, resources }>
        resourceNodes: new Map(newResourceNodes.map((node) => [node.id, node])),
      }
      gameSessions.set(newSessionId, sessionToJoin)
      console.log(`🆕 Created new game session: ${newSessionId} with ${newResourceNodes.length} nodes`)
    }

    // Add player to the session
    const player = await getPlayer(walletAddress)
    const submarineTier = player?.submarine_tier || 0
    sessionToJoin.players.set(walletAddress, {
      socketId: null, // Will be updated on socket connection
      position: { x: 0, y: 0, z: 0, rotation: 0 },
      resources: { nickel: 0, cobalt: 0, copper: 0, manganese: 0 },
      submarineTier, // Store submarine tier for multiplayer rendering
    })
    playerSessions.set(walletAddress, sessionToJoin.id)
    console.log(
      `➕ Player ${walletAddress} joined session ${sessionToJoin.id}. Current players: ${sessionToJoin.players.size}`,
    )

    // Get player's current submarine
    const submarine = SUBMARINE_TIERS[player.submarine_tier || 0]

    // Respond with session details
    res.json({
      success: true,
      data: {
        sessionId: sessionToJoin.id,
        playerCount: sessionToJoin.players.size,
        maxPlayers: MAX_PLAYERS_PER_SESSION,
        resourceNodes: Array.from(sessionToJoin.resourceNodes.values()),
        playerSubmarine: submarine,
      },
    })

    // Emit player joined event to all clients in this session (excluding the joining player for now, as their socket isn't linked yet)
    io.to(sessionToJoin.id).emit("playerJoined", {
      walletAddress,
      position: { x: 0, y: 0, z: 0 },
      submarineTier: submarine.id,
    })
  } catch (error) {
    console.error("Game join error:", error)
    res.status(500).json({ success: false, error: "Failed to join game session", details: error.message })
  }
})

// Get submarine tiers
app.get("/submarines", (req, res) => {
  res.json({ submarines: SUBMARINE_TIERS })
})

// Get player balance (mock for testnet)
app.post("/player/balance", verifyWallet, async (req, res) => {
  try {
    const player = await getPlayer(req.walletAddress)
    const balance = player ? player.total_ocx_earned : (Math.random() * 5000 + 1000).toFixed(2)

    res.json({
      balance: balance.toString(),
      symbol: "OCX",
      network: "Sepolia",
    })
  } catch (error) {
    console.error("Get balance error:", error)
    res.status(500).json({ error: "Failed to get balance" })
  }
})

// Daily resource trading endpoint
app.post("/daily-trade", verifyWallet, async (req, res) => {
  try {
    const walletAddress = req.walletAddress
    const { resources, maxCapacities } = req.body

    console.log(`💰 Daily trade request from: ${walletAddress}`)

    // Validate resources input
    if (!resources || typeof resources !== "object" || !maxCapacities || typeof maxCapacities !== "object") {
      return res.status(400).json({
        success: false,
        error: "Invalid resources or maxCapacities data",
      })
    }

    // Check if player exists
    const player = await getPlayer(walletAddress)
    if (!player) {
      return res.status(404).json({
        success: false,
        error: "Player not found",
      })
    }

    // Check if player can trade (24-hour cooldown)
    const lastTradeTime = await getPlayerLastTradeTime(walletAddress)
    if (!canPlayerTrade(lastTradeTime)) {
      const timeUntilNext = getTimeUntilNextTrade(lastTradeTime)
      const hoursLeft = Math.ceil(timeUntilNext / (60 * 60 * 1000))
      return res.status(429).json({
        success: false,
        error: "Daily trade limit reached",
        message: `You can trade again in ${hoursLeft} hours`,
        timeUntilNextTrade: timeUntilNext,
        lastTradeTime,
      })
    }

    // Validate that cargo is full
    const totalResources = Object.values(resources).reduce((sum, amount) => sum + (amount || 0), 0)
    const totalMax = Object.values(maxCapacities).reduce((sum, amount) => sum + (amount || 0), 0)
    if (totalResources < totalMax) {
      return res.status(400).json({
        success: false,
        error: "Cargo not full. You can only trade when your cargo is completely full.",
      })
    }

    // Calculate OCX value
    const { totalValue, breakdown } = calculateResourceValue(resources)
    if (totalValue <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid resource values",
      })
    }

    // Update player's last trade time and OCX earned
    const tradeTime = new Date().toISOString()
    await updatePlayerLastTradeTime(walletAddress, tradeTime, totalValue)

    // In a real implementation, you would:
    // 1. Deduct resources from player's inventory
    // 2. Add OCX tokens to player's wallet via smart contract
    // 3. Record the transaction in a trades table

    console.log(`✅ Daily trade completed for ${walletAddress}: ${totalValue} OCX`)

    res.json({
      success: true,
      data: {
        ocxEarned: totalValue,
        breakdown,
        tradeTime,
        nextTradeAvailable: new Date(Date.now() + DAILY_TRADE_COOLDOWN).toISOString(),
        message: `Successfully traded resources for ${totalValue} OCX tokens!`,
      },
    })
  } catch (error) {
    console.error("Daily trade error:", error)
    res.status(500).json({
      success: false,
      error: "Failed to process daily trade",
      details: error.message,
    })
  }
})

// Check daily trade status endpoint
app.post("/daily-trade/status", verifyWallet, async (req, res) => {
  try {
    const walletAddress = req.walletAddress

    const lastTradeTime = await getPlayerLastTradeTime(walletAddress)
    const canTrade = canPlayerTrade(lastTradeTime)
    const timeUntilNext = canTrade ? 0 : getTimeUntilNextTrade(lastTradeTime)

    res.json({
      success: true,
      data: {
        canTrade,
        lastTradeTime,
        timeUntilNextTrade: timeUntilNext,
        hoursUntilNext: timeUntilNext > 0 ? Math.ceil(timeUntilNext / (60 * 60 * 1000)) : 0,
        nextTradeAvailable: lastTradeTime
          ? new Date(new Date(lastTradeTime).getTime() + DAILY_TRADE_COOLDOWN).toISOString()
          : new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("Daily trade status error:", error)
    res.status(500).json({
      success: false,
      error: "Failed to get trade status",
      details: error.message,
    })
  }
})

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Server error:", error)
  res.status(500).json({ error: "Internal server error", details: error.message })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.path} not found`,
    availableRoutes: [
      "/",
      "/health",
      "/auth/connect",
      "/submarines",
      "/player/balance",
      "/game/join",
      "/daily-trade",
      "/daily-trade/status",
    ],
  })
})

// Start server
const PORT = process.env.PORT || 5000;
const PUBLIC_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

// --- SOCKET.IO HANDLERS FOR MULTIPLAYER ---
io.on("connection", (socket) => {
  console.log(`🔌 New socket connected: ${socket.id}`)

  // Player joins a session room
  socket.on("join-session", ({ walletAddress, sessionId }) => {
    if (!walletAddress || !sessionId) return
    socket.join(sessionId)
    // Update player's socketId in session map
    const session = gameSessions.get(sessionId)
    if (session && session.players.has(walletAddress)) {
      session.players.get(walletAddress).socketId = socket.id
      // Send current players to the new player
      const players = Array.from(session.players.entries()).map(([addr, p]) => ({
        id: addr,
        position: { x: p.position.x, y: p.position.y, rotation: p.position.rotation || 0 },
        rotation: p.position.rotation || 0,
        submarineType: p.submarineTier || 0,
        username: addr,
      }))
      socket.emit("game-state", {
        sessionId,
        players,
        resourceNodes: Array.from(session.resourceNodes.values()),
        playerData: {
          id: walletAddress,
          position: { x: session.players.get(walletAddress).position.x, y: session.players.get(walletAddress).position.y, rotation: session.players.get(walletAddress).position.rotation || 0 },
          rotation: session.players.get(walletAddress).position.rotation || 0,
          submarineType: session.players.get(walletAddress).submarineTier || 0,
          username: walletAddress,
        },
      })
      // Notify others
      socket.to(sessionId).emit("player-joined", {
        id: walletAddress,
        position: { x: session.players.get(walletAddress).position.x, y: session.players.get(walletAddress).position.y, rotation: session.players.get(walletAddress).position.rotation || 0 },
        rotation: session.players.get(walletAddress).position.rotation || 0,
        submarineType: session.players.get(walletAddress).submarineTier || 0,
        username: walletAddress,
      })
    }
  })

  // Player movement
  socket.on("player-move", ({ walletAddress, sessionId, position }) => {
    if (!walletAddress || !sessionId || !position) return
    const session = gameSessions.get(sessionId)
    if (session && session.players.has(walletAddress)) {
      // Update position and rotation
      session.players.get(walletAddress).position = {
        x: position.x,
        y: position.y,
        z: 0,
        rotation: position.rotation || 0,
      }
      // Broadcast to others
      socket.to(sessionId).emit("player-moved", {
        id: walletAddress,
        position: { x: position.x, y: position.y, rotation: position.rotation || 0 },
        rotation: position.rotation || 0,
        submarineType: session.players.get(walletAddress).submarineTier || 0,
        username: walletAddress,
      })
    }
  })

  // Player disconnects
  socket.on("disconnect", () => {
    // Find which session/player this socket belonged to
    for (const [sessionId, session] of gameSessions.entries()) {
      for (const [walletAddress, player] of session.players.entries()) {
        if (player.socketId === socket.id) {
          session.players.delete(walletAddress)
          playerSessions.delete(walletAddress)
          // Notify others
          socket.to(sessionId).emit("player-left", { id: walletAddress })
          // If session is empty, remove it
          if (session.players.size === 0) {
            gameSessions.delete(sessionId)
          }
          return
        }
      }
    }
  })
})

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🌊 OceanX Backend Server running on port ${PORT}`)
  console.log(`🔗 Network: Sepolia Testnet`)
  console.log(`💾 Database: ${supabase ? "Configured" : "Mock Mode"}`)
  console.log(`🎮 Server ready for connections...`)
  console.log(`📍 Health check: ${PUBLIC_URL}/health`)
})

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully")
  server.close(() => {
    console.log("Process terminated")
  })
})

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully")
  server.close(() => {
    console.log("Process terminated")
  })
})
