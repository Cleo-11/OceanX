/**
 * Game State Local Storage Manager
 * Handles client-side persistence of temporary game state (position, energy, hull, etc.)
 * Uses hybrid approach: localStorage for quick access, DB for permanent data
 */

interface GameState {
  position: {
    x: number;
    y: number;
    z: number;
  };
  energy: number;
  hull: number;
  sessionId: string | null;
  lastSaved: number;
}

const STORAGE_KEY_PREFIX = 'oceanx_gamestate';
const MAX_STATE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const AUTO_SAVE_INTERVAL_MS = 10000; // 10 seconds

/**
 * Save current game state to localStorage
 */
export function saveGameState(
  userId: string,
  position: { x: number; y: number; z: number },
  energy: number,
  hull: number,
  sessionId: string | null = null
): void {
  try {
    const gameState: GameState = {
      position,
      energy,
      hull,
      sessionId,
      lastSaved: Date.now(),
    };

    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}_${userId}`,
      JSON.stringify(gameState)
    );
  } catch (error) {
    console.error('Failed to save game state:', error);
  }
}

/**
 * Load game state from localStorage
 * Returns null if state is missing, corrupted, or too old
 */
export function loadGameState(userId: string): GameState | null {
  try {
    const savedData = localStorage.getItem(`${STORAGE_KEY_PREFIX}_${userId}`);
    
    if (!savedData) {
      return null;
    }

    const state: GameState = JSON.parse(savedData);

    // Validate state isn't too old (prevents stale data)
    if (Date.now() - state.lastSaved > MAX_STATE_AGE_MS) {
      console.warn('Game state expired, clearing...');
      clearGameState(userId);
      return null;
    }

    return state;
  } catch (error) {
    console.error('Failed to load game state:', error);
    return null;
  }
}

/**
 * Clear saved game state for a user
 */
export function clearGameState(userId: string): void {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}_${userId}`);
  } catch (error) {
    console.error('Failed to clear game state:', error);
  }
}

/**
 * Set up auto-save interval
 * Returns cleanup function to stop auto-saving
 */
export function setupAutoSave(
  userId: string,
  getGameState: () => {
    position: { x: number; y: number; z: number };
    energy: number;
    hull: number;
    sessionId: string | null;
  }
): () => void {
  const intervalId = setInterval(() => {
    const state = getGameState();
    saveGameState(
      userId,
      state.position,
      state.energy,
      state.hull,
      state.sessionId
    );
  }, AUTO_SAVE_INTERVAL_MS);

  // Save on page unload
  const handleBeforeUnload = () => {
    const state = getGameState();
    saveGameState(
      userId,
      state.position,
      state.energy,
      state.hull,
      state.sessionId
    );
  };

  window.addEventListener('beforeunload', handleBeforeUnload);

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}

/**
 * Get default game state (spawn position)
 */
export function getDefaultGameState(): Omit<GameState, 'lastSaved'> {
  return {
    position: { x: 0, y: 0, z: 0 },
    energy: 100,
    hull: 100,
    sessionId: 'global',
  };
}
