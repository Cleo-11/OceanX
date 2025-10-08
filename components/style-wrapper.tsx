"use client"

import { ReactNode, useEffect } from "react"

interface StyleWrapperProps {
  children: ReactNode
  className?: string
}

/**
 * Wrapper component that ensures styles are properly applied
 * Used for authenticated pages to prevent CSS loss after hydration
 */
export function StyleWrapper({ children, className = "" }: StyleWrapperProps) {
  useEffect(() => {
    console.log("🎁 [StyleWrapper] Mounting", {
      className,
      pathname: window.location.pathname,
    })
    
    // Trigger a repaint to ensure styles are loaded
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        const body = document.body
        const computedStyle = window.getComputedStyle(body)
        
        const stylesheetSummaries = Array.from(document.styleSheets).map((sheet, index) => {
          try {
            return sheet.href ? `${index}: ${sheet.href}` : `${index}: inline`
          } catch (error) {
            return `${index}: <inaccessible>`
          }
        })

        console.log("🎁 [StyleWrapper] Post-mount check", {
          bgColor: computedStyle.backgroundColor,
          fontFamily: computedStyle.fontFamily,
          hasTailwindVars: computedStyle.getPropertyValue("--tw-ring-inset") !== "",
          hasGlobalVars: computedStyle.getPropertyValue("--background") !== "",
          bodyClasses: Array.from(body.classList),
          stylesheetCount: document.styleSheets.length,
          stylesheets: stylesheetSummaries,
        })
        
        body.classList.add('styles-loaded')
      })
    }
  }, [className])

  return <div className={className}>{children}</div>
}
