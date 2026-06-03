# PRISM HIV Dashboard — Design Strategy Proposal
_Prepared for stakeholder review · 2026-06-03_
_Scope: Design directions, data-visualization standards, rough wireframes_
_No code changes occur until one direction is approved._

---

## Context

The PRISM HIV Treatment & Prevention Dashboard is an audience-intelligence platform built around 16 psychographic segments. Its four primary views — Segment Map, Audience ROI, Message Map, and Segment Profile — are used by analysts and client teams to make strategic decisions about HIV messaging, coalition building, and campaign resource allocation.

The platform has two types of users:

1. **Analysts** (internal) who need to read fine-grained data accurately and quickly
2. **Clients / decision-makers** (Gilead-facing) who need to trust the data, understand the narrative, and feel confident presenting findings

Any design direction must serve both modes. These two goals are in tension, and each direction below resolves that tension differently.

---

## Direction A — Executive Intelligence Dashboard

### Visual Personality

_Bloomberg Terminal meets Palantir AIP._ A premium, data-dense, dark-on-dark analytical environment where the data itself provides all the color. Every element earns its presence. Nothing decorates. The palette communicates authority, precision, and institutional credibility.

**Intended audience:** Executives, senior strategists, high-trust client environments. Boardroom presentations. Situations where the platform needs to look as credible as the firm behind it.

**Strengths**
- Conveys analytical rigor without explaining itself
- High contrast data stands out sharply against the dark field
- Screen-sharing friendly — high contrast ratios look strong on projectors and conferencing tools
- Consistent with the current dark-mode codebase (evolution, not rewrite)
- Segment colors and tier signals carry immediately; nothing competes

**Risks**
- Can feel opaque or intimidating to non-technical stakeholders
- Dark environments require strict discipline — one off-palette color ruins it
- Accessibility requires careful contrast management (dark-on-dark text fails easily)
- Light-printing for PDF exports requires a separate pass

**Inspired by**
- Bloomberg Terminal (density, monospace typography, data-first)
- Palantir AIP (operational, purposeful, no decoration)
- Vercel Analytics (dark-mode analytics, clean hierarchy)
- Stripe Radar (precision, trust, financial-grade data presentation)
- Tableau dark dashboard templates (chart color discipline)

---

### Direction A — Color System

```
BACKGROUNDS
  Page background    #07090f   Near-black with blue undertone. Grounds everything.
  Card surface       #0d1119   One step lighter — clear but not harsh distinction.
  Card elevated      #111827   Cards that need more prominence (profile headers, KPI).
  Panel inset        #080b12   Slightly darker than page — used for embedded data areas.

  Rationale: Three-step dark ramp creates depth without glare. All values have blue
  undertones to keep the palette cohesive rather than muddy grey.

BORDERS
  Primary border     #1a2236   Subtle structural dividers.
  Active border      #2d3f5a   Borders on selected / focused states.
  Accent border      #22d3ee   Cyan — reserved for active navigation and key emphasis.

TEXT HIERARCHY
  Primary text       #e8edf5   Near-white. Main labels, data values, headings.
  Secondary text     #8fa3bc   Readable muted — used for descriptors, sub-labels.
  Tertiary text      #4a6080   Dim — axis labels, timestamps, legal copy.
  Disabled text      #2a3a4e   Only for truly unavailable states.

  Rationale: Four-step text ramp gives the page clear reading hierarchy without
  relying on weight alone. Secondary (#8fa3bc) is blue-tinted grey, not neutral.

SEGMENT IDENTITY COLORS
  Democratic blue    #2563eb   Fill. Strong, readable.
  Democratic stroke  #3b82f6   Border, text-on-fill.
  Democratic muted   #1d4ed8   Hover / dim states.

  Republican red     #dc2626   Fill.
  Republican stroke  #ef4444   Border, text-on-fill.
  Republican muted   #b91c1c   Hover / dim states.

  Rationale: Party colors are intentional, well-understood, and should not deviate.
  They are the most important categorical signal in the product.

TIER SIGNAL COLORS
  Tier 1 (priority)  #34d399   Emerald green. High-opportunity signal.
  Tier 1 bg          #052e1c   Dark emerald fill for badges.

  Tier 2 (moderate)  #fbbf24   Amber. Mid-range signal.
  Tier 2 bg          #431a01   Dark amber fill.

  Tier 3 (low)       #f87171   Soft red. Not "danger" — just lower priority.
  Tier 3 bg          #450a0a   Dark red fill.

  Rationale: Green/amber/red maps naturally to priority ranking without requiring
  explanation. All three have dark bg counterparts for inline badges.

DATA ACCENT PALETTE (charts, highlights, KPIs)
  Cyan               #22d3ee   Primary accent. Navigation active, key callouts.
  Violet             #a78bfa   Vector/fingerprint radars, secondary dimension.
  Rose               #fb7185   Warning data, negative deltas.
  Amber              #fbbf24   Caution / mid-tier / activation.
  Emerald            #34d399   Positive, Tier 1, high-value.
  Blue               #60a5fa   Coalition, government trust metric.
  Teal               #2dd4bf   Pharma trust metric (distinct from govt blue).

  Chart color order: Cyan → Violet → Emerald → Amber → Rose → Blue → Teal
  (Use this sequence when charting multiple non-party series.)

SUCCESS / STATUS
  Positive delta     #34d399   Green. Pre/Post improvement.
  Negative delta     #f87171   Rose. Pre/Post decline.
  Neutral / no move  #4a6080   Dim. No meaningful change.
```

---

### Direction A — Typography System

```
PRIMARY TYPEFACE: JetBrains Mono
  Role: Page titles, section headers, KPI values, data labels, navigation, badges
  Why: Monospace tabular numerics make data-dense layouts align perfectly.
       Slightly technical — appropriate for an analytics platform.
       Already loaded; consistency eliminates font-switching.

SECONDARY TYPEFACE: Nunito
  Role: Body copy (persona descriptions, methodology notes, tooltips, long-form text)
  Why: Humanist sans is warmer than Mono — balances the technical primary.
       Well-spaced at small sizes; survives dense layouts.

SCALE (Direction A)

  Page Title            JetBrains Mono  12px  700  tracking 3px   UPPERCASE
                        Example: AUDIENCE ROI

  Section Title         JetBrains Mono  11px  700  tracking 2px   UPPERCASE
                        Example: PERSUASION

  Sub-label / category  JetBrains Mono   9px  500  tracking 1px   UPPERCASE
                        Example: TIER 1 · GOP

  KPI large             JetBrains Mono  28px  700  tracking 0     number-only
                        Example: 1.07

  KPI small             JetBrains Mono  14px  700  tracking 0     with unit
                        Example: 28%

  Body copy             Nunito          12px  400  leading 1.6    sentence case
                        Example: They believe America's healthcare system is broken...

  Caption               Nunito          10px  400  leading 1.4    sentence case
                        Example: Based on n=1,200, PRISM HIV wave 2

  Table cell            JetBrains Mono  11px  600  tabular-nums   right-aligned (values)
                        Example: 13.2

  Axis label            JetBrains Mono   8px  400  tracking 0.5   UPPERCASE
                        Example: INFLUENCE

  Badge                 JetBrains Mono   8px  700  tracking 1px   UPPERCASE
                        Example: TIER 1
```

---

### Direction A — Layout System

```
GRID
  Max content width:  1400px
  Page padding:       28px left/right (desktop), 16px (tablet/mobile)
  Column gutter:      16px
  Row gutter:         16px

HEADER
  Height:             52px fixed
  Structure:          [Logo | Subtitle | ──── Nav ──── | Study Badge | Sign Out]
  Active indicator:   2px cyan bottom border on active nav item
  Background:         Card surface (#0d1119)
  Border:             1px #1a2236 bottom

PAGE HEADER (per-route)
  Pattern:            Title left, controls/legend right
  Bottom border:      1px #1a2236 separates header from content
  Margin bottom:      20px

CARDS
  Border-radius:      10px
  Border:             1px #1a2236
  Background:         Card surface (#0d1119)
  Shadow:             0 2px 12px rgba(0,0,0,0.45)
  Padding:            16px (standard), 12px (dense/data)
  Elevated variant:   background #111827, shadow 0 4px 20px rgba(0,0,0,0.6)

SPACING SCALE (multiples of 4)
  xs  4px   — badge padding, icon gap
  sm  8px   — label gap, tight card padding
  md  12px  — standard inner padding
  lg  16px  — card padding, section gap
  xl  20px  — between major sections
  2x  28px  — page padding, large section breaks

MOBILE BEHAVIOR
  < 768px   Main padding collapses to 16px. Nav wraps or becomes a hamburger.
            Dense data views (ROI grid, Message heatmap) show a horizontal scroll
            container with a scroll affordance indicator (gradient fade right).
            Profile page: grid becomes single column.
  < 480px   Typography scale drops one step. KPI cards stack vertically.
```

---

### Direction A — Data Visualization Standards

```
KPI CARDS
  Preferred:    Large number + unit + label + directional delta (arrow + value)
  Layout:       Number center-prominent, label below in caps, delta badge top-right
  Color rule:   Number inherits tier color (Tier 1=green, Tier 2=amber, Tier 3=rose)
  Avoid:        Gauge/speedometer, icon decoration, shadows on numbers

RANKINGS
  Preferred:    Sorted vertical bar (horizontal) with rank number left, value right
  Color rule:   Bars inherit party color (DEM/GOP) or tier color depending on context
  Always show:  Rank number (#1, #2...) as a label — don't make reader count bars
  Avoid:        Pie charts, donut charts for ranking (distorts at small differences)

ROI SCORECARDS
  Preferred:    Columnar grid (current implementation). Segment as column, metric as row.
                Each cell: value only — color carries the signal (good/mid/low tier)
  Enhancement:  Spark-mini bar (3px height) below each score to give directionality
  Color rule:   Cell background = tier background color at 30% opacity
                Cell value = tier text color at full opacity
  Avoid:        Color gradients on the values themselves (conflicts with party coding)

SEGMENT COMPARISON
  Preferred:    Horizontal grouped bars (if 2–4 metrics), or diverging bars for polarity
                Bubble/scatter for two-axis segment placement (Segment Map approach is correct)
  Color rule:   Always color by party first (DEM=blue, GOP=red). Secondary color = tier.
  Label:        Segment code (3 letters) always visible on or near data point
  Avoid:        Stacked bars for segments (hides individual comparison),
                radar charts as primary comparison (good as fingerprint, bad as comparison)

TRUST METRICS
  Preferred:    Horizontal bar rows (Pharma / Corp / Govt in same chart, always this order)
                Scale: 1–7 (or normalized 0–100% depending on study)
                Colors: Pharma=teal, Corp=blue, Govt=violet (consistent, never swapped)
  Always show:  Scale anchors (1 = Low trust, 7 = High trust)
  Avoid:        Stacked bar for trust (implies cumulative meaning it doesn't have)

MESSAGE PERFORMANCE (SoP heatmap)
  Preferred:    Current heatmap is correct. Matrix: message×segment, value in cell.
  Enhancement:  Row-level sparkline (total SoP per message) in a fixed column at left
                Column-level sparkline (segment average) in a fixed row at top
  Color scale:  Green-anchored (high SoP = green), red-anchored (low = red/dark)
                Never use a diverging scale here (0 is not a midpoint)
  Label rule:   Always show numeric value inside cell (not just color)
  Tooltip:      Show message full text on name hover (current behavior is correct)
  Avoid:        Choropleth color only without values (forces guessing)

HEATMAPS (general)
  Color scale:  Sequential only (one anchor color, varying luminance)
  Always:       Show values in cells
  Legend:       Show 5-step scale with actual breakpoints, not just "low/high"
  Avoid:        Dual-color diverging scales unless there is a meaningful zero midpoint

TABLES
  Header:       Bold, UPPERCASE, monospace, muted color
  Values:       Monospace, tabular-nums, right-aligned numbers, left-aligned text
  Alternating:  Subtle row alternation (card bg vs. page bg — no harsh stripe)
  Sort:         Always indicate sortable columns with cursor and icon
  Hover:        Row highlight (brightness 1.1) — subtle, not a full color change
  Avoid:        Borders on every cell (use whitespace instead)

TREND / DELTA INDICATORS
  Up delta:     +X.X format, emerald green, arrow optional (▲ or just sign)
  Down delta:   −X.X format, rose red, arrow optional (▼ or just sign)
  No change:    ±0.0, dim grey — never default to a color
  Always show:  Both pre and post values alongside the delta
  Avoid:        Delta only without context (reader can't evaluate magnitude)

UNCERTAINTY COMMUNICATION
  Preferred:    n-size label below or beside any percentage
                Confidence interval shown as a range "28–34%" when available
                Small n flagged with a footnote marker (†) defined below the chart
  Avoid:        Error bars on dark backgrounds (nearly invisible)
                Presenting percentages without sample context in client-facing views

WHAT TO AVOID EVERYWHERE
  - Pie charts (use bars — always)
  - 3D charts of any kind
  - Dual-axis line charts (ambiguous scale)
  - Gradient fills on bars
  - More than 7 colors in a single chart legend
  - Animations on data values (distracting in presentations)
  - Tooltips as the only source of a key data point
```

---

## Direction B — Healthcare Research Platform

### Visual Personality

_NEJM clinical data meets STAT News editorial intelligence._ A light or near-neutral-toned environment that communicates methodological rigor, peer-review credibility, and health equity consciousness. Every design choice echoes what a research director would feel comfortable including in a slide deck or policy brief. The palette says: "we use evidence, not opinion."

**Intended audience:** Public health researchers, clinical teams, policy advocates, healthcare administrators. Situations where the platform needs to look like something a health commissioner or hospital system would trust.

**Strengths**
- Immediately legible to healthcare-trained audiences (familiar aesthetic)
- Accessible — light mode handles WCAG AA contrast more naturally
- Prints cleanly (no dark-mode export problem)
- Methodology notes and footnotes feel at home (not out of place)
- Works in daylight conference rooms without the projector fight

**Risks**
- Can feel generic if not executed with precision
- Risk of looking like a standard SaaS tool (Tableau Public, Airtable) if not distinctive
- Light mode requires stronger color discipline — background noise competes with data
- May feel less premium or authoritative to executive audiences

**Inspired by**
- NEJM Evidence data visualizations (structured, restrained, credible)
- STAT News interactive graphics (editorial precision, purposeful color)
- Medidata Rave / Veeva Vault (clinical trial data platforms)
- Johns Hopkins COVID dashboard (trust-first, methodology-forward)
- IBM Carbon Design System (healthcare variant — white backgrounds, structured)

---

### Direction B — Color System

```
BACKGROUNDS
  Page background    #f4f6f9   Cool near-white. Not stark. Blue undertone avoids clinical harshness.
  Card surface       #ffffff   Pure white cards on the cool grey page — strong legibility.
  Card secondary     #f0f4f9   Slightly tinted cards for nested panels.
  Panel dark         #1b2b40   Rich navy — used for map canvases, radar backgrounds only.

  Rationale: White cards on a slightly tinted page creates the "published research" look.
  Pure white pages feel overly clinical. The navy inset panels hold data visualizations
  without the full dark-mode commitment.

BORDERS
  Primary border     #d1dae6   Soft blue-grey dividers.
  Active border      #1e40af   Navy — for selected states.
  Accent border      #0891b2   Cyan-teal — active navigation.

TEXT HIERARCHY
  Primary text       #0f1f35   Near-navy. Readable, professional, slightly warmer than black.
  Secondary text     #3d5a78   Blue-grey mid. Sub-labels, metadata.
  Tertiary text      #7b9ab5   Light-mid. Axis labels, captions.
  Disabled text      #b0c4d8   Very muted. Only for truly unavailable.

  Rationale: All text values have blue undertones, keeping the palette coherent
  with the cool-toned backgrounds. This also distinguishes the look from
  generic black-text analytics tools.

SEGMENT IDENTITY COLORS (adjusted for light backgrounds)
  Democratic blue    #1d4ed8   Darker blue — maintains contrast on white.
  Democratic fill    #dbeafe   Pale blue fill for cards/badges on white.

  Republican red     #b91c1c   Darker red — maintains contrast on white.
  Republican fill    #fee2e2   Pale red fill for cards/badges on white.

TIER SIGNAL COLORS
  Tier 1             #047857   Dark emerald on white.
  Tier 1 fill        #d1fae5   Light emerald fill.

  Tier 2             #b45309   Dark amber on white.
  Tier 2 fill        #fef3c7   Light amber fill.

  Tier 3             #b91c1c   Dark rose on white.
  Tier 3 fill        #fee2e2   Light rose fill.

DATA ACCENT PALETTE
  Primary accent     #0891b2   Cyan-teal. Nav active, KPI callouts.
  Secondary          #7c3aed   Violet. Fingerprint radars.
  Positive           #047857   Emerald.
  Warning            #b45309   Amber.
  Negative           #b91c1c   Rose.
  Blue (coalition)   #1d4ed8   Navy blue.
  Teal (pharma)      #0d9488   Teal.

  Chart color order: Cyan-teal → Navy blue → Emerald → Amber → Violet → Rose → Teal
```

---

### Direction B — Typography System

```
PRIMARY TYPEFACE: Inter (or Source Sans 3)
  Role: Everything structural — nav, headers, labels, body copy
  Why: Inter is the standard for credible research and analytics interfaces.
       Excellent at small sizes. WCAG-safe. Universally trusted.

SECONDARY TYPEFACE: JetBrains Mono
  Role: Data values, table cells, KPI numbers, axis labels, code/methodology notes
  Why: Mono for numbers — tabular alignment, no misreading. Kept as secondary
       to maintain analytical credibility without the full "terminal" personality.

SCALE (Direction B)

  Page Title            Inter           14px  700  tracking 0.5px  Title Case
                        Example: Audience ROI

  Section Title         Inter           12px  600  tracking 0       Title Case
                        Example: Persuasion & Positioning

  Sub-label             Inter           10px  500  tracking 0.3px  UPPERCASE
                        Example: TIER 1 · REPUBLICAN

  KPI large             JetBrains Mono  32px  700  tracking 0      number-only
                        Example: 1.07

  KPI small             JetBrains Mono  16px  700  tracking 0      with unit
                        Example: 28%

  Body copy             Inter           13px  400  leading 1.65    sentence case

  Caption               Inter           11px  400  leading 1.5     sentence case

  Table cell            JetBrains Mono  12px  500  tabular-nums    right-aligned (values)

  Axis label            Inter            9px  500  tracking 0.3    UPPERCASE

  Badge                 Inter            9px  600  tracking 0.5    UPPERCASE
```

---

### Direction B — Layout System

```
GRID
  Max content width:  1400px
  Page padding:       32px (desktop), 20px (tablet), 16px (mobile)
  Column gutter:      20px
  Row gutter:         20px

HEADER
  Height:             56px fixed
  Background:         White (#ffffff) with 1px #d1dae6 bottom border
  Left:               PRISM logo + wordmark
  Center:             Primary nav (Inter 11px 500 UPPERCASE, 40px hit targets)
  Right:              Study badge + user menu
  Active indicator:   2px #0891b2 bottom border on active nav item

PAGE HEADER (per-route)
  Layout:             Title (left) / breadcrumb (left) / primary action (right)
  Bottom separator:   1px #d1dae6 — heavier than card borders to anchor the section
  Margin bottom:      24px

CARDS
  Border-radius:      8px
  Border:             1px #d1dae6
  Background:         #ffffff
  Shadow:             0 1px 4px rgba(15,31,53,0.08)
  Padding:            20px (standard), 14px (dense/data)
  Highlighted:        1px #0891b2 left border (clinical "result" highlight)

SPACING SCALE
  xs  4px   — icon gap, badge padding
  sm  8px   — tight label/element gap
  md  12px  — internal card spacing
  lg  20px  — between card sections
  xl  28px  — between major page sections
  2x  40px  — page top padding

MOBILE
  Same principles as Direction A but with less visual cost — light mode
  doesn't collapse as harshly on small screens. Tables still need horizontal
  scroll containers with visible scroll indicators.
```

---

### Direction B — Data Visualization Standards

_(Same philosophy as Direction A with light-mode adjustments)_

```
ADAPTATION NOTES FOR LIGHT BACKGROUNDS

KPI CARDS
  Background:       Card white (#ffffff) with a left border in tier color
  Number:           Near-navy (#0f1f35) — let the left border carry color signal
  Delta badge:      Pill with light fill (green/red fill from tier palette)

HEATMAPS
  Color scale:      Light → dark (white = low SoP, saturated teal/green = high SoP)
  Grid:             Light grey cell borders (#e2ebf3) — visible without harsh lines
  Values:           Near-navy text in all cells

TRUST BARS
  Background track: #e8f1f8 — pale blue track instead of near-black
  Fill:             Cyan-teal for Pharma, Navy for Corp, Violet for Govt
  Labels:           Inter 10px #3d5a78

SEGMENT MAP
  Canvas:           Use navy panel (#1b2b40) as the SVG background — preserving the
                    "star field" aesthetic that helps bubbles pop
  Legend container: White card below the map (matching the rest of the page)
  Card popup:       White card with tier-color left border, drop-shadow

TABLES
  Header:           #f0f4f9 background, #0f1f35 text, 1px #d1dae6 bottom border
  Row hover:        #f4f7fb — very subtle
  Borders:          Only horizontal (row separators), no vertical column borders

ALL OTHER STANDARDS
  (Same chart type preferences, same delta indicators, same uncertainty rules as Direction A)
```

---

## Wireframes

> These wireframes are intentionally low-fidelity.
> Their purpose is to communicate information hierarchy, not visual finish.
> Box labels indicate the component type and rough content — not final copy.

---

### View 1 — Segment Map

```
Direction A (dark)         |   Direction B (light)
─────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────────┐
│ [LOGO] AUDIENCE INTELLIGENCE  [MAP] [ROI] [MESSAGES] [PROFILE]  [─] │  ← 52px header
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  AUDIENCE MAP                           ● DEM  ● GOP  Size=pop%    │  ← page header
│  16 PRISM segments · click to preview  ─────────────────────────── │
│                                                                     │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │                SVG BUBBLE MAP CANVAS                          │   │
│ │                                                               │   │
│ │  DEMOCRATIC SEGMENTS      │        REPUBLICAN SEGMENTS        │   │
│ │                           │                                   │   │
│ │   ○ UCP(11%)  ○ FJP(10%) │  ○ WE(9%)  ○ CEC(7%) ○ TC(6%)   │   │
│ │   ○ HAD(8%)   ○ HCP(8%)  │  ○ MFL(5%) ○ VS(5%)  ○ PP(3%)   │   │
│ │   ○ HCI(7%)   ○ GHI(10%) │  ○ HHN(3%) ○ TSP(2%) ○ HF(2%)  │   │
│ │                           │  ○ PFF(4%)                       │   │
│ │                           │                                   │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                             [ACTIVE BUBBLE: CEC selected]           │
│              ┌──────────────────────────────┐                       │
│              │  [CEC PERSONA CARD IMAGE]    │                       │
│              │  Consumer Empowerment Champs │  ← floats on hover   │
│              │  Click to open full profile →│                       │
│              └──────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────┘

HIERARCHY INTENT:
  1. Map canvas dominates — full width, ~60% of page height
  2. Header provides orientation instantly (title + legend)
  3. Persona card appears on select, floats above canvas
  4. Single click = preview, double click = navigate to profile
```

---

### View 2 — Audience ROI

```
┌─────────────────────────────────────────────────────────────────────┐
│ [LOGO] AUDIENCE INTELLIGENCE  [MAP] [ROI] [MESSAGES] [PROFILE]  [─] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  AUDIENCE ROI            ● TIER 1 (priority)  ● TIER 2  ● TIER 3  │  ← tier legend right
│  ROI = Pop × (Persuasion + Coalition + Activation + Influence) ──── │
│                                                                     │
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │                 SCROLLABLE ROI GRID                              ││
│ │                                                                  ││
│ │  ┌──────────────┬──────────────────────── GOP ──────────────────┤│
│ │  │              │  TC    CEC    WE    HHN   TSP   HF   PFF   VS ││
│ │  │              │ T1     T1     T1    T1    T3    T1   T2    T3 ││
│ │  ├──────────────┼────────────────────────────────────────────── ││
│ │  │ ROI SCORE    │ 1.13  1.07   1.08  1.05  1.02  0.88  0.95  0.89││
│ │  ├──────────────┼────────────────────────────────────────────── ││
│ │  │ PERSUASION   │ [donut+bar] [donut+bar] [donut+bar]  ...      ││
│ │  │              │                                                ││
│ │  ├──────────────┼────────────────────────────────────────────── ││
│ │  │ [▸ PRE/POST] │  (toggle to expand pre/post delta section)    ││
│ │  ├──────────────┼────────────────────────────────────────────── ││
│ │  │ COALITION    │ [donut] [donut] [donut] ...                   ││
│ │  ├──────────────┼────────────────────────────────────────────── ││
│ │  │ ACTIVATION   │ [donut] [donut] [donut] ...                   ││
│ │  ├──────────────┼────────────────────────────────────────────── ││
│ │  │ INFLUENCE    │  18%    7%     11%   24%  ...                 ││
│ │  └──────────────┴────────────────────────────────────────────── ││
│ │                    ← GOP party divider | DEM continues →        ││
│ └──────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘

HIERARCHY INTENT:
  1. Tier legend in header — reader knows the ranking system before the grid loads
  2. ROI score row is the first data row — biggest numbers, largest font
  3. Persuasion is the most complex row — positioned early while reader is fresh
  4. Pre/Post is collapsed by default (too dense for first read) — toggle expands
  5. Coalition, Activation, Influence follow as supporting evidence
  6. Segment headers: code (large) + full name (small) + pop% + tier badge
```

---

### View 3 — Message Map

```
┌─────────────────────────────────────────────────────────────────────┐
│ [LOGO] AUDIENCE INTELLIGENCE  [MAP] [ROI] [MESSAGES] [PROFILE]  [─] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  MESSAGE MAP                          [CONTROL] [PERSONA VARIANTS]  │  ← toggle in header
│  Share of Preference · MaxDiff · 20 messages · 16 PRISM segments ── │
│                                                                     │
│  SoP: [■ ≤6] [■ 7–8] [■ 9–10] [■ 11–12] [■ ≥13]  THEME: [●L] [●S]│  ← legend row
│                                                                     │
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │  HEATMAP TABLE                                                   ││
│ │                                                                  ││
│ │  ┌──┬──────────────────┬──────┬─────┬───── GOP ─────┬── DEM ───┐││
│ │  │# │  MESSAGE          │THEME │ ALL │TC CEC WE ...  │UCP FJP..│││
│ │  ├──┼──────────────────┼──────┼─────┼───────────────┼─────────┤││
│ │  │1 │ Economic Security │ECON  │ 9.2 │[cell][cell]...│[cell].. │││
│ │  │2 │ Innovation Speed  │INNOV │11.4 │[cell][cell]...│[cell].. │││
│ │  │3 │ Patient Access    │PAT   │ 7.8 │[cell][cell]...│[cell].. │││
│ │  │  │ ...               │      │     │               │         │││
│ │  │20│ Treatment Equity  │EQ    │13.1 │[cell][cell]...│[cell].. │││
│ │  └──┴──────────────────┴──────┴─────┴───────────────┴─────────┘││
│ │                                                                  ││
│ │  [hover over message name → tooltip with full message text]      ││
│ │  [click column header → sort by segment SoP descending]          ││
│ └──────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘

HIERARCHY INTENT:
  1. Page header establishes methodology context upfront (SoP, MaxDiff)
  2. Mode toggle is in the header — not buried below the table
  3. Legend row immediately below header — reader knows color scale before seeing data
  4. Table has fixed message name column (scrollable horizontally across segments)
  5. TOTAL column is first data column — provides immediate reference before segment breakdown
  6. GOP/DEM group headers span their segment columns — party framing always visible
```

---

### View 4 — Segment Profile

```
┌─────────────────────────────────────────────────────────────────────┐
│ [LOGO] AUDIENCE INTELLIGENCE  [MAP] [ROI] [MESSAGES] [PROFILE]  [─] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  AUDIENCE PROFILES     [TSP][CEC][TC][WE][PP][HF][PFF][HHN][MFL]  │  ← selector right
│  16 PRISM segments · HIV study ─── [VS][UCP][FJP][HCP][HAD][HCI][GHI]│
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  ○ CEC  CONSUMER EMPOWERMENT CHAMPIONS   [GOP] [7%] [TIER 1] │  │  ← persona header
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ "Prices are too high and we need reform. We don't need more  │  │  ← quote card
│  │  government programs — we need to empower consumers."        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────┐  ┌─────────────────────────────┐  ┌────────┐ │
│  │ VECTOR           │  │ PERSONA NARRATIVE            │  │  ROI   │ │
│  │ FINGERPRINT      │  │                              │  │  CARD  │ │
│  │                  │  │ ◆ What They Believe          │  │        │ │
│  │  [radar chart]   │  │ (body text)                  │  │  1.07  │ │
│  │                  │  │                              │  │  ROI   │ │
│  │  [diverging bars]│  │ ◆ What They Want             │  │ ─────  │ │
│  │                  │  │ (body text)                  │  │ 28% Hi │ │
│  └──────────────────┘  │                              │  │  ████░ │ │
│                        │ ◆ What They Do               │  │ 60% Su │ │
│                        │ (body text)                  │  │  ████░ │ │
│                        │                              │  │ 12% Ac │ │
│                        │ ◆ Who They Are               │  │  ██░░░ │ │
│                        │ (body text)                  │  │  7% In │ │
│                        └─────────────────────────────┘  └────────┘ │
│                                                                     │
│  [DEMO] [HIV] [BELIEFS] [IDEOLOGY] [TRUST] [EXPERIENCE] [WELLNESS]  │  ← tab strip
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  [Active tab content panel — demographics, HIV data, etc.]         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

HIERARCHY INTENT:
  1. Segment selector at top-right of header — always accessible, doesn't consume page space
  2. Persona header: code + full name + party badge + pop% + tier badge — all in one row
  3. Quote card: the single most evocative sentence — gets its own visual frame, first read
  4. Three-column body:
     Left:   Vector Fingerprint (360° ideological map — where do they sit?)
     Center: Persona Narrative (who are they in words — 4 quadrants)
     Right:  ROI Card (why do they matter to this study — numbers)
  5. Tab strip: secondary content — demographics, beliefs, etc. — below the fold
  6. Tab content: full-width panel, fills available space below tabs
```

---

## Recommendation

**Direction A — Executive Intelligence Dashboard** is the stronger fit for this platform.

### Why

**The user is making resource allocation decisions, not publishing research.**

The PRISM HIV dashboard exists to answer: _which segments should we invest in, which messages do we lead with, and why?_ These are strategic decisions with dollar-amount consequences. The platform's aesthetic needs to communicate: "these recommendations are backed by rigorous methodology and we stand behind them."

Direction A's dark, analytical visual language achieves this without a single word of explanation. A Gilead executive seeing the dashboard for the first time should feel the same confidence they feel opening a Bloomberg terminal or a Palantir briefing — "this is serious infrastructure, built by people who know what they're doing."

Direction B is excellent and should not be abandoned. It is the better choice if PRISM ever develops a research-publication workflow, a public-facing equity tool, or a light-mode PDF export product. The light-mode aesthetic also pairs well with healthcare partners who are compliance-sensitive about screen-sharing (dark screens can trigger recording concerns in some settings).

**Recommended path:**
- Implement Direction A as the primary theme.
- Preserve the infrastructure for a Direction B "light mode" toggle that can be activated per-client without rebuilding the application.
- Lock color tokens as CSS custom properties (`--bg`, `--card`, etc.) so theme switching is a root-variable swap, not a redesign.

### One concession from Direction B to carry into Direction A

Direction B's treatment of **body copy** (Inter 13px, generous leading) is superior to the current all-monospace approach for persona narratives and long descriptions. Adopt Inter (or keep Nunito) as the body copy face for the Profile page's narrative panels. Monospace everywhere is technically correct but taxes the reader over long text.

---

_Prepared for stakeholder review. No production code was changed._
_Next step: select a direction, approve the color and typography system,_
_then schedule implementation sprints by phase._
