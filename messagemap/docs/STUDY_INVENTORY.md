# PRISM 3-Study Inventory (AL, AHIP, HIV)

Produced 2026-06-03 before resuming Phase A of the messagemap refactor.
The HIV-scoped Pydantic schema in `messagemap/src/prism_config.py` will
be expanded against this inventory, not redone.

## Sources

| Study | Source repo (visible to inventory) | Live | Auth | What's in repo |
|---|---|---|---|---|
| AL (AmericanLife / PhRMA) | `travlrdc1982/prism-dashboard-v4` | al.rcghealthprism.* (implied) | Supabase | React app + `src/data/study.js` (AL content) + `src/data/studyData.js` (canonical segments) |
| AHIP (ESI + MA) | `prism-lead/prism-dashboard-v4` | (prism-dashboard-v4.vercel.app implied) | None | React app + `src/data/studyData.js` (ESI + MA top-level keys) + `src/data/study.js` (vestigial AL stub, unused) |
| HIV | `travlrdc1982/prism-dashboard-HIV` | hiv.rcghealthprism.app | Supabase | React app + Python pipeline (`compute_core.py`, `extract_hiv.py`, `derive_hiv_seg_data.py`, `refresh.py`, `messagemap/`) + `src/data/study.js` (HIV) + `src/data/studyData.js` (canonical + HIV) + `src/data/topline/dashboard.json` + `src/data/hiv/*.json` |

## Pipeline asymmetry (read this first)

**The three studies do not share a `compute_core.py`. They never did.** Specifically:

- **AL and AHIP** have no Python pipeline source in their repos. The auto-generated comment at the top of `studyData.js` for both says `python convert_data.py [WORKBOOK]`. **That `convert_data.py` is not in any accessible repo** (I checked all 13 visible repos under the `prism-lead` org and both `prism-dashboard-v4` forks). It lives off-repo, likely on the analyst's local machine or a private store.
- **HIV** has a full Python pipeline checked into the repo (`compute_core.py` is ~2,000 lines), plus the four-step orchestrator (`refresh.py`). HIV's pipeline produces a much larger output surface than AL/AHIP's pipeline produces.

Practical implication: the "configurability surface" the YAML needs to express is **mostly derived from the HIV pipeline today**, plus a few shape concessions for AL and AHIP. The AL/AHIP pipelines (whatever `convert_data.py` actually does) are smaller and produce a strict subset of HIV's output. The right framing for the refactor is:

> The platform engine is HIV's pipeline made generic. AL and AHIP are degenerate cases of that pipeline that skip the topline + persona-profile + message-map sections and emit only the segment-metrics + messages-with-variants core.

If Bryan can produce `convert_data.py` later, the inventory below should be revised against it. For now, AL/AHIP rows describe the data shapes consumed by the React app (the contract), not the producer code.

## React data-layer shapes per study

What each study's React pages actually consume:

| File | AL reads | AHIP reads | HIV reads |
|---|---|---|---|
| `studyData.js` | `DATA.segments` only (canonical 16-segment skeleton) | `DATA.segments`, `DATA.ESI`, `DATA.MA` | `DATA.segments`, `DATA.HIV` |
| `study.js` | `STUDY_META`, `MESSAGES`, `STUDY_METRICS`, `TIER_CONFIG`, `getTierNum`, `CONTROL_SOP`, `VARIANT_SOP`, `TOTAL_SOP`, `TOTAL_TOTALS`, `CONTROL_TOTALS`, `VARIANT_TOTALS`, `THEME_COLORS`, `PERSUADABILITY_LABELS` | Nothing imported by pages (AHIP `study.js` is a vestigial AL stub) | `STUDY_META`, `K_PREPOST`, `MESSAGES`, `CONTROL_SOP`(empty), `VARIANT_SOP`(empty), `ASSIGNED_TIERS`, `getAssignedTier`, `STUDY_METRICS`, `PREPOST_METRICS`, `TIER_CONFIG`, `getTierNum`, `getSopColor`, `PERSUADABILITY_LABELS` |
| `topline/dashboard.json` | n/a | n/a | full topline (modules, items, batteries, composites, trust, pre/post, demographics, influencer, ROI placeholders) |
| `hiv/*.json` | n/a | n/a | seg_data.json, bench.json, items.json, trust.json, zparams.json, manifest.json (persona profile) |

## Inventory of variations across studies

Five-part schema per your spec. Each variation gets: (a) what changes, (b) which studies have it, (c) what kind of configurability that requires.

### Section 1. Constants that vary across studies → YAML scalar/list fields

| # | What | AL | AHIP | HIV | Configurability type |
|---|---|---|---|---|---|
| 1.1 | Study metadata (name / client / topic / field date / methodology) | "AmericanLife / PhRMA / Pharmaceutical Investment 2025 / 11-msg MaxDiff" | "ESI" and "MA" (two studies in one app) | "PRISM HIV / Gilead / Apr-May 2026 / 17-msg MaxDiff + persuasion index" | Scalar fields in `study.*` block (already in YAML). For AHIP: a top-level YAML with `studies[]` array (multi-study mode) or two separate YAMLs |
| 1.2 | Number of messages | 11 | unknown (need MAESI workbook); inferred from studyData each study | 17 | Scalar `maxdiff.n_messages` (already in YAML) |
| 1.3 | MaxDiff task design (n tasks, items per task, n versions, design file) | unknown for AL | unknown for AHIP | 14 tasks × 4 items × 272 versions | Scalar fields `maxdiff.{n_tasks, items_per_task}` + path `maxdiff.design_file` (already in YAML) |
| 1.4 | Persuasion-index items (count, labels, scale, alpha thresholds) | NO persuasion index (AL has no pre/post composite at study.js level) | NO persuasion index | 7 items × 7-pt scale × α ≥ 0.70 soft | `index.items[]` + `index.scale` + `index.alpha_*` (already in YAML). Becomes OPTIONAL block; degenerate-case studies omit it |
| 1.5 | Pre/post metrics (single-measure pre/post tracking, separate from MaxDiff composite index) | AL has nothing visible at this layer | unknown | HIV has K_PREPOST=7 plus PREPOST_METRICS array (rank, att1, att2, fav, etc.) | New YAML block `prepost.metrics[]` with per-metric `{key, label, question, scale}` |
| 1.6 | Segment tier assignment per study | AL: `getTierNum(roi)` formulaic (roi≥1.07 → 1, ≥1.00 → 2, else 3) | AHIP: same formulaic `getTierNum(roi)` | HIV: `ASSIGNED_TIERS` is an explicit dict per segment (analyst-edited, NOT formulaic) | Two patterns: (a) `tier_assignment: formulaic` with thresholds vs. (b) `tier_assignment: explicit` with `segments.priority_tier_in_study` dict. Both need to be expressible. |
| 1.7 | Persuadability bands (labels) | `["Strong support","Lean support","Persuadable","Lean oppose","Strong oppose"]` (5-band) | same 5-band | same 5-band | YAML `persuadability.bands[]`. Same across all three; can be a platform constant unless a study wants different bands. |
| 1.8 | Theme colors per message theme | `{Leadership, Security, Economy, Innovation, Patient}` 5 themes | `{Leadership, Security, Economy, Innovation, Patient}` 5 themes | empty/no themes | YAML `theme_colors: {theme_name: hex_color}` dict, optional |
| 1.9 | ROI tier thresholds | hardcoded 1.07 / 1.00 in `getTierNum` | hardcoded 1.07 / 1.00 in `getTierNum` | not used (HIV is explicit per segment) | `tier.thresholds: [1.07, 1.00]` (optional, only when tier_assignment=formulaic) |
| 1.10 | SoP color scale break points | `getSopColor`: v≥13/10/7/6/<6 (5-band) | `getSopC`: v≥13/10/7/6/<6 (5-band) | `getSopColor` (same) | YAML `sop.color_breaks: [13, 10, 7, 6]` (or platform constant) |
| 1.11 | Study-specific composite formulas | none in AL | none in AHIP | 8 (MBS, SDS, EDS, SCS, CFS, PFS, SCF, HKS) | `composites[]` block in canonical hiv_2026.yaml (already exists). OPTIONAL block. |
| 1.12 | Item batteries | none in AL or AHIP at the React layer | none | HIV: hivstigma, mfq, critics, trust, knowledge, demographics, influencer | `batteries[]` block (already in canonical hiv_2026.yaml). OPTIONAL. |

### Section 2. Code sections that differ structurally → named engine patterns

| # | What differs | AL | AHIP | HIV | Pattern dispatch |
|---|---|---|---|---|---|
| 2.1 | How MessageMap renders cells | Reads `MESSAGES` from study.js with per-segment variants string. Renders SoP as a 16-column matrix (`CONTROL_SOP`, `VARIANT_SOP`, `TOTAL_SOP`) | Reads `DATA.ESI` / `DATA.MA` per-study sub-objects via toggle. Renders SoP from precomputed per-message arrays | Reads `dashboard.json.message_topline` + `message_map_cells` from messagemap pipeline; renders 4D cells (msg × seg × arm × token) | Engine pattern enum: `message_map.engine: {simple_sop \| persona_variant_matrix \| maxdiff_persona_proof}` |
| 2.2 | AudienceROI scorecard cell math | Per-segment ROI from STUDY_METRICS; formulaic tier from roi | Per-segment ROI from DATA.{ESI,MA}.segments; same formulaic tier | Per-segment ROI from workbook (analyst-edited); explicit tier from ASSIGNED_TIERS | `roi.tier_assignment: {formulaic \| explicit}` enum |
| 2.3 | Pre/post measurement | Not at React layer | Not at React layer | Two patterns coexist: (a) PREPOST_METRICS from workbook for the persona profile (HIV uses 7 metrics with rank/att/fav scales) (b) idx{NNN}_pre/post variables from the .sav driving persuasion index residualization for messagemap | YAML branch: `prepost.enabled: bool`, plus sub-blocks `prepost.workbook_metrics[]` and `prepost.sav_items[]` (both optional) |
| 2.4 | Multi-study toggle within one app | Single study (AL) | Two studies side-by-side (ESI / MA toggle in nav) | Single study (HIV) | YAML `dashboard.studies[]: list of sub-studies`; AHIP has 2 entries, AL/HIV have 1 |
| 2.5 | Auth | Supabase, Login.jsx, Shell signs out | None (open) | Supabase + Login + /admin invite flow | `auth.provider: {none \| supabase}`, plus optional admin allowlist block |
| 2.6 | Topline page | Not present | Not present | Full topline at `/topline` (modules, banner tables, batteries, trust battery, MaxDiff, ROI) | `topline.enabled: bool`. When true, requires the full `compute_core.py`-style pipeline run. |
| 2.7 | Persona profile content | Only `persona: {quote, believe, want, doWhat, whoAre}` from canonical segments; no per-study deep tab | Same as AL | Adds an HIV-specific tab inside SegmentProfile (`HIVTab.jsx`) with SCF/Stigma/Knowledge/Contact tiles, topology scatter, trust list | `persona_profile.custom_tab: {none \| <named extension>}` (extension point) |

### Section 3. Functions monkey-patched, replaced, or extended per study → extension points

None of the three studies monkey-patch core engine code in the way one might fear (no per-study Python forks that diverge from a common base). The "extension" pattern in practice is:

| # | Extension point | AL | AHIP | HIV | Mechanism |
|---|---|---|---|---|---|
| 3.1 | Workbook ingestion (`convert_data.py` / `extract_hiv.py`) | `python convert_data.py AmericanLifeDashboardData.xlsx` (script NOT in repo) | `python convert_data.py MAESIDashboardData.xlsx` (script NOT in repo) | `extract_hiv.py HIV_Study_Template.xlsx` (in repo) | Named extension callable registered by config. Studies declare `pipeline.workbook_ingest: <name>` → registry dispatch |
| 3.2 | Per-study messages-with-variants structure | study.js MESSAGES array with `{id, code, shortName, theme, control, variants:{seg_id: text}}` | (same shape, but not in study.js — it's inside `DATA.{ESI,MA}.messages` of studyData.js per-study sub-key) | study.js MESSAGES array with same shape | Common output schema; the producer extension point varies but the output is uniform |
| 3.3 | Persona profile tab | none | none | `HIVTab.jsx` is a fully custom React component reading from `src/data/hiv/*.json` | Per-study "Layer 3" custom extension per `NEW_STUDY_PLAYBOOK.md`. Not generalized. Each study declares whether it has one. |
| 3.4 | Topline section renderers | none | none | HIV has TrustModule, ItemsModule, PrePostModule, DemographicsModule, InfluencerModule, RoiModule | Module renderer registry keyed by module id. New studies can plug in new module renderers via the same pattern. |
| 3.5 | Composite formula evaluator | none | none | HIV evaluates 8 composites from items via a small expression DSL (mean(), mean_diff(), sum_aware()) | Named composite-method functions registered in the pipeline (already partially modeled in canonical hiv_2026.yaml as `formula` strings) |
| 3.6 | Reverse coding rule | none in AL or AHIP at this layer | none | HIV `derive_hiv_seg_data.py` applies `8 - val` reverse coding to SDS and SCS for the HIV-tab's "avoidance" framing | YAML `composites[].direction` enum + a reverse-coding registry |

### Section 4. `dashboard.json` sections that differ across studies → stable output schema

| Section | AL | AHIP | HIV | Treatment in platform schema |
|---|---|---|---|---|
| `study` (meta block) | n/a | n/a | present | Required output block, common shape |
| `segments` (per-study segment list with n, code, party, tier) | implicit (via studyData.js `DATA.segments` + `STUDY_METRICS`) | implicit (per `DATA.{ESI,MA}.segments`) | explicit in dashboard.json | Required, common shape |
| `messages` (messages with variants per segment) | study.js `MESSAGES` | studyData `DATA.{ESI,MA}.messages` | dashboard.json `messages` (broken schema today; should align) | Required, common shape |
| `baskets` (segment groupings for analyst views) | n/a | n/a | present (5 baskets) | Optional, HIV-specific currently. AL/AHIP could adopt. |
| `lift_variants` (PERSUASION / BASE outcome toggle) | n/a | n/a | present (2 variants) | Optional, only required when messagemap.enabled = true |
| `message_map_cells` (4D cell estimator output) | n/a | n/a | present (1151 cells × 2 outcomes) | Optional, only when messagemap.enabled = true |
| `message_topline` (per-segment × message SoP + utility) | n/a (AL has CONTROL/VARIANT/TOTAL_SOP matrices in study.js, similar info different shape) | n/a (similar in studyData) | present (272 rows = 16 segs × 17 msgs) | Common shape required; AL/AHIP currently inline-encode in study.js / studyData.js |
| `sop_simple` (5-basket simple SoP plot) | n/a | n/a | present | Optional, HIV-specific |
| `topline` (full topline module data: items, batteries, composites, trust, etc.) | n/a | n/a | present (modules array + items[] + batteries[] + composites + trust + demographics + influencer) | Optional, only when topline.enabled = true |
| `hiv_tab` / persona profile deep-dive | n/a | n/a | present at `src/data/hiv/*.json`, NOT in dashboard.json | Optional, study-specific custom extension |

The lesson is: the platform `dashboard.json` schema is mostly **a set of optional sections** that the engine emits when the study has the data for them. AL/AHIP run the engine with most sections disabled, HIV runs everything.

### Section 5. Study-specific extensions in one study but not others → generalize / retire decisions

| Extension | Studies | Recommendation |
|---|---|---|
| HIV stigma battery (13 items × 7-pt agreement + 8 composites: MBS, SDS, EDS, SCS, CFS, PFS, SCF, HKS) | HIV only | Keep as study-specific. Don't generalize the battery (it's content); the composite-formula engine already generalizes. |
| HIV knowledge battery (11 binary items including K5 trap) | HIV only | Same — content is study-specific; the binary-set engine generalizes. |
| HIV persona profile tab (HIVTab.jsx + hiv_tab_v5.html-derived SVG positioning) | HIV only | Per `NEW_STUDY_PLAYBOOK.md`: each study decides whether to build its own custom deep-dive. Treat as Layer 3 always. Do not abstract. |
| Trust battery (22 messengers × 7-pt trust scale, top-3 metric + sig + frequency dist) | HIV only currently. Methodology is reusable. | Keep as a named module pattern in the engine. AL/AHIP could opt in later. |
| MaxDiff with persona-tuned variants (3 effects: theme utility, persona lift, proof-point lift) | HIV only currently. AL has persona variants but no proof tokens. AHIP has nothing visible. | Keep as the canonical message-map engine (the messagemap subdirectory). Studies opt in. |
| Pre/post survey items at the .sav level (idx{NNN}_pre/post variables feeding the persuasion index) | HIV only | Keep as optional. Only used when `index.enabled = true`. |
| Per-segment ROI tier assignment via workbook column (analyst-edited tiers) | HIV only | Keep as an alternative to `formulaic` tier assignment. AL and AHIP could adopt. |
| ESI / MA multi-study toggle within one React app | AHIP only | Keep as a `dashboard.studies[]: array` pattern. HIV and AL have 1 entry; AHIP has 2. |
| Two-message SoP comparison (CONTROL_SOP vs VARIANT_SOP separate matrices) | AL only | Generalize as a special case of the message-map: AL is doing a 2-arm (Control vs Variant) test, HIV is doing a 17-msg × 16-seg × proof-token test. Both express via the same 4D cell shape; AL's is a degenerate case (1 message family × 2 arms × 16 segments × 0 proof tokens). |

## Implications for the YAML schema (what's missing from today's `study.yaml`)

Based on the five-study union (which is really HIV ⊇ AL ≈ AHIP), the schema I wrote against HIV mostly survives, but it should be expanded as follows:

| New block / field | Rationale |
|---|---|
| `study.id` becomes a discriminator (single vs multi-study container) | AHIP has 2 studies in one app. Either a top-level `studies[]: List[StudyConfig]` wrapper or a `study.subordinate_studies[]` array. |
| `index.enabled: bool` | AL/AHIP don't have a persuasion index. Index block becomes optional. |
| `topline.enabled: bool` (already mostly there) | Same gating, more explicit. |
| `prepost.enabled: bool` + `prepost.metrics[]` | New top-level block for pre/post survey metrics (HIV has 7 currently). Distinct from index-level pre/post. |
| `tier_assignment: formulaic \| explicit` + `tier.thresholds: [hi, lo]` or `tier.assigned: Dict[seg_code, int]` | AL/AHIP do formulaic, HIV does explicit. Schema needs both. |
| `theme_colors: Dict[str, hex]` (optional) | Per-study theme palette for message-map UI. |
| `sop.color_breaks: List[int]` (optional, default to platform constant) | The 5 color band thresholds for SoP cells. Currently hardcoded in pages. |
| `auth.provider: none \| supabase` + admin allowlist block | AL and HIV have auth; AHIP doesn't. |
| `persona_profile.custom_tab: str \| null` | HIV has a custom tab; pointer to a registered React component name (extension point). |
| `message_map.engine: simple_sop \| persona_variant_matrix \| maxdiff_persona_proof` | Three patterns observed across studies. |
| `pipeline.workbook_ingest: str` (named extension callable, registered) | `convert_data` for AL/AHIP, `extract_hiv` for HIV. Registry-based dispatch. |
| `composites[]` block stays optional (HIV-only today) | Keep current shape. |
| `batteries[]` block stays optional (HIV-only today) | Keep current shape. |
| `trust[]` battery as a named module pattern | Available to any study that fields a trust scale. |

## What's missing that I can't recover without you

1. **`convert_data.py` source for AL and AHIP.** Either upload the file or paste it. Without it I'm modeling the producer schema from the React-consumer side only.
2. **AHIP `MAESIDashboardData.xlsx` and AL `AmericanLifeDashboardData.xlsx`** (workbook shapes for those studies). The HIV workbook (`HIV_Study_Template.xlsx`) is in the HIV repo. The AL and AHIP workbooks aren't anywhere I can see.
3. **Confirmation: is "AHIP" the project name, or is "ESI + MA" the actual two-study unit and "AHIP" the umbrella label?** If the latter, study.id should support a hierarchy (program → sub-study).

## Recommended next move

1. **Lock the inventory** (this document) as the schema-design driver.
2. **Get `convert_data.py` + the two missing workbooks** if you can. They'd let me compare producer-side vs consumer-side schemas and validate my "AL/AHIP are degenerate cases" claim.
3. **Expand the Pydantic schema** per the table in the previous section. Most additions are new optional blocks (index, topline, composites, batteries, etc.) plus a few new enums. The existing HIV-scoped validators continue to apply when the relevant block is present.
4. **Resume Phase A** after schema expansion is reviewed.

The HIV-specific code in `compute_core.py` is the closest thing to "the platform engine" today. The refactor turns it generic. AL and AHIP don't have a competing engine; they have a simpler producer (`convert_data.py`) that emits a strict subset of the same data shapes the React app consumes. Modeling the union is therefore "model the HIV pipeline + flag the optional sections" rather than "reconcile three competing pipelines."
