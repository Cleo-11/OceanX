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
  const MAX_SPEED = 50; // units per second (submarine max speed)
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
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("⚠️ Missing Supabase environment variables - running in mock mode");
  } else {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log("✅ Supabase client initialized with service role key");
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

        // Physics validation: prevent teleportation exploits
        const now = Date.now();
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
     * Server-Authoritative Mining Handler
     * Requirement #1: Server-side mining authority with full validation
     */
    socket.on("mine-resource", async (data) => {
        const startTime = Date.now();
        
        try {
            // Per-socket rate limiting (prevents multi-connection spam)
            if (isSocketRateLimited(socket, 'mine-resource', 30, 60000)) {
                console.warn(`⚠️ Mining rate limit exceeded for socket: ${socket.id}`);
                socket.emit("mining-result", {
                    success: false,
                    reason: "rate_limit_exceeded",
                    message: "Too many mining attempts from this connection. Please wait a minute."
                });
                return;
            }
            
            // Sanitize and validate input
            const nodeId = typeof data?.nodeId === "string" ? sanitizePlainText(data.nodeId.trim(), 128) : null;
            const sessionId = typeof data?.sessionId === "string" ? sanitizePlainText(data.sessionId.trim(), 128) : null;
            const walletAddress = typeof data?.walletAddress === "string" ? sanitizePlainText(data.walletAddress.toLowerCase().trim(), 64) : null;
            const requestedResourceType = data?.resourceType;
            
            // Validate required fields
            if (!nodeId || !sessionId || !walletAddress) {
                console.log(`❌ Invalid mine-resource data:`, { nodeId, sessionId, walletAddress });
                socket.emit("mining-result", {
                    success: false,
                    reason: "invalid_request",
                    message: "Missing required fields: nodeId, sessionId, walletAddress"
                });
                return;
            }
            
            // Validate wallet address format
            if (!isValidWalletAddress(walletAddress)) {
                console.log(`❌ Invalid wallet address format: ${walletAddress}`);
                socket.emit("mining-result", {
                    success: false,
                    reason: "invalid_wallet",
                    message: "Invalid wallet address format"
                });
                return;
            }
            
            // Per-wallet rate limiting (additional layer)
            if (isSocketRateLimited(socket, `mining:${walletAddress}`, 30, 60000)) {
                console.log(`⚠️ Mining rate limit exceeded for wallet: ${walletAddress}`);
                socket.emit("mining-result", {
                    success: false,
                    reason: "rate_limit_exceeded",
                    message: "Too many mining attempts. Please wait a minute."
                });
                return;
            }
            
            // Get player position from session
            const session = gameSessions.get(sessionId);
            if (!session) {
                console.log(`❌ Session not found: ${sessionId}`);
                socket.emit("mining-result", {
                    success: false,
                    reason: "session_not_found",
                    message: "Game session not found"
                });
                return;
            }
            
            const player = session.players.get(walletAddress);
            if (!player) {
                console.log(`❌ Player not found in session: ${walletAddress}`);
                socket.emit("mining-result", {
                    success: false,
                    reason: "player_not_found",
                    message: "Player not found in session"
                });
                return;
            }
            
            // Requirement #5: Idempotency - Generate unique attempt ID
            const attemptId = miningService.generateAttemptId(walletAddress, nodeId);
            
            // Get IP address for rate limiting and fraud detection (Requirement #6)
            const ipAddress = socket.handshake.headers['x-forwarded-for'] || 
                             socket.handshake.headers['x-real-ip'] || 
                             socket.handshake.address;
            const userAgent = socket.handshake.headers['user-agent'] || 'unknown';
            
            // Requirement #8: Comprehensive logging
            console.log(`⛏️ Mining attempt from ${walletAddress}:`, {
                nodeId,
                sessionId,
                position: player.position,
                attemptId: attemptId.slice(0, 30) + '...',
                ip: ipAddress
            });
            
            if (!supabase) {
                console.error(`❌ Database not available`);
                socket.emit("mining-result", {
                    success: false,
                    reason: "service_unavailable",
                    message: "Mining service temporarily unavailable"
                });
                return;
            }
            
            // Requirement #1-7: Execute server-authoritative mining
            const result = await miningService.executeMiningAttempt(supabase, {
                walletAddress,
                sessionId,
                nodeId,
                playerPosition: player.position,
                requestedResourceType,
                attemptId,
                ipAddress,
                userAgent
            });
            
            const processingTime = Date.now() - startTime;
            
            // Requirement #8: Log result
            if (result.success) {
                console.log(`✅ Mining success: ${walletAddress} mined ${result.amount}x ${result.resourceType} (${processingTime}ms)`);
            } else {
                console.log(`⚠️ Mining failed: ${walletAddress} - ${result.reason} (${processingTime}ms)`);
            }
            
            // Send authoritative result to client
            socket.emit("mining-result", {
                ...result,
                processingTime
            });
            
            // If successful, broadcast to session (so other players see node claimed)
            if (result.success) {
                socket.to(sessionId).emit("resource-mined", {
                    nodeId,
                    minedBy: walletAddress,
                    resourceType: result.resourceType,
                    amount: result.amount,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            // Capture error in Sentry
            if (process.env.SENTRY_DSN) {
                Sentry.captureException(error, {
                    extra: {
                        wallet: data?.walletAddress,
                        nodeId: data?.nodeId,
                        sessionId: data?.sessionId,
                    },
                    tags: {
                        handler: 'mine-resource',
                    },
                });
            }
            
            logServerError("mine-resource", error, {
                wallet: data?.walletAddress,
                nodeId: data?.nodeId,
                sessionId: data?.sessionId
            });
            
            socket.emit("mining-result", {
                success: false,
                reason: "server_error",
                message: "Internal server error during mining"
            });
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

/**
 * POST /marketplace/sign-claim
 * Generate EIP-712 signature for a claim (does NOT submit transaction)
 * Client will receive signature and submit claim tx themselves (user pays gas)
 */
app.post("/marketplace/sign-claim", claimLimiter, requireClaimAuth, async (req, res) => {
    try {
        const wallet = req?.auth?.wallet;
        if (!wallet) {
            return respondWithError(res, 401, "Wallet authentication required", "WALLET_REQUIRED");
        }

        // Get amount from request (in OCX, will convert to wei)
        const ocxAmount = parseFloat(req.body?.ocxAmount || req.body?.amount || 0);
        if (isNaN(ocxAmount) || ocxAmount <= 0) {
            return respondWithError(res, 400, "Invalid OCX amount", "INVALID_AMOUNT");
        }

        // Convert OCX to wei
        const amountWei = ethers.parseEther(ocxAmount.toString());

        // Optional: resource type and amount (for marketplace trades)
        const resourceType = req.body?.resourceType;
        const resourceAmount = parseInt(req.body?.resourceAmount || 0);

        console.log(`📝 Sign-only claim request: ${wallet} wants ${ocxAmount} OCX (${amountWei.toString()} wei)`);

        // 🔒 CRITICAL: Check nonce for replay attack prevention
        if (!nonceManager) {
            console.error("❌ Nonce Manager not available");
            return respondWithError(res, 503, "Signature service temporarily unavailable", "SERVICE_UNAVAILABLE");
        }

        // Get current nonce from blockchain
        const currentNonce = await nonceManager.getCurrentNonce(wallet);

        // Check if this nonce already has a signature (prevents replay)
        const existingClaim = await nonceManager.checkNonceUsage(wallet, currentNonce);
        
        if (existingClaim) {
            console.warn(`⚠️ Nonce ${currentNonce} already signed for ${wallet}`);
            
            // Return existing signature instead of creating a new one
            return res.json({
                success: true,
                message: "Signature already generated for this nonce",
                signature: existingClaim.signature,
                nonce: existingClaim.nonce,
                amount: existingClaim.amount,
                deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
                isExisting: true,
            });
        }

        // 🔒 CRITICAL: Server-side validation before signing
        const { maxClaimable, reason, playerData } = await computeMaxClaimableAmount(wallet);
        
        if (amountWei > maxClaimable) {
            console.warn(`⚠️ Sign-claim rejected: ${wallet} requested ${ocxAmount} OCX but max is ${ethers.formatEther(maxClaimable)}`);
            return respondWithError(
                res,
                403,
                `Requested amount exceeds allowable claim. Max: ${ethers.formatEther(maxClaimable)} OCX. Reason: ${reason}`,
                "AMOUNT_EXCEEDS_LIMIT"
            );
        }
        
        if (!playerData) {
            return respondWithError(res, 404, "Player not found", "PLAYER_NOT_FOUND");
        }

        // Verify player has resources if this is a trade
        // Skip individual resource check for "mixed" type (trading all resources at once)
        if (resourceType && resourceType !== "mixed" && resourceAmount > 0) {
            const availableResource = playerData.resources[resourceType] || 0;
            if (resourceAmount > availableResource) {
                return respondWithError(
                    res,
                    403,
                    `Insufficient ${resourceType}. Available: ${availableResource}, requested: ${resourceAmount}`,
                    "INSUFFICIENT_RESOURCES"
                );
            }
        }

        if (!claimService || !claimService.generateClaimSignature) {
            return respondWithError(res, 503, "Claim service not available", "SERVICE_UNAVAILABLE");
        }
        
        // 🔒 Reserve nonce (prevents concurrent signing with same nonce)
        try {
            await nonceManager.reserveNonce(wallet, currentNonce, amountWei.toString());
        } catch (error) {
            if (error.message.includes('already in use')) {
                return respondWithError(res, 409, "Concurrent claim detected. Please try again.", "NONCE_CONFLICT");
            }
            throw error;
        }

        // Log signature generation event
        console.log(`🔐 Generating signature for ${wallet}: ${ocxAmount} OCX (nonce: ${currentNonce})`);
        
        // Generate signature (does NOT submit transaction)
        const signatureData = await claimService.generateClaimSignature(
            wallet,
            amountWei.toString()
        );

        // 🔒 Store signature in database (critical for audit trail)
        await nonceManager.storeSignature(wallet, currentNonce, signatureData.signature);

        // Create pending trade record in DB (for marketplace tracking)
        let tradeId = null;
        const idempotencyKey = req.body?.idempotencyKey || generateIdempotencyKey();
        if (supabase && playerData) {
            try {
                const { data: trade, error: tradeError } = await supabase
                    .from('trades')
                    .insert({
                        player_id: playerData.id,
                        wallet_address: wallet.toLowerCase(),
                        resource_type: resourceType || null,
                        resource_amount: resourceAmount || null,
                        ocx_amount: amountWei.toString(),
                        status: 'pending',
                        nonce: signatureData.nonce,
                        deadline: signatureData.deadline,
                        idempotency_key: idempotencyKey,
                        created_at: new Date().toISOString()
                    })
                    .select('id')
                    .single();

                if (!tradeError && trade) {
                    tradeId = trade.id;
                    console.log(`✅ Created pending trade: ${tradeId}`);
                } else {
                    console.error('❌ Failed to create trade record:', tradeError);
                    // This is a critical failure - signature issued but not tracked
                    logServerError('trade-creation-failed', tradeError, { wallet, amount: ocxAmount });
                }
            } catch (dbErr) {
                logServerError('trade-db-error', dbErr, { wallet, amount: ocxAmount });
            }
        }

        // Return signature data for client to submit
        res.json({
            success: true,
            tradeId,
            wallet,
            ocxAmount,
            amountWei: signatureData.amountWei,
            nonce: signatureData.nonce,
            deadline: signatureData.deadline,
            signature: signatureData.signature,
            v: signatureData.v,
            r: signatureData.r,
            s: signatureData.s,
            message: "Signature generated. Client must call OCXToken.claim() to execute transaction."
        });

    } catch (err) {
        console.error("❌ Sign-claim error:", err);
        res.status(500).json({ 
            error: err.message || "Internal error",
            details: process.env.NODE_ENV !== "production" ? err.stack : undefined
        });
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
                return res.status(400).json({ error: "Trade already confirmed" });
            }

            // Convert OCX amount back to wei for verification
            expectedAmount = ethers.parseEther(trade.ocx_amount).toString();
            
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
                // Begin transaction-like updates
                // 1. Mark trade as confirmed
                const { error: tradeUpdateError } = await supabase
                    .from('trades')
                    .update({
                        status: 'confirmed',
                        tx_hash: txHash,
                        confirmed_at: new Date().toISOString(),
                        block_number: verification.blockNumber
                    })
                    .eq('id', tradeId);

                if (tradeUpdateError) {
                    throw new Error(`Failed to update trade: ${tradeUpdateError.message}`);
                }

                // 2. Get player record
                const { data: player, error: playerError } = await supabase
                    .from('players')
                    .select('*')
                    .eq('wallet_address', wallet.toLowerCase())
                    .single();

                if (playerError || !player) {
                    throw new Error(`Player not found: ${playerError?.message}`);
                }

                // 3. Update player: deduct resources, increment OCX earned
                const updates = {
                    total_ocx_earned: (player.total_ocx_earned || 0) + parseFloat(trade.ocx_amount)
                };

                // Deduct resources if this was a resource trade
                if (trade.resource_type && trade.resource_amount > 0) {
                    const resourceKey = trade.resource_type.toLowerCase();
                    const currentAmount = player[resourceKey] || 0;
                    
                    if (currentAmount < trade.resource_amount) {
                        console.warn(`⚠️ Resource underflow: ${resourceKey} ${currentAmount} < ${trade.resource_amount}`);
                        // Still proceed but log the issue
                    }

                    updates[resourceKey] = Math.max(0, currentAmount - trade.resource_amount);
                }

                const { error: playerUpdateError } = await supabase
                    .from('players')
                    .update(updates)
                    .eq('id', player.id);

                if (playerUpdateError) {
                    throw new Error(`Failed to update player: ${playerUpdateError.message}`);
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