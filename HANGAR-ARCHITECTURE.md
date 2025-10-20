# 🏗️ Submarine Hangar - Architecture Diagram

## Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                    /submarine-hangar (Route)                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   page.tsx (Server Component)                    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ 1. Authenticate User (Supabase Auth)                   │   │
│  │ 2. Fetch Player Data (players table)                   │   │
│  │    - submarine_tier                                    │   │
│  │    - balance                                           │   │
│  │    - resources (nickel, cobalt, copper, manganese)    │   │
│  │    - wallet_address                                    │   │
│  │ 3. Pass data to Client Component                       │   │
│  └────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│               page-client.tsx (Client Component)                 │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ State Management:                                      │   │
│  │ - isUpgrading (boolean)                               │   │
│  │                                                        │   │
│  │ Handlers:                                             │   │
│  │ - handlePurchase() → Ethers.js integration           │   │
│  │ - handleClose() → Navigate to /home                  │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │             Background Effects Layer                      │ │
│  │  • Gradient background (slate → cyan)                   │ │
│  │  • Animated light rays (vertical gradients)             │ │
│  │  • Glowing orbs (blur + pulse)                          │ │
│  │  • Scanlines (retro holographic effect)                 │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    HangarHUD Component                    │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │ Fixed Top Dashboard (z-50)                        │  │ │
│  │  │                                                    │  │ │
│  │  │  Logo & Title  │  Active Vessel  │  Balance  │ X │  │ │
│  │  │                │   Tier Info    │   OCE     │   │  │ │
│  │  │ ─────────────────────────────────────────────────│  │ │
│  │  │  ● System Status Indicators                       │  │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                 HangarHeader Component                    │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │         🌊 HANGAR BAY 🌊                          │  │ │
│  │  │    Deep Sea Operations Center                     │  │ │
│  │  │                                                    │  │ │
│  │  │    ┌────────────────────────────┐                │  │ │
│  │  │    │  Currently Deployed:       │                │  │ │
│  │  │    │  Nautilus I - TIER 1       │                │  │ │
│  │  │    └────────────────────────────┘                │  │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              SubmarineCarousel Component                  │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │        Tier Navigator (1-10 buttons)              │  │ │
│  │  │  [1] [2] [3] [4] [5] [6] [7] [8] [9] [10]       │  │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  │                                                            │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │  ← Previous                           Next →      │  │ │
│  │  │                                                    │  │ │
│  │  │         ┌──────────────────────────┐             │  │ │
│  │  │         │                          │             │  │ │
│  │  │         │   SubmarineCard3D        │             │  │ │
│  │  │         │   (selected tier)        │             │  │ │
│  │  │         │                          │             │  │ │
│  │  │         └──────────────────────────┘             │  │ │
│  │  │                                                    │  │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│               SubmarineCard3D Component (Detail)                 │
│                                                                  │
│  ┌────────────────────────────┬───────────────────────────────┐ │
│  │  3D Display Column         │  Stats & Actions Column       │ │
│  │                            │                               │ │
│  │  ┌──────────────────────┐ │  ┌─────────────────────────┐ │ │
│  │  │                      │ │  │  PERFORMANCE            │ │ │
│  │  │  Submarine3DModel    │ │  │  Health, Energy         │ │ │
│  │  │  (Three.js Canvas)   │ │  │  Depth, Speed           │ │ │
│  │  │                      │ │  └─────────────────────────┘ │ │
│  │  │  • Auto-rotate       │ │                               │ │
│  │  │  • Animated props    │ │  ┌─────────────────────────┐ │ │
│  │  │  • Glowing lights    │ │  │  MINING                 │ │ │
│  │  │  • Tier indicators   │ │  │  Mining Rate            │ │ │
│  │  │                      │ │  │  Total Storage          │ │ │
│  │  └──────────────────────┘ │  └─────────────────────────┘ │ │
│  │                            │                               │ │
│  │  ┌──────────────────────┐ │  ┌─────────────────────────┐ │ │
│  │  │  Nautilus I          │ │  │  STORAGE CAPACITY       │ │ │
│  │  │  Tier 1              │ │  │  Nickel:    [████░░]    │ │ │
│  │  └──────────────────────┘ │  │  Cobalt:    [██░░░░]    │ │ │
│  │                            │  │  Copper:    [██░░░░]    │ │ │
│  │  ┌──────────────────────┐ │  │  Manganese: [█░░░░░]    │ │ │
│  │  │  SPECIAL ABILITY     │ │  └─────────────────────────┘ │ │
│  │  │  Description...      │ │                               │ │
│  │  └──────────────────────┘ │  ┌─────────────────────────┐ │ │
│  │                            │  │  UPGRADE COST           │ │ │
│  └────────────────────────────┤  │  OCE: 100 tokens        │ │ │
│                               │  └─────────────────────────┘ │ │
│                               │                               │ │
│                               │  ┌─────────────────────────┐ │ │
│                               │  │  [Deploy Submarine]     │ │ │
│                               │  └─────────────────────────┘ │ │
│                               └───────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│             Submarine3DModel Component (Three.js)                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Canvas (React Three Fiber)                              │  │
│  │                                                           │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │  Camera & Lights                                   │ │  │
│  │  │  - PerspectiveCamera                               │ │  │
│  │  │  - OrbitControls (auto-rotate)                     │ │  │
│  │  │  - ambientLight, spotLight, pointLight             │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │  3D Meshes                                         │ │  │
│  │  │                                                     │ │  │
│  │  │  • Main Hull (cylinder)                           │ │  │
│  │  │  • Nose Cone (cone)                               │ │  │
│  │  │  • Conning Tower (box + cylinder)                 │ │  │
│  │  │  • Propeller (animated rotation)                  │ │  │
│  │  │  • Side Fins (boxes)                              │ │  │
│  │  │  • Windows (glowing spheres)                      │ │  │
│  │  │  • Tier Indicator Lights                          │ │  │
│  │  │                                                     │ │  │
│  │  │  Materials:                                        │ │  │
│  │  │  - color: submarine.color                         │ │  │
│  │  │  - metalness: 0.8                                 │ │  │
│  │  │  - roughness: 0.2                                 │ │  │
│  │  │  - emissive: cyan (for lights)                    │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │  Animations (useFrame)                             │ │  │
│  │  │  - Propeller rotation (continuous)                 │ │  │
│  │  │  - Floating motion (sin wave)                      │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         SUPABASE DATABASE                         │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  players table                                              │ │
│  │  ────────────────────────────────────────────────────────  │ │
│  │  • user_id                                                  │ │
│  │  • wallet_address                                           │ │
│  │  • submarine_tier ← Current tier (1-10)                    │ │
│  │  • balance ← OCE tokens                                     │ │
│  │  • nickel, cobalt, copper, manganese ← Resources           │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                              ↓ SELECT query
┌──────────────────────────────────────────────────────────────────┐
│                  page.tsx (Server Component)                      │
│  const { data: playerRecord } = await supabase                   │
│    .from("players")                                              │
│    .select("*")                                                  │
│    .eq("user_id", session.user.id)                              │
└──────────────────────────────────────────────────────────────────┘
                              ↓ Props
┌──────────────────────────────────────────────────────────────────┐
│                page-client.tsx (Client Component)                 │
│  Props received:                                                 │
│  - currentTier: 1                                                │
│  - resources: { nickel: 100, cobalt: 50, ... }                  │
│  - balance: 1000                                                 │
│  - walletAddress: "0x..."                                        │
└──────────────────────────────────────────────────────────────────┘
        ↓                    ↓                    ↓
┌──────────────┐  ┌──────────────────┐  ┌─────────────────────┐
│  HangarHUD   │  │  HangarHeader    │  │ SubmarineCarousel   │
│              │  │                  │  │                     │
│  Displays:   │  │  Displays:       │  │  Displays:          │
│  • Balance   │  │  • Title         │  │  • All 10 tiers     │
│  • Resources │  │  • Current sub   │  │  • Selected tier    │
│  • Wallet    │  │  • Tier badge    │  │  • Navigation       │
└──────────────┘  └──────────────────┘  └─────────────────────┘
                                                  ↓
                                     ┌─────────────────────────┐
                                     │   SubmarineCard3D       │
                                     │                         │
                                     │  Validates:             │
                                     │  balance >= cost?       │
                                     │    ↓                    │
                                     │  Enables/Disables:      │
                                     │  Purchase button        │
                                     └─────────────────────────┘
                                                  ↓
                                     ┌─────────────────────────┐
                                     │  User clicks button     │
                                     │         ↓               │
                                     │  handlePurchase()       │
                                     │         ↓               │
                                     │  [TODO] Ethers.js       │
                                     │  Smart contract call    │
                                     │         ↓               │
                                     │  Update Supabase        │
                                     │  submarine_tier = new   │
                                     │         ↓               │
                                     │  Navigate to /game      │
                                     └─────────────────────────┘
```

---

## Animation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      Page Load Sequence                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  0.0s - Background renders                                       │
│         • Gradient background                                    │
│         • Light rays start pulsing                               │
│         • Glowing orbs fade in                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  0.0s - HangarHUD fades in                                       │
│         • opacity: 0 → 1 (0.8s)                                 │
│         • Status lights pulse                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  0.3s - HangarHeader slides in                                   │
│         • opacity: 0 → 1                                         │
│         • y: -20 → 0 (0.6s)                                     │
│         • Title glow pulses                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  0.6s - Tier Navigator fades in                                  │
│         • Buttons scale up one by one                            │
│         • Current tier highlighted                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  0.8s - SubmarineCard3D enters                                   │
│         • opacity: 0 → 1                                         │
│         • scale: 0.95 → 1 (0.5s)                                │
│         • 3D model starts rotating                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  1.0s - Stats animate in                                         │
│         • Storage bars fill from 0% → 100%                       │
│         • Numbers count up                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  READY - User can interact                                       │
│         • All animations complete                                │
│         • 3D model rotating continuously                         │
│         • Hover effects active                                   │
└─────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                   Carousel Navigation Sequence                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  User clicks Next/Prev or tier button                            │
│         ↓                                                        │
│  setDirection(1 or -1)                                           │
│  setSelectedIndex(newIndex)                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Current card exits                                              │
│         • x: 0 → -1000 (or +1000) (0.6s)                        │
│         • opacity: 1 → 0                                         │
│         • scale: 1 → 0.8                                         │
│         • rotateY: 0 → -45° (or +45°)                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  New card enters (from opposite side)                            │
│         • x: +1000 (or -1000) → 0 (0.6s)                        │
│         • opacity: 0 → 1                                         │
│         • scale: 0.8 → 1                                         │
│         • rotateY: +45° (or -45°) → 0                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3D model loads                                                  │
│         • Suspense shows loading spinner                         │
│         • Model renders                                          │
│         • Auto-rotation starts                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Stats animate                                                   │
│         • Storage bars fill (1s)                                 │
│         • Purchase button ready                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## State Management

```
┌─────────────────────────────────────────────────────────────────┐
│                  page-client.tsx State                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  const [isUpgrading, setIsUpgrading] = useState(false)          │
│                                                                  │
│  Purpose: Disable purchase button during transaction            │
│                                                                  │
│  Flow:                                                           │
│  1. User clicks "Deploy Submarine"                              │
│  2. setIsUpgrading(true)                                        │
│  3. Button shows "Upgrading..." with spinner                    │
│  4. Blockchain transaction executes                             │
│  5. On success/failure: setIsUpgrading(false)                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              SubmarineCarousel.tsx State                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  const [selectedIndex, setSelectedIndex] = useState(0)          │
│                                                                  │
│  Purpose: Track which submarine is currently displayed          │
│  Range: 0-9 (maps to tiers 1-10)                                │
│                                                                  │
│  const [direction, setDirection] = useState(0)                  │
│                                                                  │
│  Purpose: Control animation direction                           │
│  Values: 1 (next), -1 (prev), 0 (initial)                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Dependency Graph

```
app/submarine-hangar/page.tsx
    ├── imports: @supabase/auth-helpers-nextjs
    ├── imports: @/lib/types
    └── renders: ./page-client.tsx

app/submarine-hangar/page-client.tsx
    ├── imports: next/navigation
    ├── imports: @/components/style-wrapper
    ├── imports: @/lib/types
    ├── imports: @/components/hangar/HangarHUD
    ├── imports: @/components/hangar/HangarHeader
    └── imports: @/components/hangar/SubmarineCarousel

components/hangar/HangarHUD.tsx
    ├── imports: lucide-react (X, Wallet)
    ├── imports: @/lib/types
    └── imports: @/lib/submarine-tiers

components/hangar/HangarHeader.tsx
    ├── imports: framer-motion
    ├── imports: @/lib/submarine-tiers
    └── imports: lucide-react (Waves, Anchor)

components/hangar/SubmarineCarousel.tsx
    ├── imports: react (useState, Suspense)
    ├── imports: framer-motion
    ├── imports: @/lib/types
    ├── imports: @/lib/submarine-tiers
    ├── imports: ./SubmarineCard3D
    └── imports: lucide-react (ChevronLeft, ChevronRight)

components/hangar/SubmarineCard3D.tsx
    ├── imports: framer-motion
    ├── imports: @react-three/fiber (Canvas)
    ├── imports: @react-three/drei (OrbitControls, etc.)
    ├── imports: @/lib/submarine-tiers
    ├── imports: @/lib/types
    ├── imports: @/lib/resource-utils
    ├── imports: ./Submarine3DModel
    └── imports: lucide-react (Lock, Star, Zap, etc.)

components/hangar/Submarine3DModel.tsx
    ├── imports: react (useRef)
    ├── imports: @react-three/fiber (useFrame)
    └── imports: @types/three (Mesh)

lib/submarine-tiers.ts
    └── exports: SUBMARINE_TIERS array

lib/types.ts
    └── exports: TypeScript interfaces

lib/resource-utils.ts
    └── exports: hasEnoughResourcesForUpgrade()
```

---

This architecture ensures clean separation of concerns, optimal performance, and easy maintenance!
