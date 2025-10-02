import { z } from "zod"

const finiteNumberBetween = (min: number, max: number) =>
  z
    .number()
    .min(min)
    .max(max)
    .refine((value) => Number.isFinite(value), "Value must be a finite number")

// Validation schemas for API inputs and WebSocket messages

// Resource type validation
export const resourceTypeSchema = z.enum(['nickel', 'cobalt', 'copper', 'manganese'])

// Player resources validation
export const playerResourcesSchema = z.object({
  nickel: z.number().int().min(0),
  cobalt: z.number().int().min(0),
  copper: z.number().int().min(0),
  manganese: z.number().int().min(0),
})

// Player position validation
export const playerPositionSchema = z.object({
  x: finiteNumberBetween(0, 2000), // Assuming map bounds
  y: finiteNumberBetween(0, 2000),
  rotation: finiteNumberBetween(0, 360).optional().default(0),
  z: finiteNumberBetween(-10000, 10000).optional().default(0),
})

// Resource node validation
export const resourceNodeSchema = z.object({
  id: z.string().min(1).max(128),
  position: z.object({
    x: finiteNumberBetween(-2000, 2000),
    y: finiteNumberBetween(-2000, 2000),
    z: finiteNumberBetween(-1000, 1000).optional().default(0),
  }),
  type: resourceTypeSchema,
  amount: z.number().int().min(0).max(1000),
  depleted: z.boolean().default(false),
  size: finiteNumberBetween(5, 200).optional().default(20),
  maxAmount: z.number().int().min(0).max(5000).optional(),
})

// Player stats validation
export const playerStatsSchema = z.object({
  health: z.number().min(0).max(100),
  energy: z.number().min(0).max(100),
  capacity: playerResourcesSchema,
  maxCapacity: playerResourcesSchema,
  depth: z.number().min(0),
  speed: z.number().min(0).max(100),
  miningRate: z.number().min(0).max(100),
  tier: z.number().int().min(1).max(10),
})

// Mining request validation
export const mineResourceRequestSchema = z.object({
  nodeId: z.string().min(1).max(128),
  playerId: z.string().min(1),
  resourceType: resourceTypeSchema,
  amount: z.number().int().min(1).max(50).optional().default(1),
})

// WebSocket message validation
export const webSocketMessageSchema = z.object({
  type: z.enum(['game-state', 'resource-mined', 'player-joined', 'player-left', 'error']),
  data: z.any(),
  timestamp: z.number().optional(),
})

// Game state validation
export const gameStateSchema = z.object({
  players: z.array(z.object({
    id: z.string(),
    walletAddress: z.string().optional(),
    username: z.string().optional(),
    position: playerPositionSchema.optional(),
    submarineTier: z.number().int().min(1).max(10).optional().default(1),
  })).optional().default([]),
  resources: z.array(resourceNodeSchema).optional().default([]),
  resourceNodes: z.array(resourceNodeSchema).optional().default([]),
})

// Trading request validation
export const tradeRequestSchema = z.object({
  playerId: z.string().min(1),
  resourceType: resourceTypeSchema,
  amount: z.number().int().min(1).max(1000),
})

// Submarine upgrade validation
export const upgradeRequestSchema = z.object({
  playerId: z.string().min(1),
  targetTier: z.number().int().min(2).max(10),
})

// Wallet address validation
export const walletAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address")
  .transform((value) => value.toLowerCase())

// Contract transaction validation
export const contractTransactionSchema = z.object({
  to: walletAddressSchema,
  value: z.string().regex(/^\d+$/, "Invalid value format"),
  data: z.string().regex(/^0x[a-fA-F0-9]*$/, "Invalid transaction data").optional(),
  gasLimit: z.string().regex(/^\d+$/, "Invalid gas limit").optional(),
})

// Error response validation
export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  message: z.string().optional(),
  code: z.number().int().optional(),
})

// Success response validation
export const successResponseSchema = z.object({
  success: z.literal(true),
  data: z.any().optional(),
  message: z.string().optional(),
})

// API response validation
export const apiResponseSchema = z.union([successResponseSchema, errorResponseSchema])

// API response validation
export const apiResponseSchema = z.union([successResponseSchema, errorResponseSchema])

export const playerMovePayloadSchema = z.object({
  sessionId: z.string().min(1),
  walletAddress: walletAddressSchema,
  position: playerPositionSchema,
})

export const mineResourcePayloadSchema = z.object({
  sessionId: z.string().min(1),
  walletAddress: walletAddressSchema,
  nodeId: z.string().min(1).max(128),
  resourceType: resourceTypeSchema.optional(),
  amount: z.number().int().min(1).max(50).optional().default(1),
})

// Helper function to validate and sanitize input
export function validateInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  try {
    return schema.parse(input)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      throw new Error(`Validation failed: ${fieldErrors.join(', ')}`)
    }
    throw error
  }
}

// Helper function to safely validate optional input
export function validateInputSafe<T>(schema: z.ZodSchema<T>, input: unknown): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = validateInput(schema, input)
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown validation error' }
  }
}
//