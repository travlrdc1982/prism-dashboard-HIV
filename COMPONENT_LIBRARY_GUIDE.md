# PRISM UI Component Library Documentation

## Overview
This is the unified component library for the PRISM HIV dashboard. All UI components consume design tokens from `designTokens.js` and support both dark and light themes automatically.

## Core Principles
- **Token-based:** No hardcoded colors, sizes, or spacing values
- **Theme-aware:** Components respond to `isDark` prop; all styling pulls from centralized theme
- **Consistent:** All components follow the same patterns for props, naming, and behavior
- **Extensible:** Easy to add new components or variants without breaking existing code

---

## Available Components

### Button
Primary interactive element. Supports multiple variants and sizes.

```jsx
import { Button } from '../components/ui';

<Button variant="primary" size="md" onClick={handleClick}>
  Click me
</Button>

<Button variant="secondary" disabled>
  Disabled
</Button>

<Button variant="danger" size="sm">
  Delete
</Button>
```

**Props:**
- `variant`: 'primary' | 'secondary' | 'tertiary' | 'danger' (default: 'primary')
- `size`: 'sm' | 'md' | 'lg' (default: 'md')
- `disabled`: boolean (default: false)
- `isDark`: boolean (default: true)
- `onClick`: function
- `style`: object (additional inline styles)
- `className`: string

---

### Card
Content container with consistent padding, border, and shadow.

```jsx
import { Card } from '../components/ui';

<Card padding="md" shadow="base" isDark={true}>
  <h3>Card Title</h3>
  <p>Card content goes here</p>
</Card>
```

**Props:**
- `padding`: 'sm' | 'md' | 'lg' (default: 'md')
- `shadow`: 'none' | 'sm' | 'base' | 'md' | 'lg' (default: 'base')
- `isDark`: boolean (default: true)
- `borderColor`: string (override border color)
- `style`: object
- `className`: string

---

### Badge
Inline label or tag for status, categories, or highlights.

```jsx
import { Badge } from '../components/ui';

<Badge variant="success">Active</Badge>

<Badge variant="tier1" isDark={true}>
  Tier 1
</Badge>

<Badge variant="gop" size="sm">
  Republican
</Badge>

<Badge color="#e57373">Custom Color</Badge>
```

**Props:**
- `variant`: 'default' | 'success' | 'warning' | 'error' | 'tier1' | 'tier2' | 'tier3' | 'gop' | 'dem' (default: 'default')
- `size`: 'sm' | 'md' | 'lg' (default: 'md')
- `color`: string (override color)
- `isDark`: boolean (default: true)
- `style`: object
- `className`: string

---

### Panel
Container for sidebars, detail panes, and content sections with optional header and footer.

```jsx
import { Panel } from '../components/ui';

<Panel title="Details" isDark={true}>
  <p>Content here</p>
</Panel>

<Panel
  headerContent={<h3>Custom Header</h3>}
  footer={<button>Action</button>}
  padding="lg"
>
  <p>Main content</p>
</Panel>
```

**Props:**
- `title`: string (simple header text)
- `headerContent`: React element (custom header)
- `footer`: React element (footer section)
- `padding`: 'sm' | 'md' | 'lg' (default: 'md')
- `isDark`: boolean (default: true)
- `style`: object
- `className`: string

---

### Table
Consistent table styling with striped rows and hover effects.

```jsx
import { Table } from '../components/ui';

<Table headers={['Name', 'Value', 'Status']} striped hover isDark={true}>
  <tr><td>Item 1</td><td>100</td><td>Active</td></tr>
  <tr><td>Item 2</td><td>200</td><td>Inactive</td></tr>
</Table>

<Table headers={['Segment', 'Tier', 'ROI']} compact={true}>
  <tr><td>Segment A</td><td>Tier 1</td><td>85%</td></tr>
  <tr><td>Segment B</td><td>Tier 2</td><td>62%</td></tr>
</Table>
```

**Props:**
- `headers`: array of strings
- `striped`: boolean (default: true)
- `hover`: boolean (default: true)
- `compact`: boolean (default: false)
- `isDark`: boolean (default: true)
- `style`: object
- `className`: string

---

## Design Tokens

All tokens are centralized in `designTokens.js` and organized by category:

### Colors
- **Party:** `TOKENS.party.gop`, `TOKENS.party.dem`, `TOKENS.party.us`
- **ROI:** `TOKENS.roi.attitudes`, `TOKENS.roi.behavior`
- **Tiers:** `TOKENS.tier.tier1`, `TOKENS.tier.tier2`, `TOKENS.tier.tier3`
- **Semantic:** `TOKENS.significance`, `TOKENS.activation`, `TOKENS.persuasion`, etc.

### Typography
- **Font families:** `TYPOGRAPHY.fontFamily.default` (DM Sans), `.mono`, `.serif`
- **Font sizes:** `xs`, `sm`, `base`, `md`, `lg`, `xl`, `2xl`, etc.
- **Font weights:** `light`, `normal`, `medium`, `semibold`, `bold`, `extrabold`
- **Line heights:** `tight`, `snug`, `normal`, `relaxed`, `loose`

### Spacing
- **Scale:** `SPACING[0]` to `SPACING[24]` (0px to 96px)
- All padding/margin should use these values for consistency

### Shadows
- `SHADOWS.sm`, `SHADOWS.base`, `SHADOWS.md`, `SHADOWS.lg`, `SHADOWS.xl`

### Border Radius
- `BORDER_RADIUS.sm`, `.base`, `.md`, `.lg`, `.xl`, `.full`

---

## Theme System

### Dark Mode (Default)
```javascript
import { getTheme } from '../data/designTokens';

const darkTheme = getTheme(true);
// darkTheme.colors.bg.primary = '#0b0e13'
// darkTheme.colors.text.primary = '#dce4ed'
// etc.
```

### Light Mode
```javascript
const lightTheme = getTheme(false);
// lightTheme.colors.bg.primary = '#ffffff'
// lightTheme.colors.text.primary = '#1f2937'
// etc.
```

### Adding Theme-Aware Components
All components accept `isDark` prop. Pass it from a parent context or state manager:

```jsx
import { getTheme } from '../data/designTokens';

function MyComponent({ isDark = true }) {
  const theme = getTheme(isDark);
  
  return (
    <div style={{ background: theme.colors.bg.primary }}>
      <Button isDark={isDark}>Click me</Button>
      <Card isDark={isDark}>Content</Card>
    </div>
  );
}
```

---

## Adding New Components

1. Create a new file in `src/components/ui/ComponentName.jsx`
2. Import tokens from `designTokens.js`
3. Use `getTheme(isDark)` to access colors and styling
4. Accept `isDark` as a prop
5. Export the component from `src/components/ui/index.js`

Example template:
```jsx
import React from 'react';
import { getTheme, SPACING, TYPOGRAPHY } from '../../data/designTokens';

export default function MyComponent({ isDark = true, style = {}, ...props }) {
  const theme = getTheme(isDark);
  const { colors } = theme;

  const componentStyle = {
    background: colors.bg.secondary,
    color: colors.text.primary,
    padding: SPACING[3],
    fontFamily: TYPOGRAPHY.fontFamily.default,
    ...style,
  };

  return <div style={componentStyle} {...props} />;
}
```

---

## Best Practices

✅ **DO:**
- Use tokens for all colors, spacing, typography
- Accept `isDark` prop and pass it through to child components
- Provide sensible defaults
- Document component props and usage
- Keep components focused and single-purpose

❌ **DON'T:**
- Use hardcoded colors (e.g., `#0b0e13`)
- Use hardcoded spacing (e.g., `padding: '16px'`)
- Ignore theme variants
- Create new components without documentation
- Mix inline styles with CSS classes

---

## Migration Path

Existing components should gradually adopt the component library:

1. **Phase 1:** Create library (done)
2. **Phase 2:** Use library in new code
3. **Phase 3:** Refactor high-impact pages (AudienceROI, SegmentProfile)
4. **Phase 4:** Full migration; deprecate old styling patterns

---

## Questions or Feedback?
Update this document as the library evolves and components are added.
