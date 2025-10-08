"use client"

import { ReactNode, useEffect } from "react"

import { CSSLoader } from "@/components/css-loader"
import { CSSDiagnosticsOverlay } from "@/components/css-diagnostics-overlay"
import { useCSSLoader } from "@/hooks/use-css-loader"
import { RootProvider } from "./root-provider"

interface CSSRootProviderProps {
  children: ReactNode
}

/**
 * Ensures global/Tailwind CSS is injected and verified on every page.
 * Combines the legacy RootProvider with proactive CSS checks.
 */
export function CSSRootProvider({ children }: CSSRootProviderProps) {
  useCSSLoader()

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const body = document.body
    const computedStyle = window.getComputedStyle(body)
    const stylesheetSummaries = Array.from(document.styleSheets).map((sheet, index) => {
      try {
        return sheet.href ? `${index}: ${sheet.href}` : `${index}: inline`
      } catch (error) {
        return `${index}: <inaccessible>`
      }
    })

    console.log("🎯 [CSSRootProvider] CSS diagnostics", {
      pathname: window.location.pathname,
      stylesheetCount: document.styleSheets.length,
      stylesheets: stylesheetSummaries,
      bodyClasses: Array.from(body.classList),
      background: computedStyle.backgroundColor,
      fontFamily: computedStyle.fontFamily,
    })
  }, [])

  return (
    <>
        <CSSDiagnosticsOverlay />
      <CSSLoader />
      <RootProvider>{children}</RootProvider>
    </>
  )
}
