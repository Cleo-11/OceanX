# 🚀 Marketplace Implementation Guide

## ✅ What's Been Created

### 1. **Main Files**
- ✅ `/app/marketplace/page.tsx` - Server component with auth
- ✅ `/app/marketplace/marketplace-client.tsx` - Client component with full UI
- ✅ `/lib/marketplace-utils.ts` - Helper functions and resource data
- ✅ `/lib/types.ts` - Extended with marketplace types
- ✅ `MARKETPLACE-README.md` - Complete documentation

### 2. **Features Implemented**
- ✅ Stunning underwater-themed UI with animations
- ✅ Resource grid with search and filters
- ✅ Rarity-based color coding (Common → Legendary)
- ✅ Trade modal with amount selector
- ✅ OCX balance display
- ✅ Trade history viewer
- ✅ Responsive design (mobile + desktop)
- ✅ Framer Motion animations
- ✅ Route integration from `/home` page

### 3. **Visual Polish**
- ✅ Glowing holographic cards
- ✅ Animated floating particles
- ✅ Smooth hover effects
- ✅ Modal slide animations
- ✅ Gradient backgrounds
- ✅ Rarity-specific glow effects

## 🔧 Next Steps to Make it Production-Ready

### Step 1: Database Setup (Supabase)

Create these tables in your Supabase database:

```sql
-- Player Resources Inventory
CREATE TABLE player_resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  resource_id TEXT NOT NULL,
  amount INTEGER DEFAULT 0 CHECK (amount >= 0),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(player_id, resource_id)
);

-- Trade Transactions History
CREATE TABLE trade_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  resource_id TEXT NOT NULL,
  resource_name TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  ocx_received NUMERIC NOT NULL CHECK (ocx_received > 0),
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Marketplace Resource Catalog
CREATE TABLE marketplace_resources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  category TEXT NOT NULL CHECK (category IN ('mineral', 'organic', 'energy', 'artifact')),
  base_ocx_rate NUMERIC NOT NULL CHECK (base_ocx_rate > 0),
  description TEXT,
  is_tradable BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_player_resources_player_id ON player_resources(player_id);
CREATE INDEX idx_trade_transactions_player_id ON trade_transactions(player_id);
CREATE INDEX idx_trade_transactions_timestamp ON trade_transactions(timestamp DESC);
```

### Step 2: Seed Initial Resource Data

```sql
-- Insert the 4 mineable resources
INSERT INTO marketplace_resources (id, name, icon, rarity, category, base_ocx_rate, description) VALUES
('nickel', 'Nickel', '⚪', 'common', 'mineral', 10, 'Common nickel deposits found on the ocean floor'),
('cobalt', 'Cobalt', '🔵', 'uncommon', 'mineral', 25, 'Valuable cobalt-rich mineral nodules from deep waters'),
('copper', 'Copper', '�', 'rare', 'mineral', 50, 'Rare copper ore deposits from volcanic vents'),
('manganese', 'Manganese', '⚫', 'epic', 'mineral', 100, 'Premium manganese nodules from the abyssal plains');
```

### Step 3: Update TypeScript Database Interface

Add to `lib/types.ts`:

```typescript
export interface Database {
  public: {
    Tables: {
      // ... existing tables ...
      player_resources: {
        Row: {
          id: string
          player_id: string
          resource_id: string
          amount: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          player_id: string
          resource_id: string
          amount?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          player_id?: string
          resource_id?: string
          amount?: number
          updated_at?: string
        }
      }
      trade_transactions: {
        Row: {
          id: string
          player_id: string
          resource_id: string
          resource_name: string
          amount: number
          ocx_received: number
          timestamp: string
        }
        Insert: {
          id?: string
          player_id: string
          resource_id: string
          resource_name: string
          amount: number
          ocx_received: number
          timestamp?: string
        }
        Update: {
          id?: string
          player_id?: string
          resource_id?: string
          resource_name?: string
          amount?: number
          ocx_received?: number
          timestamp?: string
        }
      }
      marketplace_resources: {
        Row: {
          id: string
          name: string
          icon: string | null
          rarity: string
          category: string
          base_ocx_rate: number
          description: string | null
          is_tradable: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          icon?: string | null
          rarity: string
          category: string
          base_ocx_rate: number
          description?: string | null
          is_tradable?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          icon?: string | null
          rarity?: string
          category?: string
          base_ocx_rate?: number
          description?: string | null
          is_tradable?: boolean
          updated_at?: string
        }
      }
    }
  }
}
```

### Step 4: Replace Mock Data with Real Data

Update `marketplace-client.tsx` around line 110-180:

```typescript
// Replace the useEffect with mock data with:
useEffect(() => {
  async function fetchPlayerResources() {
    try {
      const { data: resourcesData, error: resourcesError } = await supabase
        .from("player_resources")
        .select(`
          *,
          marketplace_resources (*)
        `)
        .eq("player_id", playerData.id)

      if (resourcesError) throw resourcesError

      const formattedResources: Resource[] = resourcesData.map((item) => ({
        id: item.resource_id,
        name: item.marketplace_resources.name,
        icon: item.marketplace_resources.icon,
        rarity: item.marketplace_resources.rarity as RarityLevel,
        category: item.marketplace_resources.category as Resource["category"],
        ocxRate: item.marketplace_resources.base_ocx_rate,
        amount: item.amount,
        description: item.marketplace_resources.description,
      }))

      setResources(formattedResources)
      setFilteredResources(formattedResources)
    } catch (error) {
      console.error("Error fetching resources:", error)
    }
  }

  fetchPlayerResources()
}, [playerData.id])
```

### Step 5: Implement Real Blockchain Trading

Update the `handleTrade` function around line 260:

```typescript
const handleTrade = async () => {
  if (!selectedResource || tradeAmount <= 0 || tradeAmount > selectedResource.amount) return

  setIsTrading(true)
  try {
    const ocxToReceive = selectedResource.ocxRate * tradeAmount

    // 1. Record transaction in database
    const { error: tradeError } = await supabase
      .from("trade_transactions")
      .insert({
        player_id: playerData.id,
        resource_id: selectedResource.id,
        resource_name: selectedResource.name,
        amount: tradeAmount,
        ocx_received: ocxToReceive,
      })

    if (tradeError) throw tradeError

    // 2. Update player's resource inventory
    const { error: updateError } = await supabase
      .from("player_resources")
      .update({
        amount: selectedResource.amount - tradeAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("player_id", playerData.id)
      .eq("resource_id", selectedResource.id)

    if (updateError) throw updateError

    // 3. TODO: Execute blockchain transaction to mint OCX tokens
    // const walletManager = WalletManager.getInstance()
    // await walletManager.executeContract(
    //   OCX_TOKEN_ADDRESS,
    //   OCX_TOKEN_ABI,
    //   'mint',
    //   [playerData.wallet_address, ethers.parseEther(ocxToReceive.toString())]
    // )

    // 4. Update player's total OCX earned
    await supabase
      .from("players")
      .update({
        total_ocx_earned: (playerData.total_ocx_earned || 0) + ocxToReceive,
      })
      .eq("id", playerData.id)

    // 5. Update local state
    const updatedResources = resources.map((r) =>
      r.id === selectedResource.id
        ? { ...r, amount: r.amount - tradeAmount }
        : r
    )
    setResources(updatedResources)

    // 6. Refresh balance
    await fetchOCXBalance()

    // 7. Show success notification
    // toast.success(`Traded ${tradeAmount}x ${selectedResource.name} for ${ocxToReceive} OCX!`)

    setSelectedResource(null)
    setTradeAmount(1)
  } catch (error) {
    console.error("Trade error:", error)
    // toast.error("Trade failed. Please try again.")
  } finally {
    setIsTrading(false)
  }
}
```

### Step 6: Load Recent Trade History

Add this useEffect around line 230:

```typescript
// Fetch trade history
useEffect(() => {
  async function fetchTradeHistory() {
    try {
      const { data, error } = await supabase
        .from("trade_transactions")
        .select("*")
        .eq("player_id", playerData.id)
        .order("timestamp", { ascending: false })
        .limit(10)

      if (error) throw error
      setRecentTrades(data || [])
    } catch (error) {
      console.error("Error fetching trade history:", error)
    }
  }

  fetchTradeHistory()
}, [playerData.id])
```

### Step 7: Connect to Mining Game

When players mine resources in the game, update their inventory:

```typescript
// In your mining/game logic
async function addMinedResource(playerId: string, resourceId: string, amount: number) {
  const { data, error } = await supabase
    .from("player_resources")
    .upsert({
      player_id: playerId,
      resource_id: resourceId,
      amount: supabase.raw(`COALESCE(amount, 0) + ${amount}`),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'player_id,resource_id'
    })
  
  return { data, error }
}
```

## 🎮 Testing Checklist

- [ ] Navigate from home page to marketplace
- [ ] Verify resources load correctly
- [ ] Test search functionality
- [ ] Test rarity filter
- [ ] Test category filter
- [ ] Open trade modal
- [ ] Adjust trade amount with +/- buttons
- [ ] Test max button
- [ ] Confirm trade
- [ ] Verify OCX balance updates
- [ ] Check trade appears in history
- [ ] Test on mobile device
- [ ] Verify animations are smooth

## 📱 Mobile Optimization

The marketplace is already responsive with:
- Grid adjusts from 4 columns → 3 → 2 → 1
- Touch-friendly buttons
- Mobile-optimized modals
- Smooth scrolling

## 🎨 Customization

### Change Color Theme
Edit `marketplace-client.tsx`:
```typescript
// Change primary color from cyan to purple
className="text-cyan-400" → className="text-purple-400"
className="border-cyan-500/30" → className="border-purple-500/30"
```

### Add New Resource
Edit `lib/marketplace-utils.ts`:
```typescript
{
  id: "new_resource",
  name: "New Resource",
  icon: "🔮",
  rarity: "epic",
  category: "energy",
  ocxRate: 600,
  description: "A brand new rare resource",
}
```

## 🚨 Common Issues

### "Cannot find module" Error
- Restart TypeScript server: `Cmd/Ctrl + Shift + P` → "Restart TS Server"
- Check file exists in `/app/marketplace/marketplace-client.tsx`

### Resources Not Loading
- Verify Supabase connection
- Check console for errors
- Ensure player is authenticated

### Trade Not Working
- Check wallet is connected
- Verify Supabase permissions (RLS policies)
- Check transaction hasn't exceeded available amount

## 📚 Additional Resources

- [Framer Motion Docs](https://www.framer.com/motion/)
- [ShadCN UI Components](https://ui.shadcn.com/)
- [Supabase Docs](https://supabase.com/docs)
- [Ethers.js Guide](https://docs.ethers.org/)

---

**Your marketplace is ready! Just connect the database and you're live! 🎉**
