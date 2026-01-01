# Archived Contracts

This directory contains contracts that were designed but not integrated into the production system.

---

## OceanResource.sol

**Status:** Archived (not in use)  
**Archived Date:** 2024  
**Reason:** Architecture decision to use off-chain resource tracking

### Original Purpose
This contract was designed to track resource nodes on-chain, allowing:
- Spawning new resource nodes with types (Metal, Rare, Jackpot)
- Marking resources as mined
- On-chain verification of resource state

### Why It's Not Used
The AbyssX architecture uses a **hybrid off-chain/on-chain model** for scalability and cost efficiency:

| Aspect | On-Chain Approach | Our Off-Chain Approach |
|--------|------------------|------------------------|
| Resource spawning | Gas cost per spawn | Free (Supabase) |
| Mining validation | Gas cost per mine | Server-authoritative (free) |
| Real-time updates | Slow (block time) | Instant (WebSocket) |
| Player experience | High latency | Low latency |
| Cost at scale | Expensive | Fixed DB cost |

### Current Architecture
1. **Mining happens in Supabase** via `miningService.js` with server-authoritative validation
2. **Resources are tracked** in `resource_events` table with append-only pattern
3. **Only token claims go on-chain** via `OCXToken.claim()` with EIP-712 signatures
4. **Server signs claims** after validating accumulated resources in database

### If You Need On-Chain Resources Later
This contract could be integrated for:
- NFT-based rare resource tracking
- Fully decentralized game mode
- Provably fair resource generation (using VRF)

To reactivate:
1. Move back to `../OceanResource.sol`
2. Create corresponding test file
3. Integrate with `OceanGameController.sol`
4. Update deployment scripts
