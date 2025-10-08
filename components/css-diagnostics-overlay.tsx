"use client"

import { useEffect, useState } from "react"

type StylesheetSummary = {
  index: number
  href: string
}

type DiagnosticsSnapshot = {
  timestamp: number
  pathname: string
  stylesheetCount: number
  stylesheets: StylesheetSummary[]
  bodyClasses: string[]
  background: string
  fontFamily: string
  hasTailwindVars: boolean
  hasGlobalVars: boolean
}

declare global {
  interface Window {
    __CSS_DIAGNOSTICS__?: DiagnosticsSnapshot
  }
}

const overlayStyles: React.CSSProperties = {
  position: "fixed",
  bottom: "1rem",
  right: "1rem",
  zIndex: 9999,
  padding: "0.75rem 1rem",
  borderRadius: "0.5rem",
  background: "rgba(0, 0, 0, 0.85)",
  color: "#e0f2fe",
  fontFamily: "monospace",
  fontSize: "0.75rem",
  lineHeight: 1.4,
  maxWidth: "22rem",
  pointerEvents: "none",
  border: "1px solid rgba(56, 189, 248, 0.4)",
  boxShadow: "0 8px 24px rgba(8, 47, 73, 0.35)",
}

function captureSnapshot(): DiagnosticsSnapshot {
  const body = document.body
  const computedStyle = window.getComputedStyle(body)

  const stylesheets: StylesheetSummary[] = Array.from(document.styleSheets).map((sheet, index) => {
    try {
      return {
        index,
        href: sheet.href ?? "inline",
      }
    } catch (error) {
      return {
        index,
        href: "<inaccessible>",
      }
    }
  })

  const snapshot: DiagnosticsSnapshot = {
    timestamp: Date.now(),
    pathname: window.location.pathname,
    stylesheetCount: document.styleSheets.length,
    stylesheets,
    bodyClasses: Array.from(body.classList),
    background: computedStyle.backgroundColor,
    fontFamily: computedStyle.fontFamily,
    hasTailwindVars: computedStyle.getPropertyValue("--tw-ring-inset") !== "",
    hasGlobalVars: computedStyle.getPropertyValue("--background") !== "",
  }

  window.__CSS_DIAGNOSTICS__ = snapshot
  return snapshot
}

function formatTimestamp(timestamp: number) {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

export function CSSDiagnosticsOverlay() {
  const [snapshot, setSnapshot] = useState<DiagnosticsSnapshot | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    if (process.env.NODE_ENV === "production") {
      return
    }

    const params = new URLSearchParams(window.location.search)
    const shouldShow = params.has("cssDebug") || process.env.NEXT_PUBLIC_CSS_DEBUG === "1"

    setVisible(shouldShow)
    if (!shouldShow) {
      return
    }

    const snapshot = captureSnapshot()
    setSnapshot(snapshot)

    const update = () => {
      setSnapshot(captureSnapshot())
    }

    const interval = window.setInterval(update, 1500)
    window.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        update()
      }
    })

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  if (!visible || !snapshot) {
    return null
  }

  return (
    <div style={overlayStyles}>
      <div style={{ fontWeight: 700, color: "#67e8f9", marginBottom: "0.35rem" }}>
        CSS Diagnostics @ {formatTimestamp(snapshot.timestamp)}
      </div>
      <div>Path: {snapshot.pathname}</div>
      <div>Stylesheets: {snapshot.stylesheetCount}</div>
      <div>Body Classes: {snapshot.bodyClasses.join(" ") || "<none>"}</div>
      <div>Background: {snapshot.background}</div>
      <div>Font: {snapshot.fontFamily}</div>
      <div>Tailwind vars: {snapshot.hasTailwindVars ? "yes" : "no"}</div>
      <div>Global vars: {snapshot.hasGlobalVars ? "yes" : "no"}</div>
      <div style={{ marginTop: "0.35rem", color: "#38bdf8" }}>Sheets:</div>
      <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
        {snapshot.stylesheets.map((sheet) => (
          <li key={sheet.index}>{sheet.href}</li>
        ))}
      </ul>
      <div style={{ marginTop: "0.35rem", color: "#94a3b8" }}>
        (Add <code>?cssDebug</code> to the URL to toggle)
      </div>
    </div>
  )
}
