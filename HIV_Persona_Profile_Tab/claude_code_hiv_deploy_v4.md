# Task: Stand Up `hiv.rcghealthprism.app` — Clone, Audit, Configure, Port, Integrate, Deploy

## Goal

Stand up a new study-specific instance of the PRISM client dashboard at `hiv.rcghealthprism.app` for the HIV Treatment & Prevention study. This work has five sequential phases:

1. **Clone** the existing American Leadership (AL) dashboard codebase into a new HIV repo
2. **Audit** the cloned codebase to catalogue what is hardcoded vs. what is configurable; produce a written report
3. **Configure** the HIV instance by replacing AL-specific content with HIV equivalents (or making it data-driven)
4. **Port** the existing standalone HIV topline (`PRISM_HIV_Topline.html`) into the dashboard as a new in-app route
5. **Integrate** a new HIV-specific tab **inside the existing persona profile** (`SegmentProfile.jsx`), parameterized by whichever segment is currently being viewed. Full spec and reference implementation provided.
6. **Deploy** to `hiv.rcghealthprism.app` on Vercel

The result: a fully functional client-facing dashboard at the new subdomain, with HIV data wired through every existing component plus the new topline and the new HIV tab inside each segment's persona profile.

---

## Context

**The existing American Leadership dashboard** is a React/Vite app deployed on Vercel (assumed at `al.rcghealthprism.app` or similar). It contains five components built on the PRISM 16-segment frame:

- `SegmentMap.jsx` — interactive bubble map of the 16 segments with persona cards
- `IdeologyHeatmap.jsx` — attitudinal vectors heatmap
- `AudienceROI.jsx` — ROI scorecard view (study-keyed; currently keyed to `ESI`, `MA`)
- `SegmentProfile.jsx` — per-segment deep-dive
- `MessageMap.jsx` — message testing visualization

**The 16-segment frame is canonical PRISM content** and is reused across every study without change. The codes, names, party affiliations, population shares, and bubble-map coordinates are constants. Persona content (quotes, beliefs, demographics) is currently study-tunable in some places and hardcoded in others — the audit will resolve this.

**The HIV topline already exists as a standalone HTML** (`PRISM_HIV_Topline.html`, ~620KB) built by a Python pipeline (`compute_core.py` → `dashboard.json` → injected into `dashboard_template.html`). The migration takes this HTML's rendering logic and reimplements it as a React route inside the new HIV dashboard.

**The new HIV tab** is a study-specific view that lives **inside** the existing `SegmentProfile.jsx` component as one tab among several (Demographics, HIV, Beliefs, Values, Trust, Experience, Culture, Media). The HIV tab parameterizes by the segment currently being viewed (e.g., viewing TSP's profile shows TSP's HIV data; viewing GHI's profile shows GHI's HIV data). Full spec, data files, and reference HTML implementation are provided in §5 and the project file uploads.

---

## Files Claude Code must read before writing any code

In this order:

1. **`BUILD_GUIDE.md`** — full architectural context for the topline (sections 1-8). Read every section.
2. **The American Leadership repo** — full structure. Specifically: `package.json`, `vite.config.js`, the routing setup (likely `App.jsx` or `main.jsx`), `studyData.js` (or equivalent data module), and every `.jsx` component in `src/components/`.
3. **`dashboard_template.html`** — the ~2,000-line source for the topline migration. Note the `<style>` block (lines ~10-513) and the `<script>` block with ~47 render functions (lines ~558-end).
4. **`dashboard.json`** — the HIV topline's data feed. Read the top-level keys and their shape.
5. **`compute_core.py`** — only for understanding what `dashboard.json` contains. Do not modify.
6. **The HIV tab reference materials** uploaded by Bryan: `hiv_tab_v5.html`, `seg_data.json`, `items.json`, `bench.json`, `trust.json`, `manifest.json`, `zparams.json`. Read full details in §5.1 of this prompt.

---

## Architecture invariants (DO NOT BREAK)

These apply across every phase of the work.

### 1. The 16-segment frame is canonical
The 16 segments (TSP, CEC, TC, HF, PP, WE, PFF, HHN, MFL, VS, UCP, FJP, HCP, HAD, HCI, GHI) are constants. Their codes, names, party affiliations, and bubble-map coordinates do not change between AL and HIV. Do not modify these.

### 2. Brochure-rails three-pane layout (for topline)
Survey pane (240px) · codebook pane (240px) · banner pane (variable-width). All three rails line up vertically across every module. 18 banner columns (TOTAL + 16 segments + GOP/DEM bands). Row labels right-justified, wrap to 420px max-width.

Load-bearing CSS:
- `.banner-table td.rlbl { text-align: right; white-space: normal; max-width: 420px; }`
- `.banner-table td.cell { width: 46px }`

### 3. `dashboard.json` is immutable input
Treat as a fixed input contract. Do not restructure, normalize, rename keys, or pre-process. Import as-is.

### 4. Significance markers are pre-computed
`•` = p<.05, `••` = p<.01. Stats and p-values come from `dashboard.json`. Do not recompute.

### 5. Composites are per-study
The eight HIV composites (MBS, SDS, EDS, SCS, CFS, PFS, SCF, HKS) are this study's indices, not canonical PRISM constructs. Do not abstract them into shared components. Render whatever `dashboard.json` provides.

### 6. The K5 trap item visual flag
Knowledge item "epidemic is effectively over" is the trap: `FALSE` badge in survey pane, pink-tinted banner row. Excluded from HKS scoring. Preserve this rendering.

### 7. Module order is locked
01 HIV Stigma · 02 Pre-Post · 03 ROI Scorecard · 04 Critics · 05 Message Testing (disabled) · 06 Trusted Sources (disabled) · 07 Demographics · 08 Influencer360.

### 8. Data is pre-cleaned at the Python layer, not the React layer
The Python pipeline (`prism_hiv_dashboard.py` rev. 2026-05-16) systematically recodes non-response codes (98, 99, 998, 999) to missing across all Q-prefix variables before any aggregation. The React app must NOT re-validate or clean numeric values. If a value looks wrong, the bug is in the Python pipeline — flag it for Bryan, do not patch in JS.

---

## PHASE 1 — Clone

### Stage 1.1: Clone the AL repo into a new HIV repo
- Identify the American Leadership repo (Bryan provides the git URL).
- Clone to a new local directory: `prism-hiv-dashboard/`.
- Initialize a new git remote (Bryan provides the new GitHub repo URL).
- First commit: "Initial clone from prism-american-leadership at commit <sha>" — preserve provenance.

### Stage 1.2: Project-level renames
- `package.json`: update `name` to `prism-hiv-dashboard`, `version` to `0.1.0`.
- `index.html`: update `<title>` to "PRISM HIV Treatment & Prevention".
- `README.md`: update with HIV-specific description.
- Any references to "American Leadership" or "al-dashboard" in config, CI, or deployment files — replace with HIV equivalents.

### Stage 1.3: Verify the cloned app runs
- `npm install` (or `yarn`/`pnpm`, match the AL project's package manager).
- `npm run dev` — confirm the app starts and renders the existing AL views without errors.
- At this point the app is still showing American Leadership content. That is correct. Configuration happens in Phase 3.

---

## PHASE 2 — Audit (Deliverable: written report)

### Stage 2.1: Catalogue every hardcoded value

Read every `.jsx` file in `src/components/` plus `studyData.js` and any other data modules. For each file, identify and classify every literal value, constant, or hardcoded string. Use this taxonomy:

**Category A — Stable PRISM constants (intentional, do not change between studies)**
Examples: the 16 segments and their codes/names; bubble map coordinates in `SegmentMap.jsx`; the GOP/DEM color palette; canonical scale anchors.

**Category B — Study-specific content (must change for HIV)**
Examples: study title, client name, survey intro text, ROI normative values if hardcoded, message stimuli text, persona quotes if AL-specific, any text mentioning American Leadership themes by name.

**Category C — Already configurable through `studyData`**
Examples: per-segment metrics, ROI scorecard cells, message map data. Verify these flow correctly when `studyData` changes.

**Category D — Should be configurable but isn't (technical debt)**
Examples: hardcoded theme color assignments (`THEME_COLORS` in `MessageMap.jsx`); hardcoded row heights; hardcoded popover dimensions; hardcoded persona card image paths if they don't update with study context.

### Stage 2.2: Produce the audit report

Write `AUDIT.md` at the root of the new HIV repo. Structure:

```markdown
# PRISM Dashboard — Hardcoded vs. Configurable Audit
Date: <today>
Source: prism-american-leadership @ <sha>

## Summary
- Total files reviewed: <n>
- Category A items (stable, do not change): <n>
- Category B items (study-specific, must change for HIV): <n>
- Category C items (already configurable): <n>
- Category D items (should be configurable, technical debt): <n>

## File-by-file findings

### `src/components/SegmentMap.jsx`
**Category A items:**
- `BUBBLES` array (lines X-Y): coordinates, sizes, z-index for each of 16 segments. KEEP.
- `STAGE_W`, `STAGE_H` (line X): canvas dimensions. KEEP.
- `DEM_FILL`, `GOP_FILL` colors. KEEP.

**Category B items:**
- `CARD_IMAGES` paths (lines X-Y): point to `/prism-demo/*Card.PNG`. NEEDS REPLACEMENT for HIV — confirm whether HIV uses the same persona cards or has HIV-specific ones.

**Category D items:**
- Persona quote popover dimensions hardcoded at lines X. Should flow from theme config.

### `src/components/AudienceROI.jsx`
[... similar structure ...]

[Repeat for every component file and data module.]

## Recommended action for HIV configuration
For each Category B item, state the exact change required and the new value (or note "needs Bryan input").
For each Category D item, mark as "defer to canonical layer refactor" unless it blocks HIV functionality.
```

### Stage 2.3: Pause for Bryan review

Do not proceed to Phase 3 until Bryan has reviewed `AUDIT.md`. Bryan will:
- Confirm Category A items (stable) are correctly identified
- Provide the HIV-specific replacement values for Category B items he hasn't explicitly specified
- Decide which Category D items to defer

Output a comment on the audit PR or chat-back summary listing any ambiguities for Bryan to resolve.

---

## PHASE 3 — Configure for HIV

### Stage 3.1: Apply Category B replacements

Using the resolved audit, replace every American Leadership-specific value with its HIV equivalent. Examples (Bryan confirms exact values):

- Study metadata: `id`, `title`, `client`, `subtitle`, `fieldDates`, `n`, `weightingTarget`
- Survey intro text in title pane
- Branding strings (if any)
- AL-specific message stimuli → HIV stimuli (these come from `dashboard.json`, but check for any hardcoded fallbacks)
- AL-specific persona content → confirm whether HIV uses the same canonical PRISM personas or a study-tuned variant

### Stage 3.2: Replace `studyData.js`

Replace the AL data module with HIV data:
```js
// before
import esi from "./esi.json";
import ma from "./ma.json";
const DATA = { ESI: esi, MA: ma };
export default DATA;

// after — single-study HIV instance
import hiv from "./dashboard.json";
const DATA = { HIV: hiv };
export default DATA;
```

If components reference specific study keys (`DATA.ESI`, `DATA.MA`), update them to use `DATA.HIV`. The existing pattern in `AudienceROI.jsx` and `MessageMap.jsx` should adapt cleanly.

### Stage 3.3: Verify all five existing components render

Run the dev server. Visit each of the five existing views:
- SegmentMap
- IdeologyHeatmap
- AudienceROI
- SegmentProfile
- MessageMap

Each must render without errors using HIV data. Visual fidelity to the AL deploy is expected (same layout, same component structure) — only the content has changed.

If any component is fundamentally AL-specific (i.e., shows content that doesn't exist for HIV), flag it for Bryan's decision: keep, hide, or replace with HIV-equivalent.

---

## PHASE 4 — Topline migration

The standalone `PRISM_HIV_Topline.html` becomes a new in-app route at `/topline`. Eight modules (6 active, 2 disabled).

### Stage 4.1: Project setup
- Create `src/components/Topline/` folder.
- Add a new route in the router: `/topline` → `<Topline />`.
- Stub the component to render a placeholder.

### Stage 4.2: Port CSS as a scoped module
- Extract the `<style>` block from `dashboard_template.html` (lines ~10-513).
- Create `src/components/Topline/Topline.module.css`.
- Paste verbatim. Scope under top-level `.topline-root` class to prevent leakage (use find-and-replace prefix, not hand-editing).

### Stage 4.3: Port utility functions
Extract pure functions from `<script>` block into `src/components/Topline/utils/format.js`:
- `heatColor(dev)`, `fmtPct(v)`, `fmtMean(v)`, `fmtDelta(v, unit)`
- `sigDots(level)`, `sigDots3(level)`
- Any other pure helpers (no DOM access)

Copy-paste with no behavioral change.

### Stage 4.4: Port title page
- Create `src/components/Topline/TitlePage.jsx`.
- Translate `renderTitlePage()` from the template. Three panes: survey intro · study metadata + LOI · sample composition table.
- Pass `DATA.HIV.study` and `DATA.HIV.segments` as props.
- Verify pixel-identical to standalone topline.

### Stage 4.5: Port ROI module
- Create `src/components/Topline/RoiModule.jsx`.
- SVG is pre-computed and embedded in `dashboard.json`; render via `dangerouslySetInnerHTML`.
- Do NOT regenerate the SVG in React.

### Stage 4.6: Port Demographics module
- Create `src/components/Topline/DemographicsModule.jsx`.
- Iterate over `DATA.HIV.demographics`; dispatch to standard frequency block or `binary_set` block (Personal Contact: QCON_LGBr1-r4).
- Implement Weighted/Unweighted toggle as module-level `useState`. Swaps `pct`/`pct_wgt` and `n`/`n_wgt` in cell display; popover shows the other.
- Preserve 5-level RUCA collapse.

### Stage 4.7: Port Items module (HIV Stigma + Critics)
- Create `src/components/Topline/ItemsModule.jsx`.
- One block per item from registry filtered by `battery`.
- HIV Stigma is umbrella: 13 stigma + 8 MFQ + 11 Knowledge + 8 composites. Render `stigma_extras.knowledge` and `stigma_extras.composites` after main items.
- Render codebook FILTER row with split-sample / LOI-reduction note for split-sample batteries.
- Implement sig-test popover: hover/click on `•`/`••` shows full stat + p-value.
- Implement K5 visual flag: `FALSE` badge in survey pane, pink-tinted banner row.

### Stage 4.8: Port Pre-Post module
- Create `src/components/Topline/PrePostModule.jsx`.
- Each item: three rows stacked (PRE · POST · Δ).
- 7 items × 3 rows × 17 cuts.

### Stage 4.9: Port Influencer360 module
- Create `src/components/Topline/InfluencerModule.jsx`.
- 5 demographics-style blocks: composites · high-engagement (14) · low-engagement (3) · followers · social-media (3).
- Exclude QSM2r1-r3 from display.

### Stage 4.10: Top nav and module nav
- Create `<ToplineNav>` (top nav + chip nav).
- Wire chips to scroll to module sections.

### Stage 4.11: Compose
- `src/components/Topline/Topline.jsx` as top-level.
- Wrap everything in `<div className="topline-root">` to scope CSS.
- Compose: `<ToplineNav /> <Advisory /> <TitlePage /> {modules.map per item_type}`.

### Stage 4.12: Print
- Preserve `window.print()` behavior. Add print-only stylesheet hiding nav + advisory.

---

## PHASE 5 — Integrate the HIV tab inside `SegmentProfile.jsx`

The HIV tab is **a sub-tab within the existing persona profile component**, not a top-level new route. It joins the existing tab strip (Demographics, Beliefs, Values, Trust, Experience, Culture, Media) as a new entry positioned **second** in the tab order: Demographics · **HIV** · Beliefs · Values · Trust · Experience · Culture · Media.

### Stage 5.1: Reference materials (uploaded by Bryan)

A complete reference HTML implementation and all supporting data files have been provided in the project uploads. Use these as the ground truth for layout, behavior, and data shape:

| File | Purpose |
|---|---|
| `hiv_tab_v5.html` | Self-contained reference implementation: full markup, CSS, SVG charts, all interactive behaviors. The HIV tab is shown active; hardcodes FJP (segment 12) as the focal segment for demonstration. |
| `seg_data.json` | Per-segment composite data for all 16 segments: MBS, SDS, EDS, SCS, CFS, PFS, SCF (raw + z), HKS, CON_HIV, CON_LGB, and rank fields. **This is what the tab consumes when the focal segment changes.** |
| `items.json` | Item-level data for the four accordions (SCF, stigma, knowledge, contact). Each item has `code`, `stem`, `binary`, plus values for: `focal` (legacy FJP value), `by_segment` (object keyed by segment_id 1-16, populated by the fixed Python pipeline), `All`, `Republicans`, `Democrats`. **Read `by_segment[segmentId]` for the currently-viewed segment; ignore the `focal` field in the React port.** |
| `bench.json` | Benchmark composites for `All`, `Republicans`, `Democrats`. Drives the compare-bar toggle. |
| `trust.json` | 22 trust messenger items with same `by_segment` + `All`/`Republicans`/`Democrats` structure as items.json. Values are weighted means on the 1-7 trust scale. The pipeline now systematically recodes 98/99/998/999 non-response codes to missing across all Q* variables, so values are guaranteed to be in valid range. |
| `manifest.json` | Study metadata: `n_raw=960`, `effective_n=753.6`, design effect, IPF rake dimensions, weighting notes, and exclusions (QHIVr5 is the foil item excluded from HKS; QTRUSTr3 personal physician excluded; QHIVSTIGMAr9-r13 are within-subject controls not in composites). |
| `zparams.json` | Mean and SD for each composite, used as z-score standardization parameters. |
| `prism_hiv_dashboard.py` | Python script that built the JSON files from `260433.sav`. Read for understanding only — do not run or modify. |
| `prism_hiv_dashboard.sps` | SPSS syntax used in data prep. Read for understanding only. |

### Stage 5.2: Tab structure (eight sub-views)

If the existing `SegmentProfile.jsx` does not yet have a tab strip, create one with these eight tabs:

1. **Demographics** — existing content (currently shown via the persona "demo" object); refactor into a tab body
2. **HIV** — NEW, this implementation
3. **Beliefs** — placeholder tab (renders existing "believe" persona content)
4. **Values** — placeholder tab (renders existing "want" / values content)
5. **Trust** — placeholder tab (the HIV tab's Section 3 trust battery may eventually move here; for now it stays inside the HIV tab)
6. **Experience** — placeholder tab (renders existing "doWhat" / "whoAre" content)
7. **Culture** — placeholder tab (stub for V2)
8. **Media** — placeholder tab (stub for V2)

The HIV tab is the only one with new structure. The other seven re-organize existing persona profile content into a tabbed layout. **Do not re-author persona content; just reorganize what's already there.**

### Stage 5.3: HIV tab — three sections

The HIV tab body has three sections, in order. All are parameterized by the focal segment (the segment whose profile is currently being viewed).

**Section 1 — Four headline tiles (4-column grid)**

| Tile | What it shows | Data source |
|---|---|---|
| **Compassion ↔ Sanctity** | Vertical SCF scale (Care ↔ Sanctity moral spectrum). Shows focal segment marker on left; R/D/US benchmark glyphs on right; rank ("rank N of 16"); delta vs. active benchmark. Item-level accordion below (CFS items + PFS items + SCF composite). | `seg_data.json[focal].SCF_raw`, `seg_data.json[focal].SCF_rank`, `bench.json[bench].SCF.raw`, `items.json.scf` |
| **Stigma Profile — Blame & Avoidance** | Two parallel glyph rows (BLAME / AVOIDANCE) with values 0-7 mapped to filled chevron glyphs. Includes seesaw bar showing which channel dominates. Item-level accordion with stigma items (SB1, SB2, MBS, SD1, SD2, SDS). | `seg_data.json[focal].MBS_raw`, `.SDS_raw`, `items.json.stigma` |
| **HIV Knowledge** | Horizontal bar 0-10 showing sum of correct knowledge items. Focal value, active benchmark tick, rank label ("3 OF 16"). Item-level accordion with 10 knowledge items (K1, K2, K3, K4, K6, K7, K8, K9, K10, K11 — K5 excluded as foil). | `seg_data.json[focal].HKS`, `seg_data.json[focal].HKS_rank`, `bench.json[bench].HKS`, `items.json.know` |
| **Personal Contact** | Two binary measures (CON-HIV: knows person with HIV; CON-LGB: knows LGBTQ person). Side-by-side percentages with benchmark deltas. Item-level accordion with both items. | `seg_data.json[focal].CON_HIV`, `.CON_LGB`, `seg_data.json[focal].CON_HIV_rank`, `.CON_LGB_rank`, `items.json.contact` |

**Section 2 — Strategic Positioning (scatter plot)**

A scatter of all 16 segments. X-axis is stigma (MBS or composite of stigma), Y-axis is policy support (or SCF — verify in reference HTML). Bubble size proportional to `pop`. Focal segment highlighted; others dimmed. The data array is `STR` in the reference HTML (`seg`, `stigma`, `policy`, `pop`, `scf`). For the React port, regenerate from `seg_data.json` where possible.

**Section 3 — Trust Messengers (22-item battery)**

Vertical list of 22 trust messenger items, sorted by focal segment's trust score (highest first). Each row shows: messenger name, focal bar, benchmark bar, delta. The reference HTML's TRUST array has cleaner numeric values than `trust.json` — use the HTML's data values until Bryan confirms which is authoritative.

### Stage 5.4: Compare-bar toggle (top of tab body)

Three buttons: **All Americans** (US glyph) · **Republicans** (R glyph) · **Democrats** (D glyph). One is active at a time. Selecting a button:
- Updates all benchmark glyphs throughout the tab (active = solid, inactive = dim)
- Recomputes all deltas (focal − benchmark)
- Updates accordion column headers
- Updates the readout text under SCF tile, knowledge bar marker, contact tile, and scatter axes

Initial state: `Democrats` is active (matches the reference HTML).

### Stage 5.5: Parameterize by segment (the critical change)

The reference HTML hardcodes FJP (segment 12) as focal. The React port **must** parameterize by the segment currently being viewed in `SegmentProfile`. Implementation:

```jsx
// In SegmentProfile.jsx
const [searchParams] = useSearchParams();
const segmentCode = searchParams.get('seg') || 'TSP';  // or whatever pattern matches existing routing
const segmentId = SEGMENTS.find(s => s.code === segmentCode)?.id;

// Pass to HIVTab
<HIVTab segmentId={segmentId} segmentCode={segmentCode} />
```

Inside the HIV tab, every reference to "FJP" or "focal" in the reference HTML becomes a lookup against `seg_data.json[segmentId]` and `segmentCode` as the display label. When the user clicks a different segment pill at the top of `SegmentProfile`, the HIV tab re-renders with that segment as focal.

### Stage 5.6: Implementation steps

1. **Read `hiv_tab_v5.html` end to end** before writing any code. The SVG generation logic for the SCF vertical scale, the stigma seesaw, the knowledge bar, the scatter plot, and the trust ranking are all hand-rolled and non-trivial.

2. **Place the data files.** Copy all uploaded JSON files into `src/data/hiv/`:
   ```
   src/data/hiv/seg_data.json
   src/data/hiv/items.json
   src/data/hiv/bench.json
   src/data/hiv/trust.json
   src/data/hiv/manifest.json
   src/data/hiv/zparams.json
   ```

3. **Create the component tree:**
   ```
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
   ```

4. **Port the CSS.** The reference HTML uses CSS custom properties (`--bg-deep`, `--accent-magenta`, etc.) for a dark theme. If the rest of the dashboard is also dark-themed, these may already exist as global variables — verify. Otherwise scope the HIV tab's styles under `.hiv-tab-root` to prevent the dark theme from leaking into other tabs.

5. **Port the SVG renderers.** The reference HTML uses `document.createElementNS()` to build SVG elements imperatively. In React, translate to JSX where possible (most of the SCF chart, knowledge bar, stigma glyphs can be pure JSX). For the scatter plot which involves more complex positioning logic, a `<svg>` element with mapped children works fine.

6. **Wire the compare-bar state.** `useState('Democrats')` at the `HIVTab` level. Pass `bench` as a prop to every tile, scatter, and trust component. Each child re-renders when bench changes.

7. **Verify parameterization** by switching between segments in the parent profile. Open TSP, switch tabs to HIV, confirm TSP's data shows. Click on UCP in the pill bar at top, confirm the HIV tab updates to UCP's data without remounting the entire profile.

### Stage 5.7: Reading focal item values per segment

The fixed Python pipeline (`prism_hiv_dashboard.py` revision 2026-05-16) populates `by_segment` for every item and every trust messenger. The React port reads `item.by_segment[segmentId]` for the current segment's value, with the existing `All`, `Republicans`, `Democrats` fields used for benchmark display.

In code:
```jsx
const focalValue = item.by_segment[String(segmentId)];
const benchValue = item[bench];  // 'All' | 'Republicans' | 'Democrats'
const delta = focalValue - benchValue;
```

No need to halt or request anything from Bryan at this stage — the data is complete.

If a `by_segment[sid]` value comes back as `null` (segment has no respondents on that item, e.g., very small cell after weighting filters), the accordion row should render the value as `—` rather than `0.00`.

### Stage 5.8: Acceptance for Phase 5

The HIV tab integration is complete when:

1. Opening any segment's profile shows a tab strip with 8 tabs.
2. Clicking "HIV" displays the three-section layout from `hiv_tab_v5.html`.
3. Switching the compare bar between All / R / D updates every value, glyph, and delta in the tab.
4. Switching between segments (via the pill bar in the profile) updates the HIV tab to show that segment's data.
5. The seven other tabs render (even if as placeholders) without errors.
6. The dark-theme CSS does not leak into other parts of the dashboard.
7. The `manifest.json` notes are surfaced somewhere visible (study tag, footer, or info popover) so analysts and clients see: `n=960`, effective n=753.6, weighted, IPF-raked.

---

## PHASE 6 — Deploy

### Stage 6.1: Vercel project setup
- Create new Vercel project linked to the HIV repo.
- Configure build settings (Vite defaults: `npm run build`, output `dist/`).
- Set environment variables if needed (Bryan provides; likely study identifier or feature flags).

### Stage 6.2: Domain configuration
- Add custom domain `hiv.rcghealthprism.app` in Vercel project settings.
- Configure DNS: CNAME `hiv` → `cname.vercel-dns.com` (or current Vercel guidance) on the `rcghealthprism.app` zone. Bryan confirms DNS provider.
- Wait for SSL provisioning.

### Stage 6.3: Production deploy
- Push to `main` branch.
- Verify deploy succeeds.
- Open `hiv.rcghealthprism.app` in browser. Smoke-test every route.

### Stage 6.4: Auth (if AL deploy uses auth)
- Mirror the auth configuration from the AL deploy.
- Confirm client login gates the HIV instance correctly.
- If using shared auth across study deploys, configure to recognize this subdomain.

---

## Acceptance criteria

The work is complete when ALL of these are true:

### Phase 1-3 (clone + audit + configure)
1. `AUDIT.md` exists at the root of the new HIV repo, fully populated, reviewed by Bryan.
2. All Category B (AL-specific) items have been replaced with HIV equivalents.
3. All five existing components (SegmentMap, IdeologyHeatmap, AudienceROI, SegmentProfile, MessageMap) render without errors using HIV data.
4. No "American Leadership" strings remain in the codebase (run `grep -ri "american leadership" src/` returns nothing meaningful).

### Phase 4 (topline)
5. `/topline` route renders all 6 active modules with visual parity to standalone `PRISM_HIV_Topline.html` (side-by-side eyeball check).
6. Sig markers, popovers, K5 flag, Weighted/Unweighted toggle all functional.
7. `dashboard.json` byte-identical to input.
8. No CSS leakage from `.topline-root` into other routes (verify by opening each other route and confirming unchanged appearance).

### Phase 5 (HIV tab inside persona profile)
9. `SegmentProfile.jsx` has an 8-tab strip; HIV is the second tab and active by default for the HIV deploy.
10. HIV tab renders three sections (4-tile headline, scatter, trust battery) per the reference `hiv_tab_v5.html`.
11. Compare bar (All / Republicans / Democrats) updates every value, glyph, and delta when toggled.
12. Switching segments (TSP → CEC → GHI etc.) updates the HIV tab data to that segment without remounting the profile.
13. Other seven tabs render without errors (placeholders acceptable for V1).
14. Dark theme of the HIV tab does not leak into other tabs or other dashboard routes.

### Phase 6 (deploy)
15. `hiv.rcghealthprism.app` resolves and serves the dashboard over HTTPS.
16. All routes accessible. Auth (if applicable) gates correctly.
17. AL deploy at its existing domain remains untouched and functional.

---

## Out of scope (DO NOT do these)

- **Do not modify the American Leadership deploy or its repo.** This is a clone; the AL deploy keeps running unchanged.
- **Do not modify `compute_core.py`** or any of the Python build pipeline.
- **Do not modify `dashboard.json`.** It is fixed input.
- **Do not abstract module rendering** in the topline before all 8 modules are working.
- **Do not introduce new state management libraries.** Component-local `useState` is sufficient.
- **Do not enable Module 05 (Message Testing) or Module 06 (Trusted Sources)** in the topline.
- **Do not refactor `studyData.js` to a multi-study schema.** This HIV instance holds HIV only. Multi-study aggregation is a future canonical-layer concern, not for this build.
- **Do not introduce new dependencies** without asking. The existing stack (React, Vite, react-router-dom, whatever is in AL's `package.json`) is the constraint.
- **Do not modify the bubble-map coordinates** or any Category A item identified in the audit.

---

## Working style

- Phase 1 must complete before Phase 2; Phase 2 must complete (with Bryan review) before Phase 3; and so on. Do not parallelize phases.
- Within a phase, work in small commits. After each stage, run the dev server and visually verify.
- If a Category B replacement value is missing from the audit, halt and request it. Do not fabricate study content.
- If the topline migration produces a visual mismatch against the standalone HTML, the bug is in the React port. Fix the React side. Do not modify `dashboard.json` or the format utilities.
- For Phase 5 (HIV tab), the data files now include `by_segment` for every item and trust messenger. Read from there; do not halt to request anything.
- Open one draft PR per phase. Tag for review before merging to `main`.

---

## Reference: file → action map

| File | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 |
|---|---|---|---|---|---|---|
| `package.json` | rename | audit | — | — | — | — |
| `index.html` | retitle | — | — | — | — | — |
| `src/components/SegmentMap.jsx` | — | audit | replace AL refs | — | — | — |
| `src/components/IdeologyHeatmap.jsx` | — | audit | replace AL refs | — | — | — |
| `src/components/AudienceROI.jsx` | — | audit | switch to HIV data | — | — | — |
| `src/components/SegmentProfile.jsx` | — | audit | replace AL refs | — | refactor: add tab strip | — |
| `src/components/MessageMap.jsx` | — | audit | switch to HIV data | — | — | — |
| `src/data/studyData.js` | — | audit | replace with HIV | — | — | — |
| `src/data/dashboard.json` | — | — | add (HIV input) | consumed | possibly consumed | — |
| `src/data/hiv/*.json` (6 files) | — | — | — | — | add | — |
| `src/components/Topline/*` | — | — | — | create | — | — |
| `src/components/SegmentProfile/HIVTab/*` | — | — | — | — | create | — |
| `src/components/SegmentProfile/tabs/*` | — | — | — | — | create stubs | — |
| Vercel config / DNS | — | — | — | — | — | configure |
| `AUDIT.md` | — | create | reference | — | — | — |

---

## When the work is done

Produce a final summary at the root of the repo: `MIGRATION_LOG.md`. Include:

- Phase-by-phase summary of what was done
- Any Category D items deferred (with rationale)
- Any visual mismatches in the topline that couldn't be resolved (with screenshots)
- The final Vercel deployment URL and configuration
- Any open questions for Bryan
- A list of files modified, files created, and lines of code added/removed at the headline level

Tag Bryan for sign-off.
