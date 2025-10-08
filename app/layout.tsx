import type { Metadata } from 'next'
import { CSSRootProvider } from '@/components/providers/css-root-provider'
import './globals.css'
// Force CSS to be included in every page chunk
import '@/styles/blockchain-effects.css'
import '@/styles/submarine-selection.css'
import { BodyClassHydrator } from '@/components/body-class-hydrator'
import { BodyClassForce } from '@/components/body-class-force'

export const metadata: Metadata = {
  title: 'AbyssX - Deep Sea Mining Adventure',
  description: 'Dive into the depths and mine valuable resources in this blockchain-powered underwater mining game',
  generator: 'Next.js',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Server-side log
  console.log('🏗️ [RootLayout] Rendering on server/client')
  
  return (
  <html lang="en" className="antialiased" style={{ background: '#020617', minHeight: '100vh' }}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preload" href="/fonts" as="font" crossOrigin="anonymous" />
  {/* Preconnect to Google Fonts for faster font loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
  {/* Load fonts via link (preferred over @import in CSS) */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
        
        {/* EMERGENCY: Inline critical CSS that MUST load */}
        <style dangerouslySetInnerHTML={{
          __html: `
            /* Critical CSS - Applied immediately, cannot be blocked */
            html {
              background: #020617 !important;
              min-height: 100vh !important;
            }
            body {
              min-height: 100vh !important;
              background-color: #020617 !important;
              background: #020617 !important;
              color: #e6f6ff !important;
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif !important;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
              margin: 0 !important;
              padding: 0 !important;
            }
            * {
              box-sizing: border-box;
            }
            #__next {
              min-height: 100vh;
              background: #020617;
            }
          `
        }} />
        
        <script
          dangerouslySetInnerHTML={{
            __html: `
              console.log('🎬 [HTML Head] Script executing');
              console.log('📍 Current path:', window.location.pathname);
              console.log('📄 Checking stylesheets...');
              setTimeout(() => {
                console.log('📋 Stylesheets loaded:', document.styleSheets.length);
                Array.from(document.styleSheets).forEach((sheet, i) => {
                  try {
                    console.log('  Sheet ' + i + ':', sheet.href || 'inline');
                  } catch(e) {
                    console.log('  Sheet ' + i + ': blocked');
                  }
                });
              }, 100);
            `,
          }}
        />
      </head>
      <body 
        className="min-h-screen bg-depth-950 font-sans antialiased"
        style={{ 
          minHeight: '100vh',
          backgroundColor: '#020617',
          color: '#e6f6ff',
          fontFamily: 'Inter, system-ui, sans-serif',
          margin: 0,
          padding: 0
        }}
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `
              console.log('🎬 [Body Start] Before React hydration');
              console.log('  Body classes:', document.body.className);
              console.log('  Initial stylesheet count:', document.styleSheets.length);
              
              // EMERGENCY: Force body classes immediately
              (function() {
                const requiredClasses = ['min-h-screen', 'bg-depth-950', 'font-sans', 'antialiased'];
                const body = document.body;
                const currentClasses = body.className.split(/\\s+/).filter(Boolean);
                const missingClasses = requiredClasses.filter(c => !currentClasses.includes(c));
                
                if (missingClasses.length > 0) {
                  console.warn('⚠️ [Emergency] Missing body classes:', missingClasses);
                  body.className = [...new Set([...currentClasses, ...requiredClasses])].join(' ');
                  console.log('✅ [Emergency] Applied body classes:', body.className);
                }
                
                // Force CSS loaded marker
                setTimeout(() => {
                  if (!body.classList.contains('css-loaded')) {
                    body.classList.add('css-loaded');
                    console.log('✅ [Emergency] Added css-loaded class');
                  }
                }, 100);
              })();
            `,
          }}
        />
        <BodyClassForce />
        <BodyClassHydrator className="min-h-screen bg-depth-950 font-sans antialiased">
          <CSSRootProvider>{children}</CSSRootProvider>
        </BodyClassHydrator>
      </body>
    </html>
  )
}
