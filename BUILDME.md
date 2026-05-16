# HIV Dashboard — Wire-Up Instructions

## Goal

Deliver a fully functional client-facing dashboard at `hiv.rcghealthprism.app`, with HIV data wired through every existing component, plus the new topline and the new HIV tab inside each segment's persona profile.

Three deliverables, in order:

1. **Phase A — Wire HIV data into the existing dashboard** (SegmentMap, AudienceROI, SegmentProfile work for HIV; MessageMap deferred until wave 2)
2. **Phase B — Integrate the HIV Persona Profile Tab** as a sub-tab inside SegmentProfile
3. **Phase C — Topline migration** (React port; full spec below)

Work one phase at a time. Commit and pause at the end of each phase. Do not start Phase B until Bryan confirms Phase A renders cleanly. Do not start Phase C until Bryan confirms Phase B.

## Hard rules

- **Do NOT modify canonical PRISM content.** That means `src/data/segments.js`, `src/data/ideology.js`, `src/data/vectors.js`, `src/data/trust.js`, `src/data/experiential.js`, the SEGMENTS array inside `SegmentProfile.jsx`, the religion/wellness/media/geography tables inside `SegmentProfile.jsx`, and the BUBBLES array in `SegmentMap.jsx`. All canonical. Touch nothing.
- **Do NOT modify the topline build pipeline** (`compute_core.py`, `dashboard_template.html`, `dashboard.json`).
- **Do NOT fabricate study data.** All HIV values come from `HIV_Study_Template.xlsx` at the repo root (Phase A) and the JSON files in `HIV_Persona_Profile_Tab/` (Phase B) and `dashboard.json` (Phase C). If a number is needed and not in one of these sources, halt and ask.
- **Do NOT abstract or refactor for elegance.** Make the minimum changes to ship. Refactors come later.
- **Data is pre-cleaned at the Python layer, not the React layer.** The Python pipeline (`prism_hiv_dashboard.py` rev. 2026-05-16) systematically recodes non-response codes (98, 99, 998, 999) to missing across all Q-prefix variables before any aggregation. The React app must NOT re-validate or clean numeric values. If a value looks wrong, the bug is in the Python pipeline — flag it for Bryan, do not patch in JS.

## Architecture invariants (DO NOT BREAK)

1. **The 16-segment frame is canonical.** The 16 segments (TSP, CEC, TC, HF, PP, WE, PFF, HHN, MFL, VS, UCP, FJP, HCP, HAD, HCI, GHI) are constants. Their codes, names, party affiliations, population shares, and bubble-map coordinates do not change. Do not modify.
2. **Brochure-rails three-pane layout (for topline).** Survey pane (240px) · codebook pane (240px) · banner pane (variable-width). All three rails line up vertically across every module. 18 banner columns (TOTAL + 16 segments + GOP/DEM bands). Row labels right-justified, wrap to 420px max-width. Load-bearing CSS: `.banner-table td.rlbl { text-align: right; white-space: normal; max-width: 420px; }` and `.banner-table td.cell { width: 46px }`.
3. **`dashboard.json` is immutable input.** Treat as a fixed input contract. Do not restructure, normalize, rename keys, or pre-process. Import as-is.
4. **Significance markers are pre-computed.** `•` = p<.05, `••` = p<.01. Stats and p-values come from `dashboard.json`. Do not recompute.
5. **Composites are per-study.** The eight HIV composites (MBS, SDS, EDS, SCS, CFS, PFS, SCF, HKS) are this study's indices, not canonical PRISM constructs. Do not abstract them into shared components. Render whatever `dashboard.json` provides.
6. **The K5 trap item visual flag.** Knowledge item "epidemic is effectively over" is the trap: `FALSE` badge in survey pane, pink-tinted banner row. Excluded from HKS scoring. Preserve this rendering.
7. **Topline module order is locked.** 01 HIV Stigma · 02 Pre-Post · 03 ROI Scorecard · 04 Critics · 05 Message Testing (disabled) · 06 Trusted Sources (disabled) · 07 Demographics · 08 Influencer360.

## Context

The existing American Leadership dashboard is a React/Vite app on Vercel. It contains five components built on the PRISM 16-segment frame:

- `SegmentMap.jsx` — interactive bubble map of the 16 segments with persona cards
- `IdeologyHeatmap.jsx` — attitudinal vectors heatmap
- `AudienceROI.jsx` — ROI scorecard view (study-keyed; currently keyed to `ESI`, `MA`)
- `SegmentProfile.jsx` — per-segment deep-dive
- `MessageMap.jsx` — message testing visualization

The HIV repo (`prism-dashboard-HIV`) is a clone of this codebase. Project-level renames already done or to verify in Phase A.0: `package.json` `name` = `prism-hiv-dashboard`, `index.html` `<title>` = "PRISM HIV Treatment & Prevention", `README.md` updated for HIV.

The HIV topline exists as a standalone HTML (`PRISM_HIV_Topline.html`, ~620KB) built by a Python pipeline (`compute_core.py` → `dashboard.json` → injected into `dashboard_template.html`). Phase C reimplements its rendering as a React route.

The new HIV tab is a study-specific view inside `SegmentProfile.jsx` as one of eight tabs (Demographics, **HIV**, Beliefs, Values, Trust, Experience, Culture, Media), parameterized by the segment currently being viewed.

---

## Phase A — Wire HIV data into the existing dashboard

### A.0 Verify the clone state

Before any edits, confirm: `package.json` `name` is `prism-hiv-dashboard`, `index.html` `<title>` reflects HIV, `README.md` is HIV-specific. If any are not done, do them now.

### A.1 Read the workbook

Read `HIV_Study_Template.xlsx` from the repo root using `openpyxl` or `pandas`. Read these tabs:

- **StudyMeta** (key-value pairs)
- **Messages** (one row per message×token; skip rows where col A starts with `#`)
- **VariantText** (one row per message×token, 16 segment columns)
- **SegmentMetrics** (one row per segment, 16 segments total)

Skip the SoP, SigFlags, and ThemeColors tabs. They are blank by design (SoP/SigFlags = wave 2; themes intentionally off for HIV).

### A.2 Important workbook gotchas

- The SegmentMetrics header has a bug: columns 31-50 are all labeled `prepost_key4_*`. They actually correspond to prepost items 4, 5, 6, and 7. **Read SegmentMetrics by column position, not header name.** Layout (with the `tier` column at position 6):
  - Cols 1-15: identifiers and core metrics (code, name, party, pop, roi, tier, highRoi, supporters, activation, influence, 5 persuadability buckets)
  - Cols 16-20: prepost item 1 (pre, post, label, question, scale)
  - Cols 21-25: item 2 · 26-30: item 3 · 31-35: item 4 · 36-40: item 5 · 41-45: item 6 · 46-50: item 7
- The `tier` column (1/2/3) is at column 6. Read it directly. Do not derive from ROI.
- The Messages tab has both `token_id=0` (core text) and `token_id=1` / `token_id=2` (proof-point variants). For Phase A, **use only `token_id=0`** for the message stimulus text. Tokens are for future use.
- Themes are ALL-CAPS in the workbook. Keep them ALL-CAPS in the React data.

### A.3 Add an HIV entry to `src/data/studyData.js`

Open `src/data/studyData.js`. Currently it exports `DATA = { ESI: {...}, MA: {...} }`. Add an HIV entry with the same shape:

```js
DATA.HIV = {
  segments: [ /* 16 segments, each with: code, name, party, pop, roi, highRoi, supporters, activation, influence, persuadability:[5 buckets], prePost:{item1:[pre,post], item2:[pre,post], ...} */ ],
  prePostMetrics: [ /* 7 metric definitions: {key, label, question, scale} drawn from the SegmentMetrics tab — use the first segment's labels since they are identical across segments */ ],
  messages: [ /* 17 entries: {id, shortName, theme, text, sop: []} — sop is an empty array for now; MessageMap will show a wave-2 placeholder */ ]
}
```

Match the existing ESI/MA shape exactly so the components consume HIV identically. Inspect ESI's structure first before writing HIV's.

### A.4 Update components to support HIV

Make these surgical edits. Each one is small.

**`src/components/AudienceROI.jsx`:**
- Add `HIV` to the `STUDY_DATA` mapping at the top (alongside ESI and MA).
- Add an `HIV:` block to `ASSIGNED_TIERS` populated from the `tier` column in SegmentMetrics.
- Change `useState("ESI")` to `useState("HIV")`.
- Change the study toggle button bar from `[{k:"ESI",...},{k:"MA",...}]` to `[{k:"HIV",l:"HIV STUDY"}]`. (Single button is fine; it signals which study is active.)

**`src/components/MessageMap.jsx`:**
- Change `useState("ESI")` to `useState("HIV")`.
- Same single-button toggle change as AudienceROI.
- **No theme palette for HIV.** Do not extend `THEME_COLORS` for HIV themes. Do not color-code messages by theme in the HIV view.
- The component reads `DATA[study].messages` and expects each message to have an 18-column `sop` array. HIV `sop` arrays are empty. At the top of the component, add a check: if `DATA[study].messages[0].sop.length === 0`, render a placeholder banner: "Message testing results available in Wave 2. Messages and stimulus text shown below for reference." Below the banner, render a simple list of the 17 messages (theme tag in plain text, short name, full text) — no heatmap, no theme colors.

**`src/components/SegmentProfile.jsx`:**
- Find the `STUDY_ROI` object (the big 16-segment × {ESI, MA} map). Add an `HIV` inner key to each segment with the same metrics from SegmentMetrics. Don't remove ESI or MA.
- Find the `PREPOST` object. It currently has 4 keys per segment (`rank`, `att1`, `att2`, `fav`). Generalize:
  - Use generic numbered keys (`item1`...`item7`).
  - Replace the data with 16 segments × 7 items × {pre, post} from the workbook.
  - Find the rendering code that iterates over PREPOST keys (currently hardcodes 4). Update to iterate dynamically over whatever keys exist. Display labels and questions come from `studyData.HIV.prePostMetrics`.
  - If 7 items breaks the existing visual layout (the `H` row-height object has assumptions tied to 4), adjust container heights. Do not truncate to 4.
- Find the ROI Card render block that maps `["ESI","MA"]`. Change to `["HIV"]` only.
- Find the string `"ESI STUDY" : "MA STUDY"` and change to `"HIV STUDY"`.

**`src/App.jsx`:**
- Keep the `/messages` route active so nav stays consistent. The placeholder banner from MessageMap.jsx handles the wave-2 state.

### A.5 Themes off for HIV

Per Bryan's decision: no theme color pattern for the HIV MessageMap. Themes appear as plain text labels only. The `THEME_COLORS` constant in MessageMap.jsx is irrelevant for the HIV path.

### A.6 Verify Phase A

- Run `npm install` if needed, then `npm run dev`.
- **SegmentMap (landing):** 16 bubbles render with HIV pop weights. Bubble sizes reflect HIV's distribution (WE about 9%, UCP about 11%, etc.).
- **AudienceROI (`/roi`):** the single HIV button is selected by default. Each segment's ROI, tier, persuadability, supporters, activation, influence reflect HIV values. Spot-check 5 segments against the workbook.
- **SegmentProfile (`/profile`):** pick TSP. ROI card shows HIV values (roi 1.024, tier 1, highRoi 30%, supporters 32%, activation 32%, influence 31%). Pre/post section shows 7 items, not 4. Switch through several segments and confirm rendering.
- **MessageMap (`/messages`):** placeholder banner visible. List of 17 messages with themes as plain text. No heatmap.
- No console errors.

Before committing, write `verify_phaseA.md` showing:
- (a) For each of the 16 segments, one line: `code | roi | tier | supporters | activation | influence` as read from the workbook AND as it appears in the generated `studyData.js` HIV block, side by side. Mismatch jumps out visually.
- (b) The list of 7 prepost item labels with the source workbook column number.
- (c) Confirmation that the 17 message theme strings render as plain text (no color coding) in MessageMap.

This is so a non-programmer can verify the wiring without reading code.

Commit: `feat(hiv): wire SegmentMetrics into studyData.js and components`. **Pause and ping Bryan before Phase B.**

---

## Phase B — Integrate the HIV Persona Profile Tab

The HIV tab is a sub-tab within the existing persona profile component, not a top-level route. It joins the existing tab strip as the second entry: Demographics · **HIV** · Beliefs · Values · Trust · Experience · Culture · Media.

### B.1 Reference materials

A complete reference HTML implementation and supporting data files are in `HIV_Persona_Profile_Tab/` at the repo root. Use these as ground truth:

| File | Purpose |
|---|---|
| `hiv_tab_v5.html` | Self-contained reference implementation: full markup, CSS, SVG charts, all interactive behaviors. The HIV tab is shown active; hardcodes FJP (segment 12) as the focal segment for demonstration. |
| `seg_data.json` | Per-segment composite data for all 16 segments: MBS, SDS, EDS, SCS, CFS, PFS, SCF (raw + z), HKS, CON_HIV, CON_LGB, and rank fields. This is what the tab consumes when the focal segment changes. |
| `items.json` | Item-level data for the four accordions (SCF, stigma, knowledge, contact). Each item has `code`, `stem`, `binary`, plus values for: `focal` (legacy FJP value), `by_segment` (object keyed by segment_id 1-16, populated by the fixed Python pipeline), `All`, `Republicans`, `Democrats`. **Read `by_segment[segmentId]` for the currently-viewed segment; ignore the `focal` field in the React port.** |
| `bench.json` | Benchmark composites for `All`, `Republicans`, `Democrats`. Drives the compare-bar toggle. |
| `trust.json` | 22 trust messenger items with same `by_segment` + `All`/`Republicans`/`Democrats` structure as items.json. Values are weighted means on the 1-7 trust scale. |
| `manifest.json` | Study metadata: `n_raw=960`, `effective_n=753.6`, design effect, IPF rake dimensions, weighting notes, exclusions (QHIVr5 = HKS foil; QTRUSTr3 personal physician excluded; QHIVSTIGMAr9-r13 = within-subject controls not in composites). |
| `zparams.json` | Mean and SD for each composite, used as z-score standardization parameters. |
| `prism_hiv_dashboard.py` | Python script that built the JSON files from `260433.sav`. Read for understanding only — do not run or modify. |
| `prism_hiv_dashboard.sps` | SPSS syntax used in data prep. Read for understanding only. |

### B.2 Pre-work — read before writing any code

**Read `hiv_tab_v5.html` end to end** before writing component code. The SVG generation logic for the SCF vertical scale, the stigma seesaw, the knowledge bar, the scatter plot, and the trust ranking is hand-rolled and non-trivial. Also read each of the JSON files end to end.

Write `HIV_TAB_INVENTORY.md` at the repo root with:

- (a) **Visual structure.** Outline the page in order: top-level layout, compare bar, each of the four tiles, scatter section, trust section. For each, list HTML classes used, SVG viewBox dimensions, and which JSON file fields are read.
- (b) **Interactive behaviors.** Every place state mutates in the reference HTML (compare bar clicks, accordion open/close, hover states). What changes visually when each mutates.
- (c) **Patterns that need translation.** Every use of `document.createElementNS`, `innerHTML =`, direct DOM mutation, or `addEventListener` in the reference. These all become declarative JSX.
- (d) **Data flow.** For each tile and section, one line: "Reads X from Y JSON file, displays it as Z." Check explicitly: where does FJP appear hardcoded (segment_id = 12)? Each such occurrence becomes the `segmentId` prop.
- (e) **Open questions.** Anything unclear or ambiguous.

Pause and confirm the inventory with Bryan before writing component code.

### B.3 Tab structure (eight sub-views)

If `SegmentProfile.jsx` does not yet have a tab strip, create one with these eight tabs:

1. **Demographics** — existing content (currently shown via the persona "demo" object); refactor into a tab body
2. **HIV** — NEW, this implementation
3. **Beliefs** — placeholder tab (renders existing "believe" persona content)
4. **Values** — placeholder tab (renders existing "want" / values content)
5. **Trust** — placeholder tab (the HIV tab's Section 3 trust battery may eventually move here; for now it stays inside the HIV tab)
6. **Experience** — placeholder tab (renders existing "doWhat" / "whoAre" content)
7. **Culture** — placeholder tab (stub for V2)
8. **Media** — placeholder tab (stub for V2)

The HIV tab is the only one with new structure. The other seven re-organize existing persona profile content into a tabbed layout. **Do not re-author persona content; just reorganize what's already there.**

### B.4 HIV tab — three sections

All sections are parameterized by the focal segment (the segment whose profile is currently being viewed).

**Section 1 — Four headline tiles (4-column grid)**

| Tile | What it shows | Data source |
|---|---|---|
| **Compassion ↔ Sanctity** | Vertical SCF scale (Care ↔ Sanctity moral spectrum). Focal segment marker on left; R/D/US benchmark glyphs on right; rank ("rank N of 16"); delta vs. active benchmark. Item-level accordion below (CFS items + PFS items + SCF composite). | `seg_data.json[focal].SCF_raw`, `seg_data.json[focal].SCF_rank`, `bench.json[bench].SCF.raw`, `items.json.scf` |
| **Stigma Profile — Blame & Avoidance** | Two parallel glyph rows (BLAME / AVOIDANCE) with values 0-7 mapped to filled chevron glyphs. Seesaw bar showing which channel dominates. Item-level accordion with stigma items (SB1, SB2, MBS, SD1, SD2, SDS). | `seg_data.json[focal].MBS_raw`, `.SDS_raw`, `items.json.stigma` |
| **HIV Knowledge** | Horizontal bar 0-10 showing sum of correct knowledge items. Focal value, active benchmark tick, rank label ("3 OF 16"). Item-level accordion with 10 knowledge items (K1, K2, K3, K4, K6, K7, K8, K9, K10, K11 — K5 excluded as foil). | `seg_data.json[focal].HKS`, `seg_data.json[focal].HKS_rank`, `bench.json[bench].HKS`, `items.json.know` |
| **Personal Contact** | Two binary measures (CON-HIV: knows person with HIV; CON-LGB: knows LGBTQ person). Side-by-side percentages with benchmark deltas. Item-level accordion with both items. | `seg_data.json[focal].CON_HIV`, `.CON_LGB`, `seg_data.json[focal].CON_HIV_rank`, `.CON_LGB_rank`, `items.json.contact` |

**Section 2 — Strategic Positioning (scatter plot)**

A scatter of all 16 segments. X-axis is stigma (MBS or composite of stigma), Y-axis is policy support (or SCF — verify in reference HTML). Bubble size proportional to `pop`. Focal segment highlighted; others dimmed. The data array is `STR` in the reference HTML (`seg`, `stigma`, `policy`, `pop`, `scf`). For the React port, regenerate from `seg_data.json` where possible.

**Section 3 — Trust Messengers (22-item battery)**

Vertical list of 22 trust messenger items, sorted by focal segment's trust score (highest first). Each row: messenger name, focal bar, benchmark bar, delta. The reference HTML's TRUST array has cleaner numeric values than `trust.json` — use the HTML's data values until Bryan confirms which is authoritative.

### B.5 Compare-bar toggle (top of tab body)

Three buttons: **All Americans** (US glyph) · **Republicans** (R glyph) · **Democrats** (D glyph). One active at a time. Selecting a button:
- Updates all benchmark glyphs throughout the tab (active = solid, inactive = dim)
- Recomputes all deltas (focal − benchmark)
- Updates accordion column headers
- Updates the readout text under SCF tile, knowledge bar marker, contact tile, and scatter axes

Initial state: `Democrats` active (matches reference HTML).

### B.6 Parameterize by segment (the critical change)

The reference HTML hardcodes FJP (segment 12) as focal. The React port must parameterize by the segment currently being viewed in `SegmentProfile`:

```jsx
// In SegmentProfile.jsx
const [searchParams] = useSearchParams();
const segmentCode = searchParams.get('seg') || 'TSP';
const segmentId = SEGMENTS.find(s => s.code === segmentCode)?.id;

<HIVTab segmentId={segmentId} segmentCode={segmentCode} />
```

Every reference to "FJP" or "focal" in the reference HTML becomes a lookup against `seg_data.json[segmentId]` and `segmentCode` as the display label. When the user clicks a different segment pill at the top of `SegmentProfile`, the HIV tab re-renders with that segment as focal.

### B.7 Implementation steps

1. **Move data files.** Copy from `HIV_Persona_Profile_Tab/` into `src/data/hiv/`:

src/data/hiv/seg_data.json
src/data/hiv/items.json
src/data/hiv/bench.json
src/data/hiv/trust.json
src/data/hiv/manifest.json
src/data/hiv/zparams.json

2. **Create the component tree:**

src/components/SegmentProfile/
SegmentProfile.jsx        ← refactor: add tab strip, body switcher
TabStrip.jsx              ← new: the tab navigation
tabs/
DemographicsTab.jsx     ← refactor: existing demo content
HIVTab/
HIVTab.jsx            ← top-level for the HIV tab
CompareBar.jsx        ← All/R/D toggle
tiles/
SCFTile.jsx
StigmaTile.jsx
KnowledgeTile.jsx
ContactTile.jsx
StrategicScatter.jsx
TrustMessengers.jsx
utils/
glyphs.jsx          ← R/D/US benchmark glyph SVG components
format.js
BeliefsTab.jsx          ← stub from existing persona.believe
ValuesTab.jsx           ← stub from existing persona.want
TrustTab.jsx            ← stub
ExperienceTab.jsx       ← stub from existing persona.doWhat/whoAre
CultureTab.jsx          ← stub for V2
MediaTab.jsx            ← stub for V2

3. **Build order — smallest to largest.** Build and verify each in isolation before composing:
   - `utils/glyphs.jsx` — three small SVG components (`USGlyph`, `RGlyph`, `DGlyph`), each takes an `active` boolean prop
   - `utils/format.js` — rank formatting ("3 of 16"), signed deltas, z-score → display
   - `CompareBar.jsx` — three-button toggle, default `Democrats`
   - `ContactTile.jsx` — smallest tile, two binary percentages and deltas. Builds confidence in data flow.
   - `KnowledgeTile.jsx` — horizontal bar 0-10
   - `StigmaTile.jsx` — two glyph rows with seesaw bar
   - `SCFTile.jsx` — vertical scale, most complex tile
   - Item-level accordions inside each tile
   - `StrategicScatter.jsx`
   - `TrustMessengers.jsx`
   - `HIVTab.jsx` — top-level composer, holds `useState('Democrats')` and passes `bench` as prop

4. **Port the CSS.** The reference HTML uses CSS custom properties (`--bg-deep`, `--accent-magenta`, etc.) for a dark theme. The rest of the dashboard is already dark (`#0b0e13`). If the reference HTML's class names collide with anything in the dashboard, scope styles under `.hiv-tab-root` to prevent leakage. Otherwise inline styles in JSX are fine.

5. **Port the SVG renderers.** The reference HTML uses `document.createElementNS()` to build SVG elements imperatively. In React, translate to JSX:
   - `document.createElementNS('http://www.w3.org/2000/svg', 'circle')` → `<circle cx={...} cy={...} r={...} fill={...} />`
   - `el.style.background = '#xxx'` → `style={{ background: '#xxx' }}`
   - `el.addEventListener('click', fn)` → `onClick={fn}`
   - `el.classList.add('active')` → conditional `className`
   - `el.innerHTML = '<div>' + x + '</div>'` → JSX: `<div>{x}</div>`
   
   If you reach for `useRef` and direct DOM mutation, stop. Almost everything should be declarative.

6. **Verify parameterization.** Open TSP, switch to HIV tab, confirm TSP's data. Click UCP in the pill bar, confirm HIV tab updates to UCP's data without remounting.

### B.8 Reading focal item values per segment

The fixed Python pipeline (`prism_hiv_dashboard.py` rev. 2026-05-16) populates `by_segment` for every item and every trust messenger:

```jsx
const focalValue = item.by_segment[String(segmentId)];
const benchValue = item[bench];  // 'All' | 'Republicans' | 'Democrats'
const delta = focalValue - benchValue;
```

If `by_segment[sid]` is `null` (very small cell after weighting filters), render the value as `—` rather than `0.00`. Do not patch with mock values.

### B.9 Verify Phase B

Write `verify_phaseB.md` showing:

- (a) HIV tab rendering for three different segments: TSP (GOP, small pop), FJP (DEM, large pop — the reference HTML's original focal), GHI (DEM, large pop, different profile). All four tiles, scatter, and trust battery update.
- (b) Switching compare bar between All / Republicans / Democrats while viewing a single segment updates all benchmark glyphs, deltas, and accordion column headers.
- (c) For one segment, list the 4 composite values (SCF, MBS, SDS, HKS) as they appear in the HIV tab AND in `seg_data.json`, side by side. Values must match.
- (d) The other 7 tabs (Demographics, Beliefs, Values, Trust, Experience, Culture, Media) render without errors.
- (e) No CSS leakage: open the Demographics tab and confirm it looks the same as before HIV was added.
- (f) `manifest.json` metadata is surfaced somewhere visible (study tag, footer, or info popover) so analysts and clients see: `n=960`, effective n=753.6, weighted, IPF-raked.

Acceptance: HIV tab integration is complete when all of (a)-(f) check out and `SegmentProfile.jsx` has an 8-tab strip with HIV in position 2.

Commit: `feat(hiv): integrate HIV persona profile tab`. **Pause for Bryan's review before Phase C.**

---

## Phase C — Topline migration

The standalone `PRISM_HIV_Topline.html` becomes a new in-app route at `/topline`. Eight modules (6 active, 2 disabled).

### C.1 Project setup

- Create `src/components/Topline/` folder.
- Add a new route in `src/App.jsx`: `/topline` → `<Topline />`.
- Stub the component to render a placeholder.

### C.2 Port CSS as a scoped module

- Extract the `<style>` block from `dashboard_template.html` (lines ~10-513).
- Create `src/components/Topline/Topline.module.css`.
- Paste verbatim. Scope under top-level `.topline-root` class to prevent leakage (use find-and-replace prefix, not hand-editing).

### C.3 Port utility functions

Extract pure functions from `<script>` block into `src/components/Topline/utils/format.js`:
- `heatColor(dev)`, `fmtPct(v)`, `fmtMean(v)`, `fmtDelta(v, unit)`
- `sigDots(level)`, `sigDots3(level)`
- Any other pure helpers (no DOM access)

Copy-paste with no behavioral change.

### C.4 Port title page

- Create `src/components/Topline/TitlePage.jsx`.
- Translate `renderTitlePage()` from the template. Three panes: survey intro · study metadata + LOI · sample composition table.
- Pass `DATA.HIV.study` and `DATA.HIV.segments` as props.
- Verify pixel-identical to standalone topline.

### C.5 Port ROI module

- Create `src/components/Topline/RoiModule.jsx`.
- SVG is pre-computed and embedded in `dashboard.json`; render via `dangerouslySetInnerHTML`.
- Do NOT regenerate the SVG in React.

### C.5.5 Port the ROI PNG export

The standalone topline includes a PNG export feature: buttons that render the ROI SVG to PNG at multiple target widths (typically 1200px, 2400px, 4800px or similar — confirm from the standalone HTML). The React port must preserve this feature exactly.

**The export function (from the standalone HTML's `<script>` block):**

```js
function exportROIPng(targetWidth, label) {
  // 1. Get the SVG element from the DOM
  // 2. Read its viewBox to compute target height (preserves aspect ratio)
  // 3. Clone the SVG, set explicit width/height attributes, force xmlns
  // 4. Serialize to a Blob via XMLSerializer
  // 5. Load the Blob as an Image
  // 6. Draw onto a canvas at targetWidth × targetHeight
  // 7. Fill white background first (SVG bg doesn't transfer cleanly)
  // 8. canvas.toBlob → PNG → trigger download with filename PRISM_ROI_{label}_{targetWidth}px.png
}
```

**Steps:**

1. Copy `exportROIPng` from the standalone HTML's `<script>` block into `src/components/Topline/utils/exportPng.js`. Keep the function body verbatim. The function is pure DOM manipulation; it does not need React adaptation.

2. In `RoiModule.jsx`, wrap the ROI SVG render in a container div with `id="roi-svg-container"` (or whatever id the standalone HTML uses — match exactly so the export function's `getElementById` call works).

3. Render the export bar (`.roi-export-bar` div) above the ROI SVG. Buttons match the standalone HTML's button list and labels. Each button's `onClick` calls `exportROIPng(targetWidth, label)` with the same arguments the standalone HTML uses.

4. Match the export bar's CSS exactly — the `.roi-export-bar`, `.roi-export-label`, `.roi-export-btn` classes are in `Topline.module.css` after C.2's CSS port. Verify they're present.

5. The export function uses `URL.createObjectURL` and creates an `<a>` element with `download` attribute. This works in React without modification; do not refactor to use React state for the download.

**Watch out for:**

- **Fonts.** The exported PNG may render without the custom fonts (Roboto, DM Sans, Roboto Mono) if they haven't loaded by the time the SVG is rasterized. The standalone HTML has an `onerror` handler that alerts "Export failed. The SVG may use externally-loaded fonts that need a moment to load. Try again." Preserve this exact behavior.
- **CSS variables in the SVG.** The pre-computed ROI SVG in `dashboard.json` uses inline styles and explicit hex colors, not CSS variables. This is why the export works reliably across browsers. Do not rewrite the SVG to use CSS variables.
- **The white background fill.** The canvas is filled white before drawing the SVG (`ctx.fillStyle = '#ffffff'; ctx.fillRect(...)`). SVG transparent backgrounds export as black or transparent depending on browser — the explicit fill prevents that. Preserve.

### C.5.5 Verify

- Click each export button. A PNG downloads.
- Open the PNG. The aspect ratio matches the SVG viewBox. The background is white. The fonts are correct (or the alert fires if fonts haven't loaded).
- Filename matches pattern `PRISM_ROI_{label}_{targetWidth}px.png`.
- Confirm the PNG opens correctly in Preview, Adobe products, and PowerPoint (the three most likely destinations for a client deliverable).

### C.6 Port Demographics module

- Create `src/components/Topline/DemographicsModule.jsx`.
- Iterate over `DATA.HIV.demographics`; dispatch to standard frequency block or `binary_set` block (Personal Contact: QCON_LGBr1-r4).
- Implement Weighted/Unweighted toggle as module-level `useState`. Swaps `pct`/`pct_wgt` and `n`/`n_wgt` in cell display; popover shows the other.
- Preserve 5-level RUCA collapse.

### C.7 Port Items module (HIV Stigma + Critics)

- Create `src/components/Topline/ItemsModule.jsx`.
- One block per item from registry filtered by `battery`.
- HIV Stigma is umbrella: 13 stigma + 8 MFQ + 11 Knowledge + 8 composites. Render `stigma_extras.knowledge` and `stigma_extras.composites` after main items.
- Render codebook FILTER row with split-sample / LOI-reduction note for split-sample batteries.
- Implement sig-test popover: hover/click on `•`/`••` shows full stat + p-value.
- Implement K5 visual flag: `FALSE` badge in survey pane, pink-tinted banner row.

### C.8 Port Pre-Post module

- Create `src/components/Topline/PrePostModule.jsx`.
- Each item: three rows stacked (PRE · POST · Δ).
- 7 items × 3 rows × 17 cuts.

### C.9 Port Influencer360 module

- Create `src/components/Topline/InfluencerModule.jsx`.
- 5 demographics-style blocks: composites · high-engagement (14) · low-engagement (3) · followers · social-media (3).
- Exclude QSM2r1-r3 from display.

### C.10 Top nav and module nav

- Create `<ToplineNav>` (top nav + chip nav).
- Wire chips to scroll to module sections.

### C.11 Compose

- `src/components/Topline/Topline.jsx` as top-level.
- Wrap everything in `<div className="topline-root">` to scope CSS.
- Compose: `<ToplineNav /> <Advisory /> <TitlePage /> {modules.map per item_type}`.

### C.12 Print

- Preserve `window.print()` behavior. Add print-only stylesheet hiding nav + advisory.

### C.13 Add Topline link to dashboard nav

Find the Shell component (likely `src/components/Shell.jsx`). The existing nav has links to SegmentMap, AudienceROI, MessageMap, SegmentProfile. Add a Topline link matching the existing styling. Position at the end of the existing links.

### C.14 Verify Phase C

- `/topline` route renders all 6 active modules with visual parity to standalone `PRISM_HIV_Topline.html` (side-by-side eyeball check).
- Sig markers, popovers, K5 flag, Weighted/Unweighted toggle all functional.
- `dashboard.json` byte-identical to input.
- No CSS leakage from `.topline-root` into other routes (verify by opening each other route and confirming unchanged appearance).
- Print preview works.
- Topline link in dashboard nav navigates correctly.

Commit: `feat(hiv): port topline to /topline route`. **Pause.**

---

## Phase D — Deploy

### D.1 Vercel project setup
- Create new Vercel project linked to the HIV repo.
- Configure build settings (Vite defaults: `npm run build`, output `dist/`).
- Set environment variables if needed (Bryan provides).

### D.2 Domain configuration
- Add custom domain `hiv.rcghealthprism.app` in Vercel project settings.
- Configure DNS: CNAME `hiv` → `cname.vercel-dns.com` on the `rcghealthprism.app` zone. Bryan confirms DNS provider.
- Wait for SSL provisioning.

### D.3 Production deploy
- Push to `main` branch.
- Verify deploy succeeds.
- Open `hiv.rcghealthprism.app` in browser. Smoke-test every route.

### D.4 Auth (if AL deploy uses auth)
- Mirror the auth configuration from the AL deploy.
- Confirm client login gates the HIV instance correctly.
- If using shared auth across study deploys, configure to recognize this subdomain.

---

## Out of scope (DO NOT do these)

- Do not modify the American Leadership deploy or its repo. AL keeps running unchanged.
- Do not modify `compute_core.py` or any of the Python build pipeline.
- Do not modify `dashboard.json`. Fixed input.
- Do not abstract module rendering in the topline before all 8 modules are working.
- Do not introduce new state management libraries. Component-local `useState` is sufficient.
- Do not enable Module 05 (Message Testing) or Module 06 (Trusted Sources) in the topline.
- Do not refactor `studyData.js` to a multi-study schema. HIV instance holds HIV only.
- Do not introduce new dependencies without asking.
- Do not modify the bubble-map coordinates or any canonical PRISM content.
- Do not regenerate `HIV_Study_Template.xlsx`. The workbook is the source of truth and is already populated.
- Do not re-run `convert_study.py`. The output file `study.js` is a different schema from the `studyData.js` the dashboard reads. Leave the pipeline alone.

---

## Working style

- Complete each phase before starting the next. Do not parallelize.
- Within a phase, work in small commits. After each stage, run the dev server and visually verify.
- If a value is missing from a source, halt and ask Bryan. Do not fabricate.
- If the topline migration produces a visual mismatch against the standalone HTML, the bug is in the React port. Fix the React side. Do not modify `dashboard.json` or the format utilities.
- Open one draft PR per phase. Tag Bryan for review before merging to `main`.

---

## When all phases are done

Produce `MIGRATION_LOG.md` at the repo root:
- Phase-by-phase summary of what was done
- Files modified, files created, lines added/removed at headline level
- Any visual mismatches in the topline that couldn't be resolved (with screenshots)
- The final Vercel deployment URL and configuration
- Any open questions for Bryan
- Confirmation that the workbook is the single source of truth for HIV data going forward (next study run only requires updating the workbook and regenerating `studyData.js`)

Tag Bryan for sign-off.

---

## Reference: file → action map

| File | Phase A | Phase B | Phase C | Phase D |
|---|---|---|---|---|
| `package.json` | verify rename | — | — | — |
| `index.html` | verify retitle | — | — | — |
| `README.md` | verify HIV-specific | — | — | — |
| `src/data/studyData.js` | add HIV block | — | — | — |
| `src/components/SegmentMap.jsx` | renders HIV pop | — | — | — |
| `src/components/IdeologyHeatmap.jsx` | (canonical) | — | — | — |
| `src/components/AudienceROI.jsx` | add HIV branch | — | — | — |
| `src/components/MessageMap.jsx` | wave-2 placeholder | — | — | — |
| `src/components/SegmentProfile.jsx` | add HIV to STUDY_ROI, generalize PREPOST | add tab strip + HIV tab | — | — |
| `src/data/hiv/*.json` (6 files) | — | add | — | — |
| `src/components/SegmentProfile/HIVTab/*` | — | create | — | — |
| `src/components/SegmentProfile/tabs/*` | — | create stubs | — | — |
| `src/components/Topline/*` | — | — | create | — |
| `src/App.jsx` | keep `/messages` active | — | add `/topline` route | — |
| Shell / nav | — | — | add Topline link | — |
| Vercel config / DNS | — | — | — | configure |
