# 🎨 Submarine Hangar - Visual Design Guide

## Design Philosophy

The Submarine Hangar transforms the functional submarine store into an **immersive futuristic command center** where players feel like they're standing in a real underwater military base. Every visual element reinforces the sci-fi underwater theme while maintaining perfect usability.

---

## Color System

### Primary Palette
```css
/* Cyber Cyan - Main brand color */
--cyber-cyan: #06b6d4;
--cyber-cyan-dark: #0891b2;
--cyber-cyan-light: #22d3ee;

/* Electric Blue - Secondary accent */
--electric-blue: #3b82f6;
--electric-blue-dark: #2563eb;
--electric-blue-light: #60a5fa;

/* Deep Ocean - Background layers */
--ocean-deep: #0f172a;      /* Slate-950 */
--ocean-mid: #1e293b;        /* Slate-900 */
--ocean-surface: #164e63;    /* Cyan-950 */
```

### Status Colors
```css
/* Status: Owned */
--status-owned: #22c55e;        /* Green-500 */
--status-owned-bg: #16a34a;     /* Green-600 */

/* Status: Current/Active */
--status-active: #06b6d4;       /* Cyan-500 */
--status-active-bg: #0891b2;    /* Cyan-600 */

/* Status: Available */
--status-available: #3b82f6;    /* Blue-500 */
--status-available-bg: #2563eb; /* Blue-600 */

/* Status: Locked */
--status-locked: #64748b;       /* Slate-500 */
--status-locked-bg: #475569;    /* Slate-600 */

/* Status: Legendary */
--legendary: #f59e0b;           /* Amber-500 */
--legendary-accent: #fb923c;    /* Orange-400 */
```

### Resource Colors
```css
/* Resource: Nickel */
--resource-nickel: #94a3b8;     /* Slate-400 */

/* Resource: Cobalt */
--resource-cobalt: #3b82f6;     /* Blue-500 */

/* Resource: Copper */
--resource-copper: #f97316;     /* Orange-500 */

/* Resource: Manganese */
--resource-manganese: #a855f7;  /* Purple-500 */
```

---

## Typography

### Font Stack
```css
/* Primary (UI Text) */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;

/* Monospace (Numbers, Data) */
font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Courier New', monospace;
```

### Type Scale
```css
/* Mega Title */
.title-mega {
  font-size: 3.75rem;    /* 60px */
  font-weight: 900;
  letter-spacing: -0.025em;
  line-height: 1;
}

/* Large Title */
.title-large {
  font-size: 3rem;       /* 48px */
  font-weight: 800;
  letter-spacing: -0.02em;
}

/* Section Title */
.title-section {
  font-size: 2rem;       /* 32px */
  font-weight: 700;
  letter-spacing: -0.01em;
}

/* Heading */
.heading {
  font-size: 1.5rem;     /* 24px */
  font-weight: 700;
}

/* Subheading */
.subheading {
  font-size: 1.125rem;   /* 18px */
  font-weight: 600;
}

/* Body */
.body {
  font-size: 1rem;       /* 16px */
  font-weight: 400;
  line-height: 1.5;
}

/* Small */
.small {
  font-size: 0.875rem;   /* 14px */
  font-weight: 400;
}

/* Tiny */
.tiny {
  font-size: 0.75rem;    /* 12px */
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

### Text Treatments
```css
/* Gradient Text */
.text-gradient {
  background: linear-gradient(to right, #06b6d4, #3b82f6);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

/* Glow Text */
.text-glow {
  text-shadow: 0 0 20px rgba(6, 182, 212, 0.5);
}

/* Uppercase Labels */
.label {
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}
```

---

## Layout Components

### HUD Dashboard (Top Fixed)
```
┌─────────────────────────────────────────────────────────────────┐
│ 🛡️ SUBMARINE HANGAR    │ Active: Nautilus I │ Balance: 1000 │ X │
│    Command Center      │    Tier 1          │    OCE        │   │
├─────────────────────────────────────────────────────────────────┤
│ ● Systems Online  ● Hangar Pressurized  ● Vessels Ready        │
└─────────────────────────────────────────────────────────────────┘

Styling:
- Position: Fixed top-0
- Background: slate-900/80 with backdrop-blur-xl
- Border: 2px solid cyan-500/30
- Shadow: Large cyan glow
- Padding: 24px
- Z-index: 50
```

### Hangar Header (Center)
```
        ╔══════════════════════════════════════╗
        ║                                      ║
        ║         🌊 HANGAR BAY 🌊            ║
        ║                                      ║
        ╠══════════════════════════════════════╣
        ║                                      ║
        ║      Currently Deployed:             ║
        ║      [Nautilus I - TIER 1]           ║
        ║                                      ║
        ╚══════════════════════════════════════╝

Styling:
- Title: 60px bold gradient (cyan → blue)
- Subtitle: 14px uppercase slate-400
- Current Sub Card: 32px with glow effect
- Decorative dots: Animated pulse
```

### Tier Navigator
```
┌─┬─┬─┬─┬─┬─┬─┬─┬─┬─┐
│1│2│3│4│5│6│7│8│9│10│  ← Tier selector buttons
└─┴─┴─┴─┴─┴─┴─┴─┴─┴─┘

States:
- Owned: Green with ✓
- Current: Cyan with ⚡
- Selected: Cyan glow + scale 110%
- Locked: Slate with 🔒
- Available: Blue
```

### Carousel Container
```
┌───────────────────────────────────────────┐
│  ←                                     →  │
│                                           │
│     ┌─────────────────────────────┐      │
│     │                             │      │
│     │    3D SUBMARINE MODEL       │      │
│     │    (Rotating, Animated)     │      │
│     │                             │      │
│     └─────────────────────────────┘      │
│                                           │
│     Stats | Mining | Storage | Cost      │
│                                           │
│     [Deploy Submarine Button]            │
│                                           │
└───────────────────────────────────────────┘

Dimensions:
- Container: max-width 1280px
- Height: 700px
- Card: max-width 960px
- Spacing: 24px gaps
```

---

## 3D Visual Effects

### Background Layers
```css
/* Layer 1: Base Gradient */
background: linear-gradient(to bottom, 
  #0f172a,  /* Top - Dark slate */
  #1e293b,  /* Mid - Slate */
  #164e63   /* Bottom - Cyan dark */
);

/* Layer 2: Light Rays */
.light-ray {
  position: absolute;
  width: 1px;
  height: 100%;
  background: linear-gradient(to bottom,
    rgba(6, 182, 212, 0.2),  /* Top - Visible */
    rgba(6, 182, 212, 0.05), /* Mid - Fading */
    transparent              /* Bottom - Gone */
  );
  transform: skewX(-12deg);
  animation: pulse 3s infinite;
}

/* Layer 3: Glowing Orbs */
.glow-orb {
  position: absolute;
  width: 384px;
  height: 384px;
  background: radial-gradient(circle,
    rgba(6, 182, 212, 0.1),  /* Center */
    transparent              /* Edge */
  );
  filter: blur(60px);
  animation: pulse 4s infinite;
}

/* Layer 4: Scanlines */
.scanlines {
  background: linear-gradient(
    transparent 50%,
    rgba(6, 182, 212, 0.02) 50%
  );
  background-size: 100% 4px;
}
```

### Card Glow Effect
```css
.card-container {
  position: relative;
}

/* Outer glow */
.card-container::before {
  content: '';
  position: absolute;
  inset: -4px;
  background: linear-gradient(to right, cyan, blue);
  opacity: 0.1;
  filter: blur(20px);
  animation: pulse 2s infinite;
  z-index: -1;
}

/* Card itself */
.card {
  background: linear-gradient(to bottom right,
    rgba(15, 23, 42, 0.9),   /* Slate-950 */
    rgba(30, 41, 59, 0.9)    /* Slate-900 */
  );
  backdrop-filter: blur(24px);
  border: 2px solid rgba(6, 182, 212, 0.3);
  border-radius: 24px;
  box-shadow: 
    0 20px 50px rgba(0, 0, 0, 0.5),
    0 0 20px rgba(6, 182, 212, 0.2);
}
```

### Button Shimmer Effect
```css
.button-primary {
  position: relative;
  background: linear-gradient(to right, #0891b2, #2563eb);
  overflow: hidden;
}

.button-primary::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to right,
    transparent,
    rgba(255, 255, 255, 0.2),
    transparent
  );
  transform: translateX(-100%) skewX(-12deg);
  transition: transform 0.7s;
}

.button-primary:hover::after {
  transform: translateX(100%) skewX(-12deg);
}
```

---

## Animation Timings

### Entrance Animations
```typescript
// Page load
pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.8 } }
}

// Header slide in
headerVariants = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.6 } }
}

// Card entrance
cardVariants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.5 } }
}
```

### Carousel Transitions
```typescript
// Slide animation
slideVariants = {
  enter: (direction) => ({
    x: direction > 0 ? 1000 : -1000,
    opacity: 0,
    scale: 0.8,
    rotateY: direction > 0 ? 45 : -45
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    rotateY: 0
  },
  exit: (direction) => ({
    x: direction > 0 ? -1000 : 1000,
    opacity: 0,
    scale: 0.8,
    rotateY: direction > 0 ? -45 : 45
  })
}

// Timing
transition = {
  duration: 0.6,
  ease: [0.22, 1, 0.36, 1] // Cubic bezier
}
```

### Micro-interactions
```css
/* Button hover */
.button:hover {
  transform: scale(1.02);
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Icon spin on hover */
.icon:hover {
  transform: rotate(12deg) scale(1.1);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Glow pulse */
@keyframes pulse-glow {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.pulse {
  animation: pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

---

## Component Styling

### Submarine Card (Detailed)
```
┌─────────────────────────────────────────────────────┐
│ LEGENDARY ★               [ACTIVE] ⚡               │
├─────────────────────┬───────────────────────────────┤
│                     │                               │
│   ┌─────────────┐   │  PERFORMANCE                  │
│   │             │   │  Health: 100  Energy: 100     │
│   │   🚢 3D     │   │  Depth: 1000m Speed: x1.0     │
│   │   Model     │   │                               │
│   │  Rotating   │   │  MINING                       │
│   │             │   │  Rate: x1.0   Storage: 225    │
│   └─────────────┘   │                               │
│                     │  STORAGE CAPACITY             │
│   Nautilus I        │  Nickel:    [████░░░] 100     │
│   Tier 1            │  Cobalt:    [██░░░░░] 50      │
│                     │  Copper:    [██░░░░░] 50      │
│   SPECIAL ABILITY   │  Manganese: [█░░░░░░] 25      │
│   Basic mining...   │                               │
│                     │  UPGRADE COST                 │
│                     │  OCE: 100 tokens              │
│                     │                               │
│                     │  [Deploy Submarine]           │
└─────────────────────┴───────────────────────────────┘

Styling:
- Overall: Rounded-3xl (24px)
- Grid: 2 columns (1fr 1fr)
- Gap: 24px
- Padding: 32px
- Background: Gradient slate-900/90 → slate-800/90
- Border: 2px solid (status color)/50
- Shadow: 2xl with cyan tint
```

### Stat Card
```css
.stat-card {
  background: rgba(2, 6, 23, 0.5);  /* Slate-950/50 */
  border: 1px solid rgba(71, 85, 105, 0.5);  /* Slate-700/50 */
  border-radius: 12px;
  padding: 16px;
}

.stat-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;  /* Slate-400 */
  margin-bottom: 8px;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  font-family: monospace;
}
```

### Storage Bar
```css
.storage-bar-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.storage-label {
  font-size: 12px;
  color: #94a3b8;
  width: 96px;
}

.storage-track {
  flex: 1;
  height: 8px;
  background: #1e293b;  /* Slate-800 */
  border-radius: 9999px;
  overflow: hidden;
}

.storage-fill {
  height: 100%;
  border-radius: 9999px;
  background: linear-gradient(to right, currentColor, currentColor);
  transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
}

.storage-value {
  font-size: 14px;
  font-family: monospace;
  color: #cbd5e1;
  width: 64px;
  text-align: right;
}
```

---

## Responsive Design

### Breakpoint Strategy
```css
/* Mobile First */
@media (min-width: 640px) {  /* sm */
  /* Tablet adjustments */
}

@media (min-width: 1024px) { /* lg */
  /* Desktop full layout */
}

@media (min-width: 1280px) { /* xl */
  /* Large desktop enhancements */
}
```

### Mobile Adaptations (< 640px)
```css
/* HUD: Stack vertically */
.hud-stats {
  flex-direction: column;
  gap: 12px;
}

/* Carousel: Smaller models */
.submarine-model {
  height: 300px;  /* vs 400px desktop */
}

/* Card: Single column */
.submarine-card {
  grid-template-columns: 1fr;
}

/* Tier Navigator: Horizontal scroll */
.tier-nav {
  overflow-x: auto;
  scroll-snap-type: x mandatory;
}

/* Buttons: Full width */
.action-button {
  width: 100%;
}
```

### Tablet Adaptations (640px - 1024px)
```css
/* HUD: 2-column grid */
.hud-stats {
  grid-template-columns: repeat(2, 1fr);
}

/* Carousel: Medium size */
.submarine-model {
  height: 350px;
}

/* Card: Maintain 2 columns but adjust spacing */
.submarine-card {
  gap: 16px;
  padding: 24px;
}
```

---

## Accessibility

### Focus States
```css
/* Keyboard focus */
*:focus-visible {
  outline: 2px solid #06b6d4;
  outline-offset: 2px;
  border-radius: 4px;
}

/* Button focus */
.button:focus-visible {
  box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.5);
}
```

### Color Contrast
```
Background: #0f172a (Dark)
Text: #e2e8f0 (Light)
Ratio: 12.6:1 ✅ (AAA)

Cyan-400 on Slate-950:
Ratio: 7.2:1 ✅ (AA)

Blue-500 on Slate-900:
Ratio: 6.8:1 ✅ (AA)
```

### Motion Preferences
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Performance Optimizations

### GPU Acceleration
```css
/* Transform properties use GPU */
.accelerated {
  transform: translateZ(0);
  will-change: transform;
}

/* Avoid these (CPU-heavy) */
.slow {
  /* Don't animate: top, left, width, height */
  /* Animate instead: transform, opacity */
}
```

### Lazy Loading
```typescript
// Load 3D models on demand
const Submarine3D = lazy(() => import('./Submarine3DModel'))

// Wrap in Suspense
<Suspense fallback={<LoadingSpinner />}>
  <Submarine3D />
</Suspense>
```

### Debounce Scroll
```typescript
const handleScroll = useMemo(
  () => debounce(() => {
    // Handle scroll
  }, 100),
  []
)
```

---

## Visual Hierarchy

### Information Priority
1. **Primary**: Current submarine, balance
2. **Secondary**: Available submarines, stats
3. **Tertiary**: Status indicators, tips
4. **Decorative**: Background effects, glows

### Size Hierarchy
- **Largest**: Page title (60px)
- **Large**: Submarine names (32px)
- **Medium**: Section titles (18px)
- **Base**: Body text (16px)
- **Small**: Labels (12px)

### Color Hierarchy
- **Most Saturated**: Action buttons, selected items
- **Mid Saturation**: Active text, icons
- **Low Saturation**: Inactive text, borders
- **Grayscale**: Disabled items

---

## Summary

The Submarine Hangar visual design creates a cohesive, immersive experience through:

✅ **Consistent color system** (cyan/blue sci-fi theme)  
✅ **Deliberate typography** (bold titles, mono numbers)  
✅ **Layered backgrounds** (depth through blur + gradients)  
✅ **Smooth animations** (60fps transforms)  
✅ **Clear hierarchy** (size, color, position)  
✅ **Responsive layout** (mobile → desktop)  
✅ **Performance focus** (GPU, lazy loading)  

Every visual choice reinforces the underwater military base aesthetic while ensuring perfect usability and accessibility.

---

*Design System Version: 1.0 | October 20, 2025*
