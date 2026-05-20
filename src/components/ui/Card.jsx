/**
 * PRISM UI Component Library — Card Component
 * 
 * Unified, token-based card component for content containers.
 * Supports padding, border, shadow, and theme variants.
 * 
 * Usage:
 *   <Card padding="md" isDark={true}>
 *     <h3>Card Title</h3>
 *     <p>Card content goes here</p>
 *   </Card>
 */

import React from 'react';
import { getTheme, SPACING, SHADOWS, BORDER_RADIUS } from '../../data/designTokens';

export default function Card({
  children,
  padding = 'md',        // 'sm' | 'md' | 'lg'
  shadow = 'base',       // 'none' | 'sm' | 'base' | 'md' | 'lg'
  isDark = true,
  borderColor = null,    // Override border color
  style = {},
  className = '',
  ...props
}) {
  const theme = getTheme(isDark);
  const { colors } = theme;

  // Padding definitions
  const paddingMap = {
    sm: SPACING[2],
    md: SPACING[3],
    lg: SPACING[4],
  };

  const cardStyle = {
    background: colors.bg.secondary,
    color: colors.text.primary,
    border: `1px solid ${borderColor || colors.border.default}`,
    borderRadius: BORDER_RADIUS.md,
    padding: paddingMap[padding],
    boxShadow: SHADOWS[shadow],
    ...style,
  };

  return (
    <div style={cardStyle} className={className} {...props}>
      {children}
    </div>
  );
}
