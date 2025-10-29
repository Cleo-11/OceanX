# 🌊 OceanX - Blockchain Ocean Mining Game

A single-player blockchain-based mining game built with Next.js 14, Supabase, and Web3 technologies. Players control submarines to mine resources from the ocean depths and earn OCX tokens.

## 🚀 Quick Start

### For New Contributors
1. **Clone the repository**
   ```bash
   git clone https://github.com/Cleo-11/OceanX.git
   cd OceanX-master
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env.local
   # Fill in your Supabase credentials
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

### For Production Deployment
📖 **See:** [docs/INDEX.md](./docs/INDEX.md) - Complete production documentation

**Quick path to production:**
1. Read [docs/PRODUCTION-ROADMAP.md](./docs/PRODUCTION-ROADMAP.md)
2. Print [docs/QUICK-START-CHECKLIST.md](./docs/QUICK-START-CHECKLIST.md)
3. Follow [docs/PRODUCTION-IMPLEMENTATION-PLAN.md](./docs/PRODUCTION-IMPLEMENTATION-PLAN.md)

---

## 🎮 Features

- **Wallet Authentication** - Connect with Web3 wallets (MetaMask, etc.)
- **Submarine NFTs** - Upgradable submarines with 15 tiers
- **Mining Mechanics** - Earn resources and OCX tokens
- **3D Graphics** - Immersive underwater environment with Three.js
- **Marketplace** - Buy and sell submarine upgrades
- **Hangar System** - Manage your submarine fleet

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui, Radix UI
- **3D Graphics:** Three.js, @react-three/fiber
- **Icons:** Lucide React

### Backend
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth, Moralis
- **API:** Next.js API Routes

### Blockchain
- **Smart Contracts:** Solidity
- **Framework:** Foundry
- **Network:** Base Sepolia / Ethereum Sepolia
- **Web3 Library:** Ethers.js v6

---

## 📁 Project Structure

```
OceanX-master/
├── app/                      # Next.js app router pages
│   ├── api/                  # API routes
│   ├── game/                 # Main game page
│   ├── submarine-hangar/     # Submarine management
│   └── marketplace/          # Item marketplace
│
├── components/               # React components
│   ├── submarine-*.tsx       # Submarine-related components
│   ├── mine-button.tsx       # Mining mechanics
│   └── ui/                   # shadcn/ui components
│
├── lib/                      # Utility libraries
│   ├── supabase.ts          # Supabase client (client-side)
│   ├── supabase-server.ts   # Supabase server client
│   └── supabase-admin.ts    # Admin client (production)
│
├── contracts/                # Smart contracts (Foundry)
│   └── src/                  # Solidity contracts
│
├── db/                       # Database migrations
│   └── migrations/           # SQL migration files
│
├── scripts/                  # SQL scripts & utilities
│   ├── production-rls-policies.sql
│   └── check-production-rls.sql
│
└── docs/                     # Documentation
    ├── INDEX.md              # Documentation index
    ├── PRODUCTION-ROADMAP.md # Visual production guide
    └── ...                   # More guides
```

---

## 🔒 Security & Production

### Current Status: Demo-Safe
- ✅ Basic RLS policies applied
- ⚠️ Permissive (for rapid development)
- ⚠️ NOT production-ready

### Production Deployment

**🚨 Before going live, you MUST:**
1. Apply production RLS policies
2. Implement backend API security
3. Add input validation
4. Configure rate limiting

**📖 Full Guide:** [docs/PRODUCTION-IMPLEMENTATION-PLAN.md](./docs/PRODUCTION-IMPLEMENTATION-PLAN.md)

**⏱️ Time Required:** 4-6 hours

---

## 🗃️ Database Schema

### Core Tables

**`players`**
- Stores player profiles, resources, submarine tier
- Links to `auth.users` via `user_id`
- Protected by Row Level Security (RLS)

**`pending_actions`**
- Queued blockchain transactions
- Linked to players via `user_id`
- Executed asynchronously

### Migrations
All migrations in `db/migrations/`:
- `001-create-pending-actions.sql`
- `002-create-pending-actions.sql`
- `003-add-pending-fk-to-players.sql`
- `004-fix-players-schema-add-user-id.sql`

---

## 🎨 Development

### Prerequisites
- Node.js 18+
- npm or pnpm
- Supabase account
- MetaMask or Web3 wallet

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Production only (DO NOT commit)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Development Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run tests
npm test

# Lint code
npm run lint
```

---

## 📚 Documentation

### Getting Started
- [Production Roadmap](./docs/PRODUCTION-ROADMAP.md) - Visual guide to production
- [Quick Start Checklist](./docs/QUICK-START-CHECKLIST.md) - Printable checklist

### Implementation Guides
- [Production Implementation Plan](./docs/PRODUCTION-IMPLEMENTATION-PLAN.md) - Step-by-step guide
- [Backend Server-Side Patterns](./docs/BACKEND-SERVER-SIDE-PATTERNS.md) - API examples
- [RLS Migration Guide](./docs/PRODUCTION-RLS-MIGRATION.md) - Database security

### Reference
- [Documentation Index](./docs/INDEX.md) - Complete docs overview
- [Production Readiness Checklist](./docs/PRODUCTION-READINESS-CHECKLIST.md) - Pre-launch checklist
- [Scripts README](./scripts/README.md) - SQL scripts overview

---

## 🧪 Testing

### Manual Testing
See [docs/PRODUCTION-IMPLEMENTATION-PLAN.md - Phase 6](./docs/PRODUCTION-IMPLEMENTATION-PLAN.md#phase-6-testing--verification-60-min)

### Automated Testing
```bash
npm test
```

---

## 🚢 Deployment

### Recommended Platform: Vercel

1. **Connect repository** to Vercel
2. **Set environment variables** in Vercel dashboard
3. **Deploy** - Automatic on push to `main`

### Environment Variables (Production)
Set in Vercel Dashboard → Settings → Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (Secret)
- `NEXT_PUBLIC_SITE_URL` (Your domain)

### Database
- Apply production RLS policies via Supabase SQL Editor
- Run migrations in order from `db/migrations/`

**📖 Deployment Guide:** [docs/PRODUCTION-IMPLEMENTATION-PLAN.md - Phase 8](./docs/PRODUCTION-IMPLEMENTATION-PLAN.md#phase-8-final-checks--launch-30-min)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Coding Standards
- Use TypeScript for all new code
- Follow existing code style
- Add tests for new features
- Update documentation

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🙏 Acknowledgments

- **Supabase** - Database and authentication
- **Next.js** - React framework
- **shadcn/ui** - UI components
- **Three.js** - 3D graphics
- **Foundry** - Smart contract development

---

## 📞 Support

- **Documentation:** [docs/INDEX.md](./docs/INDEX.md)
- **Issues:** [GitHub Issues](https://github.com/Cleo-11/OceanX/issues)
- **Discussions:** [GitHub Discussions](https://github.com/Cleo-11/OceanX/discussions)

---

## 🗺️ Roadmap

### Phase 1: Core Game (Complete ✅)
- [x] Basic mining mechanics
- [x] Submarine system
- [x] Wallet integration
- [x] 3D environment

### Phase 2: Production Security (In Progress 🚧)
- [ ] Production RLS policies
- [ ] Backend API security
- [ ] Input validation
- [ ] Rate limiting

### Phase 3: Advanced Features (Planned 📋)
- [ ] Multiplayer support
- [ ] Real-time leaderboards
- [ ] Advanced submarine customization
- [ ] PvP mining zones

### Phase 4: Web3 Integration (Planned 📋)
- [ ] NFT marketplace
- [ ] Token staking
- [ ] DAO governance
- [ ] Cross-chain support

---

## 📊 Project Status

**Current State:** Demo-Safe ✅  
**Next Milestone:** Production-Ready 🎯  
**Target:** Q1 2025 🚀

---

**Ready to make it production-ready?**  
👉 Start here: [docs/INDEX.md](./docs/INDEX.md)

---

Built with 💙 by the OceanX Team
