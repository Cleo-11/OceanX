/**
 * Client-side handler for movement-rejected events
 * Add this to your game component to handle server position corrections
 */

// Example integration in your game component:

// 1. Add to WebSocket event listeners (in useEffect or game initialization)
websocket.on("movement-rejected", (data: {
  reason: string;
  details: string;
  currentPosition: { x: number; y: number; z: number; rotation: number };
  timestamp: number;
}) => {
  console.warn("⚠️ Server rejected movement:", {
    reason: data.reason,
    details: data.details,
    serverPosition: data.currentPosition
  });
  
  // Sync player position back to server's authoritative position
  if (playerRef.current) {
    playerRef.current.position.set(
      data.currentPosition.x,
      data.currentPosition.y,
      data.currentPosition.z
    );
    
    // If you have rotation
    if (playerRef.current.rotation) {
      playerRef.current.rotation.y = data.currentPosition.rotation;
    }
  }
  
  // Optional: Show warning to player
  if (data.reason === "movement_too_fast") {
    // Toast notification: "Movement too fast - position corrected"
    showWarningToast("Position corrected by server");
  } else if (data.reason === "update_too_frequent") {
    // Throttle movement updates on client side
    console.warn("Sending position updates too frequently");
  }
});

// 2. Optional: Throttle position updates to prevent spam rejections
let lastPositionSent = 0;
const MIN_UPDATE_INTERVAL = 16; // 60 FPS

function sendPlayerPosition(position: { x: number; y: number; z: number; rotation: number }) {
  const now = Date.now();
  
  if (now - lastPositionSent < MIN_UPDATE_INTERVAL) {
    return; // Skip this update - too frequent
  }
  
  lastPositionSent = now;
  
  websocket.emit("player-move", {
    sessionId: currentSessionId,
    walletAddress: playerWallet,
    position: position
  });
}

// 3. Optional: Client-side speed validation (prevents most rejections)
let lastPosition = { x: 0, y: 0, z: 0 };
let lastMoveTime = Date.now();
const CLIENT_MAX_SPEED = 50; // Must match server MAX_SPEED

function validateMovementBeforeSending(newPosition: { x: number; y: number; z: number }) {
  const now = Date.now();
  const deltaTime = now - lastMoveTime;
  
  // Calculate distance
  const dx = newPosition.x - lastPosition.x;
  const dy = newPosition.y - lastPosition.y;
  const dz = newPosition.z - lastPosition.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  
  // Calculate max allowed distance
  const maxDistance = (CLIENT_MAX_SPEED * deltaTime) / 1000;
  
  if (distance > maxDistance) {
    console.warn("Client-side speed limit exceeded - clamping movement");
    
    // Clamp to max distance (maintain direction)
    const ratio = maxDistance / distance;
    return {
      x: lastPosition.x + dx * ratio,
      y: lastPosition.y + dy * ratio,
      z: lastPosition.z + dz * ratio
    };
  }
  
  lastPosition = newPosition;
  lastMoveTime = now;
  return newPosition;
}

// 4. Usage in game loop
function gameLoop() {
  // Get desired position from player input
  const desiredPosition = calculateNewPosition();
  
  // Validate client-side (optional but recommended)
  const validatedPosition = validateMovementBeforeSending(desiredPosition);
  
  // Update local position
  if (playerRef.current) {
    playerRef.current.position.set(
      validatedPosition.x,
      validatedPosition.y,
      validatedPosition.z
    );
  }
  
  // Send to server (throttled)
  sendPlayerPosition({
    x: validatedPosition.x,
    y: validatedPosition.y,
    z: validatedPosition.z,
    rotation: playerRotation
  });
  
  requestAnimationFrame(gameLoop);
}

export {};
