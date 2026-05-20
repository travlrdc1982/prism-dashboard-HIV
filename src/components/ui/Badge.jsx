/**
 * PRISM UI Component Library — Badge Component
 * 
 * Unified badge for labels, tags, and status indicators.
 * Supports semantic colors, sizes, and theme variants.
 * 
 * Usage:
 *   <Badge variant="success">Active</Badge>
 *   <Badge variant="tier1" isDark={true}>Tier 1</Badge>
 *   <Badge color="#e57373">Custom</Badge>
 */

import React from 'react';
import { getTheme, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../../data/designTokens';

export default function Badge({
  children,
  variant = 'default',   // 'default' | 'success' | 'warning' | 'error' | 'tier1' | 'tier2' | 'tier3' | 'gop' | 'dem'
  size = 'md',           // 'sm' | 'md' | 'lg'
  color = null,          // Override color
  isDark = true,
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
      fontSize: TYPOGRAPHY.fontSize.xs,
      fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },
    md: {
      padding: `${SPACING[1]} ${SPACING[3]}`,
      fontSize: TYPOGRAPHY.fontSize.sm,
      fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },
    lg: {
      padding: `${SPACING[2]} ${SPACING[4]}`,
      fontSize: TYPOGRAPHY.fontSize.base,
      fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },
  };

  // Color mapping by variant
  const variantColors = {
    default: { bg: colors.bg.secondary, fg: colors.text.primary, border: colors.border.default },
    success: { bg: '#10b981', fg: '#ffffff', border: '#059669' },
    warning: { bg: '#f59e0b', fg: '#ffffff', border: '#d97706' },
    error: { bg: colors.error, fg: '#ffffff', border: isDark ? '#991b1b' : '#dc2626' },
    tier1: { bg: colors.tier.tier1, fg: '#000000', border: colors.tier.tier1Dark },
    tier2: { bg: colors.tier.tier2, fg: '#000000', border: colors.tier.tier2Dark },
    tier3: { bg: colors.tier.tier3, fg: '#ffffff', border: colors.tier.tier3Dark },
    gop: { bg: colors.party.gop, fg: '#ffffff', border: colors.party.gopDark },
    dem: { bg: colors.party.dem, fg: '#ffffff', border: colors.party.demDark },
  };

  const colorSet = color
    ? { bg: color, fg: '#ffffff', border: color }
    : variantColors[variant];

  const badgeStyle = {
    display: 'inline-block',
    background: colorSet.bg,
    color: colorSet.fg,
    border: `1px solid ${colorSet.border}`,
    borderRadius: BORDER_RADIUS.full,
    fontFamily: TYPOGRAPHY.fontFamily.default,
    whiteSpace: 'nowrap',
    ...sizes[size],
    ...style,
  };

  return (
    <span style={badgeStyle} className={className} {...props}>
      {children}
    </span>
  );
}
