# PRISM Dashboard — Hardcoded vs. Configurable Audit

Generated 2026-06-13. Branch: `messagemap-integration`. Covers the HIV deploy (cloned from the American Leadership / AL PRISM dashboard).

This audit classifies every notable hardcoded literal, constant, and string in the application source into four buckets so the analyst can triage cleanup. It is read-only analysis — nothing here was changed.

> **Supersedes** the Jun 2 draft (commit `f063631`). That draft was partly stale: its headline item (Login showing "AMERICAN LEADERSHIP STUDY") is now **resolved** — Login flows from `STUDY_META`; `BYPASS_AUTH` is now `false`; `MessageMap.jsx` was fully rewritten; and `extract_hiv.py` / `convert_data.py` were replaced by `pipeline/extract_study.py` + `pipeline/workbook.py` + `study/study.yaml`. The good structural findings from that draft (the duplication cluster, `pop`-units mismatch, dead `DATA.HIV`) are carried forward below.

Scope: `src/` (components, pages, data modules), `index.html`, `package.json`, `README.md`, and the Python workbook pipeline (`pipeline/extract_study.py`, `pipeline/workbook.py`). `study/study.yaml` + `pipeline/study_config.py` were read to verify flow. Excluded per brief: `node_modules/`, `dist/`, `HIV_Persona_Profile_Tab/`, `public/prism-demo/`.

## Summary table

| Category | Count | Notable themes |
|----------|-------|----------------|
| **A — Stable PRISM constants** (intentional, do NOT change) | ~55 | The 16 segments + codes/names/ids/party; bubble-map coords & stage dims; GOP/DEM palette; 1–7 and 0–100 scale anchors; the canonical datasets (IDEOLOGY, TRUST/ENTITIES/BELIEFS, EXP, MILITARY, UNION, RELIGION, MEDIA, WELLNESS, VECTORS); census-map SVG geometry; arm encoding 1=PERSONA/2=CORE. |
| **B — Study-specific** (must change for HIV) | ~32 | AL drug-pricing / pharma / opioid / ESG / ESI / Medicare-Advantage text in persona & belief content (`SegmentProfile.jsx`, dormant `segments.js`, `trust.js`); campaign framing ("our side", "join our coalition", "fundraising appeals", "registered voters", "electorate"); DEMOCRATIC/REPUBLICAN segment banners; hardcoded study title in `index.html`; README date drift; methodology prose not read from `STUDY_META`. |
| **C — Already configurable via studyData/study** (verified) | ~16 | Per-segment ROI metrics from `STUDY_METRICS`; tier via `getAssignedTier`/`ASSIGNED_TIERS`; pre/post via `PREPOST_METRICS`; messages/baskets/cells/variants/ui from `dashboard.json`; study name/topic/client from `STUDY_META`; generated `segments.js` map. |
| **D — Should be configurable but isn't** (tech debt) | ~42 | `SegmentProfile.jsx` duplicating study data (`STUDY_ROI`, `PREPOST`, vectors, tier colors, two theme palettes); `IdeologyHeatmap.jsx` re-hardcoding the registry + ideology matrix + GOP/DEM colSpans; brand/version/CONFIDENTIAL footer strings (disagree with `dashboard.study.version`); `getTierNum` 1.07/1.00 cutoffs; empty `THEME_COLORS`; hardcoded Supabase URL+key fallback (legacy AL project); persona-card `/prism-demo/` asset paths; metric/persona color one-offs; magic chart maxima; positional-array fragility; Python presentation constants trapped in the generator. |

## How to use this audit

Triage in this order: **B first** (anything client-facing still carrying AL framing — the dashboard is in Gilead's hands), then **D items with isolation/security impact** (the hardcoded Supabase fallback in `supabaseClient.js`, the brand/version strings), then the **D duplication cluster** in `SegmentProfile.jsx`/`IdeologyHeatmap.jsx` (delete in-file copies, import from `study.js`/`theme.js`/`src/data` — est. −700 lines, −10 duplicate sources of truth). Leave **A** alone — it is canonical PRISM platform data shared across studies. **C** is already wired; only revisit if a flow note says "but Y is still hardcoded." Category B fragments are quoted so you can grep for them directly.

A structural theme runs through D: **the same study data is hand-maintained in 2–3 places.** `study.js` (generated from `study.yaml` + `judgments.xlsx`) is the intended source of truth, but `SegmentProfile.jsx` and `IdeologyHeatmap.jsx` predate that flow and carry their own copies. The cleanup is mostly "import instead of re-declare," not new code.

---

## Category A — Stable PRISM constants (DO NOT touch)

### Segment registry & geometry
- `studyData.js:9-122` · `DATA.segments` — 16 canonical segments (id/code/name/party/pop) · The authoritative registry; pop integers (TSP 2 … GHI 10) sum to 100.
- `study.yaml:283-298` · `segment_registry` 16 rows (id/code/name/party/pop_share) · THE canonical PRISM segment table feeding the generators.
- `SegmentProfile.jsx:8-153` · `SEGMENTS` array — id/code/name/party/pop + per-segment `demo:{}` and `persona:{}` blocks · Canonical roster + demographic/persona structure (co-located `roi`/`tier`/`persuadability` fields are NOT canonical — see D).
- `segments.js:6-119` · `SEGMENTS` template (16 segs, codes, party, pop fractions) · Canonical template structure (dormant — not imported anywhere).
- `IdeologyHeatmap.jsx:4-21` · `SEGS` — 16 codes/names/party · Canonical values (but redeclared rather than imported — see D).
- `SegmentMap.jsx:9-25` · `BUBBLE_LAYOUT` — per-segment `left`/`top`/`w`/`z` bubble coords + sizes + z-order · Canonical bubble-map geometry "from the HTML."
- `SegmentMap.jsx:53-54` · `STAGE_W = 5325`, `STAGE_H = 1959` · Canonical SVG viewBox stage frame.
- `SegmentMap.jsx:216-219` · DEM/GOP cluster divider at `x=2650` · Canonical split.
- `SegmentMap.jsx:26-30` · `BUBBLES` derives `party`+`pop` from generated `SEG_BY_CODE` · Correct canonical wiring.
- `SegmentProfile.jsx:367-440, 699-704` · `STATE_PATHS`/`ALL_STATES` SVG geography + census-division `centers` · Canonical census-map coordinates.

### Palettes & scale anchors
- `theme.js:5-44` · `C` palette incl. `partyGOP:"#ef4444"`, `partyDEM:"#3b82f6"`, `FONT`, `MONO`, `partyColor()` · Canonical PRISM design system / party palette.
- `SegmentMap.jsx:58-63` · `DEM_FILL/STROKE/TEXT`, `GOP_FILL/STROKE/TEXT` · Canonical DEM/GOP blue/red palette.
- `AudienceROI.jsx:53-54` · `gop:"#e57373"`, `dem:"#64b5f6"` · Party palette.
- `AudienceROI.jsx:318-319` · `filter(party === "GOP"/"DEM")` · Party split is a stable structural constant.
- `IdeologyHeatmap.jsx:170-171,195,201,222,228` · progressive↔conservative + REPUBLICAN/DEMOCRAT band tints `#f87171`/`#60a5fa` · Canonical left-right framing + party palette.
- `SegmentProfile.jsx:544,1978,2009-2010,2026` · GOP `#ef4444`/`#f87171`/`#fca5a5` vs DEM `#3b82f6`/`#60a5fa`/`#93c5fd` · Canonical party palette.
- `SegmentProfile.jsx:541,554` · radar anchors `SCALE_MIN=-0.85`/`SCALE_MAX=0.85` · Canonical vector scale.
- `SegmentProfile.jsx:897,1510,1524,1554,1591` · "1–7" / "(v-1)/6" · Canonical 1–7 scale math/labels.
- `IdeologyHeatmap.jsx:159,349` · legend `[2.0…6.0]`, `1–7 · N=16 SEGMENTS` · Canonical 1–7 bipolar scale + 16-seg count.
- `MessageMap.jsx:456,563` · `0–100` lift scale anchor · Canonical scale anchor.
- `MessageMap.jsx:337,939,959,1034,1045` · arm encoding `1=PERSONA-tuned, 2=CORE` · Stable survey-design constant.

### Canonical datasets
- `ideology.js:6-65` · `IDEOLOGY_GROUPS` (5 groups, 15 bipolar dims) + `IDEOLOGY_DATA` (15×16) · Canonical PRISM ideology dataset.
- `IdeologyHeatmap.jsx:67-85` · `DATA` (15 dims × 16 segs) · Canonical ideology matrix (hardcoded in the page — see D).
- `SegmentProfile.jsx:304-347` · `IDEOLOGY_GROUPS`+`IDEOLOGY_DATA` · Canonical ideology dataset (in-file copy — see D).
- `trust.js:5-9` · `TRUST_DATA` (GOVT/CORP/GAP × 16) + `GAP_AVG=0.5912` · Canonical trust dataset.
- `trust.js:12-29` · `ENTITIES` (16 institutions × 16-seg vectors) · Canonical trust battery.
- `trust.js` (BELIEFS battery, `NICE_NAMES`, `INS_REFORM`) · Canonical PRISM belief battery (several items AL-worded — flagged B-risk in B).
- `SegmentProfile.jsx:995-1022` · `TRUST_DATA` + `ENTITIES` · Canonical trust datasets (in-file copy — see D).
- `SegmentProfile.jsx:1025-1075` · `BELIEFS` (47 items) · Canonical belief dataset (several AL-worded — see B).
- `experiential.js:6-89` · `EXP_DATA`, `INSURANCE_TYPE`, `GOP_PODS`, `DEM_PODS`, `NEWS`, `WELL_ORIENT`, `WELL_LIFE`, `HBIS_SUM` · Canonical experiential/media/wellness datasets.
- `SegmentProfile.jsx:1078-1154` · same experiential/media/wellness datasets · Canonical (in-file copies — see D).
- `vectors.js:6-40` · `GOP_VECTORS`/`DEM_VECTORS` + `GOP_AXES`/`DEM_AXES` · Canonical discriminant fingerprints.
- `SegmentProfile.jsx:234-301` · `GOP_VECTORS`/`DEM_VECTORS`/`*_AXES`/`VECTOR_DEFS` · Canonical vectors (in-file copy — see D). NB `VECTOR_DEFS.domestic` title is literally "American Leadership" (line 287) — this is the canonical PRISM **ideology axis name**, not the client; keep as A.
- `SegmentProfile.jsx:157-190` · `MILITARY`, `UNION_HH`, `RELIGION_CATS`/`DATA`/`OVERINDEX` · Canonical demographic datasets (positional-array fragility — see D).
- `SegmentProfile.jsx:1097-1151` · `GOP_PODS`/`DEM_PODS`/`NEWS`/`WELL_ORIENT`/`WELL_LIFE` · Canonical media/wellness datasets.
- `SegmentProfile.jsx:1193-1311` · `SEGMENT_BELIEFS` + `NICE_NAMES` · Canonical analyst curation + variable labels (some AL labels — see B).
- `SegmentProfile.jsx:1344-1349` · `INS_REFORM` spectrum · Canonical insurance-reform dataset.
- `study.js:47-66` · `ASSIGNED_TIERS` + `getAssignedTier()` · Analyst-configured tier map (the correct mechanism; supersedes `getTierNum`).
- `study.js:123` · `PERSUADABILITY_LABELS` · Canonical 5-point scale anchors.
- `study.js:102-106` · `TIER_CONFIG` (tier 1/2/3 bg/text/accent + labels) · Canonical tier styling.
- `extract_study.py:39` · `SEG_ORDER = [r["code"] for r in REGISTRY]` · Canonical order — **the old hardcoded 16-code Python list is gone**; order now derives from `study.yaml`.
- `workbook.py:49` · 5-column block stride `(lc-2…lc+2)=[pre,post,label,question,scale]` · Canonical positional pre/post layout (also a magic-offset flag — see D).

---

## Category B — Study-specific content (must change for HIV)

> The Phase-A title swap is clean: `STUDY_META` is HIV/Gilead-correct (`name:"HIV"`, `client:"Gilead"`, `topic:"HIV Treatment & Prevention"`) and no live **study-title** says "American Leadership." The B items below are un-scrubbed AL **content** and **campaign framing**, plus a few study strings hardcoded instead of read from config.

### AL drug-pricing / pharma / policy text in persona & belief content
- `SegmentProfile.jsx:1027` · BELIEFS "PROFIT" · **"Big pharma put profits over patients."**
- `SegmentProfile.jsx:1039` · BELIEFS "PHARMA_IP" · **"Pharma companies abuse the patent system to prevent competition and delay generic drugs."**
- `SegmentProfile.jsx:1043` · BELIEFS "WOKE" · **'…woke capitalism issues like "ESG" … and "DEI"…'**
- `SegmentProfile.jsx:1050` · BELIEFS "OPIOIDS" · **"Big pharma is primarily responsible for the opioid epidemic."**
- `SegmentProfile.jsx:1056` · BELIEFS "MED_NEGOT" · **"Medicare should negotiate prescription[ drug prices]"**
- `SegmentProfile.jsx:1060` · BELIEFS "MA" · **"Medicare Advantage should be protected from funding cuts."**
- `SegmentProfile.jsx:13-152` · persona quotes carrying AL framing · grep fragments: **"Prices are too high and we need reform"** (22), **"Drug and hospital prices are crushing people"** (49), **"cracking down on drug pricing"** (51), **"accountability for Big Pharma"** (42), **"aggressive drug-price negotiation"** (104-105), **"pharma's profits and patent games … Medicare Advantage"** (113-114, 131-132).
- `SegmentProfile.jsx:514` · `PP_LABELS` = "Industry Rank / Domestic Mfg / Congress Support / Industry Fav" · AL message-test item labels (unused in render — also D dead code).
- `SegmentProfile.jsx:1303,1307` · `NICE_NAMES.ESI_REQ:"Employer Insurance Mandate"`, `ANTI_ESI:"End Employer Insurance"`, `PUBLIC_OPTION` · ESI labels, AL-era (no matching HIV BELIEFS items).
- `SegmentProfile.jsx:1347` · `INS_REFORM` label **"ESI Mandatory"** · ESI term surfaced in the BELIEFS UI.
- `trust.js:34,46,57` · BELIEFS battery items **"Big pharma put profits over patients."**, **"Pharma companies abuse the patent system…"**, **"Big pharma is primarily responsible for the opioid epidemic."** · Canonical battery, but AL-worded; **B-risk** if the HIV workbook drops these items.
- `trust.js:108-128` · `NICE_NAMES` `ESI_REQ`/`ANTI_ESI`/`MA:"Protect Medicare Advantage"` · AL-pharma-worded labels.
- `segments.js:32,38,39,59,67,72` (dormant) · AL persona text · **"crack down on drug pricing, protect union health plans"** (39), **"Accountability for Big Pharma, recognition of natural medicine"** (32), **"High prices crush ordinary families"** (38), **"The pharmaceutical industry is corrupt."** (59), **"Accountability for pharma and government overreach."** (67), **"don't trust government or pharmaceutical companies."** (72). File is unused but is the source template to re-author before any HIV use.

### Campaign / political framing carried over
- `AudienceROI.jsx:376` · **"Did exposure move the audience toward our position?"** · Campaign framing ("our position").
- `AudienceROI.jsx:439` · **"How many supporters can we predict will join our coalition?"** · Advocacy framing.
- `AudienceROI.jsx:453` · **"What is the probability of responding to a CTA and being mobilized?"** · Campaign framing.
- `AudienceROI.jsx:467` · **"How likely is this audience to affect outcomes or influence others?"** · Influence copy.
- `AudienceROI.jsx:323-328` · `persuadLabels` "Strong support/Lean support/Persuadable/Lean oppose/Strong oppose" · Campaign-scale anchors (duplicates `PERSUADABILITY_LABELS` — see D).
- `OutcomeCards.jsx:32,39` · **"What will move people to our side?"**, **"What messages help reinforce our base support?"** · Campaign-framed copy ("our side", "our base").
- `MessageMap.jsx:1303-1319` · methodology footnote · **"Use this view for paid media targeting…"**, **"supporter emails, fundraising appeals…"** · Campaign framing.
- `MessageMap.jsx:1380-1404` · methodology limitations · **"registered voters"**, **"re-fielding"** · Voter-study framing in an HIV public-health study.
- `MessageMap.jsx:443-450` · `FILTER_INFO` · "priority audiences for persuasion, primary or secondary audiences by partisanship…" · Campaign framing.
- `SegmentProfile.jsx:2027` · **"{seg.pop}% of electorate"** · AL political framing ("electorate") for a general-population HIV study.
- `SegmentMap.jsx:220-225` · **"DEMOCRATIC SEGMENTS"** / **"REPUBLICAN SEGMENTS"** banner `<text>` · AL political-audience banners; `study.yaml:316-318` already defines `coalition_a_label`/`party_band_a_label` the page ignores.
- `SegmentMap.jsx:291,295` · legend **"Democratic"** / **"Republican"** · Hardcoded party copy.
- `IdeologyHeatmap.jsx:34-37` · `MFA` group → `mfa` dim `label:"Health Care"`, poles "Right / public system" / "Private market" · AL Medicare-For-All framing carried over.

### Study strings hardcoded instead of read from config
- `index.html:7` · `<title>PRISM HIV Treatment & Prevention</title>` · Study title hand-edited in HTML; HIV-correct but a duplicate of `study.yaml:12`.
- `MessageMap.jsx:459-466` · `MESSAGE_INFO` methodology prose · Hardcoded; `STUDY_META.methodology` exists ("MaxDiff · 16 PRISM segments") but isn't read.
- `AudienceROI.jsx:337` · **"ROI = Population × (Persuasion + Coalition Value + Activation + Influence)"** · ROI formula string; should be config (also D).
- `README.md:1,3,13` · "# PRISM HIV Treatment & Prevention Dashboard", **"Gilead, May 2026"** · Study title/client in docs; **date drift** — README says "May 2026" vs "Apr-Jun 2026" in `study.yaml:16`/`study.js`.
- `Shell.jsx:50` / `Login.jsx:77` · **"AUDIENCE INTELLIGENCE PLATFORM"** tagline · Hardcoded brand line, duplicated (also D).

---

## Category C — Already configurable via studyData / study (verified flow)

- `AudienceROI.jsx:9-23` · per-segment ROI metrics · Reads `seg.roi/highRoi/supporters/activation/influence/persuadability/prePost/tier` from `STUDY_METRICS[seg.code]` (study.js:69) merged onto `DATA.segments`. **Plumbed correctly.**
- `AudienceROI.jsx:191` · tier · `getAssignedTier(seg.code)` → `ASSIGNED_TIERS` (study.js:47). **Correct** (analyst-configured, not ROI-derived).
- `AudienceROI.jsx:26,265,400` · pre/post · Reads `PREPOST_METRICS` (study.js:89) for labels/questions/scale. **Plumbed correctly.**
- `MessageMap.jsx:50-57` · segments/messages/baskets/metrics/ui · Reads `dashboard.segments`/`messages`/`baskets`/`lift_variants`/`ui`. **Data-driven.**
- `MessageMap.jsx:107,118` · defaults · `UI.default_outcome`, `UI.default_basket`. **Flows from `dashboard.ui`.**
- `MessageMap.jsx:182-334` · cells/wording/universe · All from `dashboard.message_map_cells[metric]` + `dashboard.variants.messages`. **Data-driven.**
- `MessageMap.jsx:523-528` · counts strip · Messages/tokens/variants derived; respondents from `dashboard.study.n_total`. **Data-driven.**
- `MessageMap.jsx:1414-1420` · provenance footer · Reads `dashboard.study.id/version/analyst/n_total` + `activeMetric`. **Flows from `dashboard.study`.**
- `SegmentProfile.jsx:2003,2063` · tier badge · `getAssignedTier(s.code)`; comment warns NOT to read stale `s.tier`. **Flows correctly.**
- `SegmentProfile.jsx:2068` · ROI card title · `STUDY_META.name` ("HIV"). **Flows correctly.**
- `SegmentProfile.jsx:2060-2090` · ROI scorecard cells · Render `{roi,highRoi,supporters,activation,influence}` — but from the **LOCAL** `STUDY_ROI` (215-232), not study.js. **Flows from an in-file copy** → see D.
- `Shell.jsx:100` / `Login.jsx:81` · `{STUDY_META.name} STUDY` badge · Source chain `study.js:9 ← study.yaml:13 ← extract_study.py:57`. **Verified** (the old "AMERICAN LEADERSHIP STUDY" literal is gone).
- `study.js` (whole, generated) · `STUDY_META/MESSAGES/STUDY_METRICS/ASSIGNED_TIERS/PREPOST_METRICS/TIER_CONFIG/getSopColor/PERSUADABILITY_LABELS` · Generated by `extract_study.py` from `study.yaml`+`judgments.xlsx`; header marks it generated. **Config-driven** (do not hand-edit).
- `study.js:21-39,89-97` · `MESSAGES` (17 HIV stimuli), `PREPOST_METRICS` (7 PrEP/HIV items) · Consumed across MessageMap/AudienceROI; mirrors `studyData.js`. **HIV-correct, flows.**
- `study.js:42-43` · `CONTROL_SOP=[]`, `VARIANT_SOP=[]` · Intentionally empty for Wave 1 (MessageMap renders placeholder). **Config.**
- `generated/segments.js` · `SEG_BY_CODE` (id/code/name/party/pop/popShare) · Generated from `study.yaml` `segment_registry`; consumed by `SegmentMap.jsx:3`. **Verified** (party flows from config).

---

## Category D — Should be configurable but isn't (technical debt)

### Security / isolation (highest severity)
- `supabaseClient.js:14` · hardcoded fallback URL `"https://zviodrqsrawcxtqcorst.supabase.co"` (legacy `prism-dashboard-al-auth` project) · If `VITE_SUPABASE_URL` is unset, HIV client users land on the shared **legacy AL auth project**. **Fix:** require the env var; drop the literal fallback for production.
- `supabaseClient.js:18` · hardcoded fallback anon JWT key · Same legacy project. **Fix:** env-only; remove the baked key.

### Brand / version / confidentiality strings
- `SegmentProfile.jsx:2133` · footer **`PRISM V3.1 · RESERVOIR COMMUNICATIONS GROUP · CONFIDENTIAL & PROPRIETARY`** · Version+firm+CONFIDENTIAL hardcoded. **Fix:** read from `study.js`/config.
- `IdeologyHeatmap.jsx:348` · footer **`PRISM V3.1 · RESERVOIR COMMUNICATIONS GROUP · CONFIDENTIAL & PROPRIETARY`** · Same string, second location; `V3.1` **disagrees** with `dashboard.study.version="v1.0"`. **Fix:** read `dashboard.study.version`/firm/confidentiality.
- `SegmentProfile.jsx:1990-1992,2134` · `RESERVOIR HEALTH PRISM` / `PERSONA PROFILE` / `PRISM AUDIENCE INTELLIGENCE` headers+footer · Hardcoded brand/titles. **Fix:** config.
- `IdeologyHeatmap.jsx:142,144` · `RESERVOIR HEALTH PRISM PULSE` brand strip + `IDEOLOGY HEATMAP` title + `15 IDEOLOGICAL DIMENSIONS × 16 PRISM SEGMENTS` subtitle · Hardcoded; `dashboard.study.nav_brand` exists. **Fix:** read from `study`.
- `Shell.jsx:9-13` · `NAV_ITEMS` labels (AUDIENCE MAP / AUDIENCE ROI / MESSAGE MAP / AUDIENCE PROFILES / TOPLINE) · Hardcoded nav; `study.yaml` has a `nav_label` per module the shell ignores. **Fix:** read nav labels from config.
- `Shell.jsx:50` / `Login.jsx:77` · "AUDIENCE INTELLIGENCE PLATFORM" tagline (also B) · **Fix:** single config string.
- `SegmentProfile.jsx:1962,1967` · `PROFILE_TABS` "HIV" tab label hardcoded · **Fix:** read `STUDY_META.name`.

### Duplicated study data (import instead of re-declare — est. −700 lines)
- `SegmentProfile.jsx:215-232` · local `STUDY_ROI` (HIV ROI numbers, keyed `["HIV"]`) · Duplicates `study.js` `STUDY_METRICS` AND `studyData.js`. **Fix:** `import { STUDY_METRICS }`; delete local copy.
- `SegmentProfile.jsx:9-152` · per-segment `roi`/`highRoi`/`supporters`/`activation`/`influence`/`persuadability`/`tier` inside `SEGMENTS` · Stale AL metrics co-located with the canonical roster; comment (2000-2002) confirms `s.tier` is "stale AL-era data." **Fix:** strip metrics from `SEGMENTS`; keep id/code/name/party/pop/demo/persona.
- `SegmentProfile.jsx:193-210` · local `PREPOST` (7-item) · Duplicates `STUDY_METRICS[code].prePost`; assigned at line 750 but **never rendered** (dead). **Fix:** remove; source from study.js if ever shown.
- `SegmentProfile.jsx:234-253` · local `GOP_VECTORS`/`DEM_VECTORS` · Duplicate `vectors.js`. **Fix:** import from `vectors.js`.
- `SegmentProfile.jsx:350-353` · `TIER_BG/TEXT/ACCENT/LABELS` · Duplicate `study.js` `TIER_CONFIG` (identical hexes). **Fix:** import `TIER_CONFIG`.
- `SegmentProfile.jsx:1000` · local `GAP_AVG=0.5912` · Duplicates `trust.js:10`. **Fix:** import from `trust.js`.
- `SegmentProfile.jsx:995-1075` · `TRUST_DATA`/`ENTITIES`/`BELIEFS` · Duplicate `trust.js`. **Fix:** import.
- `SegmentProfile.jsx:1078-1154` · experiential/media/wellness datasets · Duplicate `experiential.js`. **Fix:** import.
- `SegmentProfile.jsx:1193-1349` · `SEGMENT_BELIEFS`/`NICE_NAMES`/`INS_REFORM` · Duplicate `trust.js`. **Fix:** import.
- `SegmentProfile.jsx:304-347` · `IDEOLOGY_GROUPS`/`IDEOLOGY_DATA` · Duplicate `ideology.js` (and re-duplicated in IdeologyHeatmap). **Fix:** import.
- `IdeologyHeatmap.jsx:4-21` · `SEGS` redeclared (UPPERCASE — drift risk vs studyData Title Case) · **Fix:** import the shared segment list.
- `IdeologyHeatmap.jsx:67-85` · `DATA` ideology matrix hardcoded in the page · **Fix:** move to `src/data/ideology.js` and import.
- `AudienceROI.jsx:42-62` · `C` palette + `tier1/2/3` colors re-declared · Duplicate `theme.js` `C` + `study.js` `TIER_CONFIG`. **Fix:** import shared tokens.
- `AudienceROI.jsx:322-328` · `persuadLabels` re-hardcoded · Duplicates `PERSUADABILITY_LABELS` (study.js:123). **Fix:** import it.
- `MessageMap.jsx:462` · methodology prose hardcoded · `STUDY_META.methodology` exists but unused. **Fix:** render from it.

### Theme / color one-offs (should be theme tokens)
- `study.js:100` · `THEME_COLORS = {}` · Empty, no consumer; intended per-theme message coloring never wired. **Fix:** populate + consume, or remove until Wave 2.
- `MessageMap.jsx:90-94,654,871,936,984,1183` · persona violet `#7F77DD` (vs `C.violet=#a78bfa` used elsewhere for the same "persona" meaning) · **Fix:** add a `persona` token to `theme.js`.
- `MessageMap.jsx:296,720,1303,1312` + `OutcomeCards.jsx:29,36` · metric colors `#34d399` (persuasion) / `#60a5fa` (base) re-hardcoded · **Fix:** add `color` to each `lift_variants` entry.
- `MessageMap.jsx:884,981` · cube chrome `#0c1322`, box-shadow stacks, `'Lora'` 16px wording font inline · **Fix:** theme tokens / a `mono-serif` font constant.
- `SegmentProfile.jsx:357-364` · `C` palette object · Hardcoded theme. **Fix:** shared theme export.
- `SegmentProfile.jsx:987-993` · `CP` palette object (a **second** theme in the same file) · Overlaps `C`. **Fix:** collapse to one configurable theme.
- `SegmentProfile.jsx:446,499,517,822,841,857,887-891…` · scattered raw hex literals not in `C`/`CP` · **Fix:** derive from the theme object.
- `IdeologyHeatmap.jsx:24-65` · `GROUPS` dim labels + group colors + lo/hi polarity copy · **Fix:** config-driven dimension registry.
- `App.jsx:41` · loading-screen `#080c16`/`#64748b`/`'Nunito'` inline · **Fix:** import `C`/`FONT`.
- `Login.jsx:60,69-70,…` · entire login palette/font hardcoded (does not use `theme.js`) · **Fix:** route through `data/theme`.
- `index.css` · body/scrollbar hexes (`#080c16`/`#0f1520`/`#334155`) + `'DM Sans'` · Cosmetic; **Fix (low):** share theme tokens.

### Magic thresholds, scales & layout
- `study.js:110` · `getTierNum(roi){ roi>=1.07?1:roi>=1.00?2:3 }` · Hardcoded AL ROI cutoffs (marked deprecated, no live consumer). **Fix:** `STUDY_META.tierThresholds=[1.07,1.00]` or delete.
- `study.js:112-121` · `getSopColor` thresholds `13/11/10/9/8/7/6` + hex pairs · SoP bin edges baked in. **Fix:** expose band thresholds (low priority — SoP empty in Wave 1).
- `IdeologyHeatmap.jsx:88-108` · `getColor`/`getTextColor` thresholds `(val-1.5)/5.0`, `>=5.3`, `<=2.5`, 0.35/0.55 · **Fix:** a `color_scale` config block (parallels `lift_variants[].color_scale`).
- `IdeologyHeatmap.jsx:187-201,304` · REPUBLICAN/DEMOCRAT `colSpan={10}`/`{6}`, band hexes, `width:58` · GOP=10/DEM=6 counts hardcoded — breaks if segment composition changes. **Fix:** derive colSpans from `SEGS.filter(party)`.
- `IdeologyHeatmap.jsx:319-324` · deviation-shading thresholds `0.7`/`0.4` + rgba · **Fix:** config thresholds.
- `SegmentProfile.jsx:885-891` · heatmap thresholds `(val-1.5)/5.0`, 0.35/0.55, color stops · **Fix:** config.
- `SegmentProfile.jsx:823,842,858` · bar-scale denominators `/20`, `/30`, `Math.max(maxRel,65)` · Hardcoded axis maxima (Military 20% / Union 30% / Religion 65%). **Fix:** derive from data.
- `SegmentProfile.jsx:826,845` · "Pop avg ~9%" / "Pop avg ~16%" literal strings · **Fix:** derive from `popAvg(MILITARY)`/`popAvg(UNION_HH)` (helper exists at 1157).
- `SegmentProfile.jsx:1177,1186-1188` · `SD_FLOOR=0.05` + inline z/SD floors · Hardcoded stat tuning. **Fix:** surface in config.
- `SegmentProfile.jsx:1647-1905` · chart maxima (UM `/0.4`, insurance `0.60`, HBIS `maxScale=6`, HBar 0.3/0.7/0.85) · Magic axis scales. **Fix:** derive from data/config.
- `MessageMap.jsx:495,493` · `rowTemplate="36px 220px 150px …"`, `minmax(56px,1fr)`/`minmax(180px,3fr)` · Hardcoded grid column widths. **Fix:** layout config.
- `MessageMap.jsx:1162` · `maxHeight: isOpen ? 600 : 0` · Accordion clamp clips tall proof lists. **Fix:** derive from content.
- `MessageMap.jsx:58` · `FADE_BELOW = UI.fade_shrink_weight_below ?? 0.6` · Already configurable; `0.6` fallback is a magic confidence threshold (acceptable).
- `AudienceROI.jsx:29-39` · `H` fixed row heights (header:120, persuasion:205, prePostRow:44…) · Magic layout dims; `prePostRow` must track `PREPOST_METRICS.length`. **Fix:** layout config / derive.
- `AudienceROI.jsx:87,326-327` · persuadability 5-stop ramp re-declared · **Fix:** single shared `PERSUADABILITY_COLORS` (parallel to `PERSUADABILITY_LABELS`).
- `AudienceROI.jsx:306` · `seg.influence >= 15 ? …` · Hardcoded influence highlight threshold. **Fix:** config.
- `AudienceROI.jsx:109,132-134` · delta colors `#34d399`/`#ef4444` · Good/bad colors hardcoded. **Fix:** theme tokens.

### Positional-array fragility
- `SegmentProfile.jsx:181-189` · `RELIGION_OVERINDEX = { wEvan:[3,6], … none:[10,12,14,15] }` · Hardcoded **segment indices**; if `SEGMENTS` order ever changes these point to the wrong rows. **Fix:** key by segment code, not index.
- `SegmentProfile.jsx:157-158` · `MILITARY`/`UNION_HH` 16-element positional arrays (no code key) · Same fragility — relies on `SEGMENTS` order. Also `HBIS_SUM` (1154). **Fix:** key by code.

### Assets, population weights, Python pipeline
- `SegmentMap.jsx:29,162,298` · bubble `pop` badge `{b.pop}%` + "Bubble size = population weight" · Pulls **canonical PRISM `pop_share`** (study.yaml:283-298), NOT the HIV study's realized sample fractions (`study.yaml` notes `n=1,044`). **Bubble sizes may not match the HIV workbook.** **Fix:** add a study-level `pop_share` override consumed by the registry, or document that bubble size is canonical-by-design. *(Worth your explicit decision.)*
- `SegmentMap.jsx:33-50` · `CARD_IMAGES` — 16 persona-card paths under `/prism-demo/...` (mixed `.PNG`/`.png`) · Leftover demo-folder asset paths. **Fix:** derive from segment code + configurable asset base.
- `SegmentMap.jsx:268,278` · card `width:320` + "Click card to view full profile →" microcopy · **Fix:** config.
- `segments.js:7-118` · template `pop` fractions independent of `DATA.segments` · If ever wired up, must regenerate from the HIV workbook. Currently dormant.
- `extract_study.py:86` · `getAssignedTier` default `|| 3` · Magic fallback tier emitted to JS. **Fix:** from `study.yaml`.
- `extract_study.py:109-112` · `TIER_CONFIG` colors + labels baked in the generator string · **Fix:** move to `study.yaml`.
- `extract_study.py:116` · `getTierNum` 1.07/1.00 emitted to JS · **Fix:** config thresholds.
- `extract_study.py:119-126` · `getSopColor` bins `13/11/10/9/8/7/6` + 8 color pairs · **Fix:** `study.yaml`.
- `extract_study.py:129` · `PERSUADABILITY_LABELS` hardcoded in Python (may diverge from `index.items` YAML wording) · **Fix:** config.
- `workbook.py:49` · 5-column block stride `±2` offsets around `*_label` anchor · Magic column geometry (deliberately positional to dodge a header-typo bug per the code comment). **Fix:** declare block layout in `study.yaml`.
- `workbook.py:74,87-90` · `JUDGMENT_COLS` tuple + SegmentMetrics column-name list · Workbook schema baked into code. **Fix:** column map in config.
- `workbook.py:119,129` · `round(float(pre)*100,1)` / `×100` percent-scaling · Magic factor (canonical transform; low priority).

---

## Cross-cutting issues

1. **Three parallel sources for HIV per-segment metrics.** The same `roi`/`highRoi`/`supporters`/`activation`/`influence`/`persuadability`/`prePost` numbers live in (a) `study.js` `STUDY_METRICS` — the canonical generated location; (b) `studyData.js` `DATA.HIV.segments` — a parallel dump; (c) `SegmentProfile.jsx` `STUDY_ROI`+`PREPOST` — hand-keyed. Pages read mostly from (a). **`DATA.HIV` appears dead** (loaded, never read by a traced consumer) — recommend deleting it so a `study.js` refresh can't leave it stale.
2. **`pop` units are inconsistent.** `DATA.segments.pop`, `BUBBLES`, and `SegmentProfile.jsx` use **integer-percent** (`2`, `7`, …); `data/segments.js` uses **decimal-fraction** (`0.02`, `0.07`, …). `segments.js` is the odd one out (and dormant). Pick one; lowest-risk is to align `segments.js` to integers.
3. **Generated vs hand-edited split.** `study.js` is generated from `study.yaml`+`judgments.xlsx`; hand-edits get clobbered (header warns). Reviewers should treat `study.js` literals as build output, not source — the source is `study.yaml`.
4. **The heaviest un-migrated AL residue is in `study.yaml`'s `topline_config`** (~lines 304-1419, outside the audited app-shell files): `subtitle: PRISM Voter Study — RCG / Dynata`, `weight_target: …× 2024 vote`, `coalition_a_label: GOP Coalition`, and the Influencer360 battery's overtly political items ("Held elected office," "party committee"). It feeds the topline engine, not the React shell, but confirms the AL→HIV repurposing is incomplete at the config layer.

---

## Appendix: file-by-file inventory

**src/App.jsx** — Auth-gate + router. No AL residue; `BYPASS_AUTH=false` is prod-safe. Only debt: inline loading-screen colors/font (D, line 41).

**src/components/Shell.jsx** — Top-bar shell. Study name flows from `STUDY_META` (C). Debt: hardcoded nav labels + "AUDIENCE INTELLIGENCE PLATFORM" tagline (B/D). Uses theme tokens properly.

**src/pages/SegmentMap.jsx** — Bubble map. Coords/stage/palette/divider canonical (A). Carries the AL political frame: DEMOCRATIC/REPUBLICAN banners + legend (B, duplicating `study.yaml` `coalition_*`). Bubble `pop` badges pull canonical pop_share — may not match HIV sample (D). Persona-card paths under leftover `/prism-demo/` (D).

**src/pages/AudienceROI.jsx** — Sources all per-segment numbers from `STUDY_METRICS`/`PREPOST_METRICS`/`getAssignedTier` (C, verified). Debt: re-declares `C`/tier colors + `persuadLabels` already in `theme.js`/`study.js` (D), campaign-framed metric copy + ROI formula string (B), fixed pixel `H` heights (D).

**src/pages/MessageMap.jsx** — Heavily rewritten on this branch; fully data-driven from `dashboard.json` + `STUDY_METRICS` (C). SoP/Utility stubbed as placeholders. Free of literal AL/ESI/drug-pricing strings. Debt: hardcoded persona violet `#7F77DD`, metric colors, grid templates, 600px accordion clamp (D); large hardcoded methodology prose with campaign framing (B).

**src/pages/SegmentProfile.jsx** — ~2139-line monolith embedding all canonical datasets (A) and tab panels. Study integration that IS wired (tier via `getAssignedTier`, name via `STUDY_META`) flows correctly (C). Heavy debt: duplicated `STUDY_ROI`/`PREPOST`/vectors/tier-colors/two theme palettes (`C`+`CP`) that should import from study.js/theme.js/vectors.js/trust.js (D); footer/version/CONFIDENTIAL/brand strings (D); un-scrubbed AL pharma/ESG/MA/ESI text in persona & belief content (B); positional-array fragility (D). Pre/post is dead here (`PREPOST`/`PrePostBar`/`PP_LABELS` defined, never rendered).

**src/pages/IdeologyHeatmap.jsx** — Most self-contained and most debt-laden: hardcodes its own `SEGS`, the entire 15×16 ideology `DATA`, the `GROUPS` registry (incl. AL-flavored `MFA`), and all color/deviation thresholds — none imported (D). Hardcodes brand/`V3.1`/CONFIDENTIAL strings contradicting `dashboard.study.version` (B/D) and REPUBLICAN/DEMOCRAT `colSpan` counts that break on segment-composition change (D).

**src/pages/Login.jsx** — Supabase auth UI. Study name flows from `STUDY_META` (C) — the old "AMERICAN LEADERSHIP STUDY" caption is gone. Debt: entire palette/font hardcoded (does not use `theme.js`), tagline duplicated (B/D). No AL copy.

**src/main.jsx** — Trivial React entry point. No findings.

**src/index.css** — Global reset + dark-theme hexes + `'DM Sans'`. Cosmetic, study-agnostic; low-priority D.

**src/supabaseClient.js** — Highest-severity D: ships hardcoded fallback URL + anon key for the legacy shared `prism-dashboard-al-auth` project. If env unset, HIV users aren't isolated. Recommend env-only, no baked fallback.

**src/data/studyData.js** — Generated master data; cleanly HIV. `DATA.segments` canonical registry (A); `DATA.HIV` carries fully HIV-authored content but appears **dead** (cross-cutting #1). No AL leftovers. Debt: roi/tier numbers also hand-duplicated in SegmentProfile.jsx (D).

**src/data/study.js** — Generated study config, HIV-correct (C). Hosts the live consumed exports. Debt: deprecated `getTierNum` (1.07/1.00 cutoffs), empty `THEME_COLORS`, `getSopColor` baked thresholds (D). `STUDY_META.methodology` exists but MessageMap doesn't consume it.

**src/data/segments.js** — PRISM template `SEGMENTS`; **not imported anywhere** (dormant). Structure canonical (A) but all persona/demo prose is stale-AL pharma/drug-pricing/MAGA content (B). `pop` is decimal here vs integer everywhere else (cross-cutting #2). Must be re-authored before any HIV use.

**src/data/ideology.js** — Canonical 15×16 ideology matrix + bipolar anchors (A). HIV-agnostic. No B/C/D.

**src/data/vectors.js** — Canonical discriminant fingerprints + axis labels (A). HIV-agnostic. Re-hardcoded in SegmentProfile.jsx (D, tracked there).

**src/data/trust.js** — Canonical `TRUST_DATA`/`ENTITIES`/`BELIEFS`/`NICE_NAMES`/`INS_REFORM`/`GAP_AVG` (A). Several belief items + labels AL/pharma-worded (B-risk). `GAP_AVG` re-hardcoded in SegmentProfile (D).

**src/data/experiential.js** — Canonical experiential/insurance/podcast/news/wellness datasets (A). HIV-agnostic. No B/C/D.

**src/data/theme.js** — Canonical design system: `C` palette (incl. GOP/DEM), fonts, `partyColor()` (A). No study content. (`THEME_COLORS` lives in study.js, not here, and is empty.)

**index.html** — Single finding: `<title>` study string hardcoded (B), a hand-edited duplicate of `study.yaml:12`.

**package.json** — Renamed to `prism-hiv-dashboard`. React 19 / Vite 7 / Supabase / react-router-dom. No AL residue. Clean.

**README.md** — HIV/Gilead docs (B). Accurate to the new pipeline. Staleness: date "May 2026" vs "Apr-Jun 2026" elsewhere; line 13 omits that study.js is generated from `study.yaml` (not just `judgments.xlsx`).

**pipeline/extract_study.py** (renamed from `extract_hiv.py`) — JS generator. Correctly sources `SEG_ORDER`/registry from `study.yaml` (A; old hardcoded list gone). Debt: emits presentation constants as string literals into study.js — `TIER_CONFIG` colors, `getTierNum` cutoffs, `getSopColor` bins+palette, `PERSUADABILITY_LABELS`, `||3` default tier (D).

**pipeline/workbook.py** — Single judgments reader. Robust (name-based `find_col`, auto-detected K). Debt: positional 5-column block stride with `±2` magic offsets (A/D flag), hardcoded column-name list + `JUDGMENT_COLS` + `×100` transform (D). Comment at line 84 is the only surviving `extract_hiv` reference.

**study/study.yaml + pipeline/study_config.py** (read to verify flow) — The new config source-of-truth; works as intended (no hardcoded study constants in the loader). The `topline_config` block holds the heaviest un-migrated AL/political residue (cross-cutting #4) — outside the strict app-shell audit scope but flagged for the config-layer cleanup.
