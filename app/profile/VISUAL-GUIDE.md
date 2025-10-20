# 🎨 Profile Page Visual Guide

## Layout Overview

```
┌────────────────────────────────────────────────────────────────┐
│                     OceanX Profile Page                        │
│                                                                │
│  [← Back to Ocean]     🌊 Captain's Profile                   │
│                                                                │
│  ┌─────────────────────────────┐  ┌──────────────────┐       │
│  │  👤 Captain Information      │  │  💰 Token Economy │       │
│  │                              │  │                  │       │
│  │  Username: Captain Alex      │  │  OCX Balance:    │       │
│  │  Wallet: 0x1234...5678       │  │  1,250 OCX       │       │
│  │  Join Date: Jan 15, 2024     │  │                  │       │
│  └──────────────────────────────┘  │  Total Earned:   │       │
│                                     │  5,430 OCX       │       │
│  ┌──────────────────┐               └──────────────────┘       │
│  │ ⚓ Submarine Fleet│  ┌──────────────────┐                   │
│  │                  │  │ 📦 Resource Stats │                   │
│  │  Model: Neptune  │  │                  │                   │
│  │  Tier: 3         │  │  Mined: 15,234   │                   │
│  │  Next: 500 OCX   │  │  Fuel: ████░░ 80%│                   │
│  └──────────────────┘  └──────────────────┘                   │
│                                                                │
│  ┌──────────────────┐                                          │
│  │ 🏆 Achievements   │                                          │
│  │                  │                                          │
│  │  Badges: 15      │                                          │
│  │  Next Goal:      │                                          │
│  │  ████████░░ 85%  │                                          │
│  └──────────────────┘                                          │
│                                                                │
│                [🚪 Disconnect Wallet]                          │
└────────────────────────────────────────────────────────────────┘
```

## Card Color Scheme

### 🔵 Player Info Card (Cyan)
- Border: `border-cyan-500/20`
- Shadow: `shadow-cyan-500/10`
- Text: `text-cyan-300`
- Accent: Cyan/Blue gradient

### 💛 Token Economy Card (Yellow)
- Border: `border-yellow-500/20`
- Shadow: `shadow-yellow-500/10`
- Text: `text-yellow-400`
- Accent: Golden highlights

### 💜 Submarine Fleet Card (Purple)
- Border: `border-purple-500/20`
- Shadow: `shadow-purple-500/10`
- Text: `text-purple-400`
- Accent: Purple badges

### 💚 Resource Stats Card (Green)
- Border: `border-green-500/20`
- Shadow: `shadow-green-500/10`
- Text: `text-green-400`
- Accent: Green progress bars

### 🧡 Achievements Card (Orange)
- Border: `border-orange-500/20`
- Shadow: `shadow-orange-500/10`
- Text: `text-orange-400`
- Accent: Trophy icons

## Responsive Breakpoints

### 📱 Mobile (< 768px)
```
┌──────────────┐
│   Card 1     │
├──────────────┤
│   Card 2     │
├──────────────┤
│   Card 3     │
├──────────────┤
│   Card 4     │
├──────────────┤
│   Card 5     │
└──────────────┘
```

### 📱 Tablet (768px - 1024px)
```
┌──────────────┬──────────────┐
│   Card 1     │   Card 2     │
│  (spans 2)   │              │
├──────────────┼──────────────┤
│   Card 3     │   Card 4     │
├──────────────┼──────────────┤
│   Card 5     │              │
└──────────────┴──────────────┘
```

### 💻 Desktop (> 1024px)
```
┌─────────────┬──────┬──────┐
│   Card 1    │ C2   │      │
│  (spans 2)  │      │      │
├──────┬──────┴──────┤      │
│  C3  │     C4      │      │
├──────┴─────────────┤      │
│       Card 5       │      │
└────────────────────┴──────┘
```

## Animation Timeline

```
Page Load
    ↓
0.0s: Header fades in from top
    ↓
0.1s: Player Info card fades in + slides up
    ↓
0.2s: Token Economy card fades in + slides up
    ↓
0.3s: Submarine Fleet card fades in + slides up
    ↓
0.4s: Resource Stats card fades in + slides up
    ↓
0.5s: Achievements card fades in + slides up
    ↓
0.5s: Disconnect button fades in
    ↓
Continuous: Background orbs pulse/float
```

## Interaction States

### Hover Effects
```
Card at rest:
  - opacity: 1.0
  - scale: 1.0
  - gradient overlay: hidden

Card on hover:
  - opacity: 1.0
  - scale: 1.02
  - gradient overlay: visible
  - transition: 300ms ease
```

### Button States
```
Normal:     bg-cyan-600, text-white
Hover:      bg-cyan-700, scale: 1.05
Active:     bg-cyan-800, scale: 0.98
Disabled:   bg-gray-600, opacity: 0.5
```

## Typography Hierarchy

```css
Page Title:
  - font-size: 1.875rem (30px)
  - font-weight: 700
  - gradient: cyan-400 → blue-400

Card Titles:
  - font-size: 1.125rem (18px)
  - font-weight: 600
  - themed colors

Large Numbers (OCX Balance):
  - font-size: 1.875rem (30px)
  - font-weight: 700
  - themed colors

Medium Numbers (Stats):
  - font-size: 1.25rem (20px)
  - font-weight: 700
  - ocean-50

Labels:
  - font-size: 0.875rem (14px)
  - font-weight: 400
  - ocean-300

Body Text:
  - font-size: 1rem (16px)
  - font-weight: 400
  - ocean-50
```

## Icon System

### Icon Sizes
- Card headers: `h-5 w-5` (20px)
- Inline labels: `h-3 w-3` (12px)
- Large decorative: `h-12 w-12` (48px)
- Button icons: `h-4 w-4` (16px)

### Icon Colors
Match the card theme:
- Player Info: cyan-400
- Token: yellow-400
- Submarine: purple-400
- Resources: green-400
- Achievements: orange-400

## Spacing System

```css
Card padding:
  - Header: p-6 (24px)
  - Content: p-6 (24px)

Grid gaps:
  - Card gap: 1.5rem (24px)

Internal spacing:
  - Section gap: 1rem (16px)
  - Item gap: 0.5rem (8px)

Page margins:
  - Container: px-4 (16px)
  - Top/bottom: py-8 (32px)
```

## Background Effects

### Animated Orbs
```
Orb 1 (Cyan):
  - Position: top-20, left-1/4
  - Size: 96 x 96
  - Animation: scale 1.0 → 1.2 → 1.0 (8s)
  - Opacity: 0.3 → 0.5 → 0.3
  - Blur: 3xl

Orb 2 (Blue):
  - Position: bottom-20, right-1/4
  - Size: 96 x 96
  - Animation: scale 1.2 → 1.0 → 1.2 (10s)
  - Opacity: 0.5 → 0.3 → 0.5
  - Blur: 3xl
```

### Grid Overlay
```
Pattern: /grid.svg
Opacity: 5%
Fixed position
Pointer-events: none
```

## Glassmorphism Effect

```css
Card background:
  - bg-depth-900/60 (60% opacity)
  - backdrop-blur-xl (24px blur)
  - border-[color]/20 (20% opacity)
  - shadow-lg with color glow

Result: Semi-transparent cards that blur
        content behind them, creating
        depth and layering
```

## Progress Bars

```
Container:
  - Height: 0.5rem (8px)
  - Border-radius: 9999px (full)
  - Background: depth-950/50

Fill:
  - Themed color (green, orange, etc.)
  - Transition: all 300ms
  - Animation: smooth width changes
```

## Modal (Disconnect Warning)

```
┌──────────────────────────────────┐
│  ⚠️  Warning: Data Deletion      │
├──────────────────────────────────┤
│                                  │
│  Disconnecting will delete:      │
│  • Submarine progress            │
│  • Mined resources               │
│  • Achievement badges            │
│  • Game history                  │
│                                  │
│  This cannot be undone.          │
│                                  │
│   [Cancel]  [Yes, Disconnect]    │
└──────────────────────────────────┘
```

## Component Hierarchy

```
ProfilePage (Server)
  └─ ProfileClient (Client)
      ├─ Background Effects
      │   ├─ Grid overlay
      │   └─ Animated orbs (2)
      │
      ├─ Header
      │   ├─ Back button
      │   ├─ Title
      │   └─ Spacer
      │
      ├─ Bento Grid
      │   ├─ Player Info Card
      │   │   └─ Username, wallet, date
      │   │
      │   ├─ Token Economy Card
      │   │   └─ Balance, earnings, mined
      │   │
      │   ├─ Submarine Fleet Card
      │   │   └─ Model, tier, upgrade cost
      │   │
      │   ├─ Resource Stats Card
      │   │   └─ Mined, fuel, missions
      │   │
      │   └─ Achievements Card
      │       └─ Badges, progress
      │
      ├─ Disconnect Button
      │
      └─ Alert Dialog (Modal)
          └─ Warning message + actions
```

## Color Palette Reference

```css
/* Background Depths */
--depth-950: #020617  /* Darkest */
--depth-900: #0f172a  /* Dark */
--depth-800: #1e293b  /* Medium dark */

/* Ocean Text Colors */
--ocean-50:  #e6f6ff  /* Lightest */
--ocean-300: #7dd3fc  /* Light */
--ocean-400: #38bdf8  /* Medium */

/* Accent Colors */
--cyan-400:   #22d3ee
--yellow-400: #facc15
--purple-400: #c084fc
--green-400:  #4ade80
--orange-400: #fb923c
--red-400:    #f87171
```

## Best Practices

1. **Always use themed colors** for consistency
2. **Maintain spacing rhythm** (4px, 8px, 16px, 24px)
3. **Keep animations subtle** (200-500ms)
4. **Use blur sparingly** (only for glassmorphism)
5. **Ensure contrast ratios** meet WCAG standards
6. **Test on all breakpoints** before deployment
7. **Optimize images** if adding custom graphics
8. **Use semantic HTML** for accessibility

---

**This visual guide helps maintain design consistency** when extending or modifying the profile page.
