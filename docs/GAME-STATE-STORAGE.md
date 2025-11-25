# Game State Storage - Hybrid Approach

This project uses a **hybrid storage approach** for optimal performance and data persistence:

## 🎮 Local Storage (Client-Side) - Temporary Game State

Stored in browser `localStorage` for instant access:

- **Player Position** (x, y, z coordinates)
- **Submarine Energy** (current energy level)
- **Submarine Hull** (current health/durability)
- **Active Session ID** (multiplayer session reference)
- **UI Preferences** (settings, keybinds, etc.)

### Benefits:
- ⚡ **Instant restore** on page refresh/reconnect
- 🔌 **Works offline** (no network latency)
- 💾 **Reduces DB load** (no writes on every movement)
- 🔄 **Auto-saves** every 10 seconds + on page unload

### Data Expiration:
Local state automatically expires after **24 hours** to prevent stale data.

---

## 🗄️ Database Storage (Server-Side) - Permanent Data

Stored in Supabase `players` table for persistence:

- **Resource Inventory** (nickel, cobalt, copper, manganese)
- **Coins** (in-game currency)
- **Submarine Tier** (current upgrade level)
- **Total Resources Mined** (lifetime stats)
- **Total OCX Earned** (lifetime blockchain earnings)
- **Last Login Timestamp**
- **Profile Data** (username, wallet address, user_id)

### Benefits:
- 🔒 **Server-authoritative** (prevents cheating)
- 🌍 **Cross-device sync** (same account, any device)
- 📊 **Permanent records** (never expires)
- 🔐 **Secure** (protected by RLS policies)

---

## 🚀 Usage

### 1. Import the Storage Manager

```typescript
import {
  saveGameState,
  loadGameState,
  setupAutoSave,
  clearGameState,
  getDefaultGameState
} from '@/lib/gameStateStorage';
```

### 2. Load State on Game Start

```typescript
// On component mount or game initialization
useEffect(() => {
  const userId = session?.user?.id;
  if (!userId) return;

  // Try to restore from localStorage
  const savedState = loadGameState(userId);
  
  if (savedState) {
    // Restore player to last known position
    spawnPlayerAt(savedState.position.x, savedState.position.y, savedState.position.z);
    setSubmarineEnergy(savedState.energy);
    setSubmarineHull(savedState.hull);
    
    // Rejoin session if they were in one
    if (savedState.sessionId) {
      rejoinSession(savedState.sessionId);
    }
  } else {
    // No saved state - use defaults
    const defaultState = getDefaultGameState();
    spawnPlayerAt(defaultState.position.x, defaultState.position.y, defaultState.position.z);
    setSubmarineEnergy(defaultState.energy);
    setSubmarineHull(defaultState.hull);
  }
}, [session]);
```

### 3. Set Up Auto-Save

```typescript
// Set up auto-save when game starts
useEffect(() => {
  const userId = session?.user?.id;
  if (!userId) return;

  const cleanup = setupAutoSave(userId, () => ({
    position: { x: player.x, y: player.y, z: player.z },
    energy: submarine.energy,
    hull: submarine.hull,
    sessionId: currentSession?.id || null
  }));

  // Clean up on unmount
  return cleanup;
}, [session]);
```

### 4. Manual Save (Optional)

```typescript
// Save manually on important events (e.g., after mining)
function handleMiningSuccess(resource: string, amount: number) {
  // Update DB (permanent data)
  await supabase
    .from('players')
    .update({
      [resource]: currentAmount + amount,
      total_resources_mined: totalMined + amount
    })
    .eq('user_id', userId);

  // Save local state
  saveGameState(
    userId,
    { x: player.x, y: player.y, z: player.z },
    submarine.energy,
    submarine.hull,
    currentSession?.id
  );
}
```

### 5. Clear State (Logout/Reset)

```typescript
// Clear local state on logout
function handleLogout() {
  const userId = session?.user?.id;
  if (userId) {
    clearGameState(userId);
  }
  // ... rest of logout logic
}
```

---

## ⚖️ What Goes Where?

### ✅ Store Locally (Fast, Temporary)
- Player coordinates
- Energy/hull status
- Active session
- Camera position
- Sound settings

### ✅ Store in Database (Permanent, Secure)
- Resources (nickel, cobalt, etc.)
- Coins & submarine tier
- Lifetime stats
- Wallet address
- Achievement progress

---

## 🔧 Configuration

Adjust constants in `lib/gameStateStorage.ts`:

```typescript
const MAX_STATE_AGE_MS = 24 * 60 * 60 * 1000; // How long before state expires
const AUTO_SAVE_INTERVAL_MS = 10000;          // How often to auto-save
```

---

## 🛡️ Security Notes

- Local storage is **not encrypted** - never store sensitive data (private keys, passwords)
- DB-stored data is protected by **Row Level Security (RLS)** policies
- Server validates all resource changes to prevent cheating
- Local state is **read-only for gameplay logic** - DB is source of truth for inventory

---

## 📝 Example: Full Integration

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { loadGameState, setupAutoSave, getDefaultGameState } from '@/lib/gameStateStorage';

export function GameComponent() {
  const { session } = useSession();
  const [playerState, setPlayerState] = useState(getDefaultGameState());

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    // Load saved state
    const saved = loadGameState(userId);
    if (saved) {
      setPlayerState(saved);
    }

    // Set up auto-save
    const cleanup = setupAutoSave(userId, () => ({
      position: playerState.position,
      energy: playerState.energy,
      hull: playerState.hull,
      sessionId: playerState.sessionId
    }));

    return cleanup;
  }, [session]);

  return (
    <div>
      {/* Your game UI */}
      <p>Position: ({playerState.position.x}, {playerState.position.y}, {playerState.position.z})</p>
      <p>Energy: {playerState.energy}</p>
      <p>Hull: {playerState.hull}</p>
    </div>
  );
}
```

---

**✨ Result:** Fast, reliable game state management with the best of both worlds!
