/**
 * Test Suite for Game State Storage
 * Tests localStorage integration for temporary game state persistence
 */

import { saveGameState, loadGameState, clearGameState, getDefaultGameState } from '../lib/gameStateStorage';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

describe('Game State Storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('saveGameState', () => {
    it('should save game state to localStorage', () => {
      const userId = 'test-user-123';
      const position = { x: 500, y: 300 };
      const energy = 80;
      const hull = 95;
      const sessionId = 'global';

      saveGameState(userId, position, energy, hull, sessionId);

      const savedData = localStorage.getItem(`oceanx_gamestate_${userId}`);
      expect(savedData).not.toBeNull();

      if (savedData) {
        const parsed = JSON.parse(savedData);
        expect(parsed.position).toEqual(position);
        expect(parsed.energy).toBe(energy);
        expect(parsed.hull).toBe(hull);
        expect(parsed.sessionId).toBe(sessionId);
        expect(parsed.lastSaved).toBeDefined();
      }
    });

    it('should handle missing userId gracefully', () => {
      // Should not throw error
      expect(() => {
        saveGameState('', { x: 0, y: 0 }, 100, 100, 'global');
      }).not.toThrow();
    });
  });

  describe('loadGameState', () => {
    it('should load saved game state', () => {
      const userId = 'test-user-123';
      const position = { x: 500, y: 300 };
      const energy = 80;
      const hull = 95;
      const sessionId = 'global';

      saveGameState(userId, position, energy, hull, sessionId);
      const loaded = loadGameState(userId);

      expect(loaded).not.toBeNull();
      expect(loaded?.position).toEqual(position);
      expect(loaded?.energy).toBe(energy);
      expect(loaded?.hull).toBe(hull);
      expect(loaded?.sessionId).toBe(sessionId);
    });

    it('should return null for non-existent user', () => {
      const loaded = loadGameState('non-existent-user');
      expect(loaded).toBeNull();
    });

    it('should return null for expired game state', () => {
      const userId = 'test-user-123';
      const expiredState = {
        position: { x: 500, y: 300 },
        energy: 80,
        hull: 95,
        sessionId: 'global',
        lastSaved: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
      };

      localStorage.setItem(`oceanx_gamestate_${userId}`, JSON.stringify(expiredState));
      const loaded = loadGameState(userId);

      expect(loaded).toBeNull();
      // Should also clear expired state
      expect(localStorage.getItem(`oceanx_gamestate_${userId}`)).toBeNull();
    });

    it('should handle corrupted localStorage data', () => {
      const userId = 'test-user-123';
      localStorage.setItem(`oceanx_gamestate_${userId}`, 'invalid-json{]');

      const loaded = loadGameState(userId);
      expect(loaded).toBeNull();
    });
  });

  describe('clearGameState', () => {
    it('should clear saved game state', () => {
      const userId = 'test-user-123';
      saveGameState(userId, { x: 500, y: 300 }, 80, 95, 'global');

      expect(localStorage.getItem(`oceanx_gamestate_${userId}`)).not.toBeNull();

      clearGameState(userId);

      expect(localStorage.getItem(`oceanx_gamestate_${userId}`)).toBeNull();
    });
  });

  describe('getDefaultGameState', () => {
    it('should return default spawn state', () => {
      const defaults = getDefaultGameState();

      expect(defaults.position).toEqual({ x: 0, y: 0, z: 0 });
      expect(defaults.energy).toBe(100);
      expect(defaults.hull).toBe(100);
      expect(defaults.sessionId).toBe('global');
    });
  });

  describe('State Persistence Integration', () => {
    it('should persist state across save/load cycles', () => {
      const userId = 'test-user-123';
      let position = { x: 100, y: 200 };
      let energy = 90;
      let hull = 100;

      // Initial save
      saveGameState(userId, position, energy, hull, 'global');
      let loaded = loadGameState(userId);
      expect(loaded?.position).toEqual(position);
      expect(loaded?.energy).toBe(energy);

      // Update state
      position = { x: 200, y: 300 };
      energy = 75;
      hull = 85;
      saveGameState(userId, position, energy, hull, 'global');

      // Load updated state
      loaded = loadGameState(userId);
      expect(loaded?.position).toEqual(position);
      expect(loaded?.energy).toBe(energy);
      expect(loaded?.hull).toBe(hull);
    });

    it('should handle rapid save/load operations', () => {
      const userId = 'test-user-123';

      for (let i = 0; i < 100; i++) {
        saveGameState(userId, { x: i, y: i * 2 }, 100 - i, 100, 'global');
      }

      const loaded = loadGameState(userId);
      expect(loaded?.position).toEqual({ x: 99, y: 198 });
      expect(loaded?.energy).toBe(1);
    });
  });

  describe('Multi-user Isolation', () => {
    it('should maintain separate state for different users', () => {
      const user1 = 'user-1';
      const user2 = 'user-2';

      saveGameState(user1, { x: 100, y: 100 }, 80, 90, 'global');
      saveGameState(user2, { x: 200, y: 200 }, 60, 70, 'session-2');

      const loaded1 = loadGameState(user1);
      const loaded2 = loadGameState(user2);

      expect(loaded1?.position).toEqual({ x: 100, y: 100 });
      expect(loaded1?.energy).toBe(80);
      expect(loaded1?.sessionId).toBe('global');

      expect(loaded2?.position).toEqual({ x: 200, y: 200 });
      expect(loaded2?.energy).toBe(60);
      expect(loaded2?.sessionId).toBe('session-2');

      // Clearing one user should not affect the other
      clearGameState(user1);
      expect(loadGameState(user1)).toBeNull();
      expect(loadGameState(user2)).not.toBeNull();
    });
  });
});
