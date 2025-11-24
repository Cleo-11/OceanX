#!/bin/bash

# Fix CSS Not Loading - Complete Reset Script

echo "🔧 Fixing CSS loading issue..."

# Step 1: Stop any running dev servers
echo "Step 1: Stopping dev servers..."
pkill -f "next dev" 2>/dev/null || true

# Step 2: Remove Next.js cache and build artifacts
echo "Step 2: Clearing Next.js cache..."
rm -rf .next
rm -rf node_modules/.cache

# Step 3: Clear pnpm cache (optional but helps)
echo "Step 3: Clearing pnpm cache..."
pnpm store prune || true

# Step 4: Reinstall dependencies to ensure Tailwind is properly set up
echo "Step 4: Reinstalling dependencies..."
pnpm install

# Step 5: Build Tailwind CSS explicitly
echo "Step 5: Building Tailwind CSS..."
pnpm exec tailwindcss -i ./app/globals.css -o ./app/output.css --minify

# Step 6: Start fresh dev server
echo "Step 6: Starting fresh dev server..."
echo ""
echo "✅ Cache cleared! Now run: pnpm dev"
echo ""
echo "If CSS still doesn't load, check:"
echo "  1. Browser hard refresh (Ctrl+Shift+R / Cmd+Shift+R)"
echo "  2. Clear browser cache"
echo "  3. Check browser console for errors"
