import { ethers } from "ethers";

const JOIN_SIGNATURE_DOMAIN = "OceanX"
const DEFAULT_MAX_SIGNATURE_AGE_MS = parseInt(process.env.JOIN_SIGNATURE_MAX_AGE_MS ?? "", 10) || 5 * 60 * 1000
const MAX_FUTURE_SKEW_MS = 60 * 1000 // allow up to 60 seconds of clock skew

const AUTH_SIGNATURE_DOMAIN = "AbyssX"
const DEFAULT_AUTH_SIGNATURE_MAX_AGE_MS =
  parseInt(process.env.AUTH_SIGNATURE_MAX_AGE_MS ?? "", 10) || DEFAULT_MAX_SIGNATURE_AGE_MS

const normalizeAddress = (address) => {
  if (typeof address !== "string") {
    throw new Error("Wallet address must be a string")
  }
  return address.toLowerCase()
}

const normalizeAction = (action) =>
  typeof action === "string" ? action.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") : ""

const parseJoinSignatureMessage = (message) => {
  if (!message || typeof message !== "string") {
    throw new Error("Signature message is required")
  }

  let parsed
  try {
    parsed = JSON.parse(message)
  } catch (error) {
    throw new Error("Signature message must be valid JSON")
  }

  const { domain, action, wallet, session, timestamp, version } = parsed

  if (domain !== JOIN_SIGNATURE_DOMAIN) {
    throw new Error("Invalid signature domain")
  }

  if (action !== "join-game") {
    throw new Error("Invalid signature action")
  }

  if (typeof wallet !== "string") {
    throw new Error("Signature is missing wallet information")
  }

  if (typeof timestamp !== "number") {
    throw new Error("Signature is missing timestamp")
  }

  return {
    domain,
    action,
    wallet: normalizeAddress(wallet),
    session: typeof session === "string" ? session : "auto",
    timestamp,
    version: typeof version === "number" ? version : 1,
  }
}

const parseAuthSignatureMessage = (message) => {
  if (!message || typeof message !== "string") {
    throw new Error("Signature message is required")
  }

  const lines = message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (!lines.length) {
    throw new Error("Signature message is empty")
  }

  const header = lines[0]
  if (!header.startsWith(`${AUTH_SIGNATURE_DOMAIN} `)) {
    throw new Error("Invalid signature domain")
  }

  const action = header.slice(AUTH_SIGNATURE_DOMAIN.length).trim()
  const walletLine = lines.find((line) => line.toLowerCase().startsWith("wallet:"))
  const timestampLine = lines.find((line) => line.toLowerCase().startsWith("timestamp:"))
  const networkLine = lines.find((line) => line.toLowerCase().startsWith("network:"))

  if (!walletLine) {
    throw new Error("Signature is missing wallet information")
  }
  if (!timestampLine) {
    throw new Error("Signature is missing timestamp")
  }

  const wallet = walletLine.split(":")[1]?.trim()
  const timestamp = Number.parseInt(timestampLine.split(":")[1]?.trim(), 10)
  const network = networkLine ? networkLine.split(":")[1]?.trim() : undefined

  if (!wallet) {
    throw new Error("Signature wallet line is malformed")
  }

  if (!Number.isFinite(timestamp)) {
    throw new Error("Signature timestamp is invalid")
  }

  return {
    domain: AUTH_SIGNATURE_DOMAIN,
    action,
    wallet: normalizeAddress(wallet),
    timestamp,
    network,
  }
}

const verifyJoinSignature = ({
  walletAddress,
  sessionId,
  signature,
  message,
  maxAgeMs = DEFAULT_MAX_SIGNATURE_AGE_MS,
  now = Date.now(),
}) => {
  if (!walletAddress) {
    throw new Error("Wallet address is required")
  }
  if (!signature) {
    throw new Error("Signature is required")
  }
  if (!message) {
    throw new Error("Signature message is required")
  }

  const normalizedWallet = normalizeAddress(walletAddress)
  const parsed = parseJoinSignatureMessage(message)

  if (parsed.wallet !== normalizedWallet) {
    throw new Error("Signed wallet does not match the provided wallet address")
  }

  let recoveredAddress
  try {
    recoveredAddress = normalizeAddress(ethers.verifyMessage(message, signature))
  } catch (error) {
    throw new Error("Signature verification failed")
  }

  if (recoveredAddress !== normalizedWallet) {
    throw new Error("Signature does not correspond to the provided wallet address")
  }

  if (typeof maxAgeMs === "number" && maxAgeMs > 0) {
    if (now - parsed.timestamp > maxAgeMs) {
      throw new Error("Signature has expired")
    }
    if (parsed.timestamp - now > MAX_FUTURE_SKEW_MS) {
      throw new Error("Signature timestamp is too far in the future")
    }
  }

  const requestedSession = sessionId ? sessionId.toLowerCase() : "auto"
  const signedSession = parsed.session ? parsed.session.toLowerCase() : "auto"
  if (requestedSession !== "auto" && signedSession !== requestedSession) {
    throw new Error("Signed session does not match requested session")
  }

  return {
    session: signedSession,
    timestamp: parsed.timestamp,
    wallet: normalizedWallet,
  }
}

const ensureExpectedAction = (parsedAction, expectedActions) => {
  if (!expectedActions || (Array.isArray(expectedActions) && expectedActions.length === 0)) {
    return
  }

  const normalizedParsed = normalizeAction(parsedAction)
  const expectedArray = Array.isArray(expectedActions) ? expectedActions : [expectedActions]

  const matches = expectedArray
    .map((candidate) => normalizeAction(candidate))
    .some((candidate) => candidate && candidate === normalizedParsed)

  if (!matches) {
    throw new Error("Signature action does not match expected action")
  }
}

const verifyAuthSignature = ({
  walletAddress,
  signature,
  message,
  expectedActions,
  maxAgeMs = DEFAULT_AUTH_SIGNATURE_MAX_AGE_MS,
  now = Date.now(),
}) => {
  if (!walletAddress) {
    throw new Error("Wallet address is required")
  }
  if (!signature) {
    throw new Error("Signature is required")
  }
  if (!message) {
    throw new Error("Signature message is required")
  }

  const normalizedWallet = normalizeAddress(walletAddress)
  const parsed = parseAuthSignatureMessage(message)

  ensureExpectedAction(parsed.action, expectedActions)

  if (parsed.wallet !== normalizedWallet) {
    throw new Error("Signed wallet does not match the provided wallet address")
  }

  let recoveredAddress
  try {
    recoveredAddress = normalizeAddress(ethers.verifyMessage(message, signature))
  } catch (error) {
    throw new Error("Signature verification failed")
  }

  if (recoveredAddress !== normalizedWallet) {
    throw new Error("Signature does not correspond to the provided wallet address")
  }

  if (typeof maxAgeMs === "number" && maxAgeMs > 0) {
    if (now - parsed.timestamp > maxAgeMs) {
      throw new Error("Signature has expired")
    }
    if (parsed.timestamp - now > MAX_FUTURE_SKEW_MS) {
      throw new Error("Signature timestamp is too far in the future")
    }
  }

  return {
    wallet: normalizedWallet,
    action: parsed.action,
    timestamp: parsed.timestamp,
    network: parsed.network,
  }
}

const HEADER_KEYS = {
  address: ["x-wallet-address", "x-wallet", "x-user-address"],
  signature: ["x-wallet-signature", "x-signature", "x-auth-signature"],
  message: ["x-wallet-message", "x-auth-message", "x-signature-message"],
}

const BODY_KEYS = {
  address: ["walletAddress", "address", "wallet", "userAddress"],
  signature: ["signature", "authSignature"],
  message: ["message", "authMessage"],
}

const QUERY_KEYS = {
  address: ["walletAddress", "address", "wallet", "userAddress"],
  signature: ["signature", "authSignature"],
  message: ["message", "authMessage"],
}

const coerceString = (value) => {
  if (typeof value === "string") {
    return value.trim()
  }
  if (Array.isArray(value)) {
    for (const candidate of value) {
      const result = coerceString(candidate)
      if (result) {
        return result
      }
    }
  }
  if (value != null && typeof value.toString === "function") {
    const str = value.toString().trim()
    return str.length ? str : undefined
  }
  return undefined
}

const pickFromSource = (source, keys) => {
  if (!source || typeof source !== "object") {
    return { value: undefined, source: undefined }
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = coerceString(source[key])
      if (value) {
        return { value, source: key }
      }
    }
  }

  return { value: undefined, source: undefined }
}

const extractAuthPayload = (
  req,
  {
    bodyKeys = BODY_KEYS,
    headerKeys = HEADER_KEYS,
    queryKeys = QUERY_KEYS,
    allowBody = true,
    allowHeaders = true,
    allowQuery = true,
  } = {},
) => {
  const bodyAddress = allowBody ? pickFromSource(req.body, bodyKeys.address) : {}
  const queryAddress = allowQuery ? pickFromSource(req.query, queryKeys.address) : {}
  const headerAddress = allowHeaders ? pickFromSource(req.headers, headerKeys.address) : {}

  const bodySignature = allowBody ? pickFromSource(req.body, bodyKeys.signature) : {}
  const querySignature = allowQuery ? pickFromSource(req.query, queryKeys.signature) : {}
  const headerSignature = allowHeaders ? pickFromSource(req.headers, headerKeys.signature) : {}

  const bodyMessage = allowBody ? pickFromSource(req.body, bodyKeys.message) : {}
  const queryMessage = allowQuery ? pickFromSource(req.query, queryKeys.message) : {}
  const headerMessage = allowHeaders ? pickFromSource(req.headers, headerKeys.message) : {}

  const walletAddress = bodyAddress.value || queryAddress.value || headerAddress.value
  const signature = bodySignature.value || querySignature.value || headerSignature.value
  const message = bodyMessage.value || queryMessage.value || headerMessage.value

  return {
    walletAddress,
    signature,
    message,
    sources: {
      wallet: bodyAddress.source ? `body.${bodyAddress.source}` : queryAddress.source ? `query.${queryAddress.source}` : headerAddress.source ? `header.${headerAddress.source}` : undefined,
      signature: bodySignature.source ? `body.${bodySignature.source}` : querySignature.source ? `query.${querySignature.source}` : headerSignature.source ? `header.${headerSignature.source}` : undefined,
      message: bodyMessage.source ? `body.${bodyMessage.source}` : queryMessage.source ? `query.${queryMessage.source}` : headerMessage.source ? `header.${headerMessage.source}` : undefined,
    },
  }
}

const createAuthMiddleware = ({
  expectedActions,
  maxAgeMs,
  bodyKeys = BODY_KEYS,
  headerKeys = HEADER_KEYS,
  queryKeys = QUERY_KEYS,
  allowBody = true,
  allowHeaders = true,
  allowQuery = true,
  attachProperty = "auth",
} = {}) => {
  return (req, res, next) => {
    try {
      const { walletAddress, signature, message, sources } = extractAuthPayload(req, {
        bodyKeys,
        headerKeys,
        queryKeys,
        allowBody,
        allowHeaders,
        allowQuery,
      })

      const verification = verifyAuthSignature({
        walletAddress,
        signature,
        message,
        expectedActions,
        maxAgeMs,
      })

      req[attachProperty] = verification
      req.auth = verification
      req.authSignature = signature
      req.authMessage = message
      req.authSources = sources
      if (!res.locals || typeof res.locals !== "object") {
        res.locals = {}
      }
      res.locals.auth = verification

      next()
    } catch (error) {
      console.warn("Authentication middleware rejected request", {
        path: req.path,
        method: req.method,
        reason: error?.message,
      })

      res.status(401).json({ error: error?.message || "Unauthorized" })
    }
  }
}

const ensureAuthenticationFresh = ({
  authenticatedAt,
  maxAgeMs = DEFAULT_MAX_SIGNATURE_AGE_MS,
  now = Date.now(),
} = {}) => {
  if (!authenticatedAt) {
    throw new Error("Authentication timestamp missing")
  }

  if (typeof maxAgeMs === "number" && maxAgeMs > 0) {
    if (now - authenticatedAt > maxAgeMs) {
      throw new Error("Authentication has expired")
    }
    if (authenticatedAt - now > MAX_FUTURE_SKEW_MS) {
      throw new Error("Authentication timestamp is too far in the future")
    }
  }

  return true
}

export {
  JOIN_SIGNATURE_DOMAIN,
  DEFAULT_MAX_SIGNATURE_AGE_MS,
  MAX_FUTURE_SKEW_MS,
  parseJoinSignatureMessage,
  verifyJoinSignature,
  AUTH_SIGNATURE_DOMAIN,
  DEFAULT_AUTH_SIGNATURE_MAX_AGE_MS,
  parseAuthSignatureMessage,
  verifyAuthSignature,
  createAuthMiddleware,
  extractAuthPayload,
  ensureAuthenticationFresh,
  BODY_KEYS,
  HEADER_KEYS,
  QUERY_KEYS,
};