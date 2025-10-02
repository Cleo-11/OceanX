// Enhanced Ocean-Themed Button Component
"use client";

import React from 'react';
import { motion } from 'framer-motion';
import type { MotionStyle, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { animationVariants } from '@/lib/design-system/animations';
import { oceanColorSystem } from '@/lib/design-system/colors';
import { typographyVariants } from '@/lib/design-system/typography';

interface OceanButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'bioluminescent';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  glowEffect?: boolean;
  children: React.ReactNode;
}

const variantStyles = {
  primary: {
    background: `linear-gradient(135deg, ${oceanColorSystem.bio.cyan} 0%, ${oceanColorSystem.bio.blue} 100%)`,
    color: 'white',
    border: 'none',
    boxShadow: `0 4px 16px rgba(0, 212, 255, 0.3)`,
  },
  secondary: {
    background: `linear-gradient(135deg, ${oceanColorSystem.depth.mid} 0%, ${oceanColorSystem.depth.deep} 100%)`,
    color: oceanColorSystem.bio.cyan,
    border: `1px solid ${oceanColorSystem.bio.cyan}40`,
    boxShadow: `0 2px 8px rgba(0, 20, 40, 0.5)`,
  },
  danger: {
    background: `linear-gradient(135deg, ${oceanColorSystem.semantic.error} 0%, #991b1b 100%)`,
    color: 'white',
    border: 'none',
    boxShadow: `0 4px 16px rgba(239, 68, 68, 0.3)`,
  },
  ghost: {
    background: 'transparent',
    color: oceanColorSystem.bio.cyan,
    border: `1px solid rgba(255, 255, 255, 0.1)`,
    boxShadow: 'none',
  },
  bioluminescent: {
    background: `linear-gradient(135deg, ${oceanColorSystem.bio.teal} 0%, ${oceanColorSystem.bio.purple} 100%)`,
    color: 'white',
    border: 'none',
    boxShadow: `0 0 20px ${oceanColorSystem.bio.teal}50`,
  },
};

const sizeStyles = {
  sm: {
    padding: '8px 16px',
    fontSize: typographyVariants.caption.fontSize,
    borderRadius: '6px',
  },
  md: {
    padding: '12px 24px',
    fontSize: typographyVariants.button.fontSize,
    borderRadius: '8px',
  },
  lg: {
    padding: '16px 32px',
    fontSize: typographyVariants.button.fontSize,
    borderRadius: '10px',
  },
  xl: {
    padding: '20px 40px',
    fontSize: typographyVariants.h3.fontSize,
    borderRadius: '12px',
  },
};

export function OceanButton({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  iconPosition = 'left',
  glowEffect = false,
  className,
  children,
  disabled,
  style: styleProp,
  ...props
}: OceanButtonProps) {
  const buttonStyle = variantStyles[variant] || variantStyles.primary;
  const sizeStyle = sizeStyles[size] || sizeStyles.md;

  const combinedStyle: MotionStyle = {
    ...buttonStyle,
    ...sizeStyle,
    fontFamily: typographyVariants.button.fontFamily,
    fontWeight: typographyVariants.button.fontWeight,
    letterSpacing: typographyVariants.button.letterSpacing,
  };

  const mergedStyle: MotionStyle = {
    ...combinedStyle,
    ...(styleProp ? (styleProp as MotionStyle) : {}),
  };

  return (
    <motion.button
      className={cn(
        // Base styles
        'relative inline-flex items-center justify-center',
        'font-medium tracking-wide transition-all duration-300',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'backdrop-blur-sm overflow-hidden',
        // Disabled styles
        disabled && 'opacity-50 cursor-not-allowed',
        // Loading styles
        isLoading && 'cursor-wait',
        className
      )}
  style={mergedStyle}
      variants={animationVariants.button}
      initial="idle"
      whileHover={!disabled ? "hover" : "idle"}
      whileTap={!disabled ? "tap" : "idle"}
      disabled={disabled || isLoading}
      {...props}
    >
      {/* Shimmer effect overlay */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        style={{ transform: 'translateX(-100%)' }}
        animate={{
          transform: ['translateX(-100%)', 'translateX(100%)'],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'linear',
          delay: Math.random() * 2,
        }}
      />

      {/* Glow effect for bioluminescent variant */}
      {(glowEffect || variant === 'bioluminescent') && (
        <motion.div
          className="absolute inset-0 -z-10 blur-lg"
          style={{
            background: buttonStyle.background,
            borderRadius: sizeStyle.borderRadius,
          }}
          animate={{
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* Content */}
      <div className="relative flex items-center justify-center space-x-2">
        {isLoading ? (
          <motion.div
            className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        ) : (
          <>
            {icon && iconPosition === 'left' && (
              <span className="w-4 h-4">{icon}</span>
            )}
            <span>{children}</span>
            {icon && iconPosition === 'right' && (
              <span className="w-4 h-4">{icon}</span>
            )}
          </>
        )}
      </div>

      {/* Ripple effect on click */}
      <motion.div
        className="absolute inset-0 bg-white/20 rounded-full scale-0"
        whileTap={{
          scale: [0, 1],
          opacity: [0.5, 0],
        }}
        transition={{ duration: 0.3 }}
      />
    </motion.button>
  );
}

// Export for easy usage
export default OceanButton;