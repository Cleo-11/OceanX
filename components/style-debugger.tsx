"use client"

import { useEffect, useState } from "react"

/**
 * Debug component to verify CSS is loaded
 * Add this to any page to see style loading status
 * 
 * Usage: import { StyleDebugger } from "@/components/style-debugger"
 *        <StyleDebugger />
 */
export function StyleDebugger() {
  const [status, setStatus] = useState<{
    tailwindLoaded: boolean
    globalsLoaded: boolean
    computedBgColor: string
    bodyClasses: string[]
  }>({
    tailwindLoaded: false,
    globalsLoaded: false,
    computedBgColor: "",
    bodyClasses: [],
  })

  useEffect(() => {
    if (typeof window !== "undefined") {
      const body = document.body
      const computedStyle = window.getComputedStyle(body)

      // Check Tailwind
      const hasTailwind = computedStyle.getPropertyValue("--tw-ring-inset") !== ""

      // Check computed background
      const bgColor = computedStyle.backgroundColor

      // Check body classes
      const bodyClasses = Array.from(body.classList)

      // Check if globals.css custom vars are loaded
      const hasGlobals = computedStyle.getPropertyValue("--background") !== ""

      setStatus({
        tailwindLoaded: hasTailwind,
        globalsLoaded: hasGlobals,
        computedBgColor: bgColor,
        bodyClasses,
      })
    }
  }, [])

  // Only show in development
  if (process.env.NODE_ENV !== "development") {
    return null
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 bg-black/90 text-white p-4 rounded-lg border border-cyan-500 text-xs font-mono max-w-sm"
      style={{ backdropFilter: "blur(10px)" }}
    >
      <div className="font-bold mb-2 text-cyan-400">🎨 Style Debugger</div>
      <div className="space-y-1">
        <div>
          Tailwind: {status.tailwindLoaded ? "✅ Loaded" : "❌ Not Loaded"}
        </div>
        <div>
          Globals: {status.globalsLoaded ? "✅ Loaded" : "❌ Not Loaded"}
        </div>
        <div>Background: {status.computedBgColor || "none"}</div>
        <div>
          Body Classes: {status.bodyClasses.length > 0 ? status.bodyClasses.join(", ") : "none"}
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-cyan-700 text-[10px] text-cyan-300">
        Remove in production
      </div>
    </div>
  )
}
