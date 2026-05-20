/**
 * PRISM UI Component Library — Table Component
 * 
 * Unified table component for displaying tabular data.
 * Supports striped rows, hover effects, and token-based styling.
 * 
 * Usage:
 *   <Table headers={['Name', 'Value', 'Status']} isDark={true}>
 *     <tr><td>Item 1</td><td>100</td><td>Active</td></tr>
 *     <tr><td>Item 2</td><td>200</td><td>Inactive</td></tr>
 *   </Table>
 */

import React from 'react';
import { getTheme, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../../data/designTokens';

export default function Table({
  children,
  headers = [],
  striped = true,
  hover = true,
  isDark = true,
  compact = false,
  style = {},
  className = '',
  ...props
}) {
  const theme = getTheme(isDark);
  const { colors } = theme;

  const paddingSize = compact ? 'sm' : 'md';
  const paddingValue = compact ? SPACING[2] : SPACING[3];

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    fontFamily: TYPOGRAPHY.fontFamily.default,
    fontSize: TYPOGRAPHY.fontSize.base,
    ...style,
  };

  const headerStyle = {
    background: colors.bg.tertiary,
    color: colors.text.primary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    borderBottom: `2px solid ${colors.border.strong}`,
    textAlign: 'left',
  };

  const cellStyle = {
    padding: paddingValue,
    borderBottom: `1px solid ${colors.border.default}`,
  };

  // Clone children and add styling
  const styledRows = React.Children.map(children, (row, idx) => {
    if (!row) return null;
    
    let rowBg = 'transparent';
    if (striped && idx % 2 === 1) {
      rowBg = colors.bg.tertiary;
    }

    const rowStyle = {
      background: rowBg,
      transition: 'background 150ms ease-in-out',
    };

    // Add hover effect if enabled
    const onHover = hover ? {
      onMouseEnter: (e) => {
        e.currentTarget.style.background = colors.interactive.hover;
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.background = rowBg;
      },
    } : {};

    return React.cloneElement(row, {
      style: rowStyle,
      ...onHover,
      children: React.Children.map(row.props.children, (cell) => {
        if (cell.type === 'td') {
          return React.cloneElement(cell, {
            style: {
              ...cellStyle,
              ...cell.props.style,
            },
          });
        }
        return cell;
      }),
    });
  });

  return (
    <table style={tableStyle} className={className} {...props}>
      {headers.length > 0 && (
        <thead>
          <tr>
            {headers.map((header, idx) => (
              <th key={idx} style={{ ...headerStyle, ...cellStyle }}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {styledRows}
      </tbody>
    </table>
  );
}
