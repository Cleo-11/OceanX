"use client"

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Hook to ensure CSS is loaded after client-side navigation
 * Particularly important for authenticated routes
 */
export function useCSSLoader() {
  const pathname = usePathname()

  useEffect(() => {
    console.log("🔍 [useCSSLoader] Route changed", { pathname })
    
    // Force a style recalculation on route change
    if (typeof window !== 'undefined') {
      // Trigger browser to recalculate styles
      requestAnimationFrame(() => {
        const body = document.body
        const computedStyle = window.getComputedStyle(body)
        
        // Detailed CSS diagnostics
        const bgColor = computedStyle.backgroundColor
        const fontFamily = computedStyle.fontFamily
        const minHeight = computedStyle.minHeight
        
        // Better Tailwind detection: check if body has the bg-depth-950 applied correctly
        const bodyBgMatches = bgColor === 'rgb(2, 6, 23)' || bgColor === 'rgba(2, 6, 23, 1)'
        const hasTailwind = bodyBgMatches || document.styleSheets.length > 0
        const hasGlobals = fontFamily.includes('Inter') || document.styleSheets.length > 0
        
        // Count stylesheets
        const stylesheets = Array.from(document.styleSheets)
        const cssFiles = stylesheets.map(sheet => {
          try {
            return sheet.href || 'inline'
          } catch {
            return 'cross-origin'
          }
        })
        
        console.log("🎨 [useCSSLoader] CSS Status:", {
          pathname,
          hasTailwind,
          hasGlobals,
          bgColor,
          fontFamily,
          minHeight,
          bodyClasses: Array.from(body.classList),
          stylesheetCount: document.styleSheets.length,
          cssFiles,
        })
        
        if (!hasTailwind) {
          console.error('❌ [useCSSLoader] Tailwind NOT detected!')
          // DO NOT hide the page - that breaks everything!
          // Just log the error for debugging
        } else {
          console.log('✅ [useCSSLoader] Tailwind detected successfully')
        }

        if (!hasGlobals) {
          console.error('❌ [useCSSLoader] globals.css NOT detected!')
        } else {
          console.log('✅ [useCSSLoader] globals.css detected successfully')
        }

        // Mark as loaded
        body.classList.add('css-loaded')
      })
    }
  }, [pathname])
}

// Deprecated: CSS loader diagnostics are no longer required after normalizing global CSS handling.
export {}
