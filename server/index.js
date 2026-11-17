// OceanX Backend Server - ESM entry point
import "dotenv/config";
import express from "express";
import http from "http";
import crypto from "crypto";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";
import helmet from "helmet";
import pino from "pino";
import pinoHttp from "pino-http";
import * as Sentry from "@sentry/node";
import * as claimService from "./claimService.js";
import { tokenContract } from "./claimService.js";
import * as miningService from "./miningService.js";
import * as resourceService from "./resourceService.js";
import NonceManager from "./lib/nonceManager.js";
import { mineNode, PlayerWorlds } from "./lib/authoritativeMining.js";
import { updatePlayerBalances, LedgerError, isResourceType } from "./lib/playerLedger.js";
import {
  CLAIM_TRADE_TYPE,
  CLAIM_REFUND_GRACE_SEC,
  RESERVED_TRADE_KEY_PREFIX,
  claimKind,
  claimAmountToOcx,
  secondsUntilRefundable,
  settlePendingClaims,
  sweepPendingClaims,
} from "./lib/claimLifecycle.js";
import {
  verifyJoinSignature,
  createAuthMiddleware,
  ensureAuthenticationFresh,
  DEFAULT_MAX_SIGNATURE_AGE_MS,
} from "./auth.js";
import {
  validateInput,
  playerMovePayloadSchema,
  mineResourcePayloadSchema,
  playerPositionSchema,
  resourceNodeSchema,
  playerResourcesSchema,
} from "./lib/validation.ts";
import { sanitizeHtml, sanitizePlainText } from "./lib/sanitize.ts";

// ========================================
// 🔒 SECURITY & LOGGING INITIALIZATION
// ========================================

// Initialize Sentry for error monitoring (before other code)
if (process.env.SENTRY_DSN && process.env.NODE_ENV !== 'test') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    beforeSend(event) {
      // Scrub sensitive data
      if (event.request) {
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
        }
      }
      return event;
    },
  });
  console.log('✅ Sentry error monitoring initialized');
} else {
  console.log('ℹ️  Sentry disabled (set SENTRY_DSN to enable)');
}

// Initialize Pino structured logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    }
  } : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
});

// Export logger for use in other modules
export { logger };

// ========================================
// 🔒 STARTUP ENVIRONMENT VALIDATION
// ========================================
/**
 * Validates all required environment variables before server starts.
 * Prevents server from starting with missing or invalid configuration.
 * This is a critical security measure - DO NOT BYPASS.
 */
function validateServerEnvironment() {
  logger.info('🔍 Validating server environment variables...');

  const REQUIRED_ENV_VARS = [
    { name: "BACKEND_PRIVATE_KEY", validator: validatePrivateKey },
    { name: "RPC_URL", validator: validateURL },
    { name: "TOKEN_CONTRACT_ADDRESS", validator: validateEthereumAddress },
    { name: "SUPABASE_URL", validator: validateURL },
    { name: "SUPABASE_ANON_KEY", validator: validateNonEmpty },
    { name: "SUPABASE_SERVICE_ROLE_KEY", validator: validateNonEmpty },
    { name: "CHAIN_ID", validator: validateChainId },
  ];

  const errors = [];

  for (const { name, validator } of REQUIRED_ENV_VARS) {
    const value = process.env[name];

    if (!value) {
      errors.push(`❌ Missing required environment variable: ${name}`);
      continue;
    }

    const validationResult = validator(value, name);
    if (!validationResult.valid) {
      errors.push(`❌ Invalid ${name}: ${validationResult.error}`);
    }
  }

  if (errors.length > 0) {
    logger.error({ errors, requiredVars: REQUIRED_ENV_VARS.map(v => v.name) }, '🚨 ENVIRONMENT VALIDATION FAILED');
    logger.error('Please configure these in your .env file or deployment platform (Render).');
    process.exit(1);
  }

  logger.info({
    chainId: process.env.CHAIN_ID,
    rpcUrl: process.env.RPC_URL,
    contractAddress: process.env.TOKEN_CONTRACT_ADDRESS,
    privateKeyHint: `****${process.env.BACKEND_PRIVATE_KEY.slice(-8)}`
  }, '✅ All required environment variables validated successfully');
}

// Validation helper functions
function validatePrivateKey(value, name) {
  // Ethereum private key: 64 hex characters with or without 0x prefix
  const cleanKey = value.startsWith("0x") ? value.slice(2) : value;

  if (!/^[a-fA-F0-9]{64}$/.test(cleanKey)) {
    return {
      valid: false,
      error: "Must be 64 hex characters (with or without 0x prefix)",
    };
  }

  // Additional security check: ensure it's not a commonly known test key
  const TEST_KEYS = [
    "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // Hardhat #0
    "0000000000000000000000000000000000000000000000000000000000000001", // Weak key
  ];

  if (TEST_KEYS.includes(cleanKey.toLowerCase())) {
    return {
      valid: false,
      error: "Cannot use well-known test private key in production",
    };
  }

  return { valid: true };
}

function validateURL(value, name) {
  try {
    const url = new URL(value);
    if (!url.protocol.startsWith("http")) {
      return { valid: false, error: "Must be HTTP or HTTPS URL" };
    }
    return { valid: true };
  } catch (e) {
    return { valid: false, error: "Invalid URL format" };
  }
}

function validateEthereumAddress(value, name) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    return {
      valid: false,
      error: "Must be valid Ethereum address (0x + 40 hex characters)",
    };
  }
  return { valid: true };
}

function validateNonEmpty(value, name) {
  if (value.trim().length === 0) {
    return { valid: false, error: "Cannot be empty" };
  }
  return { valid: true };
}

function validateChainId(value, name) {
  const chainId = parseInt(value);
  if (isNaN(chainId) || chainId <= 0) {
    return { valid: false, error: "Must be positive integer" };
  }
  return { valid: true };
}

// 🚨 VALIDATE ENVIRONMENT BEFORE CONTINUING
// In `test` environment we skip the hard exit so unit tests can run without full production env.
if (process.env.NODE_ENV !== 'test') {
  validateServerEnvironment();
} else {
  console.log('ℹ️  Skipping strict environment validation in test mode');
}

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

/**
 * Calculate 3D distance between two positions
 */
function calculateDistance(pos1, pos2) {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  const dz = pos1.z - pos2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Validate if movement is physically possible
 * Prevents teleportation exploits
 */
function isValidMovement(previousPosition, newPosition, deltaTime) {
  // If no previous position, allow first movement (spawn)
  if (!previousPosition) {
    return { valid: true, reason: "initial_spawn" };
  }
  
  // Configuration (adjust based on your game physics)
  // Fastest submarine (tier 15, speed 8) moves 8 * 0.2 * 62.5 = 100 units/s
  // on the client; allow headroom for frame-time jitter.
  const MAX_SPEED = 120; // units per second
  const TELEPORT_ABILITY_RANGE = 100; // max teleport distance for special ability
  const MIN_UPDATE_INTERVAL = 16; // minimum ms between updates (60 FPS)
  
  // Calculate time delta (default to 100ms if not provided)
  const dt = deltaTime || 100;
  
  // Prevent spam by enforcing minimum update interval
  if (dt < MIN_UPDATE_INTERVAL) {
    return { valid: false, reason: "update_too_frequent", details: `Min interval: ${MIN_UPDATE_INTERVAL}ms` };
  }
  
  // Calculate distance moved
  const distance = calculateDistance(previousPosition, newPosition);
  
  // Calculate maximum allowed distance based on time
  const maxDistance = (MAX_SPEED * dt) / 1000; // convert ms to seconds
  
  // Allow teleport range for special abilities (future enhancement)
  const allowedDistance = Math.max(maxDistance, TELEPORT_ABILITY_RANGE);
  
  if (distance > allowedDistance) {
    return {
      valid: false,
      reason: "movement_too_fast",
      details: `Moved ${distance.toFixed(2)} units in ${dt}ms (max: ${allowedDistance.toFixed(2)})`
    };
  }
  
  return { valid: true, reason: "ok" };
}

// ==========================================
// 🏆 IN-MEMORY LEADERBOARD
// ==========================================
/**
 * Maintains a sorted in-memory leaderboard that is updated on every OCX state
 * change. One-time DB hydration happens at startup so leaderboard requests never
 * need to hit the database or explorer APIs.
 */
class LeaderboardManager {
  constructor() {
    this._players = new Map(); // wallet (lowercase) -> { username, ocxEarned, submarineTier }
    this._hydrated = false;
  }

  /** Partial update — only provided fields are changed; others are preserved. */
  updatePlayer(wallet, { username, ocxEarned, submarineTier } = {}) {
    if (!wallet) return;
    const key = wallet.toLowerCase();
    const existing = this._players.get(key) || {};
    this._players.set(key, {
      username: username !== undefined ? username : existing.username,
      ocxEarned: typeof ocxEarned === "number" ? ocxEarned : (existing.ocxEarned ?? 0),
      submarineTier: submarineTier !== undefined ? submarineTier : (existing.submarineTier ?? 1),
    });
  }

  /** Returns top-N players sorted by ocxEarned descending. */
  getTop(n = 15) {
    return [...this._players.entries()]
      .filter(([, p]) => p.username && (p.ocxEarned ?? 0) > 0)
      .sort(([, a], [, b]) => (b.ocxEarned ?? 0) - (a.ocxEarned ?? 0))
      .slice(0, n)
      .map(([, p], i) => ({
        rank: i + 1,
        username: p.username,
        ocxEarned: p.ocxEarned ?? 0,
        submarineTier: p.submarineTier ?? 1,
      }));
  }

  /** One-time DB hydration — populates the map from current player records. */
  async hydrate(supabaseClient) {
    if (this._hydrated || !supabaseClient) return;
    try {
      const { data, error } = await supabaseClient
        .from("players")
        .select("wallet_address, username, total_ocx_earned, submarine_tier")
        .not("username", "is", null)
        .not("wallet_address", "is", null)
        .not("username", "like", "Captain-%")
        .limit(500);

      if (error) {
        console.warn("[leaderboard] Hydration query failed:", error.message);
        return;
      }

      for (const row of data || []) {
        if (row.wallet_address && row.username) {
          this.updatePlayer(row.wallet_address, {
            username: row.username,
            ocxEarned: Number(row.total_ocx_earned) || 0,
            submarineTier: row.submarine_tier || 1,
          });
        }
      }

      this._hydrated = true;
      console.log(`[leaderboard] Hydrated with ${this._players.size} players`);
    } catch (err) {
      console.warn("[leaderboard] Hydration error:", err.message);
    }
  }
}

const leaderboard = new LeaderboardManager();

// Initialize express app BEFORE using it
const app = express();
const server = http.createServer(app);

// Add body parser middleware with conservative limits
app.use(
  express.json({
    limit: "1mb",
    strict: true,
    verify: (req, res, buf) => {
      // Capture raw body for HMAC verification (webhooks)
      req.rawBody = buf;
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

/**
 * Compute maximum claimable OCX amount for a wallet based on business rules
 * Reads resources directly from players table columns (frontend writes there)
 * @param {string} wallet - Normalized wallet address (lowercase)
 * @returns {Promise<{maxClaimable: bigint, reason: string, playerData: object}>}
 */
async function computeMaxClaimableAmount(wallet) {
  if (!supabase) {
    return { maxClaimable: 0n, reason: "Database unavailable", playerData: null }
  }

  try {
    // Fetch player data including resources directly from players table
    // Note: Frontend writes directly to players table columns, not resource_events
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, wallet_address, submarine_tier, coins, total_ocx_earned, nickel, cobalt, copper, manganese")
      .ilike("wallet_address", wallet)
      .single()

    if (playerError || !player) {
      return { maxClaimable: 0n, reason: "Player not found", playerData: null }
    }

    // Extract resources directly from player record
    const resources = {
      nickel: player.nickel || 0,
      cobalt: player.cobalt || 0,
      copper: player.copper || 0,
      manganese: player.manganese || 0
    };

    console.log('💎 Player resources loaded:', { wallet, resources });

    // Business Rules for Max Claimable Amount:
    // 1. Base: Player's coins (off-chain currency) can be converted 1:1 to OCX
    // 2. Bonus: Resources can be sold at marketplace rates (implement your rates here)
    // 3. Tier multiplier: Higher tiers get better rates (future enhancement)

    const RESOURCE_TO_OCX_RATE = {
      nickel: 0.1,    // 1 nickel = 0.1 OCX
      cobalt: 0.5,    // 1 cobalt = 0.5 OCX
      copper: 1.0,    // 1 copper = 1 OCX
      manganese: 2.0  // 1 manganese = 2 OCX
    }

    // Calculate value from resources (using live balance)
    const nickelValue = Math.floor((resources.nickel || 0) * RESOURCE_TO_OCX_RATE.nickel)
    const cobaltValue = Math.floor((resources.cobalt || 0) * RESOURCE_TO_OCX_RATE.cobalt)
    const copperValue = Math.floor((resources.copper || 0) * RESOURCE_TO_OCX_RATE.copper)
    const manganeseValue = Math.floor((resources.manganese || 0) * RESOURCE_TO_OCX_RATE.manganese)
    const totalResourceValue = nickelValue + cobaltValue + copperValue + manganeseValue

    // Calculate coins value (1:1 conversion)
    const coinsValue = player.coins || 0

    // Total claimable amount (coins + resources)
    const maxClaimable = BigInt(coinsValue + totalResourceValue)

    return {
      maxClaimable: maxClaimable * BigInt(10 ** 18), // Convert to wei
      reason: maxClaimable > 0n ? "OK" : "Insufficient balance",
      playerData: {
        id: player.id,
        wallet: player.wallet_address,
        tier: player.submarine_tier,
        coins: player.coins,
        resources: {
          nickel: resources.nickel || 0,
          cobalt: resources.cobalt || 0,
          copper: resources.copper || 0,
          manganese: resources.manganese || 0
        },
        resourceValue: totalResourceValue
      }
    }
  } catch (error) {
    logServerError("compute-max-claimable", error, { wallet })
    return { maxClaimable: 0n, reason: "Error computing eligibility", playerData: null }
  }
}

/**
 * Generate unique idempotency key
 */
function generateIdempotencyKey() {
  return `claim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
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

// Mining-specific rate limiter (Requirement #6: Rate limiting + anti-bot)
const miningLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 mining attempts per minute per wallet/IP
  message: "Too many mining attempts. Try again in a minute.",
  code: "MINING_RATE_LIMIT",
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
    // Query the players table for the wallet address (exact match, case-insensitive normalized)
    const { data: player, error } = await supabase
      .from("players")
      .select("coins, total_ocx_earned")
      .eq("wallet_address", wallet.toLowerCase())
      .single();
    if (error || !player) {
      return res.status(404).json({ error: "Player not found" });
    }
    const coinsValue = Number(player.coins ?? 0);
    const ocxValue = player.total_ocx_earned != null ? player.total_ocx_earned.toString() : "0";

    res.json({
      coins: Number.isFinite(coinsValue) ? coinsValue : 0,
      balance: ocxValue,
      symbol: "OCX",
      network: "offchain",
      legacyTokenBalance: ocxValue,
    });
  } catch (err) {
    logServerError("player-balance", err, { wallet });
    respondWithError(res, 500, "Unable to fetch player balance. Please try again later.", "BALANCE_FETCH_FAILED");
  }
});

/**
 * POST /player/sync-ocx-balance
 * DEPRECATED: This endpoint previously wrote on-chain wallet balance into
 * total_ocx_earned, which corrupted the off-chain credits ledger and caused
 * double-claiming. Now returns read-only data without modifying the DB.
 *
 * total_ocx_earned = unclaimed off-chain credits (mining/trading earnings)
 * on-chain balance  = tokens already in the player's wallet (separate ledger)
 */
app.post("/player/sync-ocx-balance", playerDataLimiter, requirePlayerBalanceAuth, async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: "Supabase not initialized" });
  }

  const wallet = req?.auth?.wallet;
  if (!wallet) {
    return res.status(401).json({ error: "Wallet authentication required" });
  }

  try {
    const { data: player, error: fetchError } = await supabase
      .from("players")
      .select("id, total_ocx_earned")
      .eq("wallet_address", wallet.toLowerCase())
      .single();

    if (fetchError || !player) {
      return res.status(404).json({ error: "Player not found" });
    }

    const dbOcx = player.total_ocx_earned || 0;

    // Return current DB balance without modifying it
    res.json({
      success: true,
      synced: false,
      currentBalance: dbOcx,
      message: "Sync disabled — total_ocx_earned tracks off-chain credits only",
    });
  } catch (err) {
    logServerError("sync-ocx-balance", err, { wallet });
    respondWithError(res, 500, "Unable to fetch OCX balance.", "SYNC_BALANCE_FAILED");
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
    // Query the players table for the wallet address (exact match, case-insensitive normalized)
    const { data: player, error } = await supabase
      .from("players")
      .select("submarine_tier")
      .eq("wallet_address", wallet.toLowerCase())
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
      .select("id, wallet_address, submarine_tier, coins, total_ocx_earned")
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

  // Use total_ocx_earned as the balance (token-only economy)
  const currentOcx = Number(playerRecord?.total_ocx_earned ?? 0);
  const currentBalance = Number.isFinite(currentOcx) ? currentOcx : 0;
  
  // Get upgrade cost from tier definition (token-only economy)
  const upgradeCost = tierDefinition.upgradeCost?.tokens ?? 0;

  if (currentBalance < upgradeCost) {
    return respondWithError(res, 402, `Not enough OCX to upgrade submarine (have: ${currentBalance}, need: ${upgradeCost})`, "INSUFFICIENT_OCX");
  }

  const newBalance = currentBalance - upgradeCost;
  const timestamp = new Date().toISOString();

  try {
    const { data: updatedPlayer, error: updateError } = await supabase
      .from("players")
      .update({
        submarine_tier: targetTier,
        total_ocx_earned: newBalance,
        updated_at: timestamp,
      })
      .eq("id", playerRecord.id)
      .select("id, submarine_tier, total_ocx_earned")
      .single();

    if (updateError || !updatedPlayer) {
      throw updateError || new Error("Failed to persist upgrade");
    }

    const newTierPayload = buildSubmarineResponse(tierDefinition);

    const updatedOcxValue = Number(updatedPlayer.total_ocx_earned);

    res.json({
      playerId: updatedPlayer.id,
      wallet: normalizedWallet,
      previousTier: currentTier,
      newTier: newTierPayload?.tier ?? updatedPlayer.submarine_tier,
      tierDetails: newTierPayload,
      coins: Number.isFinite(updatedOcxValue) ? updatedOcxValue : newBalance,
      balance: Number.isFinite(updatedOcxValue) ? updatedOcxValue : newBalance,
      cost: {
        tokens: upgradeCost,
      },
      timestamp,
      message: `Submarine upgraded to tier ${targetTier}`,
    });

    // Update in-memory leaderboard: reflect new OCX balance and tier
    leaderboard.updatePlayer(normalizedWallet, {
      ocxEarned: Number.isFinite(updatedOcxValue) ? updatedOcxValue : newBalance,
      submarineTier: targetTier,
    });
  } catch (error) {
    logServerError("submarine-upgrade-persist", error, {
      wallet: normalizedWallet,
      playerId: playerRecord.id,
    });
    return respondWithError(res, 500, "Failed to apply submarine upgrade", "UPGRADE_PERSIST_FAILED");
  }
});

// CORS configuration
const allowedOrigins = [
  // Production domains
  /^https:\/\/oceanx-frontend.*\.onrender\.com$/,
  /^https:\/\/ocean.*\.vercel\.app$/,
  // Vercel preview deployments (any project)
  /^https:\/\/.*\.vercel\.app$/,
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

// Sentry request handler (must be first)
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

// Helmet security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        process.env.SUPABASE_URL,
        process.env.RPC_URL,
        process.env.FRONTEND_URL,
      ].filter(Boolean),
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// Pino HTTP logger
app.use(pinoHttp({ logger }));

app.use(cors(corsOptions));
app.use(express.json({ 
  limit: "10mb",
  verify: (req, res, buf) => { req.rawBody = buf; }
}));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Socket.IO setup with production optimizations
const io = new SocketIOServer(server, {
  cors: corsOptions,
  transports: ["polling", "websocket"], // Allow polling handshake then upgrade to websocket (required for Render proxy)
  allowUpgrades: true,
  maxHttpBufferSize: 1e6, // 1MB limit
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
  perMessageDeflate: false, // Disable compression for lower latency
});

// Initialize Supabase client
let supabase = null;
try {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("⚠️ Missing Supabase environment variables - running in mock mode");
  } else {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log("✅ Supabase client initialized with service role key");
    // Hydrate in-memory leaderboard after a short delay to let other init finish
    setTimeout(() => leaderboard.hydrate(supabase).catch((e) => console.warn("[leaderboard] Hydration failed:", e.message)), 3000);
  }
} catch (error) {
  console.error("❌ Failed to initialize Supabase:", error);
}

// Initialize Nonce Manager for signature replay prevention
let nonceManager = null;
try {
  if (supabase && tokenContract) {
    nonceManager = new NonceManager(supabase, tokenContract);
    console.log("✅ Nonce Manager initialized");
    
    // Run cleanup every 5 minutes
    setInterval(async () => {
      try {
        await nonceManager.cleanupExpired();
      } catch (error) {
        console.error("❌ Nonce cleanup error:", error);
      }
    }, 5 * 60 * 1000);

    // Claim lifecycle safety net (server/lib/claimLifecycle.js): confirm claims
    // that were mined and refund claims whose signature expired unused, for
    // players who do not come back and press "Claim" again.
    // Disable with CLAIM_SETTLEMENT_SWEEP=false.
    if (process.env.CLAIM_SETTLEMENT_SWEEP !== "false") {
      const claimSweepTimer = setInterval(async () => {
        try {
          const summary = await sweepPendingClaims({
            supabase,
            getOnChainNonce: (wallet) => nonceManager.getCurrentNonce(wallet),
          });
          if (summary.confirmed || summary.refunded || summary.errors) {
            console.log(
              `🧾 Claim sweep: ${summary.confirmed} confirmed, ${summary.refunded} refunded (${summary.refundedOcx} OCX), ${summary.errors} wallet error(s)`
            );
          }
        } catch (error) {
          console.error("❌ Claim sweep error:", error);
        }
      }, 5 * 60 * 1000);
      claimSweepTimer.unref?.();
    }
  } else {
    console.warn("⚠️ Nonce Manager not initialized - missing dependencies");
  }
} catch (error) {
  console.error("❌ Failed to initialize Nonce Manager:", error);
}

console.log("✅ Claim service loaded");

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
    upgradeCost: { tokens: 0 },
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
    upgradeCost: { tokens: 100 },
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
    upgradeCost: { tokens: 200 },
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
    upgradeCost: { tokens: 350 },
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
    upgradeCost: { tokens: 500 },
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
    upgradeCost: { tokens: 750 },
    color: "#78350f",
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
    upgradeCost: { tokens: 1000 },
    color: "#1e40af",
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
    upgradeCost: { tokens: 1500 },
    color: "#1e3a8a",
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
    upgradeCost: { tokens: 2000 },
    color: "#312e81",
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
    upgradeCost: { tokens: 2750 },
    color: "#581c87",
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
    upgradeCost: { tokens: 3500 },
    color: "#7c2d12",
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
    upgradeCost: { tokens: 4500 },
    color: "#0c0a09",
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
    upgradeCost: { tokens: 6000 },
    color: "#fbbf24",
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
    upgradeCost: { tokens: 7500 },
    color: "#a855f7",
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
    baseStats,
    upgradeCost,
  };
};

// Game state management
const gameSessions = new Map(); // Map<sessionId, { id, players: Map<walletAddress, playerData>, resourceNodes }>
// Each player's own deposits (what they see and mine). Kept across reconnects.
const playerWorlds = new PlayerWorlds();
// Reconnect without a new wallet signature: token issued on a signed join.
const resumeTokens = new Map(); // token -> { wallet, expiresAt }
const RESUME_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const issueResumeToken = (wallet) => {
    for (const [token, entry] of resumeTokens) {
        if (entry.wallet === wallet || entry.expiresAt < Date.now()) resumeTokens.delete(token);
    }
    const token = crypto.randomBytes(24).toString("hex");
    resumeTokens.set(token, { wallet, expiresAt: Date.now() + RESUME_TOKEN_TTL_MS });
    return token;
};
const gameStateFor = (session, walletAddress, resumeToken) => ({
    sessionId: session.id,
    players: Array.from(session.players.values()),
    resources: Array.from(playerWorlds.get(walletAddress).nodes.values()),
    myPlayerId: walletAddress,
    resumeToken,
});

// Replace depleted deposits that are due, and tell connected owners.
setInterval(() => {
    const now = Date.now();
    for (const socket of io.sockets.sockets.values()) {
        const wallet = socket.walletAddress;
        if (wallet && playerWorlds.refresh(wallet, now)) {
            socket.emit("resource-nodes", { resources: Array.from(playerWorlds.get(wallet, now).nodes.values()) });
        }
    }
    playerWorlds.prune(now);
}, 15 * 1000).unref?.();
const MAX_PLAYERS_PER_SESSION = 20;

// Resource generation parameters
// The client world is 2000 x 2000 with the player clamped to 50..1950 on each
// axis. Nodes used to be generated around (0,0) in ±500, which put most of
// them at negative coordinates the submarine can never reach.
const WORLD_MIN = 100;
const WORLD_MAX = 1900;
const NUM_RESOURCE_NODES = 50;
const RESOURCE_TYPES = ["nickel", "cobalt", "copper", "manganese"];

// Resource rarity ratios (hierarchical distribution)
// Based on ratios: Cobalt (1) : Nickel (3) : Copper (6) : Manganese (10)
// Total parts = 20, so for 50 nodes: Cobalt=2.5, Nickel=7.5, Copper=15, Manganese=25
// Rounding to: Cobalt=3, Nickel=7, Copper=15, Manganese=25 (total=50)
const RESOURCE_RATIOS = {
    cobalt: 3,      // Most rare (6%)
    nickel: 7,      // Rare (14%)
    copper: 15,     // Common (30%)
    manganese: 25   // Most abundant (50%)
};

function generateInitialResourceNodes() {
    const nodes = [];
    const resourcePool = [];
    
    // Create a pool with exact ratio distribution
    for (const [type, count] of Object.entries(RESOURCE_RATIOS)) {
        for (let i = 0; i < count; i++) {
            resourcePool.push(type);
        }
    }
    
    // Shuffle the pool to randomize positions
    for (let i = resourcePool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [resourcePool[i], resourcePool[j]] = [resourcePool[j], resourcePool[i]];
    }
    
    // Generate nodes using the shuffled pool
    for (let i = 0; i < NUM_RESOURCE_NODES; i++) {
        const type = resourcePool[i];
        const amount = Math.floor(Math.random() * 1501) + 500;
        nodes.push({
            id: `node-${Date.now()}-${i}`,
            type,
            position: {
                x: WORLD_MIN + Math.random() * (WORLD_MAX - WORLD_MIN),
                y: WORLD_MIN + Math.random() * (WORLD_MAX - WORLD_MIN),
                z: 0,
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

      // Movement has its own (much higher) budget below. Counting it against
      // the global 100/min budget meant a few seconds of steering blocked
      // every other event, including mining.
      if (event === 'player-move') {
        if (isSocketRateLimited(socket, 'move', 30, 1000)) return;
        return next();
      }
      
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
    const rawResumeToken = typeof payload?.resumeToken === "string" ? payload.resumeToken.trim() : undefined

    const sanitizedWallet = sanitizePlainText(rawWalletAddress ? rawWalletAddress.toLowerCase() : undefined)
    const sanitizedSessionId = rawSessionId ? sanitizePlainText(rawSessionId) : undefined

    if (!sanitizedWallet || !isValidWalletAddress(sanitizedWallet)) {
      socket.emit("error", { message: "Valid wallet address is required to join." })
      return
    }

    let verification
    if (rawResumeToken && !signature) {
      // Reconnect after a drop: no new wallet prompt.
      const entry = resumeTokens.get(rawResumeToken)
      if (!entry || entry.wallet !== sanitizedWallet || entry.expiresAt < Date.now()) {
        resumeTokens.delete(rawResumeToken)
        socket.emit("join-error", { code: "RESUME_INVALID", message: "Please sign in to the game again." })
        return
      }
      verification = { wallet: sanitizedWallet, session: "auto", timestamp: Date.now() }
    } else if (!signature || !message) {
      socket.emit("error", { message: "Wallet signature is required to join." })
      socket.emit("join-error", { code: "SIGNATURE_REQUIRED", message: "Wallet signature is required to join." })
      return
    }

    if (!verification) try {
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
      socket.emit("join-error", { code: "SIGNATURE_INVALID", message: reason })
      return
    }

    const walletAddress = verification.wallet
    const resumeToken = rawResumeToken && !signature ? rawResumeToken : issueResumeToken(walletAddress)
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
                socket.emit("game-state", gameStateFor(currentSession, walletAddress, resumeToken));
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
            // The client restores its own spawn point (saved game state), so the
            // first position it reports is accepted; every later one is checked
            // against the speed limit. Mining requires a known position.
            positionKnown: false,
            lastMineAt: 0,
            lastMoveTime: Date.now(), // Track last movement time for physics validation
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

        // Send the complete game state to the newly joined player: their own
        // deposits (server-authoritative) plus a token to rejoin after a drop.
        const gameState = gameStateFor(sessionToJoin, walletAddress, resumeToken);
        const playersArray = gameState.players;
        const resourcesArray = gameState.resources;
        socket.emit("game-state", gameState);

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
        
        // Moves are fire-and-forget; one that arrives before (re)joining is
        // simply dropped rather than reported to the client as an error.
        if (!session) return;
        
        // Only a joined socket may move, and only its own submarine (an
        // unjoined socket could previously move anyone's — and position now
        // decides mining range).
        if (!socket.walletAddress) return;
        if (socket.walletAddress !== walletAddress) {
            console.log(`❌ Wallet address mismatch: ${walletAddress} vs ${socket.walletAddress}`);
            socket.emit("error", { message: "Wallet address mismatch" });
            return;
        }
        
        const player = session.players.get(walletAddress);
        if (!player) return;

        const now = Date.now();

        // First report after joining: this is the spawn point.
        if (!player.positionKnown) {
            player.position = {
                ...position,
                x: Math.max(0, Math.min(2000, position.x)),
                y: Math.max(0, Math.min(2000, position.y)),
            };
            player.positionKnown = true;
            player.lastMoveTime = now;
            socket.to(actualSessionId).emit("player-moved", { id: walletAddress, position: player.position, timestamp: now });
            return;
        }

        // Physics validation: prevent teleportation exploits
        const deltaTime = player.lastMoveTime ? now - player.lastMoveTime : null;
        const previousPosition = player.position;
        
        const movementValidation = isValidMovement(previousPosition, position, deltaTime);
        
        if (!movementValidation.valid) {
            console.warn(`⚠️ Invalid movement from ${walletAddress}: ${movementValidation.reason}`, movementValidation.details);
            
            // Send rejection to client with details
            socket.emit("movement-rejected", {
                reason: movementValidation.reason,
                details: movementValidation.details,
                currentPosition: previousPosition, // Send back last valid position
                timestamp: now
            });
            
            // Do not broadcast invalid movement
            return;
        }

        // Update player position and timestamp
        player.position = position;
        player.lastMoveTime = now;
        
        // Broadcast to other players in the same session
        const moveData = {
            id: walletAddress,
            position: player.position,
            timestamp: now
        };
        
        socket.to(actualSessionId).emit("player-moved", moveData);
        
        // Optional: Log movement for debugging (uncomment if needed)
        // console.log(`🚶 Player ${walletAddress} moved in session ${actualSessionId}:`, position);
    });

    /**
     * Server-authoritative mining (server/lib/authoritativeMining.js).
     * The client sends only { nodeId, requestId }; the server decides whether
     * the mine is allowed and how much it yields, writes it to the players row,
     * and replies with the player's new totals.
     */
    socket.on("mine-resource", async (data) => {
        const requestId = typeof data?.requestId === "string" ? sanitizePlainText(data.requestId, 64) : undefined;
        const reply = (result) => socket.emit("mining-result", { ...result, requestId });

        try {
            const walletAddress = socket.walletAddress;
            const sessionId = socket.sessionId;
            const nodeId = typeof data?.nodeId === "string" ? sanitizePlainText(data.nodeId.trim(), 128) : null;

            if (!walletAddress || !sessionId) {
                return reply({ success: false, reason: "not_joined", message: "Reconnecting to the game server. Try again in a moment." });
            }
            if (!nodeId) {
                return reply({ success: false, reason: "invalid_request", message: "Missing nodeId" });
            }
            if (isSocketRateLimited(socket, `mining:${walletAddress}`, 30, 60000)) {
                return reply({ success: false, reason: "rate_limit_exceeded", message: "Too many mining attempts. Please wait a minute." });
            }
            if (!supabase) {
                return reply({ success: false, reason: "service_unavailable", message: "Mining service temporarily unavailable" });
            }

            const session = gameSessions.get(sessionId);
            const player = session?.players.get(walletAddress);
            if (!session || !player) {
                return reply({ success: false, reason: "not_joined", message: "Reconnecting to the game server. Try again in a moment." });
            }

            const result = await mineNode({
                supabase,
                nodes: playerWorlds.get(walletAddress).nodes,
                player,
                nodeId,
                getMaxCapacity: (tier) => getTierDefinition(tier)?.baseStats?.maxCapacity || null,
            });

            // Deposits are per player, so there is nothing to broadcast.
            reply(result);
        } catch (error) {
            if (process.env.SENTRY_DSN) {
                Sentry.captureException(error, { extra: { wallet: socket.walletAddress, nodeId: data?.nodeId }, tags: { handler: "mine-resource" } });
            }
            logServerError("mine-resource", error, { wallet: socket.walletAddress, nodeId: data?.nodeId });
            reply({ success: false, reason: "server_error", message: "Mining failed on the server. Please try again." });
        }
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

// Leaderboard endpoint — served entirely from in-memory state, no DB or Explorer API hit
const leaderboardLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: "Too many leaderboard requests.",
  code: "LEADERBOARD_RATE_LIMIT",
});

app.get("/leaderboard", leaderboardLimiter, (req, res) => {
  const n = Math.min(parseInt(req.query.limit) || 15, 50);
  const data = leaderboard.getTop(n);
  res.json({ success: true, data, source: "server-memory" });
});

// Health check endpoint
app.get("/health", async (req, res) => {
    let registeredPlayers = 0;
    let databaseStatus = "unknown";

    if (supabase) {
        try {
            const { count, error } = await supabase
                .from("players")
                .select("*", { count: "exact", head: true });
            if (!error) {
                registeredPlayers = count || 0;
                databaseStatus = "connected";
            } else {
                databaseStatus = "error";
            }
        } catch (e) {
            databaseStatus = "unreachable";
        }
    }

    res.json({
        status: "OK",
        timestamp: new Date().toISOString(),
        activeSessions: gameSessions.size,
        activePlayersInSessions: Array.from(gameSessions.values()).reduce((total, session) => total + session.players.size, 0),
        registeredPlayers,
        databaseStatus,
        claimServiceAvailable: !!claimService,
    });
});

// Rate limiter for session endpoints (prevent enumeration attacks)
const sessionsLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: { error: "Too many requests, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
});

// Admin API key check middleware for sensitive endpoints
const requireAdminApiKey = (req, res, next) => {
    const adminApiKey = process.env.ADMIN_API_KEY;
    
    // If no admin key configured, only allow in development
    if (!adminApiKey) {
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({ error: "Admin access not configured" });
        }
        // Allow in development without key
        return next();
    }
    
    const providedKey = req.headers['x-admin-api-key'];
    if (!providedKey || providedKey !== adminApiKey) {
        logger.warn({ ip: req.ip }, 'Unauthorized admin access attempt');
        return res.status(401).json({ error: "Invalid or missing admin API key" });
    }
    
    next();
};

// Public sessions endpoint - returns limited info only
app.get("/sessions", sessionsLimiter, (req, res) => {
    const sessions = Array.from(gameSessions.values()).map(session => ({
        id: session.id,
        playerCount: session.players.size,
        createdAt: session.createdAt,
        // Don't expose detailed player info in public endpoint
    }));
    
    res.json({ 
        sessions,
        totalSessions: gameSessions.size,
        totalPlayers: Array.from(gameSessions.values()).reduce((total, session) => total + session.players.size, 0)
    });
});

// Admin-only detailed sessions endpoint
app.get("/admin/sessions", sessionsLimiter, requireAdminApiKey, (req, res) => {
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

// New endpoint to get specific session details (admin-only for full details)
app.get("/sessions/:sessionId", sessionsLimiter, (req, res) => {
    const session = gameSessions.get(req.params.sessionId);
    if (!session) {
        return res.status(404).json({ error: "Session not found" });
    }
    
    // Return limited info for public access
    res.json({
        id: session.id,
        playerCount: session.players.size,
        createdAt: session.createdAt,
        // Full player details require admin access via /admin/sessions/:sessionId
    });
});

// Admin-only endpoint for full session details
app.get("/admin/sessions/:sessionId", sessionsLimiter, requireAdminApiKey, (req, res) => {
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

// ⚠️ DEPRECATED: This endpoint has the backend pay gas fees - DO NOT USE
// Use /marketplace/sign-claim instead (user pays gas)
app.post("/claim", claimLimiter, requireClaimAuth, async (req, res) => {
    console.warn(`⚠️ DEPRECATED /claim endpoint called by ${req?.auth?.wallet}`);
    return respondWithError(
        res,
        410,
        "This endpoint is deprecated for security and cost reasons. Use POST /marketplace/sign-claim instead, which returns a signature for the user to submit (user pays gas).",
        "ENDPOINT_DEPRECATED"
    );
});

// ==========================================
// MARKETPLACE ENDPOINTS (Sign-only flow)
// ==========================================

// ==========================================
// OFF-CHAIN TRADE: Convert resources → OCX (database only, no blockchain)
// ==========================================

/**
 * POST /marketplace/trade-resources
 * Converts player resources to OCX off-chain (deducts resources, credits total_ocx_earned).
 * No blockchain interaction — purely database update.
 * The player can later use POST /marketplace/claim-ocx to withdraw OCX on-chain.
 */
app.post("/marketplace/trade-resources", sensitiveActionLimiter, requireClaimAuth, async (req, res) => {
    try {
        const wallet = req?.auth?.wallet;
        if (!wallet) {
            return respondWithError(res, 401, "Wallet authentication required", "WALLET_REQUIRED");
        }

        if (!supabase) {
            return respondWithError(res, 503, "Database not available", "DB_UNAVAILABLE");
        }

        // Fetch current player data
        const { data: player, error: playerError } = await supabase
            .from("players")
            .select("id, wallet_address, username, submarine_tier, coins, total_ocx_earned, nickel, cobalt, copper, manganese")
            .ilike("wallet_address", wallet)
            .single();

        if (playerError || !player) {
            return respondWithError(res, 404, "Player not found", "PLAYER_NOT_FOUND");
        }

        // Read current resources
        const resources = {
            nickel: player.nickel || 0,
            cobalt: player.cobalt || 0,
            copper: player.copper || 0,
            manganese: player.manganese || 0,
        };

        const totalResources = resources.nickel + resources.cobalt + resources.copper + resources.manganese;
        if (totalResources <= 0) {
            return respondWithError(res, 400, "No resources to trade", "NO_RESOURCES");
        }

        // Calculate OCX value using the same rates as computeMaxClaimableAmount
        const RESOURCE_TO_OCX_RATE = {
            nickel: 0.1,
            cobalt: 0.5,
            copper: 1.0,
            manganese: 2.0,
        };

        const nickelValue = Math.floor(resources.nickel * RESOURCE_TO_OCX_RATE.nickel);
        const cobaltValue = Math.floor(resources.cobalt * RESOURCE_TO_OCX_RATE.cobalt);
        const copperValue = Math.floor(resources.copper * RESOURCE_TO_OCX_RATE.copper);
        const manganeseValue = Math.floor(resources.manganese * RESOURCE_TO_OCX_RATE.manganese);
        const totalOcxEarned = nickelValue + cobaltValue + copperValue + manganeseValue;

        if (totalOcxEarned <= 0) {
            return respondWithError(res, 400, "Resources too few to yield any OCX", "ZERO_OCX");
        }

        // Update DB: zero out resources and credit total_ocx_earned
        const currentOcx = Number(player.total_ocx_earned) || 0;
        const newOcxBalance = currentOcx + totalOcxEarned;

        const { error: updateError } = await supabase
            .from("players")
            .update({
                nickel: 0,
                cobalt: 0,
                copper: 0,
                manganese: 0,
                total_ocx_earned: newOcxBalance,
                updated_at: new Date().toISOString(),
            })
            .eq("id", player.id);

        if (updateError) {
            logServerError("trade-resources-update", updateError, { wallet });
            return respondWithError(res, 500, "Failed to update player", "UPDATE_FAILED");
        }

        console.log(`✅ Off-chain trade: ${wallet} traded resources for ${totalOcxEarned} OCX (new balance: ${newOcxBalance})`);

        // Update in-memory leaderboard immediately — no DB read needed on next leaderboard request
        leaderboard.updatePlayer(wallet, {
            username: player.username,
            ocxEarned: newOcxBalance,
            submarineTier: player.submarine_tier,
        });

        res.json({
            success: true,
            wallet,
            resourcesTraded: resources,
            ocxEarned: totalOcxEarned,
            newOcxBalance,
            breakdown: {
                nickel: { amount: resources.nickel, rate: RESOURCE_TO_OCX_RATE.nickel, value: nickelValue },
                cobalt: { amount: resources.cobalt, rate: RESOURCE_TO_OCX_RATE.cobalt, value: cobaltValue },
                copper: { amount: resources.copper, rate: RESOURCE_TO_OCX_RATE.copper, value: copperValue },
                manganese: { amount: resources.manganese, rate: RESOURCE_TO_OCX_RATE.manganese, value: manganeseValue },
            },
            message: `Traded all resources for ${totalOcxEarned} OCX. Use Claim OCX to withdraw to your wallet.`,
        });
    } catch (err) {
        logServerError("trade-resources", err, { wallet: req?.auth?.wallet });
        respondWithError(res, 500, "Trade failed", "TRADE_ERROR");
    }
});

// ==========================================
// CLAIM OCX: Withdraw accumulated OCX on-chain
// ==========================================

/**
 * POST /marketplace/claim-ocx
 * Checks the player's total_ocx_earned in DB and generates a blockchain signature
 * for the full amount (or a requested amount). The client uses this signature to
 * call OCXToken.claim() on-chain, then confirms with /marketplace/trade/confirm.
 */
app.post("/marketplace/claim-ocx", claimLimiter, requireClaimAuth, async (req, res) => {
    try {
        const wallet = req?.auth?.wallet;
        if (!wallet) {
            return respondWithError(res, 401, "Wallet authentication required", "WALLET_REQUIRED");
        }

        if (!supabase) {
            return respondWithError(res, 503, "Database not available", "DB_UNAVAILABLE");
        }

        // Fetch player's claimable OCX balance from DB
        const { data: player, error: playerError } = await supabase
            .from("players")
            .select("id, wallet_address, total_ocx_earned")
            .ilike("wallet_address", wallet)
            .single();

        if (playerError || !player) {
            return respondWithError(res, 404, "Player not found", "PLAYER_NOT_FOUND");
        }

        let availableOcx = Number(player.total_ocx_earned) || 0;

        // ── Claim lifecycle: settle earlier claims BEFORE reading the balance ──
        // (server/lib/claimLifecycle.js). OCX is reserved when a signature is
        // issued, so an earlier claim that was never submitted on-chain must be
        // resumed (signature still usable) or refunded (signature expired)
        // before the balance check below — otherwise a player who dismissed the
        // wallet prompt is told "No OCX available" and the OCX is stranded.
        // Fail-open: if settlement itself errors, continue with the old flow.
        if (nonceManager) {
            try {
                const nowSec = Math.floor(Date.now() / 1000);
                const onChainNonce = await nonceManager.getCurrentNonce(wallet);
                const settlement = await settlePendingClaims({ supabase, wallet, onChainNonce, nowSec });

                if (settlement.refundedOcx > 0) {
                    const { data: refreshed } = await supabase
                        .from("players")
                        .select("total_ocx_earned")
                        .eq("id", player.id)
                        .single();
                    if (refreshed) {
                        availableOcx = Number(refreshed.total_ocx_earned) || 0;
                        leaderboard.updatePlayer(wallet, { ocxEarned: availableOcx });
                    }
                }

                const openTrade = settlement.live || settlement.settling;
                if (openTrade && openTrade.kind === "resource_trade") {
                    // A marketplace sale holds this wallet's nonce.
                    const waitSec = secondsUntilRefundable(openTrade.deadline, nowSec);
                    return res.status(409).json({
                        error: `You have a marketplace trade in progress. Finish it in the marketplace or try again in about ${Math.ceil(waitSec / 60)} minute(s).`,
                        code: "TRADE_IN_PROGRESS",
                        retryAfterSec: waitSec,
                    });
                }

                if (settlement.live) {
                    // A signature for this wallet is still valid: hand the SAME one
                    // back (with its real signed deadline) so the claim can be finished.
                    const liveClaim = settlement.live;
                    const record = await nonceManager.checkNonceUsage(wallet, liveClaim.nonce);
                    if (record && !record.used && record.signature) {
                        const liveSig = ethers.Signature.from(record.signature);
                        console.log(`🔁 Resuming live OCX claim ${liveClaim.id} for ${wallet} (nonce ${liveClaim.nonce})`);
                        return res.json({
                            success: true,
                            resumed: true,
                            isExisting: true,
                            tradeId: liveClaim.id,
                            wallet,
                            claimableOcx: claimAmountToOcx(liveClaim.ocx_amount),
                            remainingOcx: availableOcx,
                            amountWei: String(liveClaim.ocx_amount),
                            nonce: String(liveClaim.nonce),
                            deadline: Number(liveClaim.deadline),
                            signature: record.signature,
                            v: liveSig.v,
                            r: liveSig.r,
                            s: liveSig.s,
                            message: "Resuming your claim in progress. Submit OCXToken.claim() to receive tokens.",
                        });
                    }
                    // Reserved, but the signature can no longer be recovered: it
                    // will be refunded automatically once it has expired.
                    const waitSec = secondsUntilRefundable(liveClaim.deadline, nowSec);
                    return res.status(409).json({
                        error: `A previous claim is still open. Its OCX returns to your balance in about ${Math.ceil(waitSec / 60)} minute(s) — then you can claim again.`,
                        code: "CLAIM_SETTLING",
                        retryAfterSec: waitSec,
                    });
                }

                if (settlement.settling) {
                    const waitSec = secondsUntilRefundable(settlement.settling.deadline, nowSec);
                    return res.status(409).json({
                        error: `Your previous claim is being finalised. Please try again in about ${Math.ceil(waitSec / 60)} minute(s).`,
                        code: "CLAIM_SETTLING",
                        retryAfterSec: waitSec,
                    });
                }
            } catch (settleErr) {
                logServerError("claim-ocx-settle", settleErr, { wallet });
            }
        }

        if (availableOcx <= 0) {
            return respondWithError(res, 400, "No OCX available to claim. Trade resources first.", "NO_OCX_TO_CLAIM");
        }

        // Allow partial claims (optional body param), default to full balance
        const requestedAmount = parseFloat(req.body?.ocxAmount || req.body?.amount || 0);
        const claimAmount = (requestedAmount > 0 && requestedAmount <= availableOcx) 
            ? requestedAmount 
            : availableOcx;

        // Convert to wei
        const amountWei = ethers.parseEther(claimAmount.toString());

        console.log(`📝 Claim OCX request: ${wallet} wants to claim ${claimAmount} OCX (available: ${availableOcx})`);

        // 🔒 Nonce management for replay protection
        if (!nonceManager) {
            return respondWithError(res, 503, "Signature service temporarily unavailable", "SERVICE_UNAVAILABLE");
        }

        const currentNonce = await nonceManager.getCurrentNonce(wallet);
        
        // Clean up expired reservations
        const cleanedCount = await nonceManager.cleanupExpiredForWallet(wallet);
        if (cleanedCount > 0) {
            console.log(`🧹 [${wallet.slice(0,6)}] Cleaned ${cleanedCount} expired reservations`);
        }

        // Check if nonce already in use
        const existingClaim = await nonceManager.checkNonceUsage(wallet, currentNonce);
        if (existingClaim) {
            if (existingClaim.used) {
                await nonceManager.deleteStaleRecord(wallet, currentNonce);
            } else if (existingClaim.signature) {
                const now = Math.floor(Date.now() / 1000);
                if (existingClaim.expires_at <= now) {
                    await nonceManager.deleteStaleRecord(wallet, currentNonce);
                } else {
                    // A live signature that no tracked claim owns (settlement above
                    // found none) is never handed out again: returning it used to
                    // mint its amount without deducting anything.
                    const waitSec = Math.max(1, Number(existingClaim.expires_at) - now + CLAIM_REFUND_GRACE_SEC + 1);
                    return res.status(409).json({
                        error: `An earlier signature for your wallet is still active. Please try again in about ${Math.ceil(waitSec / 60)} minute(s).`,
                        code: "SIGNATURE_ACTIVE",
                        retryAfterSec: waitSec,
                    });
                }
            } else {
                await nonceManager.deleteIncompleteReservation(wallet, currentNonce);
            }
        }

        // Reserve nonce
        let nonceReserved = false;
        try {
            const reservationData = await nonceManager.reserveNonce(wallet, currentNonce, amountWei.toString());
            nonceReserved = true;

            if (reservationData.signature) {
                return respondWithError(res, 409, "Another claim was just started. Please try again.", "NONCE_CONFLICT");
            }
        } catch (error) {
            if (error.message.includes('already in use')) {
                return respondWithError(res, 409, "Concurrent claim detected. Please try again.", "NONCE_CONFLICT");
            }
            throw error;
        }

        if (!claimService || !claimService.generateClaimSignature) {
            if (nonceReserved) {
                await nonceManager.deleteIncompleteReservation(wallet, currentNonce);
            }
            return respondWithError(res, 503, "Claim service not available", "SERVICE_UNAVAILABLE");
        }

        // Reserve (deduct) the OCX BEFORE signing, atomically. Previously the
        // balance was overwritten with an absolute value after signing, so OCX
        // credited in between (a trade, a refund) was silently lost, and a
        // failed deduction still handed out the signature.
        let remainingOcx;
        try {
            const { after } = await updatePlayerBalances(supabase, {
                playerId: player.id,
                compute: () => ({ ocx: -claimAmount }),
            });
            remainingOcx = Number(after.total_ocx_earned) || 0;
        } catch (ledgerErr) {
            await nonceManager.deleteIncompleteReservation(wallet, currentNonce);
            if (ledgerErr instanceof LedgerError) {
                return respondWithError(res, 409, "Your OCX balance just changed. Please try again.", ledgerErr.code);
            }
            throw ledgerErr;
        }

        const refundReservedOcx = async () => {
            try {
                await updatePlayerBalances(supabase, { playerId: player.id, compute: () => ({ ocx: claimAmount }) });
            } catch (refundErr) {
                logServerError("claim-ocx-refund", refundErr, { wallet, claimAmount });
            }
        };

        let signatureData;
        try {
            console.log(`🔐 Generating claim signature for ${wallet}: ${claimAmount} OCX (nonce: ${currentNonce})`);
            signatureData = await claimService.generateClaimSignature(wallet, amountWei.toString());
            // Store signature together with the deadline that was actually signed
            await nonceManager.storeSignature(wallet, currentNonce, signatureData.signature, signatureData.deadline);
        } catch (signErr) {
            await refundReservedOcx();
            await nonceManager.deleteStaleRecord(wallet, currentNonce).catch(() => {});
            throw signErr;
        }

        // Create pending trade record — it is what lets an unused claim be
        // refunded later, so without it the signature is not handed out.
        const { data: trade, error: tradeError } = await supabase
            .from('trades')
            .insert({
                player_id: player.id,
                wallet_address: wallet.toLowerCase(),
                resource_type: CLAIM_TRADE_TYPE,
                resource_amount: 0,
                ocx_amount: amountWei.toString(),
                status: 'pending',
                nonce: signatureData.nonce,
                deadline: signatureData.deadline,
                idempotency_key: generateIdempotencyKey(),
                created_at: new Date().toISOString()
            })
            .select('id')
            .single();

        if (tradeError || !trade) {
            logServerError('claim-ocx-trade-record', tradeError || new Error("no row"), { wallet, amount: claimAmount });
            await refundReservedOcx();
            await nonceManager.deleteStaleRecord(wallet, currentNonce).catch(() => {});
            return respondWithError(res, 500, "The claim could not be recorded. Nothing was deducted — please try again.", "CLAIM_NOT_RECORDED");
        }
        const tradeId = trade.id;
        console.log(`✅ Created pending OCX claim trade: ${tradeId}`);
        leaderboard.updatePlayer(wallet, { ocxEarned: remainingOcx });

        res.json({
            success: true,
            tradeId,
            wallet,
            claimableOcx: claimAmount,
            remainingOcx,
            amountWei: signatureData.amountWei,
            nonce: signatureData.nonce,
            deadline: signatureData.deadline,
            signature: signatureData.signature,
            v: signatureData.v,
            r: signatureData.r,
            s: signatureData.s,
            message: `Signature generated for ${claimAmount} OCX. Submit OCXToken.claim() to receive tokens.`,
        });
    } catch (err) {
        logServerError("claim-ocx", err, { wallet: req?.auth?.wallet });
        respondWithError(res, 500, "Claim failed", "CLAIM_ERROR");
    }
});

// Marketplace resource prices in tenths of an OCX per unit. Must match the
// ocxRate values shown in app/marketplace/marketplace-client.tsx.
const RESOURCE_PRICE_TENTHS = Object.freeze({ nickel: 1n, cobalt: 5n, copper: 10n, manganese: 20n });
const MAX_RESOURCES_PER_TRADE = 1_000_000;

/** Wei for `amount` units of `resourceType` at the marketplace price. */
const resourceTradeWei = (resourceType, amount) =>
    BigInt(amount) * RESOURCE_PRICE_TENTHS[resourceType] * 10n ** 17n;

const signatureResponse = (sigHex, fields) => {
    const sig = ethers.Signature.from(sigHex);
    return { success: true, signature: sigHex, v: sig.v, r: sig.r, s: sig.s, ...fields };
};

/**
 * POST /marketplace/sign-claim
 * Sell resources for OCX minted on-chain (the player submits OCXToken.claim()
 * themselves and pays gas).
 *
 * The resources are RESERVED (deducted) when the signature is issued, exactly
 * like OCX in /marketplace/claim-ocx, and returned automatically if the
 * signature expires unused (server/lib/claimLifecycle.js). Previously they
 * were only deducted if the client called /marketplace/trade/confirm after
 * the transaction, so a client that skipped it kept both. The OCX amount is
 * computed here from the resources sold; the client's figure is ignored.
 */
app.post("/marketplace/sign-claim", claimLimiter, requireClaimAuth, async (req, res) => {
    const wallet = req?.auth?.wallet;
    let reservation = null; // { playerId, resourceType, amount } while resources are held
    let reservedNonce = null; // nonce reserved in claim_signatures by this request
    let tradeRecorded = false;

    const releaseReservation = async () => {
        if (!reservation) return;
        const held = reservation;
        reservation = null;
        try {
            await updatePlayerBalances(supabase, {
                playerId: held.playerId,
                compute: () => ({ resources: { [held.resourceType]: held.amount } }),
            });
        } catch (releaseErr) {
            logServerError("sign-claim-release", releaseErr, { wallet, ...held });
        }
    };

    try {
        if (!wallet) {
            return respondWithError(res, 401, "Wallet authentication required", "WALLET_REQUIRED");
        }
        if (!supabase) {
            return respondWithError(res, 503, "Database not available", "DB_UNAVAILABLE");
        }

        const resourceType = String(req.body?.resourceType || "").toLowerCase();
        const resourceAmount = Number(req.body?.resourceAmount);
        if (
            !isResourceType(resourceType) ||
            !Number.isInteger(resourceAmount) ||
            resourceAmount <= 0 ||
            resourceAmount > MAX_RESOURCES_PER_TRADE
        ) {
            return respondWithError(res, 400, "Choose a resource and a whole number of units to sell.", "RESOURCE_REQUIRED");
        }

        const amountWei = resourceTradeWei(resourceType, resourceAmount);
        const ocxAmount = Number(ethers.formatEther(amountWei));
        console.log(`📝 Marketplace trade request: ${wallet} sells ${resourceAmount} ${resourceType} for ${ocxAmount} OCX`);

        if (!nonceManager) {
            return respondWithError(res, 503, "Signature service temporarily unavailable", "SERVICE_UNAVAILABLE");
        }

        const currentNonce = await nonceManager.getCurrentNonce(wallet);
        const nowSec = Math.floor(Date.now() / 1000);

        // Bring earlier claims/trades up to date with the chain. A reservation
        // that is still open holds this wallet's nonce: resume it if it is the
        // same trade, otherwise ask the player to wait. This fails CLOSED —
        // issuing a second signature for a held nonce could leave a reservation
        // marked as completed when it was the other signature that was mined.
        let settlement;
        try {
            settlement = await settlePendingClaims({ supabase, wallet, onChainNonce: currentNonce, nowSec });
        } catch (settleErr) {
            logServerError("sign-claim-settle", settleErr, { wallet });
            return respondWithError(res, 503, "Could not check your earlier trades. Please try again in a moment.", "SETTLEMENT_UNAVAILABLE");
        }

        const open = settlement.live || settlement.settling;
        if (open) {
            const sameTrade =
                settlement.live &&
                open.kind === "resource_trade" &&
                open.resource_type === resourceType &&
                Number(open.resource_amount) === resourceAmount;
            if (sameTrade) {
                const record = await nonceManager.checkNonceUsage(wallet, open.nonce);
                if (record && !record.used && record.signature) {
                    console.log(`🔁 Resuming marketplace trade ${open.id} for ${wallet}`);
                    return res.json(
                        signatureResponse(record.signature, {
                            resumed: true,
                            isExisting: true,
                            tradeId: open.id,
                            wallet,
                            ocxAmount: claimAmountToOcx(open.ocx_amount),
                            resourceType,
                            resourceAmount,
                            amountWei: String(open.ocx_amount),
                            nonce: String(open.nonce),
                            deadline: Number(open.deadline),
                            message: "Resuming your trade in progress. Submit OCXToken.claim() to receive OCX.",
                        })
                    );
                }
            }
            const waitSec = secondsUntilRefundable(open.deadline, nowSec);
            const minutes = Math.max(1, Math.ceil(waitSec / 60));
            const what =
                open.kind === "resource_trade"
                    ? `a trade of ${open.resource_amount} ${open.resource_type}`
                    : "an OCX claim";
            return res.status(409).json({
                error:
                    open.kind === "resource_trade" && settlement.live
                        ? `You have ${what} in progress. Sell that same amount to finish it, or wait about ${minutes} minute(s) and the resources return to you automatically.`
                        : `You have ${what} in progress. Please try again in about ${minutes} minute(s).`,
                code: open.kind === "resource_trade" ? "TRADE_IN_PROGRESS" : "CLAIM_IN_PROGRESS",
                retryAfterSec: waitSec,
            });
        }

        const cleanedCount = await nonceManager.cleanupExpiredForWallet(wallet);
        if (cleanedCount > 0) {
            console.log(`🧹 [${wallet.slice(0, 6)}] Cleaned ${cleanedCount} expired reservations`);
        }

        // A signature for this nonce that no tracked reservation owns (e.g. one
        // issued before this version was deployed) is never handed out again —
        // that used to return a signature for whatever amount it was made for,
        // without checking resources. Wait for it to expire instead.
        const existingClaim = await nonceManager.checkNonceUsage(wallet, currentNonce);
        if (existingClaim) {
            if (existingClaim.used) {
                await nonceManager.deleteStaleRecord(wallet, currentNonce);
            } else if (existingClaim.signature) {
                const expiresAt = Number(existingClaim.expires_at) || 0;
                if (expiresAt + CLAIM_REFUND_GRACE_SEC < nowSec) {
                    await nonceManager.deleteStaleRecord(wallet, currentNonce);
                } else {
                    const waitSec = Math.max(1, expiresAt + CLAIM_REFUND_GRACE_SEC - nowSec + 1);
                    return res.status(409).json({
                        error: `An earlier signature for your wallet is still active. Please try again in about ${Math.ceil(waitSec / 60)} minute(s).`,
                        code: "SIGNATURE_ACTIVE",
                        retryAfterSec: waitSec,
                    });
                }
            } else {
                await nonceManager.deleteIncompleteReservation(wallet, currentNonce);
            }
        }

        // Reserve the nonce first: of two concurrent requests only one gets it.
        try {
            const reservationData = await nonceManager.reserveNonce(wallet, currentNonce, amountWei.toString());
            if (reservationData?.signature) {
                return respondWithError(res, 409, "Another trade was just started. Please try again.", "NONCE_CONFLICT");
            }
            reservedNonce = currentNonce;
        } catch (error) {
            if (String(error?.message).includes("already in use")) {
                return respondWithError(res, 409, "Another trade was just started. Please try again.", "NONCE_CONFLICT");
            }
            throw error;
        }

        // Reserve the resources (atomic compare-and-swap; fails if not enough).
        let playerId;
        try {
            const { before } = await updatePlayerBalances(supabase, {
                wallet,
                compute: () => ({ resources: { [resourceType]: -resourceAmount } }),
            });
            playerId = before.id;
            reservation = { playerId, resourceType, amount: resourceAmount };
        } catch (ledgerErr) {
            await nonceManager.deleteIncompleteReservation(wallet, currentNonce);
            reservedNonce = null;
            if (ledgerErr instanceof LedgerError) {
                if (ledgerErr.code === "INSUFFICIENT_RESOURCES") {
                    return respondWithError(
                        res,
                        403,
                        `Not enough ${resourceType}: you have ${ledgerErr.details?.available ?? 0}, tried to sell ${resourceAmount}.`,
                        "INSUFFICIENT_RESOURCES"
                    );
                }
                if (ledgerErr.code === "PLAYER_NOT_FOUND") {
                    return respondWithError(res, 404, "Player not found", "PLAYER_NOT_FOUND");
                }
                return respondWithError(res, 409, ledgerErr.message, ledgerErr.code);
            }
            throw ledgerErr;
        }

        if (!claimService || !claimService.generateClaimSignature) {
            await releaseReservation();
            await nonceManager.deleteIncompleteReservation(wallet, currentNonce);
            reservedNonce = null;
            return respondWithError(res, 503, "Claim service not available", "SERVICE_UNAVAILABLE");
        }

        console.log(`🔐 Generating trade signature for ${wallet}: ${ocxAmount} OCX (nonce: ${currentNonce})`);
        const signatureData = await claimService.generateClaimSignature(wallet, amountWei.toString());
        await nonceManager.storeSignature(wallet, currentNonce, signatureData.signature, signatureData.deadline);

        const { data: trade, error: tradeError } = await supabase
            .from("trades")
            .insert({
                player_id: playerId,
                wallet_address: wallet.toLowerCase(),
                resource_type: resourceType,
                resource_amount: resourceAmount,
                ocx_amount: amountWei.toString(),
                status: "pending",
                nonce: signatureData.nonce,
                deadline: signatureData.deadline,
                idempotency_key: `${RESERVED_TRADE_KEY_PREFIX}${crypto.randomUUID()}`,
                created_at: new Date().toISOString(),
            })
            .select("id")
            .single();

        if (tradeError || !trade) {
            // Without a trade row nothing could ever refund the reservation, so
            // undo everything and do not hand out the signature.
            logServerError("trade-creation-failed", tradeError || new Error("no row"), { wallet, ocxAmount });
            await releaseReservation();
            await nonceManager.deleteStaleRecord(wallet, currentNonce);
            reservedNonce = null;
            return respondWithError(res, 500, "The trade could not be recorded. Nothing was charged — please try again.", "TRADE_NOT_RECORDED");
        }
        tradeRecorded = true;
        reservation = null; // now owned by the trade row (refunded by claimLifecycle if unused)
        console.log(`✅ Reserved ${resourceAmount} ${resourceType} for trade ${trade.id}`);

        return res.json(
            signatureResponse(signatureData.signature, {
                tradeId: trade.id,
                wallet,
                ocxAmount,
                resourceType,
                resourceAmount,
                amountWei: signatureData.amountWei,
                nonce: signatureData.nonce,
                deadline: signatureData.deadline,
                message: "Signature generated. Submit OCXToken.claim() to receive OCX.",
            })
        );
    } catch (err) {
        logServerError("sign-claim", err, { wallet });
        if (!tradeRecorded) {
            await releaseReservation();
            if (reservedNonce !== null && nonceManager) {
                try {
                    await nonceManager.deleteStaleRecord(wallet, reservedNonce);
                } catch (cleanupErr) {
                    logServerError("sign-claim-cleanup", cleanupErr, { wallet });
                }
            }
        }
        return respondWithError(res, 500, "Trade failed. Nothing was charged — please try again.", "SIGN_CLAIM_ERROR");
    }
});

/**
 * POST /marketplace/trade/confirm
 * Verify a claim transaction and finalize the trade in DB
 * Client submits txHash after they've executed the claim
 */
app.post("/marketplace/trade/confirm", claimLimiter, requireClaimAuth, async (req, res) => {
    try {
        const wallet = req?.auth?.wallet;
        if (!wallet) {
            return res.status(401).json({ error: "Wallet authentication required" });
        }

        const { txHash, tradeId } = req.body;

        if (!txHash || typeof txHash !== 'string' || !txHash.match(/^0x[a-fA-F0-9]{64}$/)) {
            return res.status(400).json({ error: "Invalid transaction hash" });
        }

        console.log(`🔍 Confirming trade for ${wallet}, txHash: ${txHash}`);

        // Get trade record if tradeId provided
        let trade = null;
        let expectedAmount = null;

        if (supabase && tradeId) {
            const { data, error } = await supabase
                .from('trades')
                .select('*')
                .eq('id', tradeId)
                .eq('wallet_address', wallet.toLowerCase())
                .single();

            if (error) {
                return res.status(404).json({ error: "Trade not found" });
            }

            trade = data;

            if (trade.status === 'confirmed') {
                // Idempotent: the settlement sweep (or a retry of this request)
                // may already have confirmed it. That is success, not an error.
                return res.json({ success: true, tradeId, txHash, alreadyConfirmed: true });
            }

            // ocx_amount is stored in WEI by /marketplace/claim-ocx and
            // /marketplace/sign-claim. It was previously passed through
            // parseEther() again here (×1e18), so the amount check in
            // verifyClaimTransaction could never pass and no trade ever left
            // 'pending'. Legacy rows holding a decimal OCX value still parse.
            try {
                expectedAmount = BigInt(trade.ocx_amount).toString();
            } catch {
                expectedAmount = ethers.parseEther(String(trade.ocx_amount)).toString();
            }
            
            // 🔒 CRITICAL: Verify nonce was actually consumed on-chain (replay protection)
            if (claimService && tokenContract) {
                try {
                    const currentNonce = await tokenContract.nonces(wallet);
                    const expectedNonce = BigInt(trade.nonce) + 1n;
                    
                    if (currentNonce < expectedNonce) {
                        console.warn(`⚠️ Nonce mismatch: on-chain ${currentNonce}, expected ${expectedNonce}`);
                        return res.status(400).json({ 
                            error: "Transaction not confirmed on-chain. Nonce not incremented.",
                            code: "NONCE_NOT_INCREMENTED"
                        });
                    }
                } catch (nonceErr) {
                    console.error('❌ Failed to verify nonce:', nonceErr);
                    // Continue anyway - verification is best effort
                }
            }
        }

        if (!claimService || !claimService.verifyClaimTransaction) {
            return res.status(503).json({ error: "Claim service not available" });
        }

        // Verify the transaction on-chain
        const verification = await claimService.verifyClaimTransaction(
            txHash,
            wallet,
            expectedAmount // Can be null if no trade record
        );

        if (!verification.valid) {
            return res.status(400).json({ error: "Transaction verification failed" });
        }

        // Update trade record and player balance
        if (supabase && trade) {
            try {
                // 1. pending → confirmed. The status filter makes this a
                //    compare-and-swap, so a retried confirm (or the settlement
                //    sweep confirming it first) never deducts twice.
                const { data: movedRows, error: tradeUpdateError } = await supabase
                    .from('trades')
                    .update({
                        status: 'confirmed',
                        tx_hash: txHash,
                        confirmed_at: new Date().toISOString(),
                        block_number: verification.blockNumber
                    })
                    .eq('id', tradeId)
                    .eq('status', 'pending')
                    .select('id');

                if (tradeUpdateError) {
                    throw new Error(`Failed to update trade: ${tradeUpdateError.message}`);
                }
                if (!movedRows || movedRows.length !== 1) {
                    return res.json({ success: true, tradeId, txHash, alreadyConfirmed: true });
                }

                // 2. Update player.
                // total_ocx_earned is the UNCLAIMED off-chain balance. The OCX in
                // this trade has just been minted to the wallet on-chain, so it is
                // never credited here as well (that would make it claimable twice;
                // the old code would also have added the raw wei figure). For an
                // 'ocx_claim' the balance was already reduced when the signature
                // was issued, so confirming is bookkeeping only.
                // Trades issued by the current /marketplace/sign-claim reserved
                // their resources up front (claimKind === "resource_trade"), so
                // confirming them is bookkeeping only. Older trades deduct here.
                const isOcxClaim = trade.resource_type === CLAIM_TRADE_TYPE;
                const alreadyReserved = claimKind(trade) !== null;
                const resourceKey = String(trade.resource_type || '').toLowerCase();

                if (!isOcxClaim && !alreadyReserved && trade.resource_amount > 0) {
                    if (isResourceType(resourceKey)) {
                        await updatePlayerBalances(supabase, {
                            wallet,
                            compute: (row) => {
                                const take = Math.min(Number(row[resourceKey]) || 0, Number(trade.resource_amount));
                                if (take < trade.resource_amount) {
                                    console.warn(`⚠️ Resource underflow: ${resourceKey} ${row[resourceKey]} < ${trade.resource_amount}`);
                                }
                                return take > 0 ? { resources: { [resourceKey]: -take } } : null;
                            },
                        });
                    } else {
                        // e.g. 'mixed': no per-resource breakdown is recorded, and
                        // writing an unknown column would fail the whole confirm.
                        console.warn(`⚠️ Trade ${tradeId} has non-deductible resource type '${trade.resource_type}'; resources not adjusted`);
                    }
                }

                // The signature for this nonce has been consumed on-chain.
                if (nonceManager && trade.nonce !== null && trade.nonce !== undefined) {
                    await nonceManager.markAsClaimed(wallet, trade.nonce);
                }

                console.log(`✅ Trade confirmed: ${tradeId}, player ${wallet} received ${trade.ocx_amount} OCX`);

                res.json({
                    success: true,
                    tradeId,
                    txHash,
                    blockNumber: verification.blockNumber,
                    ocxReceived: trade.ocx_amount,
                    resourcesDeducted: trade.resource_type ? {
                        type: trade.resource_type,
                        amount: trade.resource_amount
                    } : null,
                    message: "Trade confirmed and player balance updated"
                });

            } catch (dbErr) {
                console.error("❌ DB update error:", dbErr);
                
                // Mark trade as failed
                if (trade) {
                    await supabase
                        .from('trades')
                        .update({ 
                            status: 'failed',
                            error_message: dbErr.message 
                        })
                        .eq('id', tradeId);
                }

                return res.status(500).json({ 
                    error: "Database update failed",
                    details: dbErr.message 
                });
            }
        } else {
            // No DB available or no trade record - just return verification
            res.json({
                success: true,
                txHash,
                blockNumber: verification.blockNumber,
                verified: true,
                message: "Transaction verified on-chain (no DB update)"
            });
        }

    } catch (err) {
        console.error("❌ Trade confirmation error:", err);
        res.status(500).json({ 
            error: err.message || "Internal error",
            details: process.env.NODE_ENV !== "production" ? err.stack : undefined
        });
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

// 🔐 Webhook: Mark claim as processed on blockchain
// This endpoint is called when a claim transaction is confirmed on-chain

/**
 * Verify webhook signature using HMAC-SHA256
 * @param {string} signature - The signature from x-webhook-signature header
 * @param {Buffer} rawBody - The raw request body buffer (for exact HMAC verification)
 * @param {string} secret - The webhook secret
 * @returns {boolean} - Whether the signature is valid
 */
function verifyWebhookSignature(signature, rawBody, secret) {
  if (!signature || !secret || !rawBody) return false;
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  
  // Use timing-safe comparison to prevent timing attacks
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(`sha256=${expectedSignature}`);
  
  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

// Webhook rate limiter - more restrictive for external webhooks
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute (adjust based on expected claim volume)
  message: { success: false, error: "Too many webhook requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

app.post("/webhook/claim-processed", webhookLimiter, async (req, res) => {
  try {
    const { wallet, nonce, txHash } = req.body;
    
    if (!wallet || !nonce) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing wallet or nonce" 
      });
    }

    // 🔐 Verify webhook authenticity with HMAC signature
    // 🚨 SECURITY: Webhook secret is ALWAYS required to prevent unauthorized access
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error('WEBHOOK_SECRET not configured - webhook endpoint disabled for security');
      return res.status(503).json({ 
        success: false, 
        error: "Webhook service not configured. Set WEBHOOK_SECRET environment variable." 
      });
    }
    
    const signature = req.headers['x-webhook-signature'];
    if (!verifyWebhookSignature(signature, req.rawBody, webhookSecret)) {
      logger.warn({ wallet, ip: req.ip }, 'Invalid webhook signature attempted');
      return res.status(401).json({ success: false, error: "Invalid webhook signature" });
    }

    if (nonceManager) {
      await nonceManager.markAsClaimed(wallet, nonce);
      logger.info({ wallet, nonce, txHash }, 'Claim marked as processed');
    }
    
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Webhook error');
    res.status(500).json({ success: false, error: "Internal error" });
  }
});

// 🔍 Debug endpoint: Get nonce statistics (development only)
if (process.env.NODE_ENV !== 'production') {
  app.get("/debug/nonce-stats", async (req, res) => {
    try {
      if (!nonceManager) {
        return res.json({ error: "Nonce Manager not available" });
      }

      const stats = await nonceManager.getStats();
      res.json(stats);
    } catch (error) {
      console.error('❌ Stats error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/debug/pending-claims/:wallet", async (req, res) => {
    try {
      const { wallet } = req.params;
      
      if (!nonceManager) {
        return res.json({ error: "Nonce Manager not available" });
      }

      const claims = await nonceManager.getPendingClaims(wallet);
      res.json({ wallet, claims });
    } catch (error) {
      console.error('❌ Pending claims error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('[server] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Sentry error handler (must be before other error handlers)
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

// Global error handler
app.use((err, req, res, next) => {
  logger.error({ err, url: req.url, method: req.method }, 'Unhandled error');
  
  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
  
  res.status(err.status || 500).json({ 
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Export the app/server for tests
export { app, server };

// Start the server only when not running tests
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server is live on port ${PORT}`);
    console.log(`🎮 Waiting for player connections...`);
  });
} else {
  console.log('ℹ️  Test mode detected — server.listen suppressed');
}

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