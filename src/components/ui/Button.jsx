/**
 * PRISM UI Component Library — Button Component
 * 
 * Unified, token-based button component supporting multiple variants,
 * sizes, and states. Works with both dark and light themes.
 * 
 * Usage:
 *   <Button variant="primary" size="md" onClick={handleClick}>Click me</Button>
 *   <Button variant="secondary" disabled>Disabled</Button>
 */

import React from 'react';
import { getTheme, SPACING, TYPOGRAPHY, TRANSITIONS } from '../../data/designTokens';

export default function Button({
  children,
  variant = 'primary',     // 'primary' | 'secondary' | 'tertiary' | 'danger'
  size = 'md',             // 'sm' | 'md' | 'lg'
  disabled = false,
  isDark = true,
  onClick,
  style = {},
  className = '',
  ...props
}) {
  const theme = getTheme(isDark);
  const { colors } = theme;

  // Size definitions
  const sizes = {
    sm: {
      padding: `${SPACING[1]} ${SPACING[2]}`,
      fontSize: TYPOGRAPHY.fontSize.sm,
      fontWeight: TYPOGRAPHY.fontWeight.medium,
      minHeight: '28px',
    },
    md: {
      padding: `${SPACING[2]} ${SPACING[3]}`,
      fontSize: TYPOGRAPHY.fontSize.base,
      fontWeight: TYPOGRAPHY.fontWeight.medium,
      minHeight: '36px',
    },
    lg: {
      padding: `${SPACING[3]} ${SPACING[4]}`,
      fontSize: TYPOGRAPHY.fontSize.md,
      fontWeight: TYPOGRAPHY.fontWeight.semibold,
      minHeight: '44px',
    },
  };

  // Variant definitions
  const variants = {
    primary: {
      background: colors.interactive.active,
      color: colors.text.inverse,
      border: `1px solid ${colors.interactive.active}`,
      hover: {
        background: colors.interactive.focus,
        border: `1px solid ${colors.interactive.focus}`,
      },
    },
    secondary: {
      background: colors.bg.secondary,
      color: colors.text.primary,
      border: `1px solid ${colors.border.default}`,
      hover: {
        background: colors.interactive.hover,
        border: `1px solid ${colors.border.strong}`,
      },
    },
    tertiary: {
      background: 'transparent',
      color: colors.text.primary,
      border: `1px solid ${colors.border.light}`,
      hover: {
        background: colors.interactive.hover,
        border: `1px solid ${colors.border.default}`,
      },
    },
    danger: {
      background: colors.error,
      color: colors.text.inverse,
      border: `1px solid ${colors.error}`,
      hover: {
        background: isDark ? '#b91c1c' : '#dc2626',
        border: `1px solid ${isDark ? '#b91c1c' : '#dc2626'}`,
      },
    },
  };

  const variantStyle = variants[variant];
  const sizeStyle = sizes[size];

  const baseStyle = {
    fontFamily: TYPOGRAPHY.fontFamily.default,
    borderRadius: '6px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: TRANSITIONS.fast,
    border: variantStyle.border,
    outline: 'none',
    ...sizeStyle,
    ...variantStyle,
  };

  const handleMouseEnter = (e) => {
    if (!disabled) {
      e.currentTarget.style.background = variantStyle.hover.background;
      e.currentTarget.style.border = variantStyle.hover.border;
    }
  };

  const handleMouseLeave = (e) => {
    e.currentTarget.style.background = variantStyle.background;
    e.currentTarget.style.border = variantStyle.border;
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ ...baseStyle, ...style }}
      className={className}
      {...props}
    >
      {children}
    </button>
  );
}
