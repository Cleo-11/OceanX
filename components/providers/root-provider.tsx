"use client"

import { ReactNode, useEffect } from "react"
import { CSSLoader } from "@/components/css-loader"
import { useCSSLoader } from "@/hooks/use-css-loader"

interface RootProviderProps {
  children: ReactNode
}

/**
 * Root provider component that ensures proper style inheritance
 * and hydration for all client components
 */
export function RootProvider({ children }: RootProviderProps) {
  // Ensure CSS is loaded on route changes
  
  useCSSLoader()
  
  useEffect(() => {
    console.log("🎨 [RootProvider] Mounted", {
      pathname: window.location.pathname,
      bodyClasses: Array.from(document.body.classList),
      hasGlobalsCss: !!document.querySelector('link[href*="globals"]') || !!document.querySelector('link[href*="layout"]'),
      stylesheetCount: document.styleSheets.length,
    })
  }, [])
  
  return (
    <>
      <CSSLoader />
      {children}
    </>
  )
}
