// Professional Typography System for OceanX
// Futuristic, readable, and game-appropriate fonts

export const typographySystem = {
  // Font Families
  fonts: {
    // Primary UI font - clean, futuristic
    primary: ['Inter', 'system-ui', 'sans-serif'],
    // Gaming/display font - more character
    display: ['Orbitron', 'monospace'],
    // Code/data font - technical readouts
    mono: ['JetBrains Mono', 'monospace'],
    // Fallback system fonts
    system: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif']
  },

  // Font Sizes with Fluid Scaling
  sizes: {
    // Small text and captions
    xs: 'clamp(0.75rem, 0.8vw, 0.875rem)',      // 12-14px
    sm: 'clamp(0.875rem, 0.9vw, 1rem)',         // 14-16px
    
    // Body text
    base: 'clamp(1rem, 1.1vw, 1.125rem)',       // 16-18px
    lg: 'clamp(1.125rem, 1.3vw, 1.25rem)',      // 18-20px
    
    // Headings
    xl: 'clamp(1.25rem, 1.5vw, 1.5rem)',        // 20-24px
    '2xl': 'clamp(1.5rem, 2vw, 2rem)',          // 24-32px
    '3xl': 'clamp(1.875rem, 2.5vw, 2.5rem)',    // 30-40px
    '4xl': 'clamp(2.25rem, 3vw, 3rem)',         // 36-48px
    '5xl': 'clamp(2.5rem, 4vw, 4rem)',          // 40-64px
  },

  // Line Heights
  leading: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },

  // Letter Spacing
  tracking: {
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },

  // Font Weights
  weights: {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    black: '900',
  }
};

// Typography Variants for Common UI Elements
export const typographyVariants = {
  // Headings
  h1: {
    fontSize: typographySystem.sizes['4xl'],
    fontFamily: typographySystem.fonts.display.join(', '),
    fontWeight: typographySystem.weights.bold,
    lineHeight: typographySystem.leading.tight,
    letterSpacing: typographySystem.tracking.wide,
  },
  
  h2: {
    fontSize: typographySystem.sizes['3xl'],
    fontFamily: typographySystem.fonts.display.join(', '),
    fontWeight: typographySystem.weights.semibold,
    lineHeight: typographySystem.leading.tight,
    letterSpacing: typographySystem.tracking.normal,
  },
  
  h3: {
    fontSize: typographySystem.sizes['2xl'],
    fontFamily: typographySystem.fonts.primary.join(', '),
    fontWeight: typographySystem.weights.semibold,
    lineHeight: typographySystem.leading.normal,
  },

  // Body text
  body: {
    fontSize: typographySystem.sizes.base,
    fontFamily: typographySystem.fonts.primary.join(', '),
    fontWeight: typographySystem.weights.normal,
    lineHeight: typographySystem.leading.normal,
  },

  // Game-specific text
  hud: {
    fontSize: typographySystem.sizes.sm,
    fontFamily: typographySystem.fonts.mono.join(', '),
    fontWeight: typographySystem.weights.medium,
    lineHeight: typographySystem.leading.tight,
    letterSpacing: typographySystem.tracking.wider,
    textTransform: 'uppercase' as const,
  },

  stats: {
    fontSize: typographySystem.sizes.xs,
    fontFamily: typographySystem.fonts.mono.join(', '),
    fontWeight: typographySystem.weights.normal,
    lineHeight: typographySystem.leading.tight,
    letterSpacing: typographySystem.tracking.widest,
    textTransform: 'uppercase' as const,
  },

  // Interactive elements
  button: {
    fontSize: typographySystem.sizes.base,
    fontFamily: typographySystem.fonts.primary.join(', '),
    fontWeight: typographySystem.weights.medium,
    lineHeight: typographySystem.leading.tight,
    letterSpacing: typographySystem.tracking.wide,
  },

  caption: {
    fontSize: typographySystem.sizes.xs,
    fontFamily: typographySystem.fonts.primary.join(', '),
    fontWeight: typographySystem.weights.normal,
    lineHeight: typographySystem.leading.normal,
  }
};