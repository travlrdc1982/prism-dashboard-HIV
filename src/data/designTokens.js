/**
 * PRISM HIV Dashboard — Design System Framework
 * 
 * This module defines all design tokens (colors, typography, spacing, shadows)
 * with support for dark and light themes. All UI should consume tokens from here,
 * not use hardcoded values.
 * 
 * Usage:
 *   import { TOKENS, THEME } from '../data/designTokens';
 *   const isDark = true;
 *   const theme = THEME[isDark ? 'dark' : 'light'];
 *   const bgColor = theme.colors.bg.primary;
 */

// ─────────────────────────────────────────────────────────────────────────────
// SEMANTIC COLOR TOKENS
// ─────────────────────────────────────────────────────────────────────────────

export const TOKENS = {
  // Party identification (locked colors — do not change)
  party: {
    gop: '#e57373',      // Republican: warm red
    gopLight: '#ef5350',
    gopDark: '#c62828',
    gopBg: '#ffebee',    // Light background
    dem: '#64b5f6',      // Democrat: cool blue
    demLight: '#90caf9',
    demDark: '#1e3a8a',
    demBg: '#e3f2fd',    // Light background
    us: '#e8eaed',       // Benchmark: neutral
    usBg: '#f5f5f5',
  },

  // ROI Dimensions (attitudes vs behavior)
  roi: {
    attitudes: '#5b93c7',     // Persuadability + Coalition Support
    attitudesLight: '#7eb3e0',
    attitudesDark: '#2c5aa0',
    behavior: '#a78bfa',      // Activation + Influence
    behaviorLight: '#c4b5fd',
    behaviorDark: '#6d28d9',
  },

  // Segment Tiers (three-tier traffic light system)
  tier: {
    // Primary (traffic light)
    tier1: '#34d399',   // Green: high opportunity
    tier1Light: '#6ee7b7',
    tier1Dark: '#059669',
    tier1Bg: '#064e3b',
    
    tier2: '#eab308',   // Amber: medium
    tier2Light: '#facc15',
    tier2Dark: '#b45309',
    tier2Bg: '#854d0e',
    
    tier3: '#ef4444',   // Red: low opportunity
    tier3Light: '#f87171',
    tier3Dark: '#991b1b',
    tier3Bg: '#7f1d1d',

    // Alternative (three-star system for Topline)
    star1: '#fbbf24',    // Yellow (one star)
    star2: '#86efac',    // Light green (two stars)
    star3: '#22c55e',    // Bold green (three stars)
  },

  // Benchmark indicators
  benchmark: {
    us: '#e8eaed',
    r: '#e57373',
    d: '#64b5f6',
  },

  // Significance markers
  significance: {
    sig: '#10b981',      // Green: significant
    notSig: '#9ca3af',   // Gray: not significant
    flagged: '#f97316',  // Orange: caution
  },

  // Activation vs Persuasion distinction
  activation: '#a78bfa',      // Purple
  persuasion: '#5b93c7',      // Blue
  coalition: '#3b82f6',       // Brighter blue
  influence: '#818cf8',       // Indigo

  // K5 False-Flag (special marker)
  k5Flag: '#ec4899',   // Pink

  // Neutral palette (grays, whites, blacks)
  neutral: {
    white: '#ffffff',
    black: '#000000',
    gray50: '#f9fafb',
    gray100: '#f3f4f6',
    gray200: '#e5e7eb',
    gray300: '#d1d5db',
    gray400: '#9ca3af',
    gray500: '#6b7280',
    gray600: '#4b5563',
    gray700: '#374151',
    gray800: '#1f2937',
    gray900: '#111827',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPOGRAPHY TOKENS
// ─────────────────────────────────────────────────────────────────────────────

export const TYPOGRAPHY = {
  fontFamily: {
    default: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'Courier New', monospace",
    serif: "'Fraunces', Georgia, serif",
  },

  fontSize: {
    xs: '10px',
    sm: '11px',
    base: '12px',
    md: '13px',
    lg: '14px',
    xl: '16px',
    '2xl': '18px',
    '3xl': '20px',
    '4xl': '24px',
    '5xl': '30px',
    '6xl': '36px',
    '7xl': '48px',
  },

  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },

  lineHeight: {
    tight: 1.2,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },

  letterSpacing: {
    tight: '-0.01em',
    normal: '0em',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SPACING TOKENS
// ─────────────────────────────────────────────────────────────────────────────

export const SPACING = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  10: '40px',
  12: '48px',
  14: '56px',
  16: '64px',
  20: '80px',
  24: '96px',
};

// ─────────────────────────────────────────────────────────────────────────────
// SHADOW TOKENS
// ─────────────────────────────────────────────────────────────────────────────

export const SHADOWS = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
};

// ─────────────────────────────────────────────────────────────────────────────
// BORDER RADIUS TOKENS
// ─────────────────────────────────────────────────────────────────────────────

export const BORDER_RADIUS = {
  none: '0px',
  sm: '2px',
  base: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  full: '9999px',
};

// ─────────────────────────────────────────────────────────────────────────────
// THEME VARIANTS (Dark & Light)
// ─────────────────────────────────────────────────────────────────────────────

export const THEME = {
  dark: {
    // Background colors
    colors: {
      bg: {
        primary: '#0b0e13',     // Main page background
        secondary: '#111620',   // Cards, panels
        tertiary: '#1a2238',    // Elevated surfaces
        overlay: 'rgba(0, 0, 0, 0.7)',
      },
      
      // Text colors
      text: {
        primary: '#dce4ed',     // Main text
        secondary: '#a0adc5',   // Secondary text
        muted: '#6b7280',       // Muted/disabled text
        inverse: '#000000',     // For light overlays
      },

      // Border colors
      border: {
        default: '#1c2433',     // Default borders
        light: '#182238',       // Subtle borders
        strong: '#2d3a52',      // Prominent borders
      },

      // Interactive colors
      interactive: {
        hover: '#1e293b',       // Hover state background
        active: '#334155',      // Active/selected state
        focus: '#3b82f6',       // Focus ring color
      },

      // Semantic colors
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#0ea5e9',

      // Include all semantic tokens
      ...TOKENS,
    },

    shadows: SHADOWS,
  },

  light: {
    // Background colors
    colors: {
      bg: {
        primary: '#ffffff',     // Main page background
        secondary: '#f8fafc',   // Cards, panels
        tertiary: '#f1f5f9',    // Elevated surfaces
        overlay: 'rgba(0, 0, 0, 0.1)',
      },

      // Text colors
      text: {
        primary: '#1f2937',     // Main text (dark)
        secondary: '#6b7280',   // Secondary text
        muted: '#9ca3af',       // Muted/disabled text
        inverse: '#ffffff',     // For dark overlays
      },

      // Border colors
      border: {
        default: '#e5e7eb',     // Default borders
        light: '#f3f4f6',       // Subtle borders
        strong: '#d1d5db',      // Prominent borders
      },

      // Interactive colors
      interactive: {
        hover: '#f3f4f6',       // Hover state background
        active: '#e5e7eb',      // Active/selected state
        focus: '#2563eb',       // Focus ring color (darker blue)
      },

      // Semantic colors
      success: '#059669',
      warning: '#d97706',
      error: '#dc2626',
      info: '#0284c7',

      // Include all semantic tokens
      ...TOKENS,
    },

    shadows: SHADOWS,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// BREAKPOINTS FOR RESPONSIVE DESIGN
// ─────────────────────────────────────────────────────────────────────────────

export const BREAKPOINTS = {
  mobile: 480,
  tablet: 768,
  tabletLarge: 1024,
  desktop: 1200,
  desktopLarge: 1400,
  desktopXL: 1600,
};

// ─────────────────────────────────────────────────────────────────────────────
// TRANSITIONS & ANIMATIONS
// ─────────────────────────────────────────────────────────────────────────────

export const TRANSITIONS = {
  fast: '150ms ease-in-out',
  base: '200ms ease-in-out',
  slow: '300ms ease-in-out',
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Get theme by mode
// ─────────────────────────────────────────────────────────────────────────────

export function getTheme(isDark = true) {
  return THEME[isDark ? 'dark' : 'light'];
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT EVERYTHING
// ─────────────────────────────────────────────────────────────────────────────

export default {
  TOKENS,
  TYPOGRAPHY,
  SPACING,
  SHADOWS,
  BORDER_RADIUS,
  THEME,
  BREAKPOINTS,
  TRANSITIONS,
  getTheme,
};
