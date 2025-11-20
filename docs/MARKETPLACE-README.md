# 🌊 OceanX Marketplace

## Overview

The **OceanX Marketplace** is a stunning, immersive trading hub where players can convert their mined ocean resources into OCX tokens. Built with modern web technologies, it features a beautiful underwater aesthetic with holographic effects and smooth animations.

## Features

### 🎨 Visual Design
- **Aquatic Theme**: Deep blues, glowing effects, and animated particles create an underwater atmosphere
- **Holographic UI**: Glassmorphic cards with gradient borders and glow effects
- **Rarity System**: Color-coded resources (Common, Uncommon, Rare, Epic, Legendary)
- **Responsive Grid**: Optimized layout for desktop and mobile devices

### ⚡ Core Functionality
- **Resource Trading**: Convert mined resources to OCX tokens
- **Real-time Balance**: Display current OCX wallet balance
- **Search & Filters**: Find resources by name, rarity, or category
- **Trade History**: View recent marketplace transactions
- **Dynamic Exchange Rates**: Each resource has its own OCX conversion rate

### 🎬 Animations
- Smooth page transitions with Framer Motion
- Hover effects on resource cards
- Animated background particles (bubbles/light rays)
- Modal slide-in animations
- Loading states with animated spinners

## Technical Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: ShadCN UI
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Database**: Supabase
- **Blockchain**: Ethers.js for wallet integration

## File Structure

```
app/marketplace/
├── page.tsx                 # Server component (auth & data fetching)
└── marketplace-client.tsx   # Client component (UI & interactions)

lib/
├── marketplace-utils.ts     # Helper functions & resource data
└── types.ts                 # TypeScript interfaces (extended)
```

## Routes

### `/marketplace`
- **Access**: Requires authentication and connected wallet
- **Redirects**: Unauthenticated users → `/auth`, No wallet → `/home`

## Resource Properties

Each tradable resource has:

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique identifier (nickel, cobalt, copper, manganese) |
| `name` | string | Display name |
| `icon` | string | Emoji icon |
| `rarity` | enum | common \| uncommon \| rare \| epic |
| `category` | enum | mineral (all 4 resources) |
| `ocxRate` | number | OCX tokens per unit |
| `amount` | number | Player's available quantity |
| `description` | string | Flavor text |

## The 4 Mineable Resources

| Resource | Rarity | OCX Rate | Description |
|----------|--------|----------|-------------|
| **Nickel** | Common | 10 | Common nickel deposits found on the ocean floor |
| **Cobalt** | Uncommon | 25 | Valuable cobalt-rich mineral nodules from deep waters |
| **Copper** | Rare | 50 | Rare copper ore deposits from volcanic vents |
| **Manganese** | Epic | 100 | Premium manganese nodules from the abyssal plains |

## Trading Flow

1. **Browse Resources**: View grid of available resources with stats
2. **Select Resource**: Click on card to open trade modal
3. **Choose Amount**: Use +/- buttons or input field to set quantity
4. **View Preview**: See total OCX tokens to receive
5. **Confirm Trade**: Execute blockchain transaction
6. **Update Balance**: OCX balance and inventory updated

## Integration Points

### Supabase
```typescript
// Fetch player inventory
const { data } = await supabase
  .from("player_resources")
  .select("*")
  .eq("player_id", playerId)

// Record trade transaction
await supabase
  .from("trade_transactions")
  .insert({
    player_id: playerId,
    resource_id: resourceId,
    amount: tradeAmount,
    ocx_received: totalOCX,
  })
```

### Wallet Integration
```typescript
// Get OCX balance from wallet
const walletManager = WalletManager.getInstance()
const connection = walletManager.getConnection()
const balance = await walletManager.getBalance()
```

## Future Enhancements

### Phase 1: Core Features
- [ ] Connect to actual Supabase inventory system
- [ ] Implement real blockchain OCX token transfers
- [ ] Add transaction confirmation notifications
- [ ] Create trade history persistence

### Phase 2: Advanced Features
- [ ] Dynamic pricing based on supply/demand
- [ ] Daily trading limits/bonuses
- [ ] Bulk trading discounts
- [ ] Trading achievements/badges

### Phase 3: Social Features
- [ ] Player-to-player trading
- [ ] Global marketplace statistics
- [ ] Price history charts
- [ ] Trading leaderboards

## Database Schema (Proposed)

### `player_resources` table
```sql
CREATE TABLE player_resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id),
  resource_id TEXT NOT NULL,
  amount INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### `trade_transactions` table
```sql
CREATE TABLE trade_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id),
  resource_id TEXT NOT NULL,
  resource_name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  ocx_received NUMERIC NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

### `marketplace_resources` table
```sql
CREATE TABLE marketplace_resources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  rarity TEXT NOT NULL,
  category TEXT NOT NULL,
  base_ocx_rate NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Usage Example

```tsx
// Navigate from Home page
<Button onClick={() => router.push('/marketplace')}>
  <ShoppingBag className="mr-2" />
  Trade OCX
</Button>

// Direct link
<Link href="/marketplace">Marketplace</Link>
```

## Styling Classes

### Custom Background
```css
bg-gradient-to-b from-depth-950 via-depth-900 to-depth-950
```

### Glowing Cards
```css
bg-gradient-to-br from-depth-800/80 to-depth-900/80 
border-2 border-cyan-400/50 
shadow-2xl hover:shadow-cyan-500/50
```

### Animated Particles
```tsx
<motion.div
  animate={{ y: [-100, window.innerHeight + 100] }}
  transition={{ duration: 20, repeat: Infinity }}
  className="absolute w-1 h-1 bg-cyan-400 rounded-full"
/>
```

## Performance Optimizations

- **Lazy Loading**: Resource images loaded on demand
- **Debounced Search**: Filter updates throttled
- **Memoized Calculations**: Exchange rates cached
- **Optimistic Updates**: UI updates before blockchain confirmation

## Accessibility

- Keyboard navigation support
- ARIA labels on interactive elements
- High contrast mode compatible
- Screen reader friendly

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Testing

```bash
# Run marketplace locally
pnpm dev

# Navigate to
http://localhost:3000/marketplace

# Test trading flow
1. Ensure wallet is connected
2. Select any resource
3. Adjust quantity
4. Confirm trade
5. Verify balance update
```

## Known Issues

- [ ] Mock data currently used (needs Supabase integration)
- [ ] Blockchain transactions simulated (needs smart contract)
- [ ] Trade history stored in component state (needs persistence)

## Contributing

When adding new resources:
1. Add to `DEFAULT_MARKETPLACE_RESOURCES` in `marketplace-utils.ts`
2. Ensure proper rarity and category
3. Set appropriate OCX exchange rate
4. Add descriptive flavor text
5. Test on both desktop and mobile

## Support

For issues or questions about the marketplace:
- Check existing documentation
- Review code comments
- Test in development environment
- Verify Supabase connection

---

**Built with 💙 for the OceanX community**
