#!/bin/bash

# Development CSS Testing Script
# This script helps verify CSS is loading correctly

echo "🔍 CSS Loading Diagnostic Script"
echo "=================================="
echo ""

# Check if .next directory exists
if [ -d ".next" ]; then
    echo "✅ .next directory exists"
else
    echo "❌ .next directory missing - run 'pnpm dev' or 'pnpm build' first"
    exit 1
fi

# Check if globals.css exists
if [ -f "app/globals.css" ]; then
    echo "✅ globals.css found"
    lines=$(wc -l < app/globals.css)
    echo "   → $lines lines in globals.css"
else
    echo "❌ globals.css missing!"
    exit 1
fi

# Check Tailwind config
if [ -f "tailwind.config.ts" ]; then
    echo "✅ tailwind.config.ts found"
else
    echo "❌ tailwind.config.ts missing!"
    exit 1
fi

# Check PostCSS config
if [ -f "postcss.config.mjs" ]; then
    echo "✅ postcss.config.mjs found"
else
    echo "❌ postcss.config.mjs missing!"
    exit 1
fi

echo ""
echo "📦 Checking node_modules..."

# Check if Tailwind is installed
if [ -d "node_modules/tailwindcss" ]; then
    echo "✅ tailwindcss installed"
else
    echo "❌ tailwindcss not installed - run 'pnpm install'"
    exit 1
fi

echo ""
echo "🎨 CSS Configuration Status: HEALTHY"
echo ""
echo "Next steps:"
echo "1. Clear build cache: rm -rf .next"
echo "2. Restart dev server: pnpm dev"
echo "3. Test authenticated routes:"
echo "   - /connect-wallet"
echo "   - /home"
echo "   - /game"
echo ""
echo "If styles still don't load:"
echo "• Check browser console for errors"
echo "• Verify Network tab shows _app-*.css loading"
echo "• Hard refresh with Ctrl+Shift+R (Cmd+Shift+R on Mac)"
