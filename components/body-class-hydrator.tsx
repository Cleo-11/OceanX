"use client"

import { useLayoutEffect } from 'react'

interface BodyClassHydratorProps {
  className: string
  children: React.ReactNode
}

/**
 * Ensures body classes are applied after hydration (and re-applied
 * if something strips them). This helps when Tailwind utilities
 * rely on body-level classes for base theming.
 */
export function BodyClassHydrator({ className, children }: BodyClassHydratorProps) {
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return

    const body = document.body
    const desired = className.split(/\s+/).filter(Boolean)

    // CRITICAL: Set inline styles immediately (highest priority)
    body.style.minHeight = '100vh'
    body.style.backgroundColor = '#020617'
    body.style.color = '#e6f6ff'
    body.style.fontFamily = 'Inter, system-ui, sans-serif'
    body.style.margin = '0'
    body.style.padding = '0'

    // Add missing classes
    desired.forEach(c => { if (!body.classList.contains(c)) body.classList.add(c) })

    // Diagnostic
    const cs = window.getComputedStyle(body)
    console.log('🩺 [BodyClassHydrator] Applied body classes', {
      finalBodyClassList: Array.from(body.classList),
      bg: cs.backgroundColor,
      fontFamily: cs.fontFamily,
      stylesheetCount: document.styleSheets.length,
    })
  }, [className])

  return <>{children}</>
}
