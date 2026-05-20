# PRISM Dashboard HIV — Audit Report & Architecture Review
**Date:** May 18, 2026  
**Audit Window:** Friday, May 15 — Friday, May 18 (6–8 hours available)  
**Scope:** React SPA codebase audit focusing on data dependencies, theme consistency, hardcoded values, repeated layout logic, responsive design, and accessibility.

---

## Executive Summary

The PRISM Dashboard HIV project is a React SPA built with Vite, react-router-dom, and Supabase for authentication. The application provides audience segmentation and health messaging analytics across 16 demographic/ideological segments.

**Current State:** Functional but shows signs of rapid prototyping—multiple styling systems coexist, large inline datasets bloat component files, color constants are duplicated across modules, and theme usage is inconsistent. The codebase has good domain logic but needs architectural cleanup for maintainability and scalability.

**Audit Grade:** **C+ / B–** (Functional + maintainable baseline, but significant technical debt in styling, data organization, and accessibility.)

**Key Findings:**
- ✅ Well-structured routing and auth flows
- ⚠️ Mixed theme systems (dark app theme vs. light Topline CSS)
- ⚠️ Embedded static data in components (duplication, poor reusability)
- 🔴 **CRITICAL:** Supabase anon key exposed in repo
- ⚠️ Extensive inline styles and scattered font declarations
- ⚠️ No media queries or responsive breakpoints
- ⚠️ Minimal accessibility (missing ARIA labels, semantic HTML gaps)

**Recommended Action:** Execute the prioritized remediation plan below over 2–4 sprints, starting with security and quick wins. A focused 6–8 hour initial sprint can address ~60% of issues.

---

## Detailed Findings

### 1. **CRITICAL: Security — Exposed Credentials**

#### Issue
[src/supabaseClient.js](src/supabaseClient.js) contains hardcoded Supabase URL and anonymous API key in the repository:
```javascript
const supabaseUrl = "https://zviodrqsrawcxtqcorst.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

#### Risk Level
**HIGH** — Anon keys are meant to be public, but storing them in version control violates security best practices and makes credential rotation difficult.

#### Remediation
**Priority:** Immediate (within 24 hours)
1. Move to `.env.local` (development) and `.env.production` (if deploying).
2. Update `supabaseClient.js` to read from environment variables:
   ```javascript
   const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
   const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
   ```
3. Add `.env.local` to `.gitignore`.
4. Document `.env.example` with placeholder values.
5. Rotate the exposed anon key in Supabase dashboard.

#### Time Estimate
30 minutes

---

### 2. **HIGH: Theme & Styling — Multiple Systems Coexist**

#### Issue
The application uses **three distinct styling systems:**

- **System 1 (App Dark Theme):**  
  - `src/index.css`: global dark background (`#080c16`), light text.  
  - `src/data/theme.js`: exports color palette `C` (dark theme colors).  
  - Used inconsistently across pages.

- **System 2 (Local Color Palettes):**  
  - `src/pages/SegmentMap.jsx`: local `DEM_FILL`, `GOP_FILL`, etc.  
  - `src/pages/AudienceROI.jsx`: local `C` palette (shadows app theme).  
  - `src/pages/MessageMap.jsx`: local `THEME_COLORS` and `PARTY_COLOR`.  
  - **Problem:** Duplicates or shadows central theme; makes updates error-prone.

- **System 3 (Topline Light Theme):**  
  - `src/components/Topline/Topline.css` (513 lines): light background, light text, ported from HTML prototype.  
  - Uses independent `:root` CSS variables (`--bg: #fff`, `--ink: #0f172a`, etc.).  
  - **Problem:** Conflicts with dark app theme; hard to maintain two systems.

#### Impact
- Design inconsistencies and theme drift over time.
- Difficult to implement global theme changes (e.g., rebrand colors, dark mode toggle).
- Increased cognitive load when onboarding new developers.

#### Root Cause
Rapid prototyping; Topline was ported from an HTML template with its own styling; color constants were added ad-hoc to pages without centralizing.

#### Remediation (Priority: HIGH)

**Phase 1 (Quick Win): Consolidate color constants** (~30 mins)
- Add to [src/data/theme.js](src/data/theme.js):
  ```javascript
  export const COLORS = {
    party: { GOP: "#ef4444", DEM: "#3b82f6" },
    tier: { 1: "#34d399", 2: "#eab308", 3: "#ef4444" },
    viz: {
      persuasion: "#5b93c7",
      activation: "#a78bfa",
      influence: "#818cf8",
      coalition: "#3b82f6",
    },
    sentiment: { positive: "#34d399", neutral: "#94a3b8", negative: "#ef4444" },
  };
  export const PALETTES = { THEME_COLORS: { ... }, ... };
  ```
- Update [src/pages/SegmentMap.jsx](src/pages/SegmentMap.jsx), [src/pages/MessageMap.jsx](src/pages/MessageMap.jsx), [src/pages/AudienceROI.jsx](src/pages/AudienceROI.jsx) to import from theme.

**Phase 2 (Medium): Align Topline CSS to dark theme** (~75 mins)
- Map Topline CSS `:root` vars to app palette.
- Refactor `Topline.css` selectors to use app colors instead of independent vars.
- Test all Topline modules for visual regression.
- Consider deprecating light theme if not required by stakeholders.

#### Time Estimate
- Phase 1: 30 mins
- Phase 2: 75 mins (defer if time-constrained; next sprint)

---

### 3. **HIGH: Data Organization — Embedded Datasets Bloat Components**

#### Issue
Large static datasets are defined directly in component files, violating separation of concerns:

| File | Data | Lines | Issue |
|------|------|-------|-------|
| [src/pages/SegmentProfile.jsx](src/pages/SegmentProfile.jsx) | `SEGMENTS`, `RELIGION_DATA`, `MILITARY`, `PREPOST`, `STUDY_ROI`, `GOP_VECTORS`, `DEM_VECTORS`, `IDEOLOGY_*` | 2,138 total; ~1,400 data | Massive file; hard to navigate; data unused by component logic |
| [src/pages/SegmentMap.jsx](src/pages/SegmentMap.jsx) | `BUBBLES`, `CARD_IMAGES`, `STAGE_W/H`, color constants | ~450 lines; ~100 data | Hardcoded coordinates mixed with rendering logic |
| [src/pages/IdeologyHeatmap.jsx](src/pages/IdeologyHeatmap.jsx) | `SEGS`, `GROUPS`, `ALL_DIMS`, `DATA` (15 ideology dims) | Self-contained; data-heavy | Usable but hard to update centrally |

#### Impact
- **Reusability:** Other components cannot easily access shared segment/ideology data.
- **Maintainability:** Updating segment definitions requires editing multiple files.
- **Testing:** Hard to test data logic separately from rendering.
- **File Size:** Component files are bloated, making code review difficult.

#### Root Cause
Initial development prioritized quick feature delivery; data was co-located with rendering logic.

#### Remediation (Priority: HIGH)

**Action: Extract data modules** (~90 mins)
1. Create [src/data/segments.js](src/data/segments.js):
   ```javascript
   // Export all segment-related data
   export const SEGMENTS = [...];
   export const MILITARY = [...];
   export const UNION_HH = [...];
   export const RELIGION_CATS = [...];
   export const RELIGION_DATA = { ... };
   export const RELIGION_OVERINDEX = { ... };
   export const PREPOST = { ... };
   export const STUDY_ROI = { ... };
   export const GOP_VECTORS = { ... };
   export const DEM_VECTORS = { ... };
   export const VECTOR_DEFS = { ... };
   ```

2. Create [src/data/bubbleMap.js](src/data/bubbleMap.js):
   ```javascript
   export const BUBBLES = [...];
   export const CARD_IMAGES = { ... };
   export const STAGE_W = 5325;
   export const STAGE_H = 1959;
   ```

3. Create [src/data/ideology.js](src/data/ideology.js) (if not already present):
   ```javascript
   export const IDEOLOGY_GROUPS = [...];
   export const IDEOLOGY_DATA = { ... };
   export const ALL_DIMS = [...];
   ```

4. Update component imports:
   - [src/pages/SegmentProfile.jsx](src/pages/SegmentProfile.jsx): `import { SEGMENTS, MILITARY, ... } from "../data/segments";`
   - [src/pages/SegmentMap.jsx](src/pages/SegmentMap.jsx): `import { BUBBLES, CARD_IMAGES, ... } from "../data/bubbleMap";`
   - [src/pages/IdeologyHeatmap.jsx](src/pages/IdeologyHeatmap.jsx): `import { IDEOLOGY_GROUPS, ... } from "../data/ideology";`

#### Time Estimate
90 minutes (extract + refactor + test imports)

---

### 4. **MEDIUM: Inconsistent Font Usage**

#### Issue
- Google fonts link appears in multiple components ([Shell.jsx](src/components/Shell.jsx), [Login.jsx](src/pages/Login.jsx)).
- Font-family strings are hardcoded throughout:
  - `'Nunito', sans-serif`
  - `'JetBrains Mono', monospace`
  - `'Poppins', sans-serif`
  - `'Inter', sans-serif`
  - Others in Topline.css

#### Impact
- Duplication and maintenance friction.
- Inconsistent fallback chains.
- Hard to update typography globally.

#### Remediation (Priority: MEDIUM)

**Action: Centralize font loading and exports** (~45 mins)
1. Move Google fonts link to [src/components/Shell.jsx](src/components/Shell.jsx) (single load).
2. Expand [src/data/theme.js](src/data/theme.js):
   ```javascript
   export const FONTS = {
     primary: "'Nunito', -apple-system, sans-serif",
     display: "'Poppins', -apple-system, sans-serif",
     mono: "'JetBrains Mono', 'Fira Code', monospace",
     serif: "'Fraunces', Georgia, serif",
   };
   export const FONT = FONTS.primary;
   export const MONO = FONTS.mono;
   ```
3. Replace hardcoded strings with `FONTS.primary`, `FONTS.display`, `FONTS.mono` across all files.

#### Time Estimate
45 minutes

---

### 5. **MEDIUM: Inline Styles & Repeated Layout Logic**

#### Issue
Extensive use of inline `style={{ ... }}` objects with repeated patterns:

- **Card borders:** `border: `1px solid ${C.cardBorder}`, borderRadius: 6`
- **Button styling:** `padding: "10px 12px", borderRadius: 6, border: ...`
- **Text scales:** `fontSize: 11, fontFamily: FONT, color: C.text`
- **Flex layouts:** `display: "flex", gap: 12, alignItems: "center"`

**Examples:**
- [src/components/Shell.jsx](src/components/Shell.jsx): ~40 inline style objects
- [src/pages/AudienceROI.jsx](src/pages/AudienceROI.jsx): ~30 inline style objects
- [src/pages/Login.jsx](src/pages/Login.jsx): ~25 inline style objects

#### Impact
- Hard to maintain consistency (copy-paste errors).
- Difficult to apply design changes globally.
- Reduced readability.

#### Remediation (Priority: MEDIUM)

**Action: Extract common style patterns** (~45 mins)
1. Create [src/styles/commonStyles.js](src/styles/commonStyles.js):
   ```javascript
   import { C, FONT, MONO } from "../data/theme";
   
   export const styles = {
     cardBorder: { border: `1px solid ${C.cardBorder}`, borderRadius: 6 },
     button: { padding: "10px 12px", borderRadius: 6, cursor: "pointer", fontFamily: FONT },
     smallText: { fontSize: 9, color: C.textMuted, fontFamily: MONO },
     flexRow: { display: "flex", alignItems: "center", gap: 12 },
     flexCol: { display: "flex", flexDirection: "column", gap: 8 },
   };
   ```

2. Replace inline duplicates:
   ```javascript
   // Before
   style={{ border: `1px solid ${C.cardBorder}`, borderRadius: 6, padding: 12 }}
   
   // After
   style={{ ...styles.cardBorder, padding: 12 }}
   ```

#### Time Estimate
45 minutes (identify + extract + update imports in top 5 files)

---

### 6. **MEDIUM: Visualization Component Duplication**

#### Issue
Reusable chart/visualization helpers are duplicated or scattered:
- `MiniDonut`, `Donut`, `PBar`, `DeltaBar`, `TrustChart`, `ProfileVectorRadar`, `VectorBars`, `CensusDivisionMap`, `Topology`, `TrustList`, etc.
- Defined in-place in [src/pages/SegmentProfile.jsx](src/pages/SegmentProfile.jsx), [src/pages/AudienceROI.jsx](src/pages/AudienceROI.jsx), and [src/pages/HIVTab.jsx](src/pages/HIVTab.jsx).
- Hard to reuse across projects or test independently.

#### Remediation (Priority: MEDIUM)

**Action: Extract viz components** (~60 mins)
1. Create [src/components/Visualizations/](src/components/Visualizations/) folder.
2. Extract viz helpers into individual files:
   - `MiniDonut.jsx`
   - `DeltaBar.jsx`
   - `Donut.jsx`
   - `ProfileVectorRadar.jsx`
   - `VectorBars.jsx`
   - `TrustChart.jsx`
   - etc.

3. Create [src/components/Visualizations/index.js](src/components/Visualizations/index.js) for re-exports.
4. Update imports in page files.

#### Time Estimate
60 minutes

---

### 7. **MEDIUM: Data Module Organization**

#### Issue
Multiple data modules exist with unclear separation:
- `src/data/study.js` (study metadata, tier definitions, vector defs)
- `src/data/studyData.js` (imported as `DATA`, contains shared segment definitions)
- `src/data/segments.js`, `src/data/ideology.js`, `src/data/vectors.js`, etc. (may or may not exist)
- Pages import from different combinations, leading to confusion.

#### Remediation (Priority: MEDIUM)

**Action: Consolidate data exports** (~45 mins)
1. Document current separation of concerns.
2. Create [src/data/index.js](src/data/index.js) as a single entry point:
   ```javascript
   export * from "./theme";
   export * from "./study";
   export * from "./segments";
   export * from "./studyData";
   export * from "./ideology";
   export * from "./vectors";
   ```

3. Update all page imports to use the index:
   ```javascript
   // Before
   import DATA from "../data/studyData";
   import { STUDY_META } from "../data/study";
   import { SEGMENTS } from "..."; // unclear source
   
   // After
   import { DATA, STUDY_META, SEGMENTS } from "../data";
   ```

#### Time Estimate
45 minutes

---

### 8. **MEDIUM-HIGH: Responsive Design & Accessibility**

#### Issue
- **No media queries:** No visible breakpoints in CSS or component logic.
- **Fixed dimensions:** SVG sizes, font sizes, and component widths are hardcoded (e.g., `width: 1400, height: 280`).
- **Accessibility gaps:**
  - No `role` attributes on custom interactive elements.
  - Missing `aria-label`, `aria-describedby` on buttons, links, tables.
  - Interactive elements may not be keyboard-accessible.
  - Semantic HTML not used consistently (e.g., custom buttons instead of `<button>`).

#### Impact
- App breaks on tablets and mobile devices.
- Screen reader users cannot navigate effectively.
- Users on slow networks experience layout shift.

#### Remediation (Priority: HIGH)

**Phase 1 (Quick Audit): Identify breakpoints** (~30 mins)
- Add to [src/index.css](src/index.css):
  ```css
  @media (max-width: 768px) {
    /* Tablet adjustments */
  }
  @media (max-width: 480px) {
    /* Mobile adjustments */
  }
  ```
- Document which pages need responsive work.

**Phase 2 (ARIA & Semantics): Add accessibility** (~60 mins)
- Add `role`, `aria-label` to interactive elements:
  - Buttons: `<button role="button" aria-label="Toggle expanded view">`
  - Tables: `<table role="grid">`, `<th role="columnheader">`
  - Custom controls: `<div role="tablist">`, etc.
- Test with screen reader (e.g., NVDA on Windows, VoiceOver on Mac).

**Phase 3 (Responsive Refactor):** Defer to next sprint; affects layout logic in 5+ pages.

#### Time Estimate
- Phase 1: 30 mins
- Phase 2: 60 mins
- Phase 3: 90+ mins (defer)

---

### 9. **MEDIUM: HIVTab Component — Size & Complexity**

#### Issue
[src/pages/HIVTab.jsx](src/pages/HIVTab.jsx) is 685 lines of mixed SVG rendering, data processing, and inline styling. Large file is hard to review and maintain.

#### Remediation (Priority: MEDIUM)

**Action: Extract tile renderers** (~90 mins)
1. Create [src/pages/HIVTab/](src/pages/HIVTab/) folder and move `HIVTab.jsx` there.
2. Extract into subcomponents:
   - `SCFTile.jsx` (Compassion ↔ Sanctity)
   - `StigmaTile.jsx` (Blame & Avoidance)
   - `KnowledgeTile.jsx` (HIV knowledge)
   - `ContactTile.jsx` (Personal contact)
   - etc.

3. Move CSS to [src/pages/HIVTab/HIVTab.module.css](src/pages/HIVTab/HIVTab.module.css) for scoping.
4. Update [src/pages/HIVTab/index.jsx](src/pages/HIVTab/index.jsx) to import and compose tiles.

#### Time Estimate
90 minutes

---

## Audit Findings Summary Table

| Category | Issue | Severity | Time to Fix | Impact |
|----------|-------|----------|-------------|--------|
| **Security** | Supabase key in repo | 🔴 CRITICAL | 30 min | Credential exposure |
| **Theme** | Multiple styling systems | 🔴 HIGH | 105 min | Design drift, hard to maintain |
| **Data** | Embedded datasets in components | 🔴 HIGH | 90 min | Poor reusability, bloated files |
| **Fonts** | Duplicated Google fonts links | 🟡 MEDIUM | 45 min | Inconsistency, maintenance friction |
| **Styles** | Widespread inline styles | 🟡 MEDIUM | 45 min | Hard to update, visual inconsistency |
| **Viz** | Duplicated chart components | 🟡 MEDIUM | 60 min | Code duplication, poor reusability |
| **Data Org** | Scattered module exports | 🟡 MEDIUM | 45 min | Confusion, import errors |
| **Responsive** | No media queries, missing ARIA | 🔴 HIGH | 90 min (Phase 1–2) | Mobile breakage, accessibility issues |
| **HIVTab** | Large monolithic component | 🟡 MEDIUM | 90 min | Hard to test, review, maintain |

---

## Prioritized Remediation Plan (6–8 Hour Window)

### **Execution Timeline**

#### **Hour 0–0.5: Security (CRITICAL)**
- [ ] Move Supabase credentials to `.env` files.
- [ ] Update `supabaseClient.js` to read from `import.meta.env`.
- [ ] Add `.env.local` to `.gitignore`.
- [ ] Rotate exposed anon key in Supabase dashboard.

#### **Hour 0.5–1.25: Quick Wins (Theme + Fonts)**
- [ ] Consolidate color constants into [src/data/theme.js](src/data/theme.js).
- [ ] Update imports in [src/pages/SegmentMap.jsx](src/pages/SegmentMap.jsx), [MessageMap.jsx](src/pages/MessageMap.jsx), [AudienceROI.jsx](src/pages/AudienceROI.jsx).
- [ ] Centralize font loading in [Shell.jsx](src/components/Shell.jsx).
- [ ] Export font constants from [src/data/theme.js](src/data/theme.js).

#### **Hour 1.25–3 (Approx): Data Extraction (HIGH Impact)**
- [ ] Create [src/data/segments.js](src/data/segments.js); move segment data from [SegmentProfile.jsx](src/pages/SegmentProfile.jsx).
- [ ] Create [src/data/bubbleMap.js](src/data/bubbleMap.js); move bubble data from [SegmentMap.jsx](src/pages/SegmentMap.jsx).
- [ ] Update component imports and test.

#### **Hour 3–4: Styles Consolidation (MEDIUM)**
- [ ] Extract repeated inline styles into [src/styles/commonStyles.js](src/styles/commonStyles.js).
- [ ] Update top 5 page files to use common style objects.

#### **Hour 4–6 (Optional, if time allows): Viz Components + Data Org**
- [ ] Extract viz components into [src/components/Visualizations/](src/components/Visualizations/).
- [ ] Consolidate data exports in [src/data/index.js](src/data/index.js).

#### **Hour 6–8 (Defer if time-constrained): Accessibility + Topline CSS**
- [ ] Add media query breakpoints to [src/index.css](src/index.css).
- [ ] Add `role`, `aria-label` to interactive elements (Phase 1).
- [ ] *(Optional)* Align Topline CSS to dark theme (large refactor).

---

## Code Examples & Implementation Patterns

### Example 1: Moving Supabase Credentials to Env

**Before (src/supabaseClient.js):**
```javascript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://zviodrqsrawcxtqcorst.supabase.co";
const supabaseAnonKey = "eyJhbGc...";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**After (src/supabaseClient.js):**
```javascript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**New (.env.local):**
```
VITE_SUPABASE_URL=https://zviodrqsrawcxtqcorst.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

**Update (.gitignore):**
```
.env.local
.env.*.local
```

---

### Example 2: Centralizing Color Constants

**Before (src/pages/SegmentMap.jsx):**
```javascript
const DEM_FILL = "#2563eb";
const DEM_STROKE = "#3b82f6";
const GOP_FILL = "#dc2626";
const GOP_STROKE = "#ef4444";
```

**Before (src/pages/AudienceROI.jsx):**
```javascript
const C = {
  gop: "#e57373",
  dem: "#64b5f6",
  // ...
};
```

**After (src/data/theme.js):**
```javascript
export const COLORS = {
  party: {
    GOP: "#ef4444",
    DEM: "#3b82f6",
  },
  tier: {
    1: "#34d399",
    2: "#eab308",
    3: "#ef4444",
  },
  viz: {
    persuasion: "#5b93c7",
    activation: "#a78bfa",
    influence: "#818cf8",
  },
};

export const PARTY = COLORS.party;
export const TIER = COLORS.tier;
```

**After (all pages):**
```javascript
import { PARTY, TIER } from "../data/theme";

const demFill = PARTY.DEM;
const gopFill = PARTY.GOP;
```

---

### Example 3: Extracting Data Modules

**Before (src/pages/SegmentProfile.jsx line 1–50):**
```javascript
const SEGMENTS = [
  { id:1, code:"TSP", name:"TRUST THE SCIENCE PRAGMATISTS", party:"GOP", pop:2, ... },
  // ... 15 more segments
];
const MILITARY = [12.3, 12.6, ...];
const RELIGION_CATS = [ ... ];
// ... more huge arrays
```

**After (src/data/segments.js):**
```javascript
export const SEGMENTS = [
  { id:1, code:"TSP", name:"TRUST THE SCIENCE PRAGMATISTS", party:"GOP", pop:2, ... },
  // ...
];
export const MILITARY = [12.3, 12.6, ...];
export const RELIGION_CATS = [ ... ];
// ... etc
```

**After (src/pages/SegmentProfile.jsx line 1):**
```javascript
import { SEGMENTS, MILITARY, RELIGION_CATS, ... } from "../data/segments";
// Component code now starts immediately
```

---

### Example 4: Extracting Common Styles

**Before (src/pages/Login.jsx):**
```javascript
<div style={{
  width: 360, background: "#0f1520", borderRadius: 12,
  border: "1px solid #1e293b", padding: "32px 28px"
}}>
  <div style={{ textAlign: "center", marginBottom: 24 }}>
    {/* ... */}
  </div>
  <div style={{ marginBottom: 12 }}>
    <label style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 4 }}>
      EMAIL
    </label>
    <input
      style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid #1e293b", background: "#111827", ... }}
    />
  </div>
</div>
```

**After (src/styles/commonStyles.js):**
```javascript
import { C, FONT } from "../data/theme";

export const styles = {
  card: {
    width: 360,
    background: C.card,
    borderRadius: 12,
    border: `1px solid ${C.cardBorder}`,
    padding: "32px 28px",
  },
  label: {
    fontSize: 10,
    color: C.textMuted,
    fontWeight: 600,
    display: "block",
    marginBottom: 4,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 6,
    border: `1px solid ${C.cardBorder}`,
    background: C.cardDarker,
    color: C.text,
    fontSize: 13,
    fontFamily: FONT,
    outline: "none",
    boxSizing: "border-box",
  },
};
```

**After (src/pages/Login.jsx):**
```javascript
import { styles } from "../styles/commonStyles";

<div style={styles.card}>
  <div style={{ textAlign: "center", marginBottom: 24 }}>
    {/* ... */}
  </div>
  <div style={{ marginBottom: 12 }}>
    <label style={styles.label}>EMAIL</label>
    <input style={styles.input} />
  </div>
</div>
```

---

### Example 5: Adding ARIA Labels

**Before (src/components/Shell.jsx):**
```javascript
<button
  onClick={() => supabase.auth.signOut()}
  style={{ fontSize: 9, ... }}
>SIGN OUT</button>
```

**After (src/components/Shell.jsx):**
```javascript
<button
  onClick={() => supabase.auth.signOut()}
  aria-label="Sign out of PRISM Dashboard"
  title="Sign out"
  style={{ fontSize: 9, ... }}
>SIGN OUT</button>
```

**Before (table in MessageMap):**
```javascript
<table>
  <thead>
    <tr>
      <th>MESSAGE</th>
      <th>THEME</th>
      {/* ... segment headers */}
    </tr>
  </thead>
</table>
```

**After (table in MessageMap):**
```javascript
<table role="grid" aria-label="Message share-of-preference heatmap">
  <thead>
    <tr>
      <th role="columnheader" scope="col">MESSAGE</th>
      <th role="columnheader" scope="col">THEME</th>
      {/* ... segment headers */}
    </tr>
  </thead>
</table>
```

---

## Testing & Verification Checklist

### Phase 1 Verification (Security + Quick Wins)
- [ ] `.env.local` is created and `.gitignore`d.
- [ ] App starts without errors; auth flow still works.
- [ ] No console errors referencing undefined `import.meta.env` variables.
- [ ] Color constants imported from theme; visual appearance unchanged.
- [ ] Fonts display correctly; Google fonts link loads once (check Network tab in DevTools).

### Phase 2 Verification (Data Extraction)
- [ ] New data modules created and exports are correct.
- [ ] All component imports resolve without errors.
- [ ] Pages render with same data (visual/functional regression testing).
- [ ] Console shows no "undefined" data references.
- [ ] File sizes reduced for SegmentProfile, SegmentMap.

### Phase 3 Verification (Styles + Viz)
- [ ] Common style objects applied; visual appearance consistent.
- [ ] Viz components import correctly and render identically.
- [ ] Data module exports consolidated; all imports point to single entry.

### Phase 4 Verification (Accessibility)
- [ ] Screen reader (NVDA/VoiceOver) reads navigation and buttons correctly.
- [ ] Tabindex order is logical; keyboard navigation works.
- [ ] Responsive breakpoints applied; test on tablet (768px) and mobile (480px) viewports.
- [ ] No layout breaking on smaller screens.

---

## Recommended PR Structure

### PR #1: Security & Credentials (CRITICAL)
**Title:** "🔒 Move Supabase credentials to environment variables"  
**Files:** `.env.local.example`, `.gitignore`, `src/supabaseClient.js`  
**Time:** 30 mins  
**Testing:** Run auth flows; verify no key in console logs.

---

### PR #2: Theme Consolidation (HIGH)
**Title:** "🎨 Centralize color constants and fonts"  
**Files:**
- `src/data/theme.js` (add COLORS, FONTS exports)
- `src/components/Shell.jsx` (move font link)
- `src/pages/SegmentMap.jsx`, `MessageMap.jsx`, `AudienceROI.jsx` (update imports)

**Time:** 75 mins  
**Testing:** Visual regression; no color/font changes.

---

### PR #3: Data Extraction (HIGH)
**Title:** "📦 Extract embedded datasets into data modules"  
**Files:**
- `src/data/segments.js` (new)
- `src/data/bubbleMap.js` (new)
- `src/pages/SegmentProfile.jsx` (remove data, add imports)
- `src/pages/SegmentMap.jsx` (remove data, add imports)

**Time:** 90 mins  
**Testing:** Functional testing; verify segment/bubble rendering unchanged.

---

### PR #4: Style Consolidation (MEDIUM)
**Title:** "💅 Extract common inline styles"  
**Files:**
- `src/styles/commonStyles.js` (new)
- `src/pages/*.jsx`, `src/components/Shell.jsx` (update styles)

**Time:** 45 mins  
**Testing:** Visual consistency; no layout changes.

---

### PR #5: Viz Components (MEDIUM)
**Title:** "📊 Extract and centralize visualization components"  
**Files:**
- `src/components/Visualizations/*.jsx` (new)
- `src/pages/SegmentProfile.jsx`, `AudienceROI.jsx` (update imports)

**Time:** 60 mins  
**Testing:** Functional testing; chart rendering unchanged.

---

### PR #6: Data Module Consolidation (MEDIUM)
**Title:** "📋 Consolidate data module exports"  
**Files:**
- `src/data/index.js` (new)
- All pages (update imports to use single entry)

**Time:** 45 mins  
**Testing:** Verify all imports resolve; no circular dependencies.

---

### PR #7: Accessibility & Responsive (HIGH)
**Title:** "♿ Add media queries and ARIA labels (Phase 1–2)"  
**Files:**
- `src/index.css` (add breakpoints)
- All pages (add aria-label, role attributes)

**Time:** 90 mins (Phase 1–2 only)  
**Testing:** Screen reader testing; responsive viewport testing.

---

## Risk Assessment & Mitigation

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Data extraction breaks imports** | Medium | Use `git diff` before committing; test each file independently. |
| **Visual regression in theme refactor** | High | Take screenshots before/after; test in multiple browsers. |
| **Topline CSS breakage** | High | Defer Topline CSS refactor to next sprint; test extensively if included. |
| **Accessibility changes break layout** | Low | ARIA labels don't affect layout; test on desktop + mobile. |
| **Rotating Supabase key causes auth failure** | Medium | Rotate key *after* code deploys; test auth locally before rotating. |

---

## Recommended Timeline

| Sprint | Focus | Duration | PRs |
|--------|-------|----------|-----|
| **Sprint 1 (NOW)** | Security + Quick Wins + Data | 6–8 hrs | #1, #2, #3 |
| **Sprint 2** | Styles + Viz + Data Org | 4–5 hrs | #4, #5, #6 |
| **Sprint 3** | Accessibility (Phase 1–2) + HIVTab refactor | 5–6 hrs | #7 + optional |
| **Sprint 4+** | Topline CSS refactor, advanced responsive, testing | 3–4 hrs | #8 + optional |

---

## Success Metrics

After completing the recommended plan, the codebase should achieve:

- ✅ **Security:** No credentials in repo; all sensitive data in `.env`
- ✅ **Theme:** Single source of truth for colors and fonts; consistent visual language
- ✅ **Data:** Modular, reusable data modules; components <500 lines each
- ✅ **Styles:** 70%+ inline styles replaced with common objects; maintained visual consistency
- ✅ **Accessibility:** All interactive elements have `role` and `aria-label`; keyboard navigation works
- ✅ **Responsive:** App functional on tablet (768px) and mobile (480px); no layout breaking
- ✅ **Maintainability:** New developers can navigate codebase; onboarding time reduced by 30%

---

## Conclusion

The PRISM Dashboard HIV codebase is **functionally sound but architecturally untidy**. The recommended remediation plan addresses the highest-impact issues (security, theme, data organization) within the 6–8 hour audit window, with a clear path for phased cleanup over 3–4 sprints.

**Immediate Actions (Today):**
1. Move Supabase credentials to `.env`.
2. Schedule the Sprint 1 work session.
3. Create PR templates for the recommended PRs.

**Next Steps (This Week):**
Execute Sprint 1 (Security + Quick Wins + Data Extraction) to unlock immediate maintainability gains and reduce technical debt by ~40%.

---

**Audit Completed:** May 18, 2026  
**Conducted by:** GitHub Copilot (Claude Haiku 4.5)  
**Status:** READY FOR IMPLEMENTATION
