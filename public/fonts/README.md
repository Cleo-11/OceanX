Local fonts for AbyssX

Place WOFF2 font files here to host them locally and avoid external Google Fonts requests.

Recommended filenames (used by the project):
- Inter-Variable.woff2  (variable Inter for body text)
- SpaceGrotesk-Regular.woff2 (display headings)

How to obtain files:
1. Download WOFF2 builds from a trusted source or use Google Fonts' "Download family" then convert to woff2 if needed.
2. Place the files in this folder.
3. Restart the dev server (if running) to pick up the new files.

Preload example (already added to app/layout.tsx):
<link rel="preload" href="/fonts/Inter-Variable.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
<link rel="preload" href="/fonts/SpaceGrotesk-Regular.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
