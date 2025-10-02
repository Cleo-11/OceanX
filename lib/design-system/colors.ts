// Enhanced Ocean Color System for OceanX// Enhanced Ocean Color System for OceanX// Enhanced Ocean Color System for OceanX

// Inspired by deep sea bioluminescence and underwater environments

// Inspired by deep sea bioluminescence and underwater environments// Inspired by deep sea bioluminescence and underwater environments

export const oceanColorSystem = {

  // Primary Ocean Depths

  depth: {

    abyss: '#0a0f1c',      // Deepest black-blueexport const oceanColorSystem = {export const oceanColorSystem = {

    deep: '#162447',       // Deep ocean blue

    mid: '#1f4287',        // Mid-depth blue  // Primary Ocean Depths  // Primary Ocean Depths

    surface: '#2e8b9c',    // Ocean surface

    foam: '#7fb3d3',       // Ocean foam  depth: {  depth: {

  },

    abyss: '#0a0f1c',      // Deepest black-blue    abyss: '#0a0f1c',      // Deepest black-blue

  // Bioluminescent Accents

  bio: {    deep: '#162447',       // Deep ocean blue    deep: '#162447',       // Deep ocean blue

    cyan: '#00d4ff',       // Electric cyan

    teal: '#1dd1a1',       // Vibrant teal    mid: '#1f4287',        // Mid-depth blue    mid: '#1f4287',        // Mid-depth blue

    blue: '#3742fa',       // Electric blue

    purple: '#5f27cd',     // Deep purple    surface: '#2e8b9c',    // Ocean surface    surface: '#2e8b9c',    // Ocean surface

    pink: '#ff6b9d',       // Coral pink

  },    foam: '#7fb3d3',       // Ocean foam    foam: '#7fb3d3',       // Ocean foam



  // Mineral/Resource Colors  },  },

  mineral: {

    nickel: '#c7d2fe',     // Silver-blue

    cobalt: '#3b82f6',     // Pure blue

    copper: '#f97316',     // Warm orange  // Bioluminescent Accents  // Bioluminescent Accents

    manganese: '#a855f7',  // Purple

    rare: '#fbbf24',       // Gold/rare elements  bio: {  bio: {

  },

    cyan: '#00d4ff',       // Electric cyan    cyan: '#00d4ff',       // Electric cyan

  // Submarine Tech Colors

  tech: {    teal: '#1dd1a1',       // Vibrant teal    teal: '#1dd1a1',       // Vibrant teal

    hull: '#374151',       // Dark metal

    screen: '#10b981',     // HUD green    blue: '#3742fa',       // Electric blue    blue: '#3742fa',       // Electric blue

    warning: '#f59e0b',    // Amber warning

    danger: '#ef4444',     // Red danger    purple: '#5f27cd',     // Deep purple    purple: '#5f27cd',     // Deep purple

    energy: '#eab308',     // Energy yellow

  },    pink: '#ff6b9d',       // Coral pink    pink: '#ff6b9d',       // Coral pink



  // Semantic Colors with Ocean Theme  },  },

  semantic: {

    success: '#059669',    // Deep sea green

    warning: '#d97706',    // Coral orange

    error: '#dc2626',      // Deep red  // Mineral/Resource Colors  // Mineral/Resource Colors

    info: '#0891b2',       // Ocean blue

  },  mineral: {  mineral: {



  // Glass/Transparency System    nickel: '#c7d2fe',     // Silver-blue    nickel: '#c7d2fe',     // Silver-blue

  glass: {

    light: 'rgba(255, 255, 255, 0.1)',    cobalt: '#3b82f6',     // Pure blue    cobalt: '#3b82f6',     // Pure blue

    medium: 'rgba(255, 255, 255, 0.2)',

    heavy: 'rgba(255, 255, 255, 0.3)',    copper: '#f97316',     // Warm orange    copper: '#f97316',     // Warm orange

    dark: 'rgba(0, 20, 40, 0.8)',

  }    manganese: '#a855f7',  // Purple    manganese: '#a855f7',  // Purple

};

    rare: '#fbbf24',       // Gold/rare elements    rare: '#fbbf24',       // Gold/rare elements

// Enhanced Gradients

export const oceanGradients = {  },  },

  depths: 'linear-gradient(180deg, #0a0f1c 0%, #162447 25%, #1f4287 50%, #2e8b9c 100%)',

  bioluminescent: 'linear-gradient(135deg, #00d4ff 0%, #3742fa 50%, #5f27cd 100%)',

  submarine: 'linear-gradient(145deg, #374151 0%, #1f2937 100%)',

  energy: 'linear-gradient(90deg, #eab308 0%, #f59e0b 100%)',  // Submarine Tech Colors  // Submarine Tech Colors

  resource: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',

  danger: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',  tech: {  tech: {

  glow: 'radial-gradient(circle, rgba(0, 212, 255, 0.3) 0%, rgba(0, 212, 255, 0) 70%)',

};    hull: '#374151',       // Dark metal    hull: '#374151',       // Dark metal

    screen: '#10b981',     // HUD green    screen: '#10b981',     // HUD green

    warning: '#f59e0b',    // Amber warning    warning: '#f59e0b',    // Amber warning

    danger: '#ef4444',     // Red danger    danger: '#ef4444',     // Red danger

    energy: '#eab308',     // Energy yellow    energy: '#eab308',     // Energy yellow

  },  },



  // Semantic Colors with Ocean Theme  // Semantic Colors with Ocean Theme

  semantic: {  semantic: {

    success: '#059669',    // Deep sea green    success: '#059669',    // Deep sea green

    warning: '#d97706',    // Coral orange    warning: '#d97706',    // Coral orange

    error: '#dc2626',      // Deep red    error: '#dc2626',      // Deep red

    info: '#0891b2',       // Ocean blue    info: '#0891b2',       // Ocean blue

  },  },



  // Glass/Transparency System  // Glass/Transparency System

  glass: {  glass: {

    light: 'rgba(255, 255, 255, 0.1)',    light: 'rgba(255, 255, 255, 0.1)',

    medium: 'rgba(255, 255, 255, 0.2)',    medium: 'rgba(255, 255, 255, 0.2)',

    heavy: 'rgba(255, 255, 255, 0.3)',    heavy: 'rgba(255, 255, 255, 0.3)',

    dark: 'rgba(0, 20, 40, 0.8)',    dark: 'rgba(0, 20, 40, 0.8)',

  }  }

};};



// Enhanced Gradients// Enhanced Gradients

export const oceanGradients = {export const oceanGradients = {

  depths: 'linear-gradient(180deg, #0a0f1c 0%, #162447 25%, #1f4287 50%, #2e8b9c 100%)',  depths: 'linear-gradient(180deg, #0a0f1c 0%, #162447 25%, #1f4287 50%, #2e8b9c 100%)',

  bioluminescent: 'linear-gradient(135deg, #00d4ff 0%, #3742fa 50%, #5f27cd 100%)',  bioluminescent: 'linear-gradient(135deg, #00d4ff 0%, #3742fa 50%, #5f27cd 100%)',

  submarine: 'linear-gradient(145deg, #374151 0%, #1f2937 100%)',  submarine: 'linear-gradient(145deg, #374151 0%, #1f2937 100%)',

  energy: 'linear-gradient(90deg, #eab308 0%, #f59e0b 100%)',  energy: 'linear-gradient(90deg, #eab308 0%, #f59e0b 100%)',

  resource: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',  resource: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',

  danger: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',  danger: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',

  glow: 'radial-gradient(circle, rgba(0, 212, 255, 0.3) 0%, rgba(0, 212, 255, 0) 70%)',  glow: 'radial-gradient(circle, rgba(0, 212, 255, 0.3) 0%, rgba(0, 212, 255, 0) 70%)',

};};