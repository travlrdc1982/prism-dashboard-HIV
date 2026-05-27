# PRISM HIV Dashboard: Semantic Color & Design Inventory (May 2026)

## Purpose
This document inventories every place in the dashboard where color or design tokens carry semantic meaning. This is a prerequisite for refactoring the theme system and ensuring visual consistency.

---

## 1. Party Identification
- **Red**: Republican/Conservative segments
- **Blue**: Democrat/Liberal segments
- **Usage:**
  - Segment maps
  - Segment profile headers
  - ROI visualizations
  - Charts and legends

## 2. ROI Dimensions
- **Attitudes**: Persuadability, Coalition Support
- **Behavior**: Activation Likelihood, Influence
- **Usage:**
  - ROI dashboard scorecards
  - Bar/column charts
  - Color-coded tables

## 3. Segment Tiers
- **Three-tier system:**
  - Red: High risk/low opportunity
  - Orange/Yellow: Medium
  - Green: High opportunity
- **Alternative:**
  - Three-star system (yellow, light green, bold green)
- **Usage:**
  - Segment scorecards
  - Topline ROI tables
  - Traffic light indicators

## 4. Benchmark Indicators
- **US, R, D glyphs**: Color-coded to indicate benchmark group
- **Usage:**
  - Benchmark toggles
  - Comparison tables

## 5. Significance Markers
- **Sig markers**: Color or icon to indicate statistical significance
- **Usage:**
  - Table cells
  - Chart annotations

## 6. Activation/Persuasion Distinctions
- **Separate color or iconography for activation vs. persuasion**
- **Usage:**
  - ROI breakdowns
  - Segment detail views

## 7. K5 False-Flag Pink
- **Special color for K5 segments**
- **Usage:**
  - Segment map
  - Profile highlights

## 8. Theme Palette
- **Dark theme**: Main app
- **Light theme**: Topline section, stakeholder preference
- **Reservoir Red**: Brand color
- **PRISM Rainbow**: Brand color (rarely used, but present)
- **Usage:**
  - App backgrounds
  - Card and panel backgrounds
  - Typography
  - Button and link states

## 9. Benchmark Glyphs
- **US, R, D**: Color-coded icons
- **Usage:**
  - Topline and ROI tables

## 10. Miscellaneous
- **Map regions**: Census division coloring
- **Chart axes and gridlines**: Subtle color for readability
- **Disabled/Inactive states**: Grayed out or faded
- **Hover/Active states**: Highlighted or outlined

---

## Next Steps
- Review all components and CSS for additional color usage
- Propose a unified token system for all semantic colors
- Map all current colors to new tokens
- Plan for both dark and light mode support

---

*This inventory will be updated as the design system is refactored.*
