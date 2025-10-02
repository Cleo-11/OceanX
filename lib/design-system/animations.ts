// Advanced Animation System for OceanX
// GPU-optimized, orchestrated animations with proper timing

import type { Variants } from 'framer-motion';

// Animation Durations (based on Material Design and game feel)
export const animationDurations = {
  instant: 0,
  fast: 0.15,
  normal: 0.3,
  slow: 0.5,
  dramatic: 0.8,
  cinematic: 1.2,
};

// Easing Functions
export const easings = {
  // Standard easings
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1],
  
  // Custom ocean-themed easings
  wave: [0.36, 0, 0.66, -0.56],
  bubble: [0.68, -0.6, 0.32, 1.6],
  depth: [0.83, 0, 0.17, 1],
  surface: [0.16, 1, 0.3, 1],
  
  // Game feel easings
  bounce: [0.68, -0.55, 0.265, 1.55],
  elastic: [0.175, 0.885, 0.32, 1.275],
  anticipate: [0.175, 0.885, 0.32, 1.275],
} as const;

// Standard Transitions
export const transitions = {
  fast: {
    duration: animationDurations.fast,
    ease: easings.easeOut,
  },
  normal: {
    duration: animationDurations.normal,
    ease: easings.ease,
  },
  slow: {
    duration: animationDurations.slow,
    ease: easings.easeInOut,
  },
  bounce: {
    duration: animationDurations.slow,
    ease: easings.bounce,
  },
  elastic: {
    duration: animationDurations.dramatic,
    ease: easings.elastic,
  },
  wave: {
    duration: animationDurations.cinematic,
    ease: easings.wave,
  },
} as const;

// Component Animation Variants
export const animationVariants = {
  // Modal/Dialog animations
  modal: {
    hidden: {
      opacity: 0,
      scale: 0.8,
      y: 20,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: transitions.elastic,
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      y: 10,
      transition: transitions.fast,
    },
  } satisfies Variants,

  // HUD elements
  hud: {
    hidden: {
      opacity: 0,
      x: -20,
      scale: 0.95,
    },
    visible: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: {
        ...transitions.normal,
        delay: 0.1,
      },
    },
  } satisfies Variants,

  // Submarine/vehicle animations
  submarine: {
    idle: {
      y: [0, -2, 0],
      rotate: [0, 0.5, 0],
      transition: {
        duration: 4,
        ease: easings.wave,
        repeat: Infinity,
      },
    },
    moving: {
      y: [0, -1, 0],
      rotate: [0, 1, 0],
      transition: {
        duration: 2,
        ease: easings.wave,
        repeat: Infinity,
      },
    },
    boost: {
      scale: [1, 1.05, 1],
      transition: {
        duration: 0.3,
        ease: easings.bounce,
      },
    },
  } satisfies Variants,

  // Button interactions
  button: {
    idle: {
      scale: 1,
      boxShadow: '0 4px 8px rgba(0, 212, 255, 0.2)',
    },
    hover: {
      scale: 1.02,
      boxShadow: '0 8px 16px rgba(0, 212, 255, 0.4)',
      transition: transitions.fast,
    },
    tap: {
      scale: 0.98,
      transition: transitions.fast,
    },
  } satisfies Variants,

  // Notification/alert animations
  notification: {
    hidden: {
      opacity: 0,
      x: 100,
      scale: 0.8,
    },
    visible: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: transitions.bounce,
    },
    exit: {
      opacity: 0,
      x: 100,
      scale: 0.8,
      transition: transitions.fast,
    },
  } satisfies Variants,

  // Resource bar/progress animations
  progressBar: {
    empty: {
      width: '0%',
    },
    filled: (percentage: number) => ({
      width: `${percentage}%`,
      transition: {
        duration: animationDurations.normal,
        ease: easings.easeOut,
      },
    }),
  } satisfies Variants,

  // Stagger animations for lists
  stagger: {
    hidden: {
      opacity: 0,
    },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  } satisfies Variants,

  staggerItem: {
    hidden: {
      opacity: 0,
      y: 10,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: transitions.normal,
    },
  } satisfies Variants,
};

// Special Effects Animations
export const effectVariants = {
  // Glow pulse effect
  glowPulse: {
    initial: {
      boxShadow: '0 0 0px rgba(0, 212, 255, 0.5)',
    },
    animate: {
      boxShadow: [
        '0 0 0px rgba(0, 212, 255, 0.5)',
        '0 0 20px rgba(0, 212, 255, 0.8)',
        '0 0 0px rgba(0, 212, 255, 0.5)',
      ],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: easings.wave,
      },
    },
  } satisfies Variants,

  // Screen shake for damage/impact
  screenShake: {
    initial: { x: 0, y: 0 },
    shake: {
      x: [-2, 2, -2, 2, 0],
      y: [-1, 1, -1, 1, 0],
      transition: {
        duration: 0.4,
        ease: easings.linear,
      },
    },
  } satisfies Variants,

  // Particle burst
  particleBurst: {
    initial: {
      scale: 0,
      opacity: 1,
    },
    burst: {
      scale: [0, 1.5, 0],
      opacity: [1, 0.8, 0],
      transition: {
        duration: 0.6,
        ease: easings.easeOut,
      },
    },
  } satisfies Variants,

  // Underwater floating effect
  float: {
    animate: {
      y: [-4, 4],
      rotate: [-1, 1],
      transition: {
        duration: 3,
        repeat: Infinity,
        repeatType: 'reverse' as const,
        ease: easings.wave,
      },
    },
  } satisfies Variants,
};

// Layout Animation Settings
export const layoutTransitions = {
  smooth: {
    layout: true,
    transition: transitions.normal,
  },
  elastic: {
    layout: true,
    transition: transitions.elastic,
  },
  fast: {
    layout: true,
    transition: transitions.fast,
  },
} as const;