/**
 * PRISM UI Component Library — Panel Component
 * 
 * Unified panel for sidebar, detail panes, and content sections.
 * Supports header, footer, and padding variants.
 * 
 * Usage:
 *   <Panel title="Details" isDark={true}>
 *     <p>Content here</p>
 *   </Panel>
 *   <Panel headerContent={<h3>Title</h3>} footer={<button>Action</button>}>
 *     <p>Main content</p>
 *   </Panel>
 */

import React from 'react';
import { getTheme, SPACING, TYPOGRAPHY, SHADOWS, BORDER_RADIUS } from '../../data/designTokens';

export default function Panel({
  children,
  title = null,
  headerContent = null,
  footer = null,
  padding = 'md',       // 'sm' | 'md' | 'lg'
  isDark = true,
  style = {},
  className = '',
  ...props
}) {
  const theme = getTheme(isDark);
  const { colors } = theme;

  const paddingMap = {
    sm: SPACING[2],
    md: SPACING[3],
    lg: SPACING[4],
  };

  const panelStyle = {
    background: colors.bg.secondary,
    color: colors.text.primary,
    border: `1px solid ${colors.border.default}`,
    borderRadius: BORDER_RADIUS.md,
    boxShadow: SHADOWS.base,
    overflow: 'hidden',
    ...style,
  };

  const headerStyle = {
    background: colors.bg.tertiary,
    borderBottom: `1px solid ${colors.border.default}`,
    padding: SPACING[3],
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    fontSize: TYPOGRAPHY.fontSize.md,
  };

  const contentStyle = {
    padding: paddingMap[padding],
  };

  const footerStyle = {
    background: colors.bg.tertiary,
    borderTop: `1px solid ${colors.border.default}`,
    padding: SPACING[3],
    display: 'flex',
    gap: SPACING[2],
  };

  return (
    <div style={panelStyle} className={className} {...props}>
      {(title || headerContent) && (
        <div style={headerStyle}>
          {headerContent || title}
        </div>
      )}
      <div style={contentStyle}>
        {children}
      </div>
      {footer && (
        <div style={footerStyle}>
          {footer}
        </div>
      )}
    </div>
  );
}
