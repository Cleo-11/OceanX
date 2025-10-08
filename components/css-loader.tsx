"use client"

import { useEffect } from 'react'
// Force CSS import - this makes Next.js inject the CSS into the page
import '@/app/globals.css'

/**
 * CSS Loader component that explicitly imports global CSS
 * This forces Next.js to inject the CSS into the page
 * 
 * TEMPORARY FIX: We manually built Tailwind CSS and are checking it loads
 */
export function CSSLoader() {
  useEffect(() => {
    console.log('💉 [CSSLoader] Global CSS imported and mounted')
    console.log('💉 [CSSLoader] Stylesheet count after mount:', document.styleSheets.length)
    
    // Check if Tailwind CSS variables are present
    const testElement = document.createElement('div')
    testElement.className = 'bg-depth-950 text-cyan-400'
    document.body.appendChild(testElement)
    const styles = window.getComputedStyle(testElement)
    console.log('🧪 [CSSLoader] Testing Tailwind:')
    console.log('  - bg-depth-950:', styles.backgroundColor)
    console.log('  - text-cyan-400:', styles.color)
    document.body.removeChild(testElement)
    
    // Try to manually inject the working Tailwind CSS (fallback)
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/tailwind-test.css'
    document.head.appendChild(link)
    console.log('💉 [CSSLoader] Manually injected /tailwind-test.css')

    // Second pass after microtask + a short delay
    setTimeout(() => {
      const body = document.body
      const cs = window.getComputedStyle(body)
      const hasTailwindVars = cs.getPropertyValue('--tw-ring-inset') !== ''
      const hasGlobalsVars = cs.getPropertyValue('--background') !== ''
      console.log('🧪 [CSSLoader] Post-injection check', { hasTailwindVars, hasGlobalsVars })
      if (!hasTailwindVars || !hasGlobalsVars) {
        console.warn('🚨 [CSSLoader] Tailwind/globals still missing – injecting emergency inline CSS')
        const style = document.createElement('style')
        style.id = 'emergency-inline-css'
        style.textContent = `body{background:#021627;color:#e6f6ff;font-family:Inter,system-ui,sans-serif;}
        .min-h-screen{min-height:100vh}
        .font-sans{font-family:Inter,system-ui,sans-serif}
        .antialiased{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}`
        document.head.appendChild(style)
        console.log('✅ [CSSLoader] Emergency inline CSS applied')
      }
    }, 350)
  }, [])
  
  return null
}
