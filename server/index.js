const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const { ethers } = require("ethers");
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

// Submarine tiers (assuming this is static data)
const SUBMARINE_TIERS = [
    { id: 0, name: "Basic Submarine", cost: 0, speed: 1, storage: 10, miningPower: 1, hull: 100, energy: 100 },
    { id: 1, name: "Enhanced Submarine", cost: 100, speed: 1.2, storage: 15, miningPower: 1.5, hull: 125, energy: 120 },
    { id: 2, name: "Deep-Sea Submarine", cost: 250, speed: 1.4, storage: 20, miningPower: 2, hull: 150, energy: 140 },
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
    socket.on("join-game", async ({ walletAddress }) => {
        if (!walletAddress) {
            socket.emit("error", { message: "Wallet address is required to join." });
            return;
        }

        // --- Simplified and Race-Condition-Free Session Logic ---
        let sessionToJoin = null;

        // 1. Find an available session
        for (const session of gameSessions.values()) {
            if (session.players.size < MAX_PLAYERS_PER_SESSION) {
                sessionToJoin = session;
                break;
            }
        }

        // 2. If no session is available, create a new one
        if (!sessionToJoin) {
            const newSessionId = `session-${Date.now()}`;
            const resourceNodes = generateInitialResourceNodes();
            sessionToJoin = {
                id: newSessionId,
                players: new Map(),
                resourceNodes: new Map(resourceNodes.map((node) => [node.id, node])),
            };
            gameSessions.set(newSessionId, sessionToJoin);
            console.log(`🆕 Created new game session: ${newSessionId}`);
        }

        // 3. Add player to the session
        const player = {
            id: walletAddress,
            socketId: socket.id,
            position: { x: 0, y: 0, z: 0, rotation: 0 },
            resources: { nickel: 0, cobalt: 0, copper: 0, manganese: 0 },
            submarineTier: 0, // Default tier, can be updated from DB
        };
        sessionToJoin.players.set(walletAddress, player);

        // Store session and player info directly on the socket for efficient lookup on disconnect
        socket.walletAddress = walletAddress;
        socket.sessionId = sessionToJoin.id;

        // Have the socket join the session's "room"
        socket.join(sessionToJoin.id);

        console.log(`➕ Player ${walletAddress} joined session ${sessionToJoin.id}. Total players: ${sessionToJoin.players.size}`);

        // 4. Send the complete game state to the newly joined player
        const playersArray = Array.from(sessionToJoin.players.values());
        const resourcesArray = Array.from(sessionToJoin.resourceNodes.values());
        
        socket.emit("game-state", {
            sessionId: sessionToJoin.id,
            players: playersArray,
            resources: resourcesArray,
            myPlayerId: walletAddress
        });

        // 5. Notify all other players in the room that a new player has joined
        socket.to(sessionToJoin.id).emit("player-joined", player);
    });

    /**
     * Handles player movement updates.
     */
    socket.on("player-move", (data) => {
        const { sessionId, walletAddress, position } = data;
        if (!sessionId || !walletAddress || !position) return;

        const session = gameSessions.get(sessionId);
        const player = session?.players.get(walletAddress);

        if (player) {
            player.position = position;
            // Broadcast the movement to other players in the same session
            socket.to(sessionId).emit("player-moved", {
                id: walletAddress,
                position: player.position,
            });
        }
    });

    /**
     * Handles player disconnection efficiently.
     */
    socket.on("disconnect", () => {
        console.log(`🔌 Socket disconnected: ${socket.id}`);

        // Retrieve session and player info directly from the socket object
        const { walletAddress, sessionId } = socket;

        if (walletAddress && sessionId) {
            const session = gameSessions.get(sessionId);
            if (session) {
                // Remove player from the session
                session.players.delete(walletAddress);
                console.log(`➖ Player ${walletAddress} left session ${sessionId}. Total players: ${session.players.size}`);

                // Notify remaining players
                io.to(sessionId).emit("player-left", { id: walletAddress });

                // If the session is empty, delete it
                if (session.players.size === 0) {
                    gameSessions.delete(sessionId);
                    console.log(`🗑️ Deleted empty session: ${sessionId}`);
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
    });
});

// NOTE: The /game/join endpoint is no longer needed with this improved flow.
// The client should now connect and emit a "join-game" event instead.

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