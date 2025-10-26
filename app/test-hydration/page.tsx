"use client"

import { useEffect, useState } from "react"

export default function TestHydration() {
  const [clientRendered, setClientRendered] = useState(false)

  useEffect(() => {
    console.log("✅ CLIENT COMPONENT MOUNTED!")
    console.log("React found:", typeof window.React !== "undefined")
    setClientRendered(true)
  }, [])

  return (
    <div style={{ padding: "2rem", fontFamily: "monospace" }}>
      <h1 style={{ color: clientRendered ? "green" : "red" }}>
        {clientRendered ? "✅ CLIENT HYDRATED" : "❌ SERVER ONLY"}
      </h1>
      <p>Body classes: {typeof document !== "undefined" ? document.body.className : "N/A"}</p>
      <p>Stylesheets: {typeof document !== "undefined" ? document.styleSheets.length : "N/A"}</p>
      <p>React: {typeof window !== "undefined" && window.React ? "FOUND" : "MISSING"}</p>
    </div>
  )
}
