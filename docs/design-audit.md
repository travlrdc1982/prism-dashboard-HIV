# PRISM HIV Dashboard — Design Audit
_Branch: design/dashboard-polish · Audited 2026-06-02_

---

## Route: `/` — Segment Map

| Check | Finding |
|---|---|
| Hierarchy clear? | ⚠ No page title or subtitle — user lands on a raw SVG map with no context |
| Self-explains in 3 sec? | ⚠ Barely. The party labels inside the SVG are 25%-opacity watermarks, not visible orientation |
| Cards aligned? | ✓ Card popup positions correctly for GOP/DEM halves |
| Labels readable? | ⚠ Bubble text is JetBrains Mono all-caps at very small sizes — strains at normal viewing distance |
| Charts too cramped? | ✓ SVG map has good proportional spacing |
| Colors consistent? | ✓ DEM/GOP blue/red is clearly coded |
| Mobile breaks? | ⚠ SVG scales but no mobile fallback; card popup overflows at narrow widths |
| Client-ready? | ⚠ Needs a page title, a brief intro line, and a better legend |

**Key fixes:** Add `PageHeader` with title + 1-line purpose. Make the legend slightly bigger and more polished. Increase card popup opacity and drop-shadow.

---

## Route: `/roi` — Audience ROI

| Check | Finding |
|---|---|
| Hierarchy clear? | ⚠ Page title is 14px monospace uppercase — visually it reads as a label, not a header |
| Self-explains in 3 sec? | ⚠ Formula line is 9px — too small to anchor the page visually |
| Cards aligned? | ✓ Grid is well-aligned; fixed row heights keep columns consistent |
| Labels readable? | ✗ Section row labels (Persuasion, Coalition, Activation, Influence) are 9–10px, tier badges 7px |
| Charts too cramped? | ⚠ 62px column width is intentionally tight — pre/post delta rows at 6–8px are genuinely hard to scan |
| Colors consistent? | ⚠ Local `C` palette in AudienceROI.jsx diverges slightly from `src/data/theme.js` |
| Mobile breaks? | ⚠ Horizontal scroll is present but nav bar clips |
| Client-ready? | ⚠ Strongest client-facing page — needs a stronger title area and tier call-outs |

**Key fixes:** Bump page title to a proper heading size. Add tier legend / summary row above the grid. Improve row label font sizes to 10–11px minimum.

---

## Route: `/messages` — Message Map

| Check | Finding |
|---|---|
| Hierarchy clear? | ⚠ No visible page title — the description paragraph doubles as the header |
| Self-explains in 3 sec? | ✓ Heatmap is immediately recognizable once seen |
| Cards aligned? | ✓ Table structure is solid |
| Labels readable? | ⚠ Legend labels 7px; segment header names 6px — too small for quick scanning |
| Charts too cramped? | ⚠ Message name column truncates on narrower viewports |
| Colors consistent? | ✓ Theme/party colors are consistent |
| Mobile breaks? | ⚠ Wide table requires horizontal scroll; no summary view for mobile |
| Client-ready? | ⚠ Needs a page title and better visual distinction between CONTROL/PERSONA modes |

**Key fixes:** Add page title (`MESSAGE MAP`) with subtitle (SoP methodology note). Make mode toggle more prominent. Bump legend and segment header font sizes.

---

## Route: `/profile` — Segment Profile

| Check | Finding |
|---|---|
| Hierarchy clear? | ⚠ Segment selector is functional but not visually prominent; persona quote is the first strong visual |
| Self-explains in 3 sec? | ✓ Persona card + quote makes the page legible quickly |
| Cards aligned? | ⚠ Some panels use tight inline styles that don't match others visually |
| Labels readable? | ⚠ Mixed font families and size inconsistencies throughout (Nunito, Roboto, JetBrains Mono competing) |
| Charts too cramped? | ⚠ Demographics grid is dense; pre/post bars compete with radar chart for space |
| Colors consistent? | ⚠ Local `C` in SegmentProfile.jsx partially diverges from theme.js |
| Mobile breaks? | ⚠ Persona header row overflows at tablet width |
| Client-ready? | ⚠ Persona content is rich and compelling — needs cleaner card frames to carry it |

**Key fixes:** Strengthen segment selector (clearer active state). Tighten persona header spacing. Make the key-metrics row (ROI / Supporters / Activation / Influence) a clean KPI strip. Ensure card panels use consistent border/radius/bg.

---

## Global Issues

| Issue | Impact |
|---|---|
| Google Fonts `<link>` is inside `Shell.jsx` component body — fires after render | Slight FOUT; should be in `index.html <head>` |
| 7 fonts loaded (DM Sans, JetBrains Mono, Quicksand, Poppins, Nunito, Roboto, Roboto Slab) | Unnecessary load; Nunito + JetBrains Mono cover all use cases |
| Each page defines its own local `C` palette (minor divergence from `theme.js`) | Visual inconsistency across pages; cards look slightly different tones |
| No consistent page-header component — each page rolls its own title style | Hierarchy breaks when switching pages |
| Active nav state: only `fontWeight 500` vs `300` and a subtle grey bg | Too subtle; hard to tell which page you're on |
| Focus states: none visible on nav links, buttons | Accessibility gap |

---

## Priority Order for Implementation

1. **index.html** — move fonts, trim to Nunito + JetBrains Mono
2. **Shell.jsx** — proper active indicator, hover state, focus rings
3. **Shared PageHeader component** — consistent title + subtitle across all routes
4. **AudienceROI** — stronger heading, tier legend strip
5. **MessageMap** — page title, mode toggle prominence
6. **SegmentMap** — page title + legend upgrade
7. **SegmentProfile** — KPI strip, card consistency
8. **Responsive + a11y pass**
