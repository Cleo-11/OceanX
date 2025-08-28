// ...existing code...
// --- PLAYER API ENDPOINTS ---
// Get player OCX token balance
app.post("/player/balance", async (req, res) => {
  const { address } = req.body;
  if (!address) {
    return res.status(400).json({ error: "Missing address" });
  }
  if (!supabase) {
    return res.status(500).json({ error: "Supabase not initialized" });
  }
  try {
    // Query the players table for the wallet address (case-insensitive)
    const { data: player, error } = await supabase
      .from("players")
      .select("total_ocx_earned")
      .ilike("wallet_address", address)
      .single();
    if (error || !player) {
      return res.status(404).json({ error: "Player not found" });
    }
    // Return OCX balance as string (assuming total_ocx_earned is numeric)
    res.json({ balance: player.total_ocx_earned.toString(), symbol: "OCX", network: "mainnet" });
  } catch (err) {
    console.error("/player/balance error:", err);
    res.status(500).json({ error: "Failed to fetch player balance" });
  }
});

// Get player submarine info
app.post("/player/submarine", async (req, res) => {
  const { address } = req.body;
  if (!address) {
    return res.status(400).json({ error: "Missing address" });
  }
  if (!supabase) {
    return res.status(500).json({ error: "Supabase not initialized" });
  }
  try {
    // Query the players table for the wallet address (case-insensitive)
    const { data: player, error } = await supabase
      .from("players")
      .select("submarine_tier")
      .ilike("wallet_address", address)
      .single();
    if (error || !player) {
      return res.status(404).json({ error: "Player not found" });
    }
    // Query the submarine_tiers table for the current tier
    const { data: sub, error: subError } = await supabase
      .from("submarine_tiers")
      .select("id, tier, name, description, max_nickel, max_cobalt, max_copper, max_manganese, health, energy, speed, mining_rate, depth_limit, color, special_ability")
      .eq("tier", player.submarine_tier)
      .single();
    if (subError || !sub) {
      return res.status(404).json({ error: "Submarine tier not found" });
    }
    // Return the submarine info in the expected format
    res.json({
      current: {
        id: sub.id,
        tier: sub.tier,
        name: sub.name,
        description: sub.description,
        storage: sub.max_nickel, // or sum of all max_* fields if needed
        speed: sub.speed,
        miningPower: sub.mining_rate,
        color: sub.color,
        specialAbility: sub.special_ability,
      },
      canUpgrade: true, // You can add logic to determine this
    });
  } catch (err) {
    console.error("/player/submarine error:", err);
    res.status(500).json({ error: "Failed to fetch submarine info" });
  }
});
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

console.log("🌊 Starting OceanX Backend Server...");
console.log("Environment:", process.env.NODE_ENV || "development");
console.log("Port:", process.env.PORT || 5000);

// CORS configuration
const allowedOrigins = [
  /^https:\/\/ocean.*\.vercel\.app$/,
  "http://localhost:3000",
  "https://localhost:3000",
  "https://oceanx.onrender.com",
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.some((o) => (typeof o === "string" ? o === origin : o.test(origin)))) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Socket.IO setup
const io = socketIo(server, {
  cors: corsOptions,
  transports: ["websocket", "polling"],
});

// Initialize Supabase client
let supabase = null;
try {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.log("⚠️ Missing Supabase environment variables - running in mock mode");
  } else {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    console.log("✅ Supabase client initialized");
  }
} catch (error) {
  console.error("❌ Failed to initialize Supabase:", error);
}

// Initialize claim service
let claimService = null;
try {
  claimService = require('./claimService');
  console.log("✅ Claim service loaded");
} catch (error) {
  console.error("⚠️ Claim service not available:", error.message);
}

// Submarine tiers (UPDATED with the detailed structure)
const SUBMARINE_TIERS = [
  {
    tier: 1,
    name: "Nautilus I",
    description: "Basic exploration submarine with limited storage capacity.",
    baseStats: {
      health: 100,
      energy: 100,
      capacity: { nickel: 0, cobalt: 0, copper: 0, manganese: 0 },
      maxCapacity: { nickel: 100, cobalt: 50, copper: 50, manganese: 25 },
      depth: 1000,
      speed: 1,
      miningRate: 1,
      tier: 1,
    },
    upgradeCost: { nickel: 80, cobalt: 40, copper: 40, manganese: 20, tokens: 100 },
    color: "#fbbf24",
  },
  {
    tier: 2,
    name: "Nautilus II",
    description: "Improved submarine with enhanced storage and durability.",
    baseStats: {
      health: 125,
      energy: 120,
      capacity: { nickel: 0, cobalt: 0, copper: 0, manganese: 0 },
      maxCapacity: { nickel: 150, cobalt: 75, copper: 75, manganese: 40 },
      depth: 1200,
      speed: 1.1,
      miningRate: 1.2,
      tier: 2,
    },
    upgradeCost: { nickel: 140, cobalt: 70, copper: 70, manganese: 35, tokens: 200 },
    color: "#f59e0b",
  },
  {
    tier: 3,
    name: "Abyssal Explorer",
    description: "Specialized deep-sea submarine with reinforced hull.",
    baseStats: {
      health: 150,
      energy: 140,
      capacity: { nickel: 0, cobalt: 0, copper: 0, manganese: 0 },
      maxCapacity: { nickel: 200, cobalt: 100, copper: 100, manganese: 60 },
      depth: 1500,
      speed: 1.2,
      miningRate: 1.4,
      tier: 3,
    },
    upgradeCost: { nickel: 180, cobalt: 90, copper: 90, manganese: 50, tokens: 350 },
    color: "#d97706",
  },
  {
    tier: 4,
    name: "Mariana Miner",
    description: "Heavy-duty mining submarine with expanded cargo holds.",
    baseStats: {
      health: 175,
      energy: 160,
      capacity: { nickel: 0, cobalt: 0, copper: 0, manganese: 0 },
      maxCapacity: { nickel: 300, cobalt: 150, copper: 150, manganese: 80 },
      depth: 1800,
      speed: 1.3,
      miningRate: 1.6,
      tier: 4,
    },
    upgradeCost: { nickel: 250, cobalt: 125, copper: 125, manganese: 70, tokens: 500 },
    color: "#b45309",
  },
  {
    tier: 5,
    name: "Hydrothermal Hunter",
    description: "Advanced submarine with heat-resistant plating for volcanic regions.",
    baseStats: {
      health: 200,
      energy: 180,
      capacity: { nickel: 0, cobalt: 0, copper: 0, manganese: 0 },
      maxCapacity: { nickel: 400, cobalt: 200, copper: 200, manganese: 100 },
      depth: 2200,
      speed: 1.4,
      miningRate: 1.8,
      tier: 5,
    },
    upgradeCost: { nickel: 350, cobalt: 175, copper: 175, manganese: 90, tokens: 750 },
    color: "#92400e",
  },
  {
    tier: 6,
    name: "Pressure Pioneer",
    description: "Cutting-edge submarine designed for extreme depths.",
    baseStats: {
      health: 250,
      energy: 220,
      capacity: { nickel: 0, cobalt: 0, copper: 0, manganese: 0 },
      maxCapacity: { nickel: 500, cobalt: 250, copper: 250, manganese: 125 },
      depth: 2600,
      speed: 1.5,
      miningRate: 2.0,
      tier: 6,
    },
    upgradeCost: { nickel: 450, cobalt: 225, copper: 225, manganese: 110, tokens: 1000 },
    color: "#78350f",
    specialAbility: "Pressure Resistance: Immune to depth damage",
  },
  {
    tier: 7,
    name: "Quantum Diver",
    description: "Experimental submarine with quantum-stabilized hull.",
    baseStats: {
      health: 300,
      energy: 260,
      capacity: { nickel: 0, cobalt: 0, copper: 0, manganese: 0 },
      maxCapacity: { nickel: 650, cobalt: 325, copper: 325, manganese: 160 },
      depth: 3000,
      speed: 1.6,
      miningRate: 2.2,
      tier: 7,
    },
    upgradeCost: { nickel: 600, cobalt: 300, copper: 300, manganese: 150, tokens: 1500 },
    color: "#1e40af",
    specialAbility: "Quantum Scanning: Reveals hidden resource nodes",
  },
  {
    tier: 8,
    name: "Titan Voyager",
    description: "Massive submarine with reinforced titanium hull and expanded storage bays.",
    baseStats: {
      health: 350,
      energy: 300,
      capacity: { nickel: 0, cobalt: 0, copper: 0, manganese: 0 },
      maxCapacity: { nickel: 820, cobalt: 410, copper: 410, manganese: 205 },
      depth: 3500,
      speed: 1.7,
      miningRate: 2.4,
      tier: 8,
    },
    upgradeCost: { nickel: 750, cobalt: 375, copper: 375, manganese: 190, tokens: 2000 },
    color: "#1e3a8a",
    specialAbility: "Titanium Plating: 25% damage reduction",
  },
  {
    tier: 9,
    name: "Oceanic Behemoth",
    description: "Colossal mining vessel with automated resource processing systems.",
    baseStats: {
      health: 400,
      energy: 340,
      capacity: { nickel: 0, cobalt: 0, copper: 0, manganese: 0 },
      maxCapacity: { nickel: 990, cobalt: 495, copper: 495, manganese: 248 },
      depth: 4000,
      speed: 1.8,
      miningRate: 2.6,
      tier: 9,
    },
    upgradeCost: { nickel: 900, cobalt: 450, copper: 450, manganese: 225, tokens: 2750 },
    color: "#312e81",
    specialAbility: "Auto-Processing: Resources are refined automatically",
  },
  {
    tier: 10,
    name: "Abyssal Fortress",
    description: "Fortress-class submarine built for the deepest ocean trenches.",
    baseStats: {
      health: 500,
      energy: 400,
      capacity: { nickel: 0, cobalt: 0, copper: 0, manganese: 0 },
      maxCapacity: { nickel: 1160, cobalt: 580, copper: 580, manganese: 290 },
      depth: 5000,
      speed: 1.9,
      miningRate: 2.8,
      tier: 10,
    },
    upgradeCost: { nickel: 1100, cobalt: 550, copper: 550, manganese: 275, tokens: 3500 },
    color: "#581c87",
    specialAbility: "Fortress Mode: Immobile but 3x mining rate",
  },
  {
    tier: 11,
    name: "Kraken's Bane",
    description: "Legendary submarine designed to withstand the most hostile environments.",
    baseStats: {
      health: 600,
      energy: 460,
      capacity: { nickel: 0, cobalt: 0, copper: 0, manganese: 0 },
      maxCapacity: { nickel: 1330, cobalt: 665, copper: 665, manganese: 333 },
      depth: 6000,
      speed: 2.0,
      miningRate: 3.0,
      tier: 11,
    },
    upgradeCost: { nickel: 1300, cobalt: 650, copper: 650, manganese: 325, tokens: 4500 },
    color: "#7c2d12",
    specialAbility: "Kraken Slayer: Immune to all environmental hazards",
  },
  {
    tier: 12,
    name: "Void Walker",
    description: "Mysterious submarine that seems to bend space and time around it.",
    baseStats: {
      health: 700,
      energy: 520,
      capacity: { nickel: 0, cobalt: 0, copper: 0, manganese: 0 },
      maxCapacity: { nickel: 1500, cobalt: 750, copper: 750, manganese: 375 },
      depth: 7000,
      speed: 2.2,
      miningRate: 3.2,
      tier: 12,
    },
    upgradeCost: { nickel: 1500, cobalt: 750, copper: 750, manganese: 375, tokens: 6000 },
    color: "#0c0a09",
    specialAbility: "Void Phase: Can teleport short distances",
  },
  {
    tier: 13,
    name: "Stellar Harvester",
    description: "Advanced submarine powered by miniaturized stellar technology.",
    baseStats: {
      health: 800,
      energy: 600,
      capacity: { nickel: 0, cobalt: 0, copper: 0, manganese: 0 },
      maxCapacity: { nickel: 1670, cobalt: 835, copper: 835, manganese: 418 },
      depth: 8000,
      speed: 2.4,
      miningRate: 3.4,
      tier: 13,
    },
    upgradeCost: { nickel: 1700, cobalt: 850, copper: 850, manganese: 425, tokens: 7500 },
    color: "#fbbf24",
    specialAbility: "Stellar Power: Unlimited energy in sunlight zones",
  },
  {
    tier: 14,
    name: "Cosmic Dreadnought",
    description: "The penultimate submarine, incorporating alien technology.",
    baseStats: {
      health: 900,
      energy: 700,
      capacity: { nickel: 0, cobalt: 0, copper: 0, manganese: 0 },
      maxCapacity: { nickel: 1840, cobalt: 920, copper: 920, manganese: 460 },
      depth: 9000,
      speed: 2.6,
      miningRate: 3.6,
      tier: 14,
    },
    upgradeCost: { nickel: 1900, cobalt: 950, copper: 950, manganese: 475, tokens: 9000 },
    color: "#a855f7",
    specialAbility: "Cosmic Resonance: Attracts rare resources",
  },
  {
    tier: 15,
    name: "Leviathan",
    description: "The ultimate deep-sea mining vessel, unmatched in all aspects.",
    baseStats: {
      health: 1000,
      energy: 1000,
      capacity: { nickel: 0, cobalt: 0, copper: 0, manganese: 0 },
      maxCapacity: { nickel: 2000, cobalt: 1000, copper: 1000, manganese: 500 },
      depth: 10000,
      speed: 3.0,
      miningRate: 5.0,
      tier: 15,
    },
    upgradeCost: { nickel: 0, cobalt: 0, copper: 0, manganese: 0, tokens: 0 },
    color: "#7e22ce",
    specialAbility: "Omnimining: Can mine all resources simultaneously",
  },
];

// Game state management
const gameSessions = new Map(); // Map<sessionId, { id, players: Map<walletAddress, playerData>, resourceNodes }>
const MAX_PLAYERS_PER_SESSION = 20;

// Resource generation parameters
const MAP_SIZE = 1000;
const NUM_RESOURCE_NODES = 50;
const RESOURCE_TYPES = ["nickel", "cobalt", "copper", "manganese"];

function generateInitialResourceNodes() {
    const nodes = [];
    for (let i = 0; i < NUM_RESOURCE_NODES; i++) {
        const type = RESOURCE_TYPES[Math.floor(Math.random() * RESOURCE_TYPES.length)];
        const amount = Math.floor(Math.random() * 1501) + 500;
        nodes.push({
            id: `node-${Date.now()}-${i}`,
            type,
            position: {
                x: Math.random() * MAP_SIZE - MAP_SIZE / 2,
                y: Math.random() * MAP_SIZE - MAP_SIZE / 2,
                z: Math.random() * 500 - 250,
            },
            amount: amount,
            maxAmount: amount,
            size: Math.floor(Math.random() * 21) + 10,
            depleted: false,
        });
    }
    return nodes;
}

// --- SOCKET.IO HANDLERS FOR MULTIPLAYER ---
io.on("connection", (socket) => {
    console.log(`🔌 New socket connected: ${socket.id}`);

    /**
     * Handles a player's request to join the game.
     * This is the single entry point for a player to enter a world.
     */
    socket.on("join-game", async (payload) => {
        console.log(`[SERVER] Received 'join-game' with payload:`, payload);
        const { walletAddress, sessionId } = payload || {};
        
        if (!walletAddress) {
            socket.emit("error", { message: "Wallet address is required to join." });
            return;
        }

        // Check if player is already in a session
        if (socket.walletAddress && socket.sessionId) {
            console.log(`Player ${walletAddress} already in session ${socket.sessionId}`);
            const currentSession = gameSessions.get(socket.sessionId);
            if (currentSession) {
                // Send current game state
                const playersArray = Array.from(currentSession.players.values());
                const resourcesArray = Array.from(currentSession.resourceNodes.values());
                
                socket.emit("game-state", {
                    sessionId: currentSession.id,
                    players: playersArray,
                    resources: resourcesArray,
                    myPlayerId: walletAddress
                });
                return;
            }
        }

        let sessionToJoin;

        // If a specific sessionId is provided and exists, try to join it
        if (sessionId && gameSessions.has(sessionId)) {
            const requestedSession = gameSessions.get(sessionId);
            if (requestedSession.players.size < MAX_PLAYERS_PER_SESSION) {
                sessionToJoin = requestedSession;
                console.log(`Joining requested session: ${sessionId}`);
            } else {
                console.log(`Requested session ${sessionId} is full, finding alternative`);
            }
        }

        // If no specific session or requested session is full, find or create one
        if (!sessionToJoin) {
            // Sort sessions by player count to prefer filling existing sessions
            const availableSessions = Array.from(gameSessions.values())
                .filter(session => session.players.size < MAX_PLAYERS_PER_SESSION)
                .sort((a, b) => b.players.size - a.players.size); // Prefer sessions with more players

            if (availableSessions.length > 0) {
                sessionToJoin = availableSessions[0];
                console.log(`✅ Found available session: ${sessionToJoin.id} with ${sessionToJoin.players.size} players`);
            } else {
                // Create new session
                const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const resourceNodes = generateInitialResourceNodes();
                sessionToJoin = {
                    id: newSessionId,
                    players: new Map(),
                    resourceNodes: new Map(resourceNodes.map((node) => [node.id, node])),
                    createdAt: Date.now()
                };
                gameSessions.set(newSessionId, sessionToJoin);
                console.log(`🆕 Created new game session: ${newSessionId}`);
            }
        }

        // Remove player from any existing session first
        if (socket.sessionId) {
            const oldSession = gameSessions.get(socket.sessionId);
            if (oldSession && oldSession.players.has(walletAddress)) {
                oldSession.players.delete(walletAddress);
                socket.leave(socket.sessionId);
                socket.to(socket.sessionId).emit("player-left", { id: walletAddress });
                console.log(`Removed player ${walletAddress} from old session ${socket.sessionId}`);
            }
        }

        // Create player object
        const player = {
            id: walletAddress,
            socketId: socket.id,
            position: { x: 0, y: 0, z: 0, rotation: 0 },
            resources: { nickel: 0, cobalt: 0, copper: 0, manganese: 0 },
            submarineTier: 0, // Default tier, can be updated from DB
            joinedAt: Date.now()
        };

        // Add player to the session
        sessionToJoin.players.set(walletAddress, player);

        // Store session and player info on socket
        socket.walletAddress = walletAddress;
        socket.sessionId = sessionToJoin.id;

        // Join the socket room
        socket.join(sessionToJoin.id);

        console.log(`➕ Player ${walletAddress} joined session ${sessionToJoin.id}. Total players: ${sessionToJoin.players.size}`);
        console.log(`Current players in session:`, Array.from(sessionToJoin.players.keys()));

        // Send the complete game state to the newly joined player
        const playersArray = Array.from(sessionToJoin.players.values());
        const resourcesArray = Array.from(sessionToJoin.resourceNodes.values());
        
        socket.emit("game-state", {
            sessionId: sessionToJoin.id,
            players: playersArray,
            resources: resourcesArray,
            myPlayerId: walletAddress
        });

        // Notify all other players in the room that a new player has joined
        socket.to(sessionToJoin.id).emit("player-joined", player);
        
        console.log(`📤 Sent game-state to ${walletAddress} with ${playersArray.length} players and ${resourcesArray.length} resources`);
    });

    /**
     * Enhanced player movement handler with better validation.
     */
    socket.on("player-move", (data) => {
        const { sessionId, walletAddress, position } = data;
        
        // Validate all required fields
        if (!sessionId || !walletAddress || !position) {
            console.log(`❌ Invalid player-move data:`, data);
            return;
        }

        // Use socket's stored sessionId if available for consistency
        const actualSessionId = socket.sessionId || sessionId;
        const session = gameSessions.get(actualSessionId);
        
        if (!session) {
            console.log(`❌ Session not found: ${actualSessionId}`);
            socket.emit("error", { message: "Session not found" });
            return;
        }
        
        const player = session.players.get(walletAddress);
        if (!player) {
            console.log(`❌ Player not found in session: ${walletAddress}`);
            socket.emit("error", { message: "Player not found in session" });
            return;
        }

        // Update player position
        player.position = position;
        
        // Broadcast to other players in the same session
        const moveData = {
            id: walletAddress,
            position: player.position,
            timestamp: Date.now()
        };
        
        socket.to(actualSessionId).emit("player-moved", moveData);
        
        // Optional: Log movement for debugging (uncomment if needed)
        // console.log(`🚶 Player ${walletAddress} moved in session ${actualSessionId}:`, position);
    });

    /**
     * Enhanced disconnect handler with better cleanup.
     */
    socket.on("disconnect", () => {
        console.log(`🔌 Socket disconnected: ${socket.id}`);

        const { walletAddress, sessionId } = socket;

        if (walletAddress && sessionId) {
            const session = gameSessions.get(sessionId);
            if (session && session.players.has(walletAddress)) {
                // Remove player from the session
                session.players.delete(walletAddress);
                console.log(`➖ Player ${walletAddress} left session ${sessionId}. Remaining players: ${session.players.size}`);
                console.log(`Remaining players:`, Array.from(session.players.keys()));

                // Notify remaining players
                io.to(sessionId).emit("player-left", { 
                    id: walletAddress,
                    timestamp: Date.now()
                });

                // If the session is empty, mark for cleanup but don't delete immediately
                // This allows for reconnections within a short timeframe
                if (session.players.size === 0) {
                    session.emptyAt = Date.now();
                    console.log(`📝 Session ${sessionId} is now empty, marked for cleanup`);
                }
            }
        }
    });
});

// --- HTTP Endpoints (for auth, etc.) ---

// Root endpoint for basic info
app.get("/", (req, res) => {
    res.json({ message: "🌊 OceanX Backend API is running" });
});

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({
        status: "OK",
        timestamp: new Date().toISOString(),
        activeSessions: gameSessions.size,
        totalPlayers: Array.from(gameSessions.values()).reduce((total, session) => total + session.players.size, 0),
        claimServiceAvailable: !!claimService,
    });
});

// Enhanced sessions endpoint with more details
app.get("/sessions", (req, res) => {
    const sessions = Array.from(gameSessions.values()).map(session => ({
        id: session.id,
        playerCount: session.players.size,
        createdAt: session.createdAt,
        players: Array.from(session.players.values()).map(player => ({
            id: player.id,
            socketId: player.socketId,
            position: player.position,
            resources: player.resources,
            submarineTier: player.submarineTier,
            joinedAt: player.joinedAt
        })),
        resourceNodeCount: session.resourceNodes.size
    }));
    
    res.json({ 
        sessions,
        totalSessions: gameSessions.size,
        totalPlayers: Array.from(gameSessions.values()).reduce((total, session) => total + session.players.size, 0)
    });
});

// New endpoint to get specific session details
app.get("/sessions/:sessionId", (req, res) => {
    const session = gameSessions.get(req.params.sessionId);
    if (!session) {
        return res.status(404).json({ error: "Session not found" });
    }
    
    res.json({
        id: session.id,
        playerCount: session.players.size,
        createdAt: session.createdAt,
        players: Array.from(session.players.values()),
        resourceNodes: Array.from(session.resourceNodes.values())
    });
});

// Endpoint to claim tokens (trigger contract claim)
app.post("/claim", async (req, res) => {
    try {
        const { userAddress, amount, signature } = req.body;
        if (!userAddress || !amount || !signature) {
            return res.status(400).json({ error: "Missing parameters" });
        }
        if (!claimService) {
            return res.status(503).json({ error: "Claim service not available" });
        }
        const txHash = await claimService.claimTokens(userAddress, amount, signature);
        res.json({ success: true, txHash });
    } catch (err) {
        console.error("Claim error:", err);
        res.status(500).json({ error: err.message || "Internal error" });
    }
});

// Add periodic session cleanup to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    
    for (const [sessionId, session] of gameSessions.entries()) {
        // Remove sessions that are old and empty
        if (session.players.size === 0 && session.emptyAt && (now - session.emptyAt) > 5 * 60 * 1000) { // 5 minutes after becoming empty
            gameSessions.delete(sessionId);
            console.log(`🧹 Cleaned up old empty session: ${sessionId}`);
        }
        
        // Remove players who haven't been active (optional - uncomment if needed)
        /*
        for (const [walletAddress, player] of session.players.entries()) {
            if (player.joinedAt && (now - player.joinedAt) > SESSION_TIMEOUT * 2) {
                session.players.delete(walletAddress);
                io.to(sessionId).emit("player-left", { id: walletAddress });
                console.log(`🧹 Removed inactive player: ${walletAddress} from session: ${sessionId}`);
            }
        }
        */
    }
}, 5 * 60 * 1000); // Run every 5 minutes

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server is live on port ${PORT}`);
    console.log(`🎮 Waiting for player connections...`);
});

// Graceful shutdown
const gracefulShutdown = () => {
    console.log("Shutting down gracefully...");
    server.close(() => {
        console.log("Server closed.");
        process.exit(0);
    });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);