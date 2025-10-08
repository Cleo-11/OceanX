"use client"

import { useLayoutEffect } from 'react'

const REQUIRED_CLASSES = [
  'min-h-screen',
  'bg-depth-950',
  'font-sans',
  'antialiased'
]

export function BodyClassForce() {
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return
    const body = document.body
    
    // CRITICAL: Set inline styles first (cannot be overridden by Tailwind)
    body.style.minHeight = '100vh'
    body.style.backgroundColor = '#020617'
    body.style.color = '#e6f6ff'
    body.style.fontFamily = 'Inter, system-ui, sans-serif'
    
    REQUIRED_CLASSES.forEach(c => body.classList.add(c))

    const cs = getComputedStyle(body)
    console.log('🛠️ [BodyClassForce] Applied classes + inline styles', {
      bodyClasses: Array.from(body.classList),
      bg: cs.backgroundColor,
      font: cs.fontFamily,
      stylesheetCount: document.styleSheets.length,
    })

    // Observe in case something clears classes later
    const observer = new MutationObserver(() => {
      let repaired = false
      REQUIRED_CLASSES.forEach(c => {
        if (!body.classList.contains(c)) { body.classList.add(c); repaired = true }
      })
      // Also re-apply inline styles if they're removed
      if (!body.style.backgroundColor || body.style.backgroundColor === 'transparent') {
        body.style.backgroundColor = '#020617'
        repaired = true
      }
      if (repaired) {
        console.log('♻️ [BodyClassForce] Repaired missing body classes/styles')
      }
    })
    observer.observe(body, { attributes: true, attributeFilter: ['class', 'style'] })
    return () => observer.disconnect()
  }, [])

  return null
}