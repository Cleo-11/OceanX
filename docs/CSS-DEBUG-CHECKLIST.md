# CSS Debug Testing Checklist

## Before Starting
- [ ] Terminal ready at project root
- [ ] Browser DevTools open (F12)
- [ ] Console tab visible

## Step-by-Step Test

### 1. Clean Build
```bash
cd /c/Users/cleon/Desktop/AbyssX/OceanX-master
rm -rf .next node_modules/.cache
pnpm dev
```
**Wait for:** "Ready in X ms" message

### 2. Open Landing Page
- [ ] Navigate to `http://localhost:3000`
- [ ] **Console Check:** Look for `🏗️ [RootLayout]` log
- [ ] **Console Check:** Look for `🎨 [RootProvider] Mounted`
- [ ] **Visual Check:** Page has ocean theme styling

**Expected Console Output:**
```
🏗️ [RootLayout] Rendering on server/client
🎬 [HTML Head] Script executing
🎬 [Body Start] Before React hydration
🎨 [RootProvider] Mounted { pathname: "/", bodyClasses: [...], stylesheetCount: 3+ }
🔍 [useCSSLoader] Route changed { pathname: "/" }
🎨 [useCSSLoader] CSS Status { hasTailwind: true, hasGlobals: true, bgColor: "rgb(...)" }
✅ [useCSSLoader] Tailwind detected successfully
✅ [useCSSLoader] globals.css detected successfully
```

### 3. Navigate to Auth
- [ ] Click "Sign In" button
- [ ] **Console Check:** Watch for route change logs
- [ ] **Console Check:** Verify `🔍 [useCSSLoader] Route changed { pathname: "/auth" }`
- [ ] **Visual Check:** Auth page has styling

### 4. Authenticate
- [ ] Sign in with Google or Email
- [ ] **Console Check:** Watch for redirect logs
- [ ] **Console Check:** Should see logs for `/connect-wallet` path

### 5. Connect Wallet Page - CRITICAL TEST
- [ ] Page loads after authentication
- [ ] **Console Check:** Look for `🔐 [ConnectWalletClient] Component mounted`
- [ ] **Console Check:** Look for `🎁 [StyleWrapper] Mounting`
- [ ] **Console Check:** Verify CSS Status shows `hasTailwind: true`
- [ ] **Visual Check:** Gradient background visible
- [ ] **Visual Check:** Card with border and backdrop blur
- [ ] **Visual Check:** "Connect MetaMask" button styled with gradient

**CRITICAL:** If styles are missing here, check console output:

**If you see:**
```
❌ [useCSSLoader] Tailwind NOT detected! Forcing reload...
🎨 [useCSSLoader] CSS Status {
  hasTailwind: false,
  bgColor: "rgb(255, 255, 255)",  ← This means NO STYLES!
  stylesheetCount: 0 or 1
}
```

**Then run debug script in console:**
```javascript
fetch('/debug-css.js').then(r => r.text()).then(eval)
```

### 6. Home Page
- [ ] Connect wallet and navigate to home
- [ ] **Console Check:** `🏠 [HomePageClient] Component mounted`
- [ ] **Console Check:** CSS Status shows Tailwind detected
- [ ] **Visual Check:** Stats cards styled
- [ ] **Visual Check:** Submarine icon visible
- [ ] **Visual Check:** Animated background particles

### 7. Game Page
- [ ] Click "Play Game"
- [ ] **Console Check:** `🎮 [GamePage] Component mounted`
- [ ] **Console Check:** CSS Status shows Tailwind detected
- [ ] **Visual Check:** Ocean background
- [ ] **Visual Check:** HUD elements styled
- [ ] **Visual Check:** Resource sidebar

## If Styles Are Missing

### Run Full Debug Script
In browser console:
```javascript
fetch('/debug-css.js').then(r => r.text()).then(eval)
```

### Check Output For:

**1. Stylesheet Count**
```
📋 Loaded Stylesheets:
  Total count: 0  ← BAD! Should be 3+
```

**2. CSS Variables**
```
🎨 CSS Custom Properties:
  --tw-ring-inset: ❌ NOT FOUND  ← BAD!
  --background: ❌ NOT FOUND  ← BAD!
```

**3. Computed Background**
```
🎨 Computed Body Styles:
  Background: rgb(255, 255, 255)  ← BAD! Should be dark
```

**4. Tailwind Test**
```
🧪 Tailwind Test:
  bg-blue-500 applied: ❌ NO  ← BAD!
```

## Report Issues

When reporting, include:

1. **Console logs** from the test (copy all logs with 🎨 🔍 emojis)
2. **Debug script output** (full report)
3. **Network tab screenshot** (filtered by CSS)
4. **Screenshot** of the unstyled page
5. **Browser info** (Chrome/Firefox version)

### Example Issue Report:

```
CSS not loading on /connect-wallet page

Console Output:
[paste console logs here]

Debug Script Output:
[paste full debug report here]

Network Tab:
[describe what CSS files loaded or didn't load]

Browser: Chrome 120.0.0
OS: Windows 11
```

## Quick Fixes to Try

1. **Hard Refresh:** Ctrl+Shift+R (Cmd+Shift+R on Mac)

2. **Clear Everything:**
```bash
rm -rf .next node_modules/.cache node_modules
pnpm install
pnpm dev
```

3. **Check for Build Errors:**
Look in terminal for any errors during `pnpm dev`

4. **Verify Files Exist:**
```bash
ls -la app/globals.css
ls -la tailwind.config.ts
ls -la postcss.config.mjs
```

5. **Check Node Version:**
```bash
node --version  # Should be 18+ or 20+
```

## Success Criteria

✅ All console logs show:
- `✅ [useCSSLoader] Tailwind detected successfully`
- `✅ [useCSSLoader] globals.css detected successfully`
- `bgColor: "rgb(3, 7, 18)"` or similar dark color
- `stylesheetCount: 3+`
- `hasTailwind: true`
- `hasGlobals: true`

✅ All pages visually styled:
- Dark ocean-themed backgrounds
- Styled buttons and cards
- Proper fonts and spacing
- Animated elements visible

✅ No errors in console

✅ Network tab shows CSS files with 200 status

---

**Last Updated:** October 2025
**Status:** Debug Mode Enabled
