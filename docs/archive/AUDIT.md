# PRISM Dashboard — Hardcoded vs. Configurable Audit

_Generated after Phase A wire-up. Covers `src/pages/`, `src/components/`, `src/App.jsx`, and `src/data/*`._

## Summary

| Category | Count | Action |
|----------|-------|--------|
| A — Stable PRISM constants     | ~22 entries (grouped by file) | leave as-is |
| B — Study-specific (still hardcoded for AL or wrong for HIV) | 12 | fix before deploy |
| C — Already configurable via studyData / study.js | 5 surfaces | verify only |
| D — Technical debt (should be configurable but isn't) | 18 | defer / log for future |

**Top 3 priority items:**

1. `src/pages/Login.jsx:80` — login card still says "AMERICAN LEADERSHIP STUDY" in uppercase under the PRISM logo. This is the first thing any user sees (when auth isn't bypassed). **HIGH**.
2. `src/pages/SegmentProfile.jsx:7-152` — the top-level `SEGMENTS` constant is a parallel copy of segments with hardcoded AL-era `roi`, `highRoi`, `supporters`, `activation`, `influence`, `persuadability`, and `tier` values that disagree with the HIV numbers in `study.js`. Currently dead (the visible ROI card reads from `STUDY_ROI`, the tier badge from `getAssignedTier`), but the file imports persona/demo from this same array. Either trim the dead fields or replace the array with `import { SEGMENTS } from "../data/segments"`.
3. `src/pages/SegmentProfile.jsx:214-231` STUDY_ROI / 1023-1074 BELIEFS / 1077-1153 EXP_DATA / 1192-1209 SEGMENT_BELIEFS / 1290-1310 NICE_NAMES, and `src/pages/IdeologyHeatmap.jsx:69-85` IDEOLOGY_DATA — all of these are **duplicate copies** of canonical tables that already live in `src/data/{trust,experiential,ideology,vectors,study}.js` but were copy-pasted into the page files. Source of truth ambiguity = silent drift risk.

---

## Category A — Stable PRISM constants

These are intentional and shared across studies. Do not touch.

### `src/data/segments.js`
- **L6–119** — Canonical 16-segment skeleton: id/code/name/party/pop/demo/persona quote/believe/want/doWhat/whoAre. This is the source-of-truth content for every study.
- **L121–132** — Derived helpers (`GOP_SEGS`, `DEM_SEGS`, `SEG_BY_CODE`, `popAvg`).

### `src/data/theme.js`
- **L5–36** — Color palette (`C`) and party color helper. GOP red / DEM blue / cyan / violet / etc. are the PRISM brand.
- **L38–39** — Font stack (`FONT`, `MONO`).

### `src/data/ideology.js`
- **L6–47** — `IDEOLOGY_GROUPS` (5 factor domains, 15 bipolar scales). PRISM ideology framework.
- **L49–65** — `IDEOLOGY_DATA` (15 × 16 matrix). Stable canonical scores from PRISM Pulse, not study-specific.

### `src/data/trust.js`
- **L5–10** — `TRUST_DATA` (GOVT/CORP/GAP arrays per segment).
- **L12–29** — `ENTITIES` (16-element trust values for Pharma/Insurer/Hospital/etc.).
- **L32–83** — `BELIEFS` battery (top-3-box per segment for ~50 attitude/policy items).
- **L86–103** — `SEGMENT_BELIEFS` curated 4-item lists per segment.
- **L108–128** — `NICE_NAMES` belief-code → display-name map.
- **L131–136** — `INS_REFORM` (Single Payer / Public Option / ESI / Status Quo with `color` hex codes — those colors are theme colors and stable).

### `src/data/experiential.js`
- **L6–14** `EXP_DATA`, **L17–24** `INSURANCE_TYPE`, **L27–37** `GOP_PODS`, **L39–48** `DEM_PODS`, **L51–61** `NEWS`, **L64–72** `WELL_ORIENT`, **L75–86** `WELL_LIFE`, **L89** `HBIS_SUM` — canonical PRISM Pulse data tables.

### `src/data/vectors.js`
- **L6–17** `GOP_VECTORS`, **L19–26** `DEM_VECTORS`, **L28–33** `GOP_AXES`, **L35–40** `DEM_AXES` — discriminant-function loadings; stable.

### `src/pages/SegmentMap.jsx`
- **L5–22** — `BUBBLES` array (segment bubble-map coordinates / sizes / z-order / pop). Coordinates derived from the PRISM master-art HTML.
- **L24–42** — `CARD_IMAGES` (segment → `/prism-demo/*Card.png`). Image filenames are PRISM brand cards; OK as-is (but see Category D about the `/prism-demo/` path prefix).
- **L45–46** — `STAGE_W`, `STAGE_H` (5325 × 1959) — viewBox dimensions from the master art.
- **L50–55** — `DEM_FILL / DEM_STROKE / DEM_TEXT / GOP_FILL / GOP_STROKE / GOP_TEXT` — party colors specific to this page; map matches PRISM palette.
- **L208–217** — DEM/GOP divider line and "DEMOCRATIC SEGMENTS" / "REPUBLICAN SEGMENTS" backdrop labels.

### `src/pages/IdeologyHeatmap.jsx`
- **L4–21** — `SEGS` (same 16 codes/names/party as `segments.js`, narrower shape) — duplicated, but content is canonical.
- **L24–67** — `GROUPS` (identical content to `data/ideology.js` `IDEOLOGY_GROUPS`).
- **L88–108** — `getColor`, `getTextColor` heatmap palette (PRISM-stable blue→steel→red gradient on 1–7 scale).
- **L349** — `"BIPOLAR IDEOLOGY SCALES · 1–7 · N=16 SEGMENTS"` footer line.

### `src/pages/SegmentProfile.jsx`
- **L233–258** `GOP_VECTORS` / `DEM_VECTORS` / `GOP_AXES` / `DEM_AXES` — duplicated from `data/vectors.js` (canonical content but copy-pasted; see Category D).
- **L260–293** — `VECTOR_DEFS` (vector-axis tooltip narrative text). Stable PRISM framework copy. **Category A.**
- **L303–346** — `IDEOLOGY_GROUPS` / `IDEOLOGY_DATA` (duplicated canonical content, see Category D).
- **L349–352** — `TIER_BG` / `TIER_TEXT` / `TIER_ACCENT` / `TIER_LABELS` (color palette for tier badges; matches `TIER_CONFIG` in `study.js`). Stable.
- **L356–363** — `C` color palette (page-local theme).
- **L367–436** — `STATE_PATHS` (US Census Division SVG path strings for the geography map). Stable.
- **L986–992** — `CP` color palette (profiler subsection theme).

### `src/components/Shell.jsx`
- **L5–10** — `NAV_ITEMS` (4 nav tabs, stable across studies).
- **L16** — Google Fonts URL; stable.

### `src/data/study.js`
- **L42–43** — `CONTROL_SOP = []` / `VARIANT_SOP = []` — intentional empty wave-1 sentinels.
- **L102–106** — `TIER_CONFIG` (tier1/2/3 colors). Same palette as `TIER_BG`/`TIER_TEXT`/`TIER_ACCENT` in SegmentProfile.

---

## Category B — Study-specific content (must change for HIV)

| # | Location | Severity | Issue |
|---|----------|----------|-------|
| B1 | `src/pages/Login.jsx:80` | **HIGH** | Login card header reads `AMERICAN LEADERSHIP STUDY`. Must say `HIV STUDY` (or pull from `STUDY_META.name`). User-visible on first paint. |
| B2 | `src/pages/SegmentProfile.jsx:7–152` (SEGMENTS array, `tier:` field) | **MED** | Hardcoded `tier:` values for every segment are AL-era. e.g. TSP=3, CEC=1, TC=1, HF=1, HCP=3 — HIV `ASSIGNED_TIERS` says TSP=1, CEC=2, TC=3, HF=1, HCP=1. Currently the field is dead (badge reads `getAssignedTier`), but `t = seg.tier` is still assigned at L1976 and the value is wrong. |
| B3 | `src/pages/SegmentProfile.jsx:9–146` (SEGMENTS array, `roi/highRoi/supporters/activation/influence/persuadability` fields) | **MED** | All AL-era values, all dead (no `seg.roi` / `seg.highRoi` / etc. usage anywhere). Risk of someone wiring them back up by accident and shipping wrong numbers. |
| B4 | `src/pages/SegmentProfile.jsx:2054` | **LOW** | Comment reads `{/* ROI Card — AL Study */}` immediately above the HIV ROI card. Stale comment. |
| B5 | `src/data/studyData.js:3` | **LOW** | Header comment says `Run: python convert_data.py MAESIDashboardData.xlsx`. No such file exists; HIV uses `extract_hiv.py` + `HIV_Study_Template.xlsx`. |
| B6 | `src/data/studyData.js:6–1090` | **MED** | `DATA.segments` block (lines 7–120) uses integer `pop` values (2, 7, 6, 9, 11, 10) that disagree with the percentage values in `data/segments.js` (0.02, 0.07, …) and with `BUBBLES` in `SegmentMap.jsx` (which uses 2, 7, …). Two scales coexist. Plus the per-segment HIV block under `DATA.HIV.segments` is a full duplicate of `STUDY_METRICS` in `study.js` (see Cross-cutting). |
| B7 | `src/pages/SegmentProfile.jsx:1989` | **LOW** | Header eyebrow text `RESERVOIR HEALTH PRISM`. Same on `IdeologyHeatmap.jsx:142` (`RESERVOIR HEALTH PRISM PULSE`). Reservoir is the agency, not the client (Gilead) — confirm with Bryan whether this should reference Gilead or stay generic. Not technically wrong for HIV, but is hard-coded copy. |
| B8 | `src/pages/SegmentProfile.jsx:2119` / `src/pages/IdeologyHeatmap.jsx:348` | **LOW** | Footers read `PRISM V3.1 · RESERVOIR COMMUNICATIONS GROUP · CONFIDENTIAL & PROPRIETARY`. PRISM version + agency string; A-category copy in the sense it doesn't claim "AL", but the version number is hardcoded. Tag as LOW. |
| B9 | `src/pages/SegmentProfile.jsx:1990` / `:2120` | **LOW** | Title text `PERSONA PROFILE` and `PRISM AUDIENCE INTELLIGENCE · PRISM PERSONAS` — generic, fine for HIV but tied into agency boilerplate. |
| B10 | `src/pages/SegmentProfile.jsx:2064` | n/a | `HIV STUDY ROI` label is **correct** for this study but is hardcoded as a string literal instead of reading `STUDY_META.name + " STUDY ROI"`. Not B per se (it says HIV), but flagged so re-skinning future studies takes 1 change instead of 10. (Logged in Category D as well.) |
| B11 | `src/components/Shell.jsx:70` | n/a | Top-bar badge reads `HIV STUDY` (correct, but hardcoded — should use `STUDY_META.name`). Logged in Category D. |
| B12 | `src/data/trust.js`/`vectors.js`/`experiential.js`/`ideology.js`/`segments.js` | n/a | All persona narrative and discriminating-belief content is heavily pharma- / health-care-policy-themed (RFK Jr., Big Pharma, vaccines, ESI, M4A, gender-affirming care). This is Category A (canonical PRISM Pulse content), but **content review by client** should confirm none of it conflicts with HIV-study messaging. No code change required. |

---

## Category C — Already configurable

These data surfaces correctly read from `study.js` / `studyData.js`. Verify only — no action needed unless drift is found.

1. **AudienceROI page (`src/pages/AudienceROI.jsx:8–25`)** — merges `DATA.segments` skeleton with `STUDY_METRICS[seg.code]` from `study.js`; pulls `PREPOST_METRICS` and uses `getAssignedTier(code)`. Flow works.
2. **MessageMap placeholder (`src/pages/MessageMap.jsx:3, 99, 124`)** — pulls `MESSAGES`, `CONTROL_SOP`, `VARIANT_SOP`, `STUDY_META` from `study.js`. `HAS_SOP` correctly short-circuits to wave-1 placeholder.
3. **SegmentProfile ROI card (`src/pages/SegmentProfile.jsx:2056–2090`)** — reads `STUDY_ROI[seg.code].HIV` and `getAssignedTier(seg.code)`. Renders correctly.
4. **Tier badges (`src/pages/AudienceROI.jsx:189`)** — `getAssignedTier(seg.code)` flow works.
5. **Pre/Post stacked deltas in AudienceROI** — reads `seg.prePost` (merged from `STUDY_METRICS`) keyed by `PREPOST_METRICS[].key`. Works.

**Surfaces that LOOK configurable but aren't:**

- The `STUDY_ROI` object in `src/pages/SegmentProfile.jsx:214–231` is hand-keyed `{code: {HIV: {…}}}` rather than reading from `STUDY_METRICS` in `study.js`. Same numbers, but maintained in two places. Should be replaced with `import { STUDY_METRICS } from "../data/study"; const d = STUDY_METRICS[seg.code];`. See Category D.
- `PREPOST` constant in `src/pages/SegmentProfile.jsx:192–209` (HIV pre/post data per segment) is also a hand-duplicate of `STUDY_METRICS[seg.code].prePost`. The constant is assigned to `pp` in DemographicsPanel L749 but never used downstream (see Category D dead code).

---

## Category D — Technical debt

Items that should be configurable but aren't, or that survive from earlier iterations.

### Dead code

| # | Location | Priority | Issue |
|---|----------|----------|-------|
| D1 | `src/pages/SegmentProfile.jsx:494–512` | **MED** | `PrePostBar` function — defined, never called. AL-era pre/post bar component. |
| D2 | `src/pages/SegmentProfile.jsx:513` | **MED** | `PP_LABELS = [{key:"rank",label:"Industry Rank"…}]` — AL-pharma study item labels ("Industry Rank", "Domestic Mfg", "Congress Support", "Industry Fav"). Never referenced. |
| D3 | `src/pages/SegmentProfile.jsx:749` | **MED** | `const pp = PREPOST[seg.code];` in DemographicsPanel — assigned but never read. Vestigial. |
| D4 | `src/pages/SegmentProfile.jsx:1976` | **LOW** | `const t = seg.tier;` — assigned but never used in the JSX (visible tier comes from `TIER_BG[studyTier]` etc. inside the STUDY_ROI block). |
| D5 | `src/data/study.js:110` | **LOW** | `getTierNum(roi)` — exported and self-described as deprecated. Kept to avoid breaking imports, but no current call sites. |
| D6 | `src/data/study.js:99–100` | **LOW** | `THEME_COLORS = {}` — empty object; MessageMap uses a different `THEME_COLORS` defined inline at `MessageMap.jsx:36`. Confusing pair. |
| D7 | `src/data/study.js:123` | **LOW** | `PERSUADABILITY_LABELS` exported but unused — `AudienceROI.jsx:321–327` redefines `persuadLabels` inline with colors. |

### Duplicate sources of truth (HIGH priority cleanup before next study spin-up)

| # | Location | Priority | Issue |
|---|----------|----------|-------|
| D8 | `src/pages/SegmentProfile.jsx:994–1021` vs `src/data/trust.js:5–29` | **HIGH** | `TRUST_DATA` + `ENTITIES` duplicated verbatim. Same numeric arrays exist in both files. |
| D9 | `src/pages/SegmentProfile.jsx:1024–1074` vs `src/data/trust.js:32–83` | **HIGH** | `BELIEFS` array duplicated (~50 items, ~16-value vectors per item). One drift = wrong shown to client. |
| D10 | `src/pages/SegmentProfile.jsx:1077–1153` vs `src/data/experiential.js:*` | **HIGH** | `EXP_DATA`, `INSURANCE_TYPE`, `GOP_PODS`, `DEM_PODS`, `NEWS`, `WELL_ORIENT`, `WELL_LIFE`, `HBIS_SUM` all duplicated. |
| D11 | `src/pages/SegmentProfile.jsx:192–209` vs `study.js:70–86` (`prePost` blocks) | **HIGH** | `PREPOST` constant in SegmentProfile duplicates the `prePost` sub-object of every entry in `STUDY_METRICS`. Plus duplicated again in `studyData.js` lines 142–171, 192–221, etc. **Three copies.** |
| D12 | `src/pages/SegmentProfile.jsx:214–231` vs `study.js:70–86` (`STUDY_METRICS`) | **HIGH** | `STUDY_ROI[code].HIV` duplicates `roi/highRoi/supporters/activation/influence` already in `STUDY_METRICS`. Two copies. |
| D13 | `src/pages/SegmentProfile.jsx:303–346` vs `src/data/ideology.js:6–65` | **HIGH** | `IDEOLOGY_GROUPS` and `IDEOLOGY_DATA` duplicated. Also re-duplicated in `IdeologyHeatmap.jsx:24–85`. |
| D14 | `src/pages/SegmentProfile.jsx:233–300` vs `src/data/vectors.js:6–40` | **HIGH** | `GOP_VECTORS` / `DEM_VECTORS` / `GOP_AXES` / `DEM_AXES` duplicated. |
| D15 | `src/pages/SegmentProfile.jsx:1192–1209` vs `src/data/trust.js:86–103` | **HIGH** | `SEGMENT_BELIEFS` duplicated. |
| D16 | `src/pages/SegmentProfile.jsx:1290–1310` vs `src/data/trust.js:108–128` | **HIGH** | `NICE_NAMES` duplicated. |
| D17 | `src/pages/SegmentProfile.jsx:1343–1348` vs `src/data/trust.js:131–136` | **HIGH** | `INS_REFORM` duplicated. |
| D18 | `src/pages/SegmentProfile.jsx:7–152` vs `src/data/segments.js:6–119` | **HIGH** | The whole 16-segment skeleton with persona/demo is duplicated inside SegmentProfile (with extra stale `tier/roi/highRoi/supporters/activation/influence/persuadability` AL values — see B2/B3). The `data/segments.js` version is imported by nothing on this page. |

### Hardcoded layout values

| # | Location | Priority | Issue |
|---|----------|----------|-------|
| D19 | `src/pages/AudienceROI.jsx:28–38` | **MED** | `H = {header:120, roi:54, persuasion:205, prePostRow:44, prePostPad:30, toggle:28, coalition:74, activation:74, influence:60}` — magic row heights tied to specific donut/bar sizes. Changes anywhere in the column components require manual re-tuning here. |
| D20 | `src/pages/MessageMap.jsx:74` | **MED** | Tooltip `width:400`, `left: x + 12`, `top: y - 80` — hardcoded popover geometry. Edge cases when near viewport edges handled with `Math.min`/`Math.max`, but the magic numbers are inline. |
| D21 | `src/pages/SegmentProfile.jsx:537–540` | **LOW** | Vector radar dims (`size = 260`, `maxR = 90`, `SCALE_MIN = -0.85`, `SCALE_MAX = 0.85`). The scale bounds are sensitive: any DF loading > 0.85 will overflow the radar. |
| D22 | `src/pages/AudienceROI.jsx:43–61` and `src/pages/SegmentProfile.jsx:356–363, 986–992` | **MED** | Three different inline color-palette `C` / `CP` objects in three places. Theme colors in `data/theme.js` exist but most pages roll their own. |
| D23 | `src/pages/SegmentProfile.jsx:367–436` | **LOW** | `STATE_PATHS` (~70 inline SVG `path d=`) and `centers` (L698–703) — fine as data, but ~70 lines of hardcoded geometry inside a React component. Move to `src/data/geography.js` someday. |

### Hardcoded segment-id / variant maps

| # | Location | Priority | Issue |
|---|----------|----------|-------|
| D24 | `src/pages/MessageMap.jsx:57` | **MED** | `SEG_TO_VARIANT = { 1:10, 2:1, 4:7, 7:4, 8:2, 10:8 }` — hand-mapping of segment id → spreadsheet variant column. The comment explains the mismatch, but if `extract_hiv.py` is ever re-run with renamed columns or the variant matrix is regenerated, this map will silently desync. Also currently only relevant in wave 2 (when CONTROL_SOP/VARIANT_SOP populate). |
| D25 | `src/pages/SegmentProfile.jsx:181–189` | **LOW** | `RELIGION_OVERINDEX = { wEvan:[3,6], bProt:[11], wMain:[1], cath:[2,4,5,7,8,9], jew:[], other:[0,13], none:[10,12,14,15] }` — segment indices are hardcoded. If `SEGMENTS` order ever changes, these point to the wrong rows. (Same risk for `MILITARY[]` `UNION_HH[]` `HBIS_SUM[]` etc. that are positional arrays.) |
| D26 | `src/pages/SegmentProfile.jsx:156–157` | **LOW** | `MILITARY` and `UNION_HH` are 16-element positional arrays without an explicit segment-code key. Same positional-fragility risk as D25. |

### Hardcoded copy that should be configurable

| # | Location | Priority | Issue |
|---|----------|----------|-------|
| D27 | `src/components/Shell.jsx:70` | **MED** | `HIV STUDY` hard-coded; should read `STUDY_META.name + " STUDY"` from `study.js`. |
| D28 | `src/pages/SegmentProfile.jsx:2064` | **MED** | `HIV STUDY ROI` hard-coded; same fix as D27. |
| D29 | `src/pages/MessageMap.jsx:165` | **LOW** | `"11-item MaxDiff · 16 PRISM segments"` — but `STUDY_META.nMessages = 17` for HIV, and `STUDY_META.methodology = "MaxDiff · 16 PRISM segments"`. The "11-item" magic number is wrong for HIV (wave 2 might use 17). Should pull from `STUDY_META.methodology`. |
| D30 | `src/pages/AudienceROI.jsx:336–339` | **LOW** | `"Audience ROI"` title and the ROI-formula tooltip caption are hard-coded literals; fine, but the formula could change per study. |

---

## Cross-cutting issues

1. **Three different parallel sources for HIV per-segment metrics.** The same `roi`/`highRoi`/`supporters`/`activation`/`influence`/`persuadability`/`prePost` numbers live in:
   - `src/data/study.js` `STUDY_METRICS` (the **canonical** auto-generated location)
   - `src/data/studyData.js` `DATA.HIV.segments` (a parallel JSON dump, not used by any page that I traced)
   - `src/pages/SegmentProfile.jsx` `STUDY_ROI` and `PREPOST` (hand-keyed objects at the top of the file)
   
   Pages currently read mostly from `study.js`. `studyData.js` `DATA.HIV` block is effectively dead — `AudienceROI.jsx` imports `DATA.segments` from it (16-segment skeleton) and `STUDY_METRICS` from `study.js`. `MessageMap.jsx` imports `DATA.segments` from it. The `DATA.HIV.*` block is loaded but never read. Recommend deleting `DATA.HIV` entirely.

2. **`DATA.segments.pop` is integer-percent (`2`, `7`, …) but `data/segments.js` `SEGMENTS[].pop` is decimal-fraction (`0.02`, `0.07`, …).** AudienceROI / MessageMap consume the integer form from `studyData.js`. Bubble map (`SegmentMap.jsx:5–22`) uses integer form (`pop:2`). `SegmentProfile.jsx:7–152` also uses integer form. `data/segments.js` is the odd one out at decimal. Documented but inconsistent — pick one.

3. **`studyData.js` declares itself "AUTO-GENERATED — Do not edit by hand. Run: python convert_data.py MAESIDashboardData.xlsx"** but no such script exists. The HIV block was clearly hand-written or generated by a different script. Header comment is misleading.

4. **Auto-generated `study.js` (from `extract_hiv.py`) + hand-edited `studyData.js` HIV block creates two sources of truth.** Anyone refreshing `study.js` from the workbook will not refresh `studyData.js`, and any consumer of `DATA.HIV.*` will see stale values. Mitigation: stop publishing `DATA.HIV` at all.

5. **Per-segment ideology / belief / trust / experiential numbers are also duplicated verbatim into `SegmentProfile.jsx`.** Refactoring this single page to import from `src/data/*` would delete ~700 lines and eliminate every D8–D18 risk in one pass.

6. **Auth is bypassed** (`src/App.jsx:12` `BYPASS_AUTH = true`). When auth is re-enabled, the Login screen's "AMERICAN LEADERSHIP STUDY" caption (B1) is what every user sees. Fix B1 before flipping `BYPASS_AUTH`.

7. **All hardcoded `tier:` values in the `SEGMENTS` array of `SegmentProfile.jsx` are AL-era and conflict with HIV `ASSIGNED_TIERS`.** Currently masked because the page uses `getAssignedTier(seg.code)` for the visible badge, but the dead field is a trap.

---

## Recommendations

1. **Fix Login.jsx:80 first.** One-line change: replace `AMERICAN LEADERSHIP STUDY` with `HIV STUDY` (or, better, import `STUDY_META.name` from `study.js`). High visibility, trivial fix.

2. **Refactor `SegmentProfile.jsx` to import canonical data from `src/data/*`.** Targets:
   - Replace L7–152 `SEGMENTS` with `import { SEGMENTS } from "../data/segments"` (and drop the stale `tier/roi/highRoi/supporters/activation/influence/persuadability` fields).
   - Replace L192–209 `PREPOST` / L214–231 `STUDY_ROI` with `import { STUDY_METRICS } from "../data/study"`.
   - Replace L233–300 vector tables with `import { GOP_VECTORS, DEM_VECTORS, GOP_AXES, DEM_AXES } from "../data/vectors"`.
   - Replace L303–346 ideology tables with `import { IDEOLOGY_GROUPS, IDEOLOGY_DATA } from "../data/ideology"`.
   - Replace L994–1074 trust/beliefs tables with `import { TRUST_DATA, GAP_AVG, ENTITIES, BELIEFS, SEGMENT_BELIEFS, NICE_NAMES, INS_REFORM } from "../data/trust"`.
   - Replace L1077–1153 experiential tables with `import { EXP_DATA, INSURANCE_TYPE, GOP_PODS, DEM_PODS, NEWS, WELL_ORIENT, WELL_LIFE, HBIS_SUM } from "../data/experiential"`.
   - Estimated diff: −~700 lines, −9 duplicate sources of truth.

3. **Make `IdeologyHeatmap.jsx` import the same `IDEOLOGY_GROUPS` / `IDEOLOGY_DATA` from `src/data/ideology.js` instead of redefining at L24–85.**

4. **Delete `DATA.HIV` block from `src/data/studyData.js`** (lines 121–1089). Nothing reads it. Keep only `DATA.segments` (the 16-segment skeleton) for AudienceROI / MessageMap consumption.

5. **Source-of-truth the study name + ROI card title from `STUDY_META`:** Shell.jsx L70 and SegmentProfile.jsx L2064 should both read from `STUDY_META.name`. Cuts re-skinning work for the next study from 2 edits to 0.

6. **Sweep dead code:** Delete `PrePostBar` / `PP_LABELS` (SegmentProfile.jsx L494–513), unused `pp = PREPOST[seg.code]` (L749), and unused `t = seg.tier` (L1976). Remove `getTierNum` (study.js L110) and `PERSUADABILITY_LABELS` (study.js L123) if confirmed unused after wave-2 wiring.

7. **Reconcile `pop` units:** decide between integer-percent and decimal-fraction and update either `data/segments.js` or the consumers. Lowest-risk fix: change `data/segments.js` `pop:0.02` → `pop:2` to match every consumer.
