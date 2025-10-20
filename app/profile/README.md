# 🌊 OceanX Profile Page

## Overview

The `/profile` page is a comprehensive player dashboard for the OceanX multiplayer Web3 submarine mining game. It provides a secure, beautifully designed interface for players to view their stats, manage their submarines, track achievements, and disconnect their wallet.

## 🏗️ Architecture

### Server Component (`page.tsx`)
- **Secure Data Fetching**: Fetches player data from Supabase on the server side
- **Authentication Check**: Redirects unauthenticated users to home page
- **Data Transformation**: Structures raw database data into organized profile sections
- **No Client Bundle**: No sensitive data or API keys exposed to the client

### Client Component (`profile-client.tsx`)
- **Interactive UI**: Handles user interactions, animations, and state management
- **Real-time Updates**: Listens for wallet events and updates balance live
- **Wallet Disconnection**: Manages the disconnect flow with warning modal
- **Responsive Design**: Bento-style grid layout that adapts to all screen sizes

## 📊 Data Structure

### ProfileData Interface
```typescript
interface ProfileData {
  playerInfo: {
    username: string | null
    walletAddress: string | null
    joinDate: string | null
    userId: string
  }
  tokenInfo: {
    ocxBalance: number
    totalEarned: number
    totalMined: number
    coins: number
  }
  submarineInfo: {
    currentTier: number
    submarineName: string
    nextUpgradeCost: number | null
  }
  resourceStats: {
    totalResourcesMined: number
    fuelRemaining: number
    missionsCompleted: number
  }
  achievements: {
    badgesUnlocked: number
    nextGoalProgress: number
  }
}
```

## 🎨 Design Features

### Bento Grid Layout
- Responsive grid system: 1 column on mobile, 2 on tablet, 3 on desktop
- Each card spans appropriate columns for optimal content display
- Consistent spacing and alignment across all breakpoints

### Glassmorphism Cards
- Semi-transparent backgrounds with backdrop blur
- Soft shadows with color-matched glows (cyan, yellow, purple, etc.)
- Hover effects with gradient overlays
- Border colors matching card themes

### Color Scheme
- **Cyan/Blue**: Player info, navigation elements
- **Yellow**: Token economy, OCX balance
- **Purple**: Submarine fleet information
- **Green**: Resource statistics
- **Orange**: Achievements and badges
- **Red**: Warning states, disconnect button

### Animations
- **Staggered Card Entry**: Cards fade in with delay for smooth loading
- **Hover Effects**: Scale and gradient overlays on card hover
- **Background Orbs**: Floating animated gradient orbs for depth
- **Balance Updates**: Scale animation when balance changes
- **Smooth Transitions**: All state changes are animated

## 🔐 Security Features

### Server-Side Rendering
- All sensitive data queries happen on the server
- No database credentials exposed to client
- Wallet address validated before data fetch

### Authentication Flow
1. User must provide wallet address via URL param (`?wallet=0x...`)
2. Server validates wallet address exists
3. Data fetched securely from Supabase
4. Unauthenticated users redirected to home

### Data Deletion
- Complete user data deletion on disconnect
- Confirmation modal with detailed warning
- Irreversible action with multiple safeguards

## 🚀 Usage

### Accessing the Profile
```typescript
// From any component with wallet connection:
router.push(`/profile?wallet=${walletAddress}`)

// Or use Link component:
<Link href={`/profile?wallet=${walletAddress}`}>
  View Profile
</Link>
```

### Navigation
- **Back to Ocean**: Returns to `/game` page
- **Disconnect Wallet**: Shows warning modal, then deletes data and redirects to home

## 📦 Components Used

### shadcn/ui Components
- `Card`, `CardContent`, `CardHeader`, `CardTitle`
- `Button` (various variants)
- `Badge` (for status indicators)
- `Progress` (for progress bars)
- `AlertDialog` (for disconnect warning)

### Icons (lucide-react)
- `Waves`, `Wallet`, `Trophy`, `Zap`, `Package`
- `Calendar`, `ArrowLeft`, `LogOut`, `AlertTriangle`
- `Coins`, `Anchor`, `Award`, `Target`

### Animation (framer-motion)
- `motion` components for all animations
- Variants for staggered children
- Hover states and transitions

## 🔄 Real-time Features

### Live Balance Updates
```typescript
// Updates every 10 seconds
useEffect(() => {
  const interval = setInterval(async () => {
    const { data } = await supabase
      .from("players")
      .select("coins")
      .eq("wallet_address", walletAddress)
      .single()

    if (data) {
      setLiveBalance(data.coins || 0)
    }
  }, 10000)

  return () => clearInterval(interval)
}, [walletAddress])
```

## 🗄️ Database Queries

### Player Data Query
```typescript
const { data: playerData, error } = await supabase
  .from("players")
  .select("*")
  .eq("wallet_address", walletAddress)
  .single()
```

### Submarine Tier Query
```typescript
const { data: submarineData } = await supabase
  .from("submarine_tiers")
  .select("*")
  .eq("id", playerData.submarine_tier || 1)
  .single()
```

### Next Upgrade Cost Query
```typescript
const { data: nextTierData } = await supabase
  .from("submarine_tiers")
  .select("cost")
  .eq("id", (playerData.submarine_tier || 1) + 1)
  .single()
```

## 🎯 Future Enhancements

### TODO Items
1. **Fuel Tracking**: Add `fuel_remaining` column to players table
2. **Missions System**: Create missions table and track completed missions
3. **Advanced Achievements**: More detailed badge/achievement system
4. **Transaction History**: Display recent OCX earnings/spending
5. **Social Features**: Friend list, leaderboard integration
6. **NFT Integration**: Display owned submarine NFTs
7. **Settings Panel**: Game preferences, notifications, privacy
8. **Export Data**: Allow players to export their statistics

### Database Enhancements Needed
```sql
-- Add fuel tracking
ALTER TABLE players ADD COLUMN fuel_remaining INTEGER DEFAULT 100;

-- Create missions table
CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id),
  mission_type VARCHAR(50) NOT NULL,
  completed_at TIMESTAMP,
  reward_amount INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create achievements table
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  unlock_criteria JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create player_achievements junction table
CREATE TABLE player_achievements (
  player_id UUID REFERENCES players(id),
  achievement_id UUID REFERENCES achievements(id),
  unlocked_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (player_id, achievement_id)
);
```

## 🐛 Error Handling

### Missing Player Data
- Redirects to home page with console error
- Prevents rendering with invalid data

### Failed Disconnect
- Shows alert to user
- Prevents navigation until successful
- Console logs detailed error

### Database Errors
- Graceful fallbacks for missing data
- Default values for optional fields
- Error boundaries prevent crashes

## 📱 Responsive Breakpoints

- **Mobile** (< 768px): Single column layout
- **Tablet** (768px - 1024px): Two column layout
- **Desktop** (> 1024px): Three column bento grid

## 🎨 Styling Guidelines

### Card Structure
```tsx
<Card className="bg-depth-900/60 backdrop-blur-xl border-[color]/20 shadow-lg shadow-[color]/10 overflow-hidden group">
  <div className="absolute inset-0 bg-gradient-to-br from-[color]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
  <CardHeader>
    <CardTitle className="flex items-center gap-2 text-[color]">
      <Icon className="h-5 w-5" />
      Title
    </CardTitle>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

### Color Variables
- `depth-900`, `depth-950`: Dark backgrounds
- `ocean-50`, `ocean-300`, `ocean-400`: Text colors
- Theme colors: `cyan-400`, `yellow-400`, `purple-400`, `green-400`, `orange-400`

## 📄 File Structure

```
app/profile/
├── page.tsx              # Server component (data fetching)
├── profile-client.tsx    # Client component (UI & interactions)
└── README.md            # This file
```

## 🔧 Dependencies

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.x",
    "framer-motion": "^10.x",
    "lucide-react": "^0.x",
    "next": "^14.x",
    "ethers": "^6.x"
  }
}
```

## 📝 Notes

- Always pass wallet address as URL parameter
- Server components cannot use hooks or event handlers
- Client components handle all interactivity
- Supabase RLS policies should be properly configured
- Test disconnect flow in development before production

## 🏆 Credits

Built for **OceanX** - A Web3 submarine mining game
Designed with ❤️ by the OceanX team
