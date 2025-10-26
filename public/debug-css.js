/**
 * CSS Debug Script - Run this in browser console
 * Copy and paste into DevTools console on any page with styling issues
 */

(function cssDebugger() {
  console.log("🔍 ===== CSS DEBUGGING REPORT =====");
  console.log("");

  // 1. Check HTML/Body structure
  console.log("📄 HTML Structure:");
  console.log("  HTML classes:", document.documentElement.className);
  console.log("  Body classes:", document.body.className);
  console.log("  Body classList array:", Array.from(document.body.classList));
  console.log("");

  // 2. Check computed styles
  const bodyStyle = window.getComputedStyle(document.body);
  console.log("🎨 Computed Body Styles:");
  console.log("  Background:", bodyStyle.backgroundColor);
  console.log("  Font family:", bodyStyle.fontFamily);
  console.log("  Min height:", bodyStyle.minHeight);
  console.log("  Color:", bodyStyle.color);
  console.log("  Display:", bodyStyle.display);
  console.log("");

  // 3. Check CSS custom properties
  console.log("🎨 CSS Custom Properties:");
  const twRing = bodyStyle.getPropertyValue("--tw-ring-inset");
  const background = bodyStyle.getPropertyValue("--background");
  const foreground = bodyStyle.getPropertyValue("--foreground");
  const primary = bodyStyle.getPropertyValue("--primary");

  console.log("  --tw-ring-inset:", twRing || "❌ NOT FOUND");
  console.log("  --background:", background || "❌ NOT FOUND");
  console.log("  --foreground:", foreground || "❌ NOT FOUND");
  console.log("  --primary:", primary || "❌ NOT FOUND");
  console.log("");

  // 4. Check stylesheets
  console.log("📋 Loaded Stylesheets:");
  const sheets = Array.from(document.styleSheets);
  console.log("  Total count:", sheets.length);
  
  sheets.forEach((sheet, index) => {
    try {
      const href = sheet.href || "inline/injected";
      const rules = sheet.cssRules ? sheet.cssRules.length : "inaccessible";
      console.log(`  [${index}] ${href} (${rules} rules)`);
    } catch (e) {
      console.log(`  [${index}] Cross-origin or blocked`);
    }
  });
  console.log("");

  // 5. Check for specific globals.css
  const hasGlobalsLink = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .some(link => link.href.includes('globals') || link.href.includes('app') || link.href.includes('main'));
  console.log("🔗 Globals CSS Link:", hasGlobalsLink ? "✅ FOUND" : "❌ NOT FOUND");
  console.log("");

  // 6. Check Next.js specific
  console.log("⚛️ Next.js Info:");
  console.log("  Pathname:", window.location.pathname);
  console.log("  Next data:", !!document.getElementById("__NEXT_DATA__") ? "✅ Found" : "❌ Not found");
  console.log("");

  // 7. Check if Tailwind classes work
  const testDiv = document.createElement("div");
  testDiv.className = "bg-blue-500 text-white p-4";
  document.body.appendChild(testDiv);
  const testStyle = window.getComputedStyle(testDiv);
  const tailwindWorks = testStyle.backgroundColor !== "rgba(0, 0, 0, 0)" && testStyle.backgroundColor !== "transparent";
  document.body.removeChild(testDiv);
  
  console.log("🧪 Tailwind Test:");
  console.log("  bg-blue-500 applied:", tailwindWorks ? "✅ YES" : "❌ NO");
  console.log("  Test bg color:", testStyle.backgroundColor);
  console.log("");

  // 8. Summary
  console.log("📊 DIAGNOSIS:");
  const hasTailwind = !!twRing;
  const hasGlobalVars = !!background;
  const hasCorrectBg = bodyStyle.backgroundColor !== "rgb(255, 255, 255)" && bodyStyle.backgroundColor !== "rgba(0, 0, 0, 0)";

  if (hasTailwind && hasGlobalVars && hasCorrectBg) {
    console.log("  ✅ ALL SYSTEMS OPERATIONAL - CSS is loaded correctly!");
  } else {
    console.log("  ⚠️ ISSUES DETECTED:");
    if (!hasTailwind) console.log("    ❌ Tailwind CSS not loaded");
    if (!hasGlobalVars) console.log("    ❌ globals.css custom properties not loaded");
    if (!hasCorrectBg) console.log("    ❌ Background color not applied (expected dark, got white/transparent)");
  }

  console.log("");
  console.log("💡 RECOMMENDATIONS:");
  
  if (!hasTailwind || !hasGlobalVars) {
    console.log("  1. Hard refresh: Ctrl+Shift+R (Cmd+Shift+R on Mac)");
    console.log("  2. Clear .next folder: rm -rf .next");
    console.log("  3. Restart dev server: pnpm dev");
    console.log("  4. Check Network tab for failed CSS requests");
  }

  if (sheets.length === 0) {
    console.log("  ⚠️ NO STYLESHEETS LOADED! This is critical.");
    console.log("  Check if build process completed successfully");
  }

  console.log("");
  console.log("===== END REPORT =====");
})();
