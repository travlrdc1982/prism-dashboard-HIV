# PRISM HIV Dashboard: Tablet Responsiveness Assessment (May 2026)

## Executive Summary
The dashboard is currently **desktop-only** with minimal responsive design. It has no media queries for tablet breakpoints, fixed widths in some components (e.g., HIV tab at 1600px), and heavy reliance on horizontal scrolling. For tablet/presentation scenarios (iPad/iPad Pro, ~1024-1200px width), significant adjustments are needed.

---

## Current State

### Layout Strategy
- **Main containers:** Use `maxWidth` (1300–1650px) with `margin: 0 auto` centering
- **Responsive elements:** Mostly flex-based, but no breakpoint adjustments
- **Problem areas:**
  - No media queries for tablet breakpoints
  - Some components have hard-coded widths (HIVTab: `width: 1600px`)
  - Heavy use of horizontal tables and grids that don't collapse

### CSS Media Queries
- **Print media only:** Only `@media print` rules exist (Topline component)
- **No screen breakpoints:** No responsive design for tablets or smaller screens
- **Scrolling:** Reliance on horizontal scrolling for dense data visualization

### Key Components & Their Issues

| Component | Issue | Impact |
|-----------|-------|--------|
| **AudienceROI** | Fixed `maxWidth: 1300px`, inline styles with flex but no stacking rules | Horizontal scroll on tablets; dense table doesn't adapt |
| **MessageMap** | Wide tables (up to 1650px), many columns | Requires horizontal scroll on tablets |
| **SegmentProfile** | Large inline data, sidebar navigation, potentially oversized panes | May overflow on narrow tablets |
| **IdeologyHeatmap** | `maxWidth: 1500px`, fixed column widths (58px min/max) | Grid doesn't adapt; text squishes |
| **HIVTab** | **Hardcoded `width: 1600px`** on `.hiv-tab-root` | Will not shrink; forces horizontal scroll |
| **Shell (Top Nav)** | Uses flex with no collapsing; nav items don't stack | Wraps awkwardly on narrow screens |
| **Topline** | Light theme with sticky nav, designed for wider screens | Topline dashboard doesn't adapt to tablet |

### Positive Elements
- Flex-based layouts are responsive-friendly in principle
- No absolute positioning (mostly)
- Containers use margin auto centering, which is good
- Font sizes are reasonable (not too large)

---

## Tablet Scope Definition

### Target Devices
- **iPad (10.2", 1024×768)** — minimum viable
- **iPad Air (10.9", 1440×1080)** — preferred
- **iPad Pro 11" (1668×2388)** — stretch target
- **Presentation/demo laptops** in portrait or rotated orientation

### What "Responsive for Tablet" Means (NOT Mobile)
- ✅ Layouts should adapt to 1024–1200px widths without horizontal scroll
- ✅ Tables may need truncation, abbreviation, or collapsing columns
- ✅ Dense visualizations (charts, heatmaps) should remain readable
- ✅ Navigation should be accessible without extra taps
- ✅ Zoom should not be required (100% viewport)
- ❌ NOT optimizing for phones (<768px)
- ❌ NOT mobile-first; desktop-first approach is fine
- ❌ NOT full gesture/touch optimization (e.g., bigger buttons)

---

## Scope of Work: Tablet Responsiveness Sprint

### Phase 1: Establish Breakpoints & Media Queries (1–2 hrs)
1. Define breakpoints:
   - `@media (max-width: 1200px)` — tablet down
   - `@media (max-width: 1024px)` — smaller tablet
2. Create a new `responsive.css` or add media blocks to existing files
3. Test at common tablet sizes (1024, 1200, 1440)

### Phase 2: Fix Hard-Coded Widths (1–2 hrs)
1. Remove or make flexible:
   - HIVTab `.hiv-tab-root` hard width 1600px
   - Any `width:` in fixed pixel values
2. Use `max-width` and `width: 100%` instead
3. Ensure containers can shrink below 1600px

### Phase 3: Table & Grid Adaptation (2–3 hrs)
1. **AudienceROI:**
   - Reduce column widths or hide less-critical columns
   - Consider abbreviations (ROI → R, Persuadability → Perp)
   - Stack pre-post rows if space is tight
2. **MessageMap:**
   - Consider horizontal scroll within a container (not full page)
   - Or hide lower-priority persona variants at tablet size
3. **SegmentProfile:**
   - Review pane layout; may need to stack sidebars
   - Adjust card heights/spacing if needed
4. **IdeologyHeatmap:**
   - May need to reduce grid size or use horizontal scroll within bounds

### Phase 4: Navigation & Top Bar (1 hr)
1. Shell nav: ensure items wrap or abbreviate at tablet width
2. Top nav should remain sticky and accessible
3. Logo/brand shouldn't shrink too small

### Phase 5: Testing & Refinement (1–2 hrs)
1. Manual testing at 1024, 1200, 1440 widths
2. Check scroll behavior; confirm no unintended horizontal scroll
3. Verify charts render correctly
4. Ensure text is readable (no excessive truncation)

---

## Estimated Effort
**Total: 6–10 hours** (depending on how aggressive the compression needs to be)

- If minimal adaptation (just shrinking containers): **6–7 hours**
- If moderate adaptation (hiding some columns, abbreviating): **8–10 hours**
- If aggressive (restructuring tables, stacking panes): **10–14 hours**

---

## Known Constraints
- ⚠️ Dense visualization dashboards are inherently wide; tablet viewing will involve some compromise
- ⚠️ The three-way tables (ROI, PrePost, etc.) are information-dense and may not fit cleanly at tablet sizes
- ⚠️ Charts (scatterplot, radar, heatmap) need minimum sizes to be readable
- ⚠️ Message Map has up to 2,000 cells; horizontal scrolling within a container may be necessary

---

## Success Criteria
- ✅ Dashboard renders at 1024px width without horizontal page scroll
- ✅ Tables are readable (possibly abbreviated or with horizontal scroll within container)
- ✅ Navigation is accessible and doesn't overflow
- ✅ Charts/visualizations remain legible
- ✅ No broken layouts or text overlap
- ✅ Works well on iPad in landscape mode (1200+px)

---

## Recommendation
For the **first pass**, focus on:
1. Removing hard-coded widths (especially HIVTab)
2. Establishing tablet breakpoints (1024, 1200)
3. Adjusting container widths and padding
4. Testing at 1200px (iPad landscape) as primary target

A second pass can handle more aggressive compression (column hiding, abbreviations) once core responsiveness is confirmed.

---

*This assessment will be updated as tablet-responsive changes are implemented.*
