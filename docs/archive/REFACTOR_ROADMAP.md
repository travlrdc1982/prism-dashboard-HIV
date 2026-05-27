# PRISM HIV Dashboard: Cleanup Priorities & Refactor Roadmap (May 2026)

## Overview
This document prioritizes all refactor work based on dependencies, impact, and risk. It serves as a sequencing guide for the multi-sprint cleanup effort.

---

## Refactor Tiers

### Tier 1: Foundation (Must Complete First)
These are blocking issues and must be resolved before later work.

#### 1.1 Design System & Theme Framework (FIRST PRIORITY)
- **What:** Create unified design tokens (colors, typography, spacing, shadows) with dark/light variants
- **Why:** All other UI work depends on this; prevents further theme drift
- **Duration:** 6–8 hrs
- **Blocks:** Component cleanup, responsive adaptation, future studies
- **Risk:** High (if done wrong, affects entire UI)
- **Deliverable:** `src/data/designTokens.js` + theme documentation

#### 1.2 Component Design Library (HIGH PRIORITY)
- **What:** Refactor shared UI building blocks (buttons, cards, tables, badges, panels) using unified tokens
- **Why:** Eliminates inline styling and reduces duplication
- **Duration:** 8–10 hrs
- **Blocks:** Page-level refactor; responsive work
- **Risk:** Medium (large scope but isolated)
- **Deliverable:** `src/components/ui/` (Button, Card, Table, Badge, Panel, etc.)

#### 1.3 Data Layer Consolidation (HIGH PRIORITY)
- **What:** Extract all embedded static data from components into `src/data/`
  - Duplicate segments arrays (segments.js vs SegmentProfile.jsx)
  - Inline ROI/PrePost tables (SegmentProfile.jsx)
  - Chart/visualization data
- **Why:** Prevents drift, simplifies testing, supports multi-study architecture
- **Duration:** 6–8 hrs
- **Blocks:** Data pipeline integration, future studies
- **Risk:** Medium (requires careful extraction)
- **Deliverable:** Clean `src/data/` structure with all static data

#### 1.4 Responsive Design System (MEDIUM PRIORITY)
- **What:** Add media queries and responsive rules for tablet (1024–1200px)
  - Remove hard-coded widths (especially HIVTab 1600px)
  - Establish breakpoints
  - Adapt tables/grids
- **Why:** Enables tablet/presentation use case
- **Duration:** 6–8 hrs
- **Blocks:** Demo readiness, client presentations
- **Risk:** Low (mostly CSS; no logic changes)
- **Deliverable:** `src/styles/responsive.css` + updated component layouts

---

### Tier 2: Structural Cleanup (After Foundation)
These can happen once Tier 1 is stable.

#### 2.1 Page Component Refactor (AudienceROI, MessageMap, etc.)
- **What:** Break apart large monolithic page files (1000–2000 lines) into smaller subcomponents
- **Why:** Improves maintainability, testability, and readability
- **Duration:** 10–12 hrs total (2–3 hrs per page)
- **Blocks:** Future feature work
- **Risk:** Medium (requires careful decomposition)
- **Order:**
  1. AudienceROI (most reusable components)
  2. SegmentProfile (largest file; most data extraction)
  3. MessageMap (complex grid logic)
  4. IdeologyHeatmap (visualization-heavy)

#### 2.2 Data Pipeline Integration
- **What:** Wire up the half-built pipeline (create_template.py → convert_study.py → study.js)
- **Why:** Enables sustainable data import workflow for future studies
- **Duration:** 8–10 hrs
- **Blocks:** Multi-study deployment
- **Risk:** Medium (requires understanding of dual pipelines)
- **Deliverable:** Working pipeline + validation

#### 2.3 HIV Persona Profile Tab Refactor (ReactJS Conversion)
- **What:** Convert imperative SVG (hiv_tab_v5.html) to React component
- **Why:** Consolidates tab into main app; easier to maintain
- **Duration:** 6–8 hrs
- **Blocks:** Unified HIV tab in main navigation
- **Risk:** HIGH (fragile SVG positioning; must preserve math exactly)
- **Caution:** Test extensively; verify viewBox and positioning formulas

---

### Tier 3: Optimization & Polish (Later Phases)
These improve experience but aren't blocking.

#### 3.1 Accessibility & ARIA Support
- **Duration:** 4–6 hrs
- **Priority:** Medium (nice-to-have for stakeholders)

#### 3.2 Performance & Bundle Optimization
- **Duration:** 3–5 hrs
- **Priority:** Low (current perf is acceptable)

#### 3.3 Visualization Component Library
- **Duration:** 8–10 hrs
- **Priority:** Medium (reusable charts, heatmaps, radars)

---

## Recommended Execution Order

### Sprint 1 (Now — May 20–24) — Theme & Foundation
1. **Design System Framework** (6–8 hrs) ← START HERE
2. **Component Design Library** (8–10 hrs)
3. Responsive Design System (6–8 hrs)
4. **Phase Total: 20–26 hrs** (roughly 4–5 days)

### Sprint 2 (May 25–31) — Data & Structure
1. **Data Layer Consolidation** (6–8 hrs)
2. **Data Pipeline Integration** (8–10 hrs)
3. **Phase Total: 14–18 hrs** (roughly 3 days)

### Sprint 3 (June 1–7) — Component Refactor
1. **Page Component Refactor** (10–12 hrs)
   - AudienceROI, SegmentProfile, MessageMap, IdeologyHeatmap
2. **Phase Total: 10–12 hrs** (roughly 2 days)

### Sprint 4+ (June 8+) — Specialized Work
1. HIV Persona Profile Tab Refactor (6–8 hrs)
2. Accessibility & Polish (4–6 hrs)
3. Optimization (3–5 hrs)

---

## Critical Path

The **critical path** (must complete in sequence):
1. Design System Framework → **required by everything**
2. Component Design Library → **required by page refactor**
3. Data Layer Consolidation → **required by future studies**
4. Responsive Design System → **can run in parallel with #2**

Everything else can be reordered based on priority or client needs.

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **SVG positioning breaks** (HIV Tab) | Extract and test positioning math separately; create unit tests |
| **Data duplication missed** | Use grep to find all embedded datasets before consolidation |
| **Responsive breaks desktop** | Establish min-width constraints; test at multiple breakpoints |
| **Theme drift on light/dark** | Create a unified token system first; style-guide enforcement |
| **Pipeline still broken** | Document current pipeline; test with sample study before wiring |

---

## Success Criteria (by End of Sprint 1)
- ✅ Design tokens system created and documented
- ✅ Unified dark/light theme variants functional
- ✅ All inline styling replaced with token references
- ✅ Component library provides reusable UI building blocks
- ✅ Responsive breakpoints tested at 1024, 1200, 1400px widths
- ✅ No visual regression from current state
- ✅ All changes tracked in `refactor/phase1` branch

---

## Dependencies & Blockers
- **Supabse credentials fix:** ✅ DONE (doesn't block anything else)
- **Design tokens:** REQUIRED for component work
- **Component library:** REQUIRED for page refactor
- **Data consolidation:** REQUIRED for multi-study support
- **Pipeline integration:** REQUIRED for sustainable data import

---

*This roadmap will be updated as work progresses. Adjust priorities based on client feedback or discovered issues.*
