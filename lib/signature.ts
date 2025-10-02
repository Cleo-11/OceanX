export const JOIN_SIGNATURE_DOMAIN = "OceanX"

export interface JoinSignatureMessage {
  domain: string
  action: "join-game"
  wallet: string
  session: string
  timestamp: number
  version: number
}

export interface JoinSignaturePayload {
  message: string
  session: string
  timestamp: number
  action: "join-game"
}

/**
 * Constructs a deterministic message that the client signs before joining a multiplayer session.
 * The message is serialized JSON so the backend can reliably parse and validate its contents.
 */
export const createJoinSignaturePayload = (walletAddress: string, sessionId?: string): JoinSignaturePayload => {
  if (!walletAddress) {
    throw new Error("walletAddress is required to create a join signature payload")
  }

  const session = sessionId ?? "auto"
  const timestamp = Date.now()

  const signatureMessage: JoinSignatureMessage = {
    domain: JOIN_SIGNATURE_DOMAIN,
    action: "join-game",
    wallet: walletAddress.toLowerCase(),
    session,
    timestamp,
    version: 1,
  }

  return {
    message: JSON.stringify(signatureMessage),
    session,
    timestamp,
    action: signatureMessage.action,
  }
}