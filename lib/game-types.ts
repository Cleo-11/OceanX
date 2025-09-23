// Enhanced type definitions for the ocean mining game

export interface AquaticElement {
  x: number;
  y: number;
  opacity: number;
}

export interface SunRay {
  x: number;
  width: number;
  opacity: number;
  speed: number;
}

export interface Fish {
  x: number;
  y: number;
  size: number;
  speed: number;
  direction: number;
  opacity: number;
  swimOffset: number;
}

export interface Particle {
  x: number;
  y: number;
  speedX: number;
  speedY: number;
  opacity: number;
  life: number;
}

export interface ParticleBurst {
  x: number;
  y: number;
  color: string;
  particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
  }>;
}

export interface AquaticState {
  sunRays: SunRay[];
  seaweed: never[]; // Empty array type
  kelp: never[]; // Empty array type  
  coral: never[]; // Empty array type
  fish: Fish[];
  bubbles: never[]; // Empty array type
  particles: Particle[];
}

export interface ScreenShake {
  active: boolean;
  intensity: number;
  duration: number;
  time: number;
}

export interface ColorGrade {
  active: boolean;
  tint: string;
  opacity: number;
  duration: number;
  time: number;
}

export interface MovementKeys {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
}

export interface GameStateHandlerData {
  nodeId: string;
  playerId: string;
  resources?: import('./types').PlayerResources;
  amount?: number;
}

export interface ResourceMinedData {
  nodeId: string;
  playerId: string;
  resourceType: string;
  amount: number;
}

// Connection status type
export type ConnectionStatus = "connecting" | "connected" | "disconnected";

// WebSocket event handlers
export interface WebSocketHandlers {
  "game-state": (data: GameStateHandlerData) => void;
  "resource-mined": (data: ResourceMinedData) => void;
  "error": (error: any) => void;
}