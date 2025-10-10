// ...existing code...

require("ts-node/register/transpile-only");

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { createClient } = require("@supabase/supabase-js");
const {
  verifyJoinSignature,
  createAuthMiddleware,
  ensureAuthenticationFresh,
  DEFAULT_MAX_SIGNATURE_AGE_MS,
} = require("./auth");
const {
  validateInput,
  playerMovePayloadSchema,
  mineResourcePayloadSchema,
  playerPositionSchema,
  resourceNodeSchema,
  playerResourcesSchema,
} = require("./lib/validation.ts");
const { sanitizeHtml, sanitizePlainText } = require("./lib/sanitize.ts");
require("dotenv").config();

// Utility functions for input validation and sanitization
function isValidWalletAddress(address) {
  if (typeof address !== "string") return false;
  // Ethereum address validation: 0x followed by 40 hex characters
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function isValidPosition(position) {
  if (!position || typeof position !== "object") return false;
  const { x, y, z, rotation } = position;
  return (
    isFiniteNumber(x) &&
    isFiniteNumber(y) &&
    isFiniteNumber(z) &&
    (rotation === undefined || isFiniteNumber(rotation))
  );
}

function sanitizePosition(position) {
  return {
    x: Math.max(-10000, Math.min(10000, position.x || 0)),
    y: Math.max(-10000, Math.min(10000, position.y || 0)),
    z: Math.max(-10000, Math.min(10000, position.z || 0)),
    rotation: position.rotation !== undefined ? Math.max(-360, Math.min(360, position.rotation)) : 0,
  };
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

// Initialize express app BEFORE using it
const app = express();
const server = http.createServer(app);

// Add body parser middleware with conservative limits
app.use(
  express.json({
    limit: "1mb",
    strict: true,
    verify: (req, res, buf) => {
      if (buf && buf.length > 1024 * 1024) {
        throw new Error("Payload too large")
      }
    },
  })
)
app.use(
  express.urlencoded({
    extended: false,
    limit: "1mb",
    parameterLimit: 100,
  })
)

const sanitizeRequestBody = (body) => {
  if (!body || typeof body !== "object") {
    return body
  }

  if (Array.isArray(body)) {
    return body.slice(0, 100).map((item) => sanitizeRequestBody(item))
  }

  if (Object.getPrototypeOf(body) !== Object.prototype) {
    return {}
  }

  return Object.entries(body).reduce((acc, [key, value]) => {
    if (typeof value === "string") {
      acc[key] = value.trim()
    } else if (value && typeof value === "object") {
      acc[key] = sanitizeRequestBody(value)
    } else {
      acc[key] = value
    }
    return acc
  }, {})
}

app.use((req, res, next) => {
  try {
    if (req.body && typeof req.body === "object") {
      req.body = sanitizeRequestBody(req.body)
    }
    next()
  } catch (error) {
    console.warn("❌ Failed to sanitize request body", { path: req.path, method: req.method, error: error?.message })
    res.status(400).json({ error: "Invalid request payload" })
  }
})

const respondWithError = (res, status, message, code) => {
  res.status(status).json({ error: message, code })
}

const logServerError = (scope, error, context = {}) => {
  const safeMessage = error instanceof Error ? error.message : String(error)
  const payload = {
    ...context,
    scope,
    message: safeMessage,
  }
  if (process.env.NODE_ENV !== "production" && error instanceof Error) {
    payload.stack = error.stack
  }
  console.error("❌", payload)
}

const createRateLimiter = ({ windowMs, max, message, code, skip }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip,
    keyGenerator: (req) => {
      const forwarded = req.headers["x-forwarded-for"]
      if (typeof forwarded === "string") {
        return forwarded.split(",")[0].trim()
      }
      return req.ip || req.socket.remoteAddress || "unknown"
    },
    handler: (req, res) => {
      respondWithError(res, 429, message || "Too many requests. Please slow down.", code || "RATE_LIMIT")
    },
  })

const globalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: "Too many requests. Please slow down.",
  code: "GLOBAL_RATE_LIMIT",
  skip: (req) => req.path === "/health",
})

const sensitiveActionLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: "Too many claim attempts. Try again later.",
  code: "CLAIM_RATE_LIMIT",
})

// Backwards-compatible alias used by some route handlers
const claimLimiter = sensitiveActionLimiter

const playerDataLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: "Too many player data requests.",
  code: "PLAYER_RATE_LIMIT",
})

app.use(globalApiLimiter)

const isSocketRateLimited = (socket, key, limit, intervalMs) => {
  if (!socket._rateLimiters) {
    socket._rateLimiters = {}
  }

  const now = Date.now()
  const current = socket._rateLimiters[key] || { count: 0, expiresAt: now + intervalMs }

  if (now > current.expiresAt) {
    current.count = 0
    current.expiresAt = now + intervalMs
  }

  current.count += 1
  socket._rateLimiters[key] = current

  return current.count > limit
}


console.log("🌊 Starting OceanX Backend Server...");
console.log("Environment:", process.env.NODE_ENV || "development");
console.log("Port:", process.env.PORT || 5000);

const requirePlayerBalanceAuth = createAuthMiddleware({
  expectedActions: ["get-balance", "get balance"],
});

const requirePlayerSubmarineAuth = createAuthMiddleware({
  expectedActions: ["get-submarine", "get submarine"],
});

const requireSubmarineUpgradeAuth = createAuthMiddleware({
  expectedActions: ["upgrade submarine", "upgrade-submarine", "submarine-upgrade", "upgrade"],
});

const claimBodyKeys = {
  address: ["userAddress", "walletAddress", "address", "wallet"],
  signature: ["authSignature", "signature"],
  message: ["authMessage", "message"],
};

const claimHeaderKeys = {
  address: ["x-wallet-address", "x-wallet", "x-user-address"],
  signature: ["x-auth-signature", "x-wallet-signature", "x-signature"],
  message: ["x-auth-message", "x-wallet-message", "x-signature-message"],
};

const requireClaimAuth = createAuthMiddleware({
  expectedActions: ["claim", "claim-tokens", "claim tokens"],
  bodyKeys: claimBodyKeys,
  headerKeys: claimHeaderKeys,
});

const requireSessionsAuth = createAuthMiddleware({
  expectedActions: ["sessions", "view-sessions", "admin"],
});

const requireSessionDetailAuth = createAuthMiddleware({
  expectedActions: ["sessions", "session-detail", "view-session", "admin"],
});

// --- PLAYER API ENDPOINTS ---
// Get player OCX token balance
app.post("/player/balance", playerDataLimiter, requirePlayerBalanceAuth, async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: "Supabase not initialized" });
  }

  const wallet = req?.auth?.wallet;
  if (!wallet) {
    return res.status(401).json({ error: "Wallet authentication required" });
  }
  const providedAddress = typeof req.body?.address === "string" ? req.body.address.toLowerCase().trim() : undefined;
  if (providedAddress && wallet && providedAddress !== wallet) {
    return res.status(401).json({ error: "Wallet mismatch" });
  }

  try {
    // Query the players table for the wallet address (case-insensitive)
    const { data: player, error } = await supabase
      .from("players")
      .select("coins, total_ocx_earned")
      .ilike("wallet_address", wallet)
      .single();
    if (error || !player) {
      return res.status(404).json({ error: "Player not found" });
    }
    const coinsValue = Number(player.coins ?? 0);
    const ocxValue = player.total_ocx_earned != null ? player.total_ocx_earned.toString() : "0";

    res.json({
      coins: Number.isFinite(coinsValue) ? coinsValue : 0,
      balance: coinsValue.toString(),
      symbol: "COIN",
      network: "offchain",
      legacyTokenBalance: ocxValue,
    });
  } catch (err) {
    logServerError("player-balance", err, { wallet });
    respondWithError(res, 500, "Unable to fetch player balance. Please try again later.", "BALANCE_FETCH_FAILED");
  }
});

// Get player submarine info
app.post("/player/submarine", playerDataLimiter, requirePlayerSubmarineAuth, async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: "Supabase not initialized" });
  }

  const wallet = req?.auth?.wallet;
  if (!wallet) {
    return res.status(401).json({ error: "Wallet authentication required" });
  }
  const providedAddress = typeof req.body?.address === "string" ? req.body.address.toLowerCase().trim() : undefined;
  if (providedAddress && wallet && providedAddress !== wallet) {
    return res.status(401).json({ error: "Wallet mismatch" });
  }

  try {
    // Query the players table for the wallet address (case-insensitive)
    const { data: player, error } = await supabase
      .from("players")
      .select("submarine_tier")
      .ilike("wallet_address", wallet)
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

app.post("/submarine/upgrade", sensitiveActionLimiter, requireSubmarineUpgradeAuth, async (req, res) => {
  if (!supabase) {
    return respondWithError(res, 500, "Supabase not initialized", "SUPABASE_OFFLINE");
  }

  const wallet = req?.auth?.wallet;
  if (!wallet) {
    return respondWithError(res, 401, "Wallet authentication required", "WALLET_REQUIRED");
  }

  const normalizedWallet = wallet.toLowerCase();
  const providedAddress = typeof req.body?.address === "string" ? req.body.address.toLowerCase().trim() : undefined;
  if (providedAddress && providedAddress !== normalizedWallet) {
    return respondWithError(res, 401, "Wallet mismatch", "WALLET_MISMATCH");
  }

  const requestedPlayerIdRaw = typeof req.body?.playerId === "string" ? req.body.playerId.trim() : undefined;

  let playerRecord;
  try {
    let query = supabase
      .from("players")
      .select("id, wallet_address, submarine_tier, coins")
      .limit(1);

    if (requestedPlayerIdRaw) {
      query = query.eq("id", requestedPlayerIdRaw);
    } else {
      query = query.ilike("wallet_address", normalizedWallet);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return respondWithError(res, 404, "Player record not found", "PLAYER_NOT_FOUND");
    }

    const playerWallet = typeof data.wallet_address === "string" ? data.wallet_address.toLowerCase() : null;
    if (playerWallet && playerWallet !== normalizedWallet) {
      return respondWithError(res, 403, "Player record does not belong to authenticated wallet", "PLAYER_OWNERSHIP_MISMATCH");
    }

    playerRecord = data;
  } catch (error) {
    logServerError("submarine-upgrade-player-fetch", error, { wallet: normalizedWallet });
    return respondWithError(res, 500, "Unable to load player profile", "PLAYER_FETCH_FAILED");
  }

  const currentTierRaw = Number.parseInt(playerRecord?.submarine_tier, 10);
  const currentTier = Number.isFinite(currentTierRaw) && currentTierRaw >= 1 ? currentTierRaw : 1;

  if (currentTier >= MAX_SUBMARINE_TIER) {
    return respondWithError(res, 409, "Maximum submarine tier already reached", "TIER_MAXED");
  }

  const requestedTier = parseTierInput(req.body?.targetTier ?? req.body?.requestedTier);
  const targetTier = requestedTier ?? currentTier + 1;

  if (!Number.isInteger(targetTier) || targetTier <= 0) {
    return respondWithError(res, 400, "Invalid target tier provided", "INVALID_TIER");
  }

  if (targetTier !== currentTier + 1) {
    return respondWithError(res, 409, "Submarines must be upgraded sequentially", "NON_SEQUENTIAL_TIER");
  }

  if (targetTier > MAX_SUBMARINE_TIER) {
    return respondWithError(res, 400, "Requested tier exceeds configured maximum", "TIER_OUT_OF_RANGE");
  }

  const tierDefinition = getTierDefinition(targetTier);
  if (!tierDefinition) {
    return respondWithError(res, 404, "Requested tier definition not found", "TIER_DEFINITION_MISSING");
  }

  const currentCoinsRaw = playerRecord?.coins;
  const currentCoinsValue = Number(currentCoinsRaw);
  const currentCoins = Number.isFinite(currentCoinsValue) ? currentCoinsValue : 0;
  
  // Get upgrade cost from tier definition (token-only economy)
  const upgradeCost = tierDefinition.upgradeCost?.tokens ?? 0;

  if (currentCoins < upgradeCost) {
    return respondWithError(res, 402, "Not enough coins to upgrade submarine", "INSUFFICIENT_COINS");
  }

  const newCoins = currentCoins - upgradeCost;
  const timestamp = new Date().toISOString();

  try {
    const { data: updatedPlayer, error: updateError } = await supabase
      .from("players")
      .update({
        submarine_tier: targetTier,
        coins: newCoins,
        updated_at: timestamp,
      })
      .eq("id", playerRecord.id)
      .select("id, submarine_tier, coins")
      .single();

    if (updateError || !updatedPlayer) {
      throw updateError || new Error("Failed to persist upgrade");
    }

    const newTierPayload = buildSubmarineResponse(tierDefinition);

    const updatedCoinsValue = Number(updatedPlayer.coins);

    res.json({
      playerId: updatedPlayer.id,
      wallet: normalizedWallet,
      previousTier: currentTier,
      newTier: newTierPayload?.tier ?? updatedPlayer.submarine_tier,
      tierDetails: newTierPayload,
      coins: Number.isFinite(updatedCoinsValue) ? updatedCoinsValue : newCoins,
      cost: {
        coins: upgradeCost,
      },
      timestamp,
      message: `Submarine upgraded to tier ${targetTier}`,
    });
  } catch (error) {
    logServerError("submarine-upgrade-persist", error, {
      wallet: normalizedWallet,
      playerId: playerRecord.id,
    });
    return respondWithError(res, 500, "Failed to apply submarine upgrade", "UPGRADE_PERSIST_FAILED");
  }
});

// Daily claim endpoint
app.post("/player/claim", claimLimiter, requireClaimAuth, async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: "Supabase not initialized" });
  }

  const wallet = req?.auth?.wallet;
  if (!wallet) {
    return res.status(401).json({ error: "Wallet authentication required" });
  }
  const providedAddress = typeof req.body?.address === "string" ? req.body.address.toLowerCase().trim() : undefined;
  if (providedAddress && wallet && providedAddress !== wallet) {
    return res.status(401).json({ error: "Wallet mismatch" });
  }

  try {
    const today = new Date().toISOString().split("T")[0];
    const { data: player, error: fetchError } = await supabase
      .from("players")
      .select("*")
      .ilike("wallet_address", wallet)
      .single();

    if (fetchError) {
      console.error("[server] Error fetching player for claim:", fetchError.message);
      return res.status(500).json({ error: "Error fetching player data" });
    }

    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }

    // Check if already claimed today
    if (player.last_daily_claim === today) {
      return res.status(409).json({ error: "Already claimed today" });
    }

    const claimAmount = player.submarine_tier === "luxury" ? 1000 : 500;
    const newBalance = player.balance + claimAmount;

    const { error: updateError } = await supabase
      .from("players")
      .update({
        balance: newBalance,
        last_daily_claim: today,
      })
      .eq("wallet_address", wallet);

    if (updateError) {
      console.error("[server] Error updating player claim:", updateError.message);
      return res.status(500).json({ error: "Error processing claim" });
    }

    res.json({
      success: true,
      amount: claimAmount,
      new_balance: newBalance,
    });
  } catch (err) {
    console.error("[server] Error in claim endpoint:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// CORS configuration
const allowedOrigins = [
  // Production domains
  /^https:\/\/oceanx-frontend.*\.onrender\.com$/,
  /^https:\/\/ocean.*\.vercel\.app$/,
  // Development
  "http://localhost:3000",
  "https://localhost:3000",
  // Legacy support
  "https://oceanx.onrender.com",
]

// Add frontend URL from environment if provided
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL)
  console.log("🔗 Added FRONTEND_URL to CORS:", process.env.FRONTEND_URL)
};

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

// Socket.IO setup with production optimizations
const io = socketIo(server, {
  cors: corsOptions,
  transports: ["websocket"], // DISABLE POLLING for performance
  maxHttpBufferSize: 1e6, // 1MB limit
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
  perMessageDeflate: false, // Disable compression for lower latency
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

// Track connections per IP for DDoS protection
const connectionsByIP = new Map();
const MAX_CONNECTIONS_PER_IP = 5;

// Add connection limiting middleware
io.use((socket, next) => {
  const ip = socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
             socket.handshake.address;
  
  const count = connectionsByIP.get(ip) || 0;
  
  if (count >= MAX_CONNECTIONS_PER_IP) {
    console.warn(`🚫 Connection limit exceeded for IP: ${ip}`);
    return next(new Error('Too many connections from this IP'));
  }
  
  connectionsByIP.set(ip, count + 1);
  
  socket.on('disconnect', () => {
    const current = connectionsByIP.get(ip) || 0;
    connectionsByIP.set(ip, Math.max(0, current - 1));
  });
  
  next();
});

// Submarine tiers (UPDATED with token-only economy)
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
    upgradeCost: { tokens: 100 },
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
    upgradeCost: { tokens: 200 },
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
    upgradeCost: { tokens: 350 },
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
    upgradeCost: { tokens: 500 },
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
    upgradeCost: { tokens: 750 },
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
    upgradeCost: { tokens: 1000 },
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
    upgradeCost: { tokens: 1500 },
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
    upgradeCost: { tokens: 2000 },
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
    upgradeCost: { tokens: 2750 },
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
    upgradeCost: { tokens: 3500 },
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
    upgradeCost: { tokens: 4500 },
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
    upgradeCost: { tokens: 6000 },
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
    upgradeCost: { tokens: 7500 },
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
    upgradeCost: { tokens: 9000 },
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
    upgradeCost: { tokens: 0 },
    color: "#7e22ce",
    specialAbility: "Omnimining: Can mine all resources simultaneously",
  },
];

const SUBMARINE_TIER_LOOKUP = new Map(SUBMARINE_TIERS.map((tier) => [tier.tier, tier]));
const MAX_SUBMARINE_TIER = Math.max(...SUBMARINE_TIERS.map((tier) => tier.tier));

const parseTierInput = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.length) {
      return undefined;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const getTierDefinition = (tier) => SUBMARINE_TIER_LOOKUP.get(tier) || null;

const buildSubmarineResponse = (tierDefinition) => {
  if (!tierDefinition) {
    return null;
  }

  const baseStats = tierDefinition.baseStats || {};
  const upgradeCost = tierDefinition.upgradeCost || {};
  const storageCapacity =
    baseStats.maxCapacity?.nickel ?? baseStats.capacity?.nickel ?? 0;

  return {
    id: tierDefinition.tier,
    tier: tierDefinition.tier,
    name: tierDefinition.name,
    description: tierDefinition.description,
    cost: upgradeCost.tokens ?? 0,
    speed: baseStats.speed ?? 0,
    storage: storageCapacity,
    miningPower: baseStats.miningRate ?? 0,
    hull: baseStats.health ?? 0,
    energy: baseStats.energy ?? 0,
    color: tierDefinition.color,
    specialAbility: tierDefinition.specialAbility,
    baseStats,
    upgradeCost,
  };
};

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

    // Socket-level rate limiting middleware
    socket.use((packet, next) => {
      const [event] = packet;
      
      // Skip internal events
      if (event === 'ping' || event === 'pong') return next();
      
      // Global rate limit per socket
      if (isSocketRateLimited(socket, 'global', 100, 60000)) {
        socket.emit('error', { message: 'Rate limit exceeded. Please slow down.' });
        return;
      }
      
      // Per-event rate limits
      if (event === 'player-move' && isSocketRateLimited(socket, 'move', 30, 1000)) {
        return; // Drop silently for movement spam
      }
      
      if (event === 'mine-resource' && isSocketRateLimited(socket, 'mine', 10, 5000)) {
        socket.emit('error', { message: 'Mining too fast. Please wait.' });
        return;
      }
      
      next();
    });

    /**
     * Handles a player's request to join the game.
     * This is the single entry point for a player to enter a world.
     */
  socket.on("join-game", async (payload = {}) => {
    const signature = typeof payload?.signature === "string" ? payload.signature.trim() : undefined
    const message = typeof payload?.message === "string" ? payload.message : undefined
    const rawWalletAddress = typeof payload?.walletAddress === "string" ? payload.walletAddress : undefined
    const rawSessionId = typeof payload?.sessionId === "string" ? payload.sessionId : undefined

    const sanitizedWallet = sanitizePlainText(rawWalletAddress ? rawWalletAddress.toLowerCase() : undefined)
    const sanitizedSessionId = rawSessionId ? sanitizePlainText(rawSessionId) : undefined

    if (!sanitizedWallet || !isValidWalletAddress(sanitizedWallet)) {
      socket.emit("error", { message: "Valid wallet address is required to join." })
      return
    }

    if (!signature || !message) {
      socket.emit("error", { message: "Wallet signature is required to join." })
      return
    }

    let verification
    try {
      verification = verifyJoinSignature({
        walletAddress: sanitizedWallet,
        sessionId: sanitizedSessionId,
        signature,
        message,
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Invalid wallet signature"
      console.warn("Rejected join-game due to invalid signature", {
        wallet: sanitizedWallet,
        sessionId: sanitizedSessionId,
        reason,
      })
      socket.emit("error", { message: reason })
      return
    }

    const walletAddress = verification.wallet
    const signatureSession = verification.session && verification.session !== "auto" ? verification.session : undefined
    const sessionId = sanitizedSessionId && sanitizedSessionId !== "auto" ? sanitizedSessionId : signatureSession

    socket.authenticatedWallet = walletAddress
    socket.authenticatedAt = verification.timestamp
    socket.authenticationMaxAgeMs = DEFAULT_MAX_SIGNATURE_AGE_MS

    console.log(`[SERVER] Authenticated wallet ${walletAddress} requested session ${sessionId ?? "auto"}`)

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
            submarineTier: 1, // Default tier
            joinedAt: Date.now()
        };

        // Initialize player in database if they don't exist
        if (supabase) {
          try {
            const { data: existingPlayer, error: checkError } = await supabase
              .from('players')
              .select('wallet_address, submarine_tier')
              .ilike('wallet_address', walletAddress)
              .maybeSingle();

            if (!existingPlayer && (!checkError || checkError.code === 'PGRST116')) {
              // Player doesn't exist, create them
              const { error: insertError } = await supabase
                .from('players')
                .insert({
                  wallet_address: walletAddress,
                  username: `Player_${walletAddress.substring(2, 8)}`,
                  submarine_tier: 1,
                  total_ocx_earned: 0,
                  total_resources_mined: 0,
                  last_login: new Date().toISOString(),
                });
              
              if (insertError) {
                console.error('❌ Failed to create player:', insertError);
              } else {
                console.log(`✅ Created new player: ${walletAddress}`);
              }
            } else if (existingPlayer) {
              // Update player data from DB
              player.submarineTier = existingPlayer.submarine_tier || 1;
              
              // Update last login
              await supabase
                .from('players')
                .update({ last_login: new Date().toISOString() })
                .ilike('wallet_address', walletAddress);
              
              console.log(`✅ Updated existing player: ${walletAddress}, tier: ${player.submarineTier}`);
            }
          } catch (dbError) {
            console.error('❌ Database error during player initialization:', dbError);
          }
        }

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
        // Sanitize input data
        const rawSessionId = data?.sessionId;
        const rawWalletAddress = data?.walletAddress;
        const rawPosition = data?.position;
        
        const sessionId = typeof rawSessionId === "string" ? sanitizePlainText(rawSessionId.trim()) : null;
        const walletAddress = typeof rawWalletAddress === "string" ? sanitizePlainText(rawWalletAddress.toLowerCase().trim()) : null;
        
        // Validate all required fields
        if (!sessionId || !walletAddress || !rawPosition) {
            console.log(`❌ Invalid player-move data:`, data);
            return;
        }
        
        // Validate wallet address format
        if (!isValidWalletAddress(walletAddress)) {
            console.log(`❌ Invalid wallet address format: ${walletAddress}`);
            return;
        }
        
        // Validate position data (ensure finite numbers)
        if (!isValidPosition(rawPosition)) {
            console.log(`❌ Invalid position data:`, rawPosition);
            return;
        }
        
        const position = sanitizePosition(rawPosition);
        
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
        
        // Verify that the wallet address matches the socket's authenticated address
        if (socket.walletAddress && socket.walletAddress !== walletAddress) {
            console.log(`❌ Wallet address mismatch: ${walletAddress} vs ${socket.walletAddress}`);
            socket.emit("error", { message: "Wallet address mismatch" });
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
app.post("/claim", claimLimiter, requireClaimAuth, async (req, res) => {
    try {
        const wallet = req?.auth?.wallet;
        if (!wallet) {
            return res.status(401).json({ error: "Wallet authentication required" });
        }
        
        const userAddress = typeof req.body?.userAddress === "string" 
            ? req.body.userAddress.toLowerCase().trim() 
            : wallet.toLowerCase();
        
        // Amount should come from backend logic (e.g., based on player tier or daily reward)
        const rawAmount = req.body?.amount;
        
        const parseUint = (value) => {
          if (typeof value === "number") {
            if (!Number.isFinite(value) || value < 0) return null;
            return BigInt(Math.floor(value));
          }
          if (typeof value === "string") {
            const trimmed = value.trim();
            if (!trimmed || !/^\d+$/.test(trimmed)) return null;
            try {
              return BigInt(trimmed);
            } catch (err) {
              return null;
            }
          }
          return null;
        };

        const amount = parseUint(rawAmount);
        
        if (!userAddress || amount === null || amount <= 0n) {
            return res.status(400).json({ error: "Missing or invalid parameters" });
        }
        
        // Verify wallet address matches authenticated user
        if (userAddress !== wallet.toLowerCase()) {
            return res.status(401).json({ error: "Wallet address mismatch" });
        }
        
        if (!claimService) {
            return res.status(503).json({ error: "Claim service not available" });
        }
        
        // FIXED: Backend now generates signature internally
        const txHash = await claimService.claimTokens(
          userAddress,
          amount.toString()
        );
        
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

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('[server] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

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