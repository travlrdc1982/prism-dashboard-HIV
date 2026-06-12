# PRISM HIV Dashboard — Architecture & Workflow

> A complete file-by-file map of the repo as it exists today, plus the
> end-to-end data flow from raw SPSS export to deployed Vercel preview.
>
> Snapshot: branch `messagemap-integration` (Jun 2026, post-R4 pipeline/ reorg).

---

## 1. What this repo is

A single-page React (Vite + React 19) dashboard plus a Python data
pipeline. The dashboard renders five views of a single PRISM study
(currently *Gilead HIV 2026*, n=2,578):

| Route        | Page component         | What it shows                                                                |
| ------------ | ---------------------- | ---------------------------------------------------------------------------- |
| `/`          | `SegmentMap.jsx`       | The 16-bubble PRISM segmentation overview (entry screen)                     |
| `/roi`       | `AudienceROI.jsx`      | ROI grid: tier × persuasion × pre/post × coalition × activation × influence  |
| `/messages`  | `MessageMap.jsx`       | Cell-level message-test surface (CORE × persona × proof × segment lift)      |
| `/profile`   | `SegmentProfile.jsx`   | Persona deep-dive per segment (radar + ideology + HIV tab)                   |
| `/topline`   | `Topline.jsx`          | Field-data topline (every item, every segment, with sig tests)               |

Auth is Supabase (email/password + magic-link invite). Deployment is
Vercel (every push to a branch produces a preview URL; `main` → prod).

```
   ┌─── SPSS export (.sav) ────┐         ┌── Analyst workbook (.xlsx) ──┐
   │  data/260433.sav          │         │  study/judgments.xlsx     │
   │  - rake weights           │         │  - tier, ROI inputs          │
   │  - 200+ survey variables  │         │  - messages, sig flags       │
   │  - persona_framing arm    │         │  - pre/post labels           │
   │  - MaxDiff token vars     │         └────────────┬─────────────────┘
   └───────────────┬───────────┘                      │
                   │                                  │
                   ▼                                  ▼
  ┌──────────────────────────┐         ┌──────────────────────────────┐
  │ TOPLINE PIPELINE         │         │ EXTRACT PIPELINE             │
  │ compute_core.build_      │         │ extract_study.py               │
  │ topline()                │         │  → src/data/study.js         │
  │  → dashboard.json (45k+  │         │  → src/data/studyData.js     │
  │    lines, all sections)  │         │    (HIV block)               │
  └────────────┬─────────────┘         └──────────────────────────────┘
               │
               ▼
  ┌──────────────────────────┐         ┌─────────────────────────────┐
  │ MESSAGEMAP PIPELINE      │         │ HIV-TAB DERIVATION           │
  │ prism_build_dashboard.py │         │ pipeline/derive_hiv_seg_data │
  │ - persuasion index       │         │  → src/data/hiv/seg_data.json│
  │ - residualized shift     │         │  → src/data/hiv/bench.json   │
  │ - cell lifts × 2 outcomes│         │  → src/data/hiv/items.json   │
  │ - bootstrap CIs          │         │  → src/data/hiv/zparams.json │
  │ MERGED into dashboard.   │         └─────────────────────────────┘
  │ json (messages, baskets, │
  │ lift_variants, cells,    │
  │ variants, sop_simple)    │
  └────────────┬─────────────┘
               ▼
        ┌──────────────────────────────────┐
        │ src/data/topline/dashboard.json  │  ← single artifact, read by
        │ (the merged final artifact)      │     every dashboard page that
        └──────────────────────────────────┘     needs computed values
                   │
                   ▼
        ┌──────────────────┐
        │ React app (Vite) │  → Vercel preview / production
        └──────────────────┘
```

All five stages are wrapped by **`scripts/refresh.py`** — the analyst's
one command.

---

## 2. The one-command workflow

```bash
python scripts/refresh.py --commit
```

| Step | Reads                                  | Writes                                                    | Code                                                                  |
| ---- | -------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------- |
| 1/5  | `data/260433.sav`                      | `pipeline/topline/dashboard.json`                       | `pipeline/topline/compute.py` + `compute_core.py` |
| 2/5  | (above)                                | `src/data/topline/dashboard.json` (copy)                  | `scripts/refresh.py`                                                  |
| 3/5  | `data/260433.sav`, design `.dat`, variants `.xlsx` | merges 7 sections into `src/data/topline/dashboard.json` | `pipeline/messagemap/src/prism_build_dashboard.py`                            |
| 4/5  | `src/data/topline/dashboard.json`      | `src/data/hiv/seg_data.json`, `bench.json`, `items.json`, `zparams.json` | `pipeline/derive_hiv_seg_data.py`                                     |
| 5/5  | `study/judgments.xlsx`              | `src/data/study.js`, `src/data/studyData.js` (HIV block)  | `pipeline/extract_study.py`                                                      |
| git  | (above outputs)                        | commit + push                                             | `scripts/refresh.py`                                                  |

---

## 3. Inputs

### 3.1 The `.sav` (raw SPSS export)

`data/260433.sav` — produced by the analyst in SPSS after fielding the
survey. Contains:

- One row per respondent (n=2,578)
- `WEIGHT` — two-stage rake weights (produced by the prism package; the legacy `WGT` name is retired)
- `XSEG_ASSIGNED` — canonical PRISM segment id 1–16
- `persona_framing` — between-subject arm: 1 = PERSONA-tuned, 2 = CORE
- `M{NNN}_token` — within-subject proof-token assignment per message
- `task{NN}_best`, `task{NN}_worst` — MaxDiff picks
- `idx{NNN}_pre`, `idx{NNN}_post` — pre/post persuasion-index items
- All variables in the topline registry (`ITEMS`, `PRE_POST`,
  `BATTERIES`, `TRUST_LBL`, `INFLUENCER_BLOCKS` in `compute_core.py`)

Legacy SAVs (e.g. Decipher-exported HIV with `HIV_R1`, `QHIV_*`, etc.)
are resolved to canonical names via the `legacy_rename` block in
`study/study.yaml` (the single study configuration).

### 3.2 The workbook (`study/judgments.xlsx`)

Analyst-editable Excel file (judgments ONLY), 2 sheets:

| Sheet              | Role                                                                |
| ------------------ | ------------------------------------------------------------------- |
| `Messages`         | Message short-names, themes, core text labels                       |
| `SegmentMetrics`   | Per-segment ROI, tier, coalition support, activation, influence, persuadability bar, pre/post values |

(The wave-1 computed sheets — ControlSoP, VariantSoP, SigFlags, VariantText
— and StudyMeta/ThemeColors were removed in R2; study meta lives in
`study/study.yaml`, message structure in the variants workbook. Both
workbook consumers go through the single reader `pipeline/workbook.py`.)

`extract_study.py` reads this and regenerates `study.js` + the HIV block
of `studyData.js`. `compute_core.py` re-reads the `SegmentMetrics` rows
into `roi_data` so the `/roi` page and the embedded topline ROI module
agree.

### 3.3 The variants workbook (messagemap)

`pipeline/messagemap/workbooks/Gilead_Persona-Tuned_Message_Variants_json.xlsx`
— one sheet (`Message Variants`) with 18 columns per row:

```
msg_id   theme_label   token   proof_full_text   proof_short_label   core_msg_text
  + 16 columns (one per PRISM segment code): {CODE}_msg_text
```

Each row is one (message × token) variant; columns hold the per-persona
rewrites. Parsed by `pipeline/messagemap/src/prism_variants_parser.py` into
`pipeline/messagemap/outputs/prism_variants.json`.

### 3.4 The MaxDiff design file

`pipeline/messagemap/data/Gilead_Design_File.dat` — the survey-platform's
balanced incomplete block design that tells you which 4 messages each
respondent saw in each of their 14 MaxDiff tasks. Read by
`prism_step3_exposure.py`.

### 3.5 The canonical configs (`canonical/`)

These do **not** vary with the field data — they encode the PRISM
methodology itself:

- `canonical/scales.yaml` — 1–7 Likert / 1–5 trust / etc. scale defs
- `canonical/segments.yaml` — canonical 16-segment definitions
- `canonical/maxdiff_designs/hiv_2026_design.csv` — alternate copy of
  the design file in CSV form
- `canonical/rake_targets/registered_voters_2026.yaml` — rake margin
  targets used to produce the weights (superseded by prism/benchmarks)

---

## 4. The Python pipeline files

### 4.1 `scripts/refresh.py`

The orchestrator. Runs the 5 stages in order. Each stage shells out to
its real script — `refresh.py` doesn't compute anything itself.

**Flags:**

- `--sav PATH` (default: `data/260433.sav`, env: `PRISM_SAV`)
- `--workbook PATH` (default: `study/judgments.xlsx`)
- `--weight VAR` (default: `WEIGHT`)
- `--skip-pipeline` — skip the topline compute step (run derivations only)
- `--skip-messagemap` — skip the messagemap step
- `--commit` — `git add` + `git commit` + `git push` the regenerated artifacts

### 4.2 Topline pipeline

`pipeline/topline/`

| File              | Role                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------ |
| `compute.py`      | CLI entry point. Reads `.sav` via `pyreadstat`, calls `build_topline(df)`.                 |
| `compute_core.py` | The actual compute. Study registries (`STUDY`, `LABELS`, `MODULES`, `SEGMENTS`, `ITEMS`, `PRE_POST`, `BATTERIES`, `TRUST_LBL`, `INFLUENCER_BLOCKS`) are loaded from `study/study.yaml` (topline_config section); the engine carries no hardcoded study constants. `build_topline(df, out_dir, weight_var)` is the entry function. Writes `dashboard.json` covering: `study`, `labels`, `modules`, `segments`, `items`, `item_results`, `pre_post`, `pp_results`, `demographics`, `influencer`, `stigma_extras`, `trust`, `roi_svg`, `roi_data`. |
| `dashboard_template.html` | Reference HTML mock that the React Topline ports from (source of truth for visuals + scoped CSS). |
| `BUILD_GUIDE.md` / `BUILD_GUIDE.html` | Analyst guide for adding/changing items in the registry. |

**What `compute_core.build_topline()` does:**

1. Validates `XSEG_ASSIGNED` exists; maps id → code.
2. Applies `WEIGHT` (or `1.0`) to every row.
3. For every item in `ITEMS` (expanded from `BATTERIES`), runs
   `_compute_item()`: per-segment weighted stats (`top3_count`, mean,
   freq dist) + a z-test vs rest-of-sample, with significance flagged.
4. For every `PRE_POST` pair, runs the same per-segment compute on PRE
   and POST, plus a paired McNemar test on the top-3 indicator.
5. Builds `influencer` (8 banner tables) + `trust` (7-pt messenger
   battery) + `stigma_extras` (knowledge battery with K5 trap +
   composites).
6. Renders `roi_svg` from the workbook-driven ROI grid (also writes
   `roi_data` for the standalone `/roi` page).
7. Writes `dashboard.json` to the supplied `out_dir`.

### 4.3 Messagemap pipeline

`pipeline/study_config.py` — the shared config loader. Every engine
loads its study constants from `study/study.yaml` through this module
(`load_config`, `resolve_var` for legacy-name resolution, plus shaped
views: `segments_topline`, `segments_messagemap`, `baskets`,
`index_items`, `message_config`, `task_vars`, `sav_vars`).

`pipeline/messagemap/src/`

| File                          | Role                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `prism_config.py`             | Pydantic v2 model for `study/study.yaml` (full schema validation incl. segment registry + token map). |
| `prism_variants_parser.py`    | Reads the variants workbook → `outputs/prism_variants.json`. Pure transformation, no analytics.  |
| `prism_index.py`              | Steps 1–2: builds the persuasion index (`pre_composite`, `post_composite`, Cronbach α) and the **residualized shift** (regress post on pre + segment FE; the residual is each respondent's persuasion shift above their baseline + segment expectation). |
| `prism_step3_exposure.py`     | Step 3: reads the design file + `M{NNN}_token` + best/worst picks → builds a respondent × message × token × persona-framing **exposure matrix**, plus the per-respondent Best–Worst differential per message. |
| `prism_step4_lift_v2.py`      | Step 4: vectorized cell-level lift estimator. For each (message × segment × arm × proof) cell: signed-B-W-weighted shift in the numerator, abs-B-W in the denominator. Empirical-Bayes shrinkage toward the message marginal. 500-iter respondent bootstrap CIs. Runs **twice**: once with `outcome = residual_shift` (PERSUASION) and once with `outcome = pre_composite` centered by segment mean (BASE). |
| `prism_build_dashboard.py`    | The orchestrator. Stages 1–7: load `.sav`; build exposure; compute cells × 2 outcomes; compute topline SoP + Utility; compute simple SoP across 5 baskets; load variants.json; assemble messagemap-owned sections; write `pipeline/messagemap/outputs/dashboard.json`. |

**Sections owned by messagemap** (merged by `refresh.py` into
`src/data/topline/dashboard.json`):

- `messages` — 17 message records with theme labels + proof metadata
- `baskets` — 5 segment groupings (total, priority_d, priority_all, gop, dem)
- `lift_variants` — metric metadata (`persuasion_messaging`, `base_messaging`) with σ_within/σ_between and color-scale anchors
- `message_map_cells` — `{persuasion_messaging: [1151 cells], base_messaging: [1151 cells]}`, each cell with `n`, `lift_raw`, `lift_shrunk`, `ci_low`, `ci_high`, `shrink_weight`, `msg_marginal`
- `message_topline` — per-message × per-segment SoP and utility
- `sop_simple` — per-basket SoP plot data
- `variants` — per-message text by persona token (CORE + 16 segment rewrites per token)
- Plus `study.index` and `study.residualization` sub-keys

### 4.4 HIV-tab derivation

`pipeline/derive_hiv_seg_data.py` — reads `src/data/topline/dashboard.json`,
selects the composites that drive the persona-profile HIV tab (`MBS`, `SDS`,
`EDS`, `SCS`, `CFS`, `PFS`, `SCF`, `HKS`), reverse-codes `SDS`/`SCS`
(topline frames them as comfort, HIV tab frames them as avoidance),
applies **canonical PRISM population shares** (not sample `pct_wgt` — see
fix in commit `5aaa83b`) to compute coalition aggregates, and writes:

- `src/data/hiv/seg_data.json` — per-segment composites + CON + ranks + z
- `src/data/hiv/bench.json` — All / Republican / Democrat reference means
- `src/data/hiv/items.json` — SCF / stigma / know / contact accordion items
- `src/data/hiv/zparams.json` — population mean + SD per composite (for z)

Leaves `trust.json` (wave-2) and `manifest.json` (metadata) untouched.

### 4.5 Workbook extraction

`pipeline/extract_study.py` — reads `study/judgments.xlsx`, walks the 9 sheets,
auto-detects `K` (# pre-post items) from header pattern
`prepost_keyN_label`, and emits:

- `src/data/study.js` — `STUDY_META`, `MESSAGES`, `STUDY_METRICS`,
  `ASSIGNED_TIERS`, `PREPOST_METRICS`, `K_PREPOST`. The React `/roi` and
  `/messages` pages read tier + ROI here.
- `src/data/studyData.js` (HIV block) — `DATA.HIV.messages` + benchmark
  scaffolding consumed by legacy `/messages` heatmap (pre-messagemap).

### 4.6 Other Python utilities

| File                          | Role                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| `attic/convert_study.py`      | Retired: generic non-HIV workbook → study.js converter (pre-refresh era).                  |
| `attic/create_template.py`    | Retired: blank-workbook generator for new studies (pre-refresh era).                       |
| `pipeline/port_topline_css.py` | Extracts the `<style>` block from `dashboard_template.html` and scopes every selector under `.topline-root` → writes `src/components/Topline/Topline.css`. Run only when the HTML mock changes. |
| `pipeline/messagemap/verify/verify_harness.py` | Byte-equality test that re-runs the messagemap pipeline and compares against `outputs/dashboard.json`. Catches regressions. |
| `pipeline/messagemap/verify/test_config.py`    | Pydantic test for `study.yaml` schema.                                                     |

---

## 5. The React app

### 5.1 Entry & routing

| File                       | Role                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| `index.html`               | Vite root. One `<div id="root">`.                                                                 |
| `src/main.jsx`             | Mounts `<App />`.                                                                                 |
| `src/App.jsx`              | Supabase session gate (Login or SetPassword for new invites), then `<BrowserRouter>` with the 5 routes nested under `<Shell />`. |
| `src/supabaseClient.js`    | Creates the Supabase client from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (with legacy fallback). |
| `vercel.json`              | SPA rewrite: every path → `index.html`.                                                           |
| `vite.config.js`           | Vite + React 19 plugin.                                                                           |
| `eslint.config.js`         | ESLint flat config with React-hooks rules.                                                        |

### 5.2 Shared components

| File                              | Role                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------- |
| `src/components/Shell.jsx`        | Persistent header (logo, nav, admin link, study badge, sign-out) + `<Outlet />`.  |
| `src/components/PageHeader.jsx`   | Standard 3-line page header used by `/roi` and `/messages`: `RESERVOIR HEALTH PRISM` / `{title}` / `PRISM AUDIENCE INTELLIGENCE`. |
| `src/components/InfoDot.jsx`      | "?" hover dot with a 280px tooltip styled to match the SegmentProfile radar-axis tooltip (10px Nunito violet title + 10px body, `#1e293b` background). |

### 5.3 Page components

#### `src/pages/SegmentMap.jsx`  → `/`
The bubble landing screen. **Inputs:** none (segment bubbles are hardcoded). Clicking a bubble navigates to `/profile?seg={code}`.

#### `src/pages/AudienceROI.jsx`  → `/roi`
The ROI grid. **Inputs:** `DATA.HIV.segments` (from `studyData.js`) + `STUDY_METRICS` (from `study.js`) + `PREPOST_METRICS` + `getAssignedTier()`. Renders 16-column grid: ROI score · persuadability bar · pre/post deltas · coalition / activation / influence donuts.

#### `src/pages/MessageMap.jsx`  → `/messages`
The cell-level message map. **Inputs:** `src/data/topline/dashboard.json` directly — pulls `segments`, `messages`, `baskets`, `lift_variants`, `message_map_cells`, `variants`, and counts `proofs` to populate the data-driven counts strip. Currently rendered as the page chrome + frame (B1.7); live cell shading + drill-down + variant-universe wiring still to land in B2–B6.

#### `src/pages/SegmentProfile.jsx`  → `/profile`
The persona deep-dive. **Inputs:** local hard-coded `SEGMENTS` array + the imported `IdeologyHeatmap` and `HIVTab` sub-pages. Carries the radar-axis tooltips (`VECTOR_DEFS`) that everywhere else (incl. `InfoDot.jsx`) is now styled to match.

#### `src/pages/HIVTab.jsx`  → embedded inside `/profile`
The stigma-topology + accordions. **Inputs:** `src/data/hiv/*.json` (all four files derived by `pipeline/derive_hiv_seg_data.py`) + `getAssignedTier()`. Renders the stigma 2-D quadrant chart, the SCF/Stigma/Know/Contact accordions, the trust panel, and the bench glyph toggles.

#### `src/pages/IdeologyHeatmap.jsx`  → embedded inside `/profile`
Standalone heatmap on the 15 bipolar ideology dimensions × 16 segments. **Inputs:** hardcoded `IDEOLOGY_DATA` (static — not study-specific).

#### `src/pages/Login.jsx` / `SetPassword.jsx` / `Admin.jsx`
Auth screens + admin invite tool (calls the Supabase edge function in `supabase/functions/generate-invite/index.ts`).

### 5.4 Topline view (`/topline`)

`src/components/Topline/` is its own self-contained sub-app:

| File                                          | Role                                                                                          |
| --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `Topline.jsx`                                 | Wave-1 entry. Reads `src/data/topline/dashboard.json`, picks renderers via `MODULE_RENDERERS` keyed by `module.id`, handles the cell popover + expand/freq-dist/banner-full toggles. |
| `Topline.css`                                 | Generated by `pipeline/port_topline_css.py` from `dashboard_template.html`. Scoped under `.topline-root`. |
| `Topline.addendum.css`                        | Hand-authored polish: cell popover, banner-full overrides, sticky headers, etc.               |
| `components/TopNav.jsx`                       | Study name + Data Inspector button.                                                           |
| `components/ModNav.jsx`                       | Module chip nav (auto-enables `sources` once `trust.length > 0`).                             |
| `components/ItemBlock.jsx`                    | `<ModuleSection>` wrapper used by every module.                                               |
| `components/SurveyPane.jsx` / `ItemSurveyPane.jsx` / `BannerPane.jsx` / `CodebookPane.jsx` | The 3-pane layout (survey card · banner table · codebook glossary). |
| `components/Cell.jsx`                         | Single data cell with z-test significance flag rendering.                                     |
| `components/Sig.jsx`                          | Significance icon + tooltip explanation.                                                      |
| `components/TogglesBar.jsx`                   | Expanded-cell / full-freq-dist toggles.                                                       |
| `components/Legend.jsx`                       | Significance + color-scale legend.                                                            |
| `components/DataInspector.jsx`                | Raw-JSON drawer for debugging.                                                                |
| `modules/TitlePage.jsx`                       | Study cover module.                                                                           |
| `modules/DemographicsModule.jsx`              | Module 02 — demographics + party-vote crosstab + benchmark composites.                        |
| `modules/ItemsModule.jsx`                     | Modules 01 (Stigma — incl. `stigma_extras`) and 04 (Critics).                                  |
| `modules/PrePostModule.jsx`                   | Module 03 — pre/post McNemar deltas.                                                          |
| `modules/RoiModule.jsx`                       | ROI SVG render (workbook-driven, identical to `/roi`).                                        |
| `modules/InfluencerModule.jsx`                | Module 05 — high/low engagement + influencer banner tables.                                   |
| `modules/TrustModule.jsx`                     | Module 06 — 7-pt messenger trust battery (auto-enables when data present).                    |
| `utils/applyRoiOverrides.js`                  | Splices the workbook-sourced ROI values into the SVG template.                                |
| `utils/exportPng.js`                          | Module-as-PNG capture for analyst exports.                                                    |
| `utils/flatten.js` / `format.js` / `popover.js` | Cell-data helpers, number formatters, the delegated-event cell popover hook.                |

### 5.5 Static data files (`src/data/`)

Files that **do not** vary with field data — they encode the PRISM
template itself:

| File              | Contents                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------ |
| `theme.js`        | Color palette (`C.bg`, `C.violet`, party colors, etc.) + `FONT` + `MONO` + `partyColor()`. |
| `segments.js`     | The canonical 16-segment template (demo / persona quote / believe / want / who-are).       |
| `ideology.js`     | 15 bipolar ideology dimensions × 16 segments, hardcoded 1–7 scale.                         |
| `vectors.js`      | Discriminant-function radar loadings (the `/profile` radar).                               |
| `experiential.js` | Experiential-vector definitions for `/profile`.                                            |
| `trust.js`        | Trust-messenger template metadata (pre-wave-2; superseded by `dashboard.trust` once wave-2 ships). |
| `admins.js`       | Email allowlist for admin features (mirrored in the Supabase edge function).               |

Files that **do** vary with field data, regenerated each refresh:

| File                                    | Generated by                                                  |
| --------------------------------------- | ------------------------------------------------------------- |
| `src/data/topline/dashboard.json`       | Topline pipeline (step 2) + messagemap merge (step 3)         |
| `src/data/hiv/seg_data.json`            | `pipeline/derive_hiv_seg_data.py`                              |
| `src/data/hiv/bench.json`               | `pipeline/derive_hiv_seg_data.py`                              |
| `src/data/hiv/items.json`               | `pipeline/derive_hiv_seg_data.py`                              |
| `src/data/hiv/zparams.json`             | `pipeline/derive_hiv_seg_data.py`                              |
| `src/data/hiv/trust.json`               | Wave-2 only (placeholder for now)                             |
| `src/data/hiv/manifest.json`            | Hand-maintained metadata (study id, dates)                    |
| `src/data/study.js`                     | `extract_study.py`                                              |
| `src/data/studyData.js` (HIV block)     | `extract_study.py`                                              |

---

## 6. Auth

| File                                              | Role                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `src/supabaseClient.js`                           | Browser Supabase client.                                                                          |
| `src/pages/Login.jsx`                             | Email/password sign-in screen.                                                                    |
| `src/pages/SetPassword.jsx`                       | New-user landing page after invite link.                                                          |
| `src/pages/Admin.jsx`                             | Admin-only tool to generate one-time invite links via the edge function (admin emails in `src/data/admins.js`). |
| `supabase/functions/generate-invite/index.ts`     | Supabase Edge Function. Verifies caller's email is in the admin allowlist, then calls `auth.admin.generateLink({ type: 'invite' })` and returns the URL for the analyst to relay through their own channel (signed email, Slack, secure portal). |
| `.env.example`                                    | Template for `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (production sets these in Vercel env vars). |

Supabase project for HIV: `inzcattptmqfbxbswgjd` (production env vars) /
`zviodrqsrawcxtqcorst` (legacy fallback, dev only).

---

## 7. Deployment

Push to GitHub → Vercel auto-build.

- `main` branch → production
- Any other branch → preview URL of form
  `prism-dashboard-hiv-git-{branch}-rcghealthprism.vercel.app`
- Build command: `npm install && npm run build`
- Output: `dist/`
- Project ID: `prj_tNKEsD4om4dFskHosxJ5iz9w7UOV`
  (team `team_K9WJUJmbTAtMxvSExLtydvKi` / slug `rcghealthprism`)

---

## 8. Documentation files

Top-level:

| File                       | Topic                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `README.md`                | Short overview + one-liner pipeline command.                                                                            |
| `ANALYST_WORKFLOW.md`      | The analyst-facing how-to for the refresh command. No code required.                                                    |
| `NEW_STUDY_PLAYBOOK.md`    | What to clone/replace when standing up a new study from the HIV template.                                               |
| `BUILDME.md`               | Original wave-1 build spec.                                                                                             |
| `AUDIT.md`                 | Self-audit of computational steps + sample-size sanity checks.                                                           |
| `verify_phaseA.md`         | Pydantic schema verification status for the messagemap config.                                                          |

`docs/`:

| File                          | Topic                                                                       |
| ----------------------------- | --------------------------------------------------------------------------- |
| `DATABASE_PATH.md`            | Path to retiring the JSON-import architecture in favor of a Postgres + API substrate. |
| `LEARN_FROM_RYAN.md`          | What to adopt from Ryan's parallel branch without merging it.               |
| `REFACTOR_HANDOFF.md`         | Snapshot of mid-refactor state for handoff.                                 |
| `RYAN_INTEGRATION_PLAN.md`    | (Declined) full-merge plan with Ryan's branch.                              |

`messagemap/`:

| File                              | Topic                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `README.md`                       | What the messagemap engine does + package layout.                                                |
| `HANDOFF_NOTES.md`                | Design rationale + open issues prioritized for the platform-engineering pass.                    |
| `CLAUDE_CODE_INSTRUCTIONS.md`     | Onboarding prompt + reading order for any agent picking up the pipeline.                         |
| `docs/METHODOLOGY.md`             | Full statistical methodology: persuasion index → residualization → cell estimator → shrinkage → bootstrap. |
| `docs/STUDY_INVENTORY.md`         | What's configurable per-study + the AL/AHIP/HIV inventory comparison.                            |

---

## 9. Build-time vs run-time data flow

The dashboard is a **static SPA**: everything is computed offline and
imported as JSON at build time. There is no API server, no database
lookup at render time.

- The user signs in via Supabase auth, but auth is the only network
  call the dashboard makes after build.
- All numbers come from `import json` / `import jsonFile from "…json"`
  statements in the React tree.
- A new field refresh = `python scripts/refresh.py --commit` →
  Vercel detects the new commit → rebuilds → preview URL or prod
  redeploys.

This is the deliberate trade-off: zero ops surface (no API to keep
running) in exchange for the analyst needing to re-run the pipeline +
push every time the data changes. The path off this — Postgres + an
API, sketched in `docs/DATABASE_PATH.md` — is the next architectural
evolution but not yet implemented.

---

## 10. File-by-file index (quick lookup)

| Path                                                       | One-line role                                                                                |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `data/260433.sav`                                          | Raw SPSS export, n=2,578                                                                     |
| `study/judgments.xlsx`                                  | Analyst workbook (tier, ROI inputs, messages, sig flags)                                     |
| `scripts/refresh.py`                                       | One-command orchestrator (5 stages + git)                                                    |
| `pipeline/derive_hiv_seg_data.py`                           | Step 4: dashboard.json → HIV-tab JSON files                                                  |
| `pipeline/port_topline_css.py`                              | Extract scoped CSS from dashboard_template.html                                              |
| `pipeline/extract_study.py`                                  | Step 5: workbook → study.js + studyData.js                                                   |
| `attic/convert_study.py` / `attic/create_template.py`      | Retired pre-refresh-era tools (kept for reference only)                                      |
| `requirements.txt`                                         | All pipeline deps (numpy/pandas/openpyxl/pyreadstat/pyyaml/pydantic)                         |
| `pipeline/messagemap/src/prism_build_dashboard.py`                  | Step 3: messagemap orchestrator                                                              |
| `pipeline/messagemap/src/prism_variants_parser.py`                  | Variants workbook → prism_variants.json                                                      |
| `pipeline/messagemap/src/prism_index.py`                            | Persuasion index + residualized shift                                                        |
| `pipeline/messagemap/src/prism_step3_exposure.py`                   | Exposure matrix from design + token vars                                                     |
| `pipeline/messagemap/src/prism_step4_lift_v2.py`                    | Cell lift estimator + shrinkage + bootstrap                                                  |
| `pipeline/messagemap/src/prism_config.py`                           | Pydantic model for study.yaml                                                                |
| `study/study.yaml`                                         | **THE study configuration** — sources, legacy_rename, segments, index, baskets, estimation, topline registries |
| `pipeline/messagemap/workbooks/Gilead_Persona-Tuned_Message_Variants_json.xlsx` | Variant text (content source of truth)                                                       |
| `pipeline/messagemap/data/Gilead_Design_File.dat`                   | MaxDiff design                                                                               |
| `pipeline/messagemap/outputs/prism_variants.json`                   | Parsed variants (cached)                                                                     |
| `pipeline/messagemap/outputs/dashboard.json`                        | Standalone messagemap dashboard.json (pre-merge)                                             |
| `pipeline/messagemap/outputs/prism_cells.csv`                       | All cells as CSV (1,152 rows) for diagnostics                                                |
| `pipeline/messagemap/outputs/prism_exposure_long.csv`               | Long-format exposure matrix (43,826 rows) for diagnostics                                    |
| `pipeline/messagemap/verify/verify_harness.py`                      | Byte-equality regression test for the pipeline                                               |
| `pipeline/messagemap/verify/test_config.py`                         | Pydantic schema test                                                                         |
| `pipeline/topline/compute.py`       | Step 1: topline CLI entry                                                                    |
| `pipeline/topline/compute_core.py`  | Step 1: topline compute + study registries                                                   |
| `pipeline/topline/dashboard_template.html` | Reference HTML mock that React Topline ports from                                      |
| `pipeline/topline/BUILD_GUIDE.md`   | Analyst guide for the topline registries                                                     |
| `canonical/scales.yaml` / `segments.yaml`                  | Methodology-level canonical defs                                                             |
| `canonical/maxdiff_designs/hiv_2026_design.csv`            | CSV mirror of the design file                                                                |
| `canonical/rake_targets/registered_voters_2026.yaml`       | Legacy rake targets (superseded by prism/benchmarks/populations/voters_v1)                   |
| `src/data/topline/dashboard.json`                          | **The merged final artifact** — drives Topline + MessageMap                                  |
| `src/data/hiv/seg_data.json` + `bench.json` + `items.json` + `zparams.json` | Derived HIV-tab data files                                                                  |
| `src/data/hiv/trust.json` + `manifest.json`                | Wave-2 stub + study metadata (hand-maintained)                                               |
| `src/data/study.js` + `studyData.js`                       | Workbook-extracted study metrics and HIV block                                               |
| `src/data/segments.js` / `vectors.js` / `ideology.js` / `experiential.js` / `trust.js` / `theme.js` / `admins.js` | Static PRISM template data + theme + auth allowlist                                       |
| `src/App.jsx`                                              | Router + auth gate                                                                           |
| `src/main.jsx`                                             | Vite mount                                                                                   |
| `src/supabaseClient.js`                                    | Supabase browser client                                                                      |
| `src/components/Shell.jsx`                                 | Persistent header / nav / sign-out                                                           |
| `src/components/PageHeader.jsx`                            | Standardized 3-line page header                                                              |
| `src/components/InfoDot.jsx`                               | "?" hover tooltip                                                                            |
| `src/pages/SegmentMap.jsx`                                 | `/` — landing bubble map                                                                     |
| `src/pages/AudienceROI.jsx`                                | `/roi` — ROI grid                                                                            |
| `src/pages/MessageMap.jsx`                                 | `/messages` — cell-level message map                                                         |
| `src/pages/SegmentProfile.jsx`                             | `/profile` — persona deep-dive (wraps IdeologyHeatmap + HIVTab)                              |
| `src/pages/HIVTab.jsx`                                     | Stigma + items panel inside `/profile`                                                       |
| `src/pages/IdeologyHeatmap.jsx`                            | Ideology heatmap inside `/profile`                                                           |
| `src/pages/Login.jsx` / `SetPassword.jsx` / `Admin.jsx`    | Auth screens                                                                                 |
| `src/components/Topline/Topline.jsx`                       | `/topline` — entry + module dispatch                                                         |
| `src/components/Topline/Topline.css` (generated)           | Scoped topline CSS                                                                           |
| `src/components/Topline/Topline.addendum.css`              | Hand-authored polish on top of the generated CSS                                             |
| `src/components/Topline/components/*.jsx`                  | TopNav / ModNav / SurveyPane / ItemSurveyPane / BannerPane / CodebookPane / Cell / Sig / TogglesBar / Legend / ItemBlock / DataInspector |
| `src/components/Topline/modules/*.jsx`                     | TitlePage / DemographicsModule / ItemsModule / PrePostModule / RoiModule / InfluencerModule / TrustModule |
| `src/components/Topline/utils/*.js`                        | applyRoiOverrides / exportPng / flatten / format / popover                                   |
| `supabase/functions/generate-invite/index.ts`              | Admin-only invite-link generator                                                             |
| `vercel.json`                                              | SPA rewrite for client-side routing                                                          |
| `vite.config.js`                                           | Vite + React 19 plugin                                                                       |
| `eslint.config.js`                                         | ESLint flat config                                                                           |
| `package.json` / `package-lock.json`                       | npm deps (react@19, react-router@7, supabase-js, vite@7)                                     |
| `.env.example`                                             | Required Vercel env vars                                                                     |

---

## 11. Quick reference: where to look when…

| If you want to…                                              | Look at                                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Change a topline item's label or scale                       | `compute_core.py` → `ITEMS` registry                                                 |
| Change which pre/post items form the persuasion index        | `pipeline/messagemap/src/prism_index.py` → `INDEX_ITEMS`                                      |
| Add a basket to the message map                              | `pipeline/messagemap/src/prism_build_dashboard.py` → `BASKETS` block + `study.yaml`           |
| Re-color a segment                                           | `src/data/theme.js` (party colors) + `partyColor()`                                  |
| Edit a persona quote / who-are                               | `src/data/segments.js`                                                               |
| Update a workbook number (tier, ROI, sig flag)               | `study/judgments.xlsx` → rerun `python scripts/refresh.py`                        |
| Edit a message variant rewrite                               | `pipeline/messagemap/workbooks/Gilead_Persona-Tuned_Message_Variants_json.xlsx`               |
| Adjust the cell shrinkage formula                            | `pipeline/messagemap/src/prism_step4_lift_v2.py` → `eb_shrink_vec`                            |
| Add a new dashboard route                                    | `src/App.jsx` (router) + new page in `src/pages/` + new nav item in `Shell.jsx`      |
| Re-port the topline CSS after editing the HTML mock          | `python pipeline/port_topline_css.py`                                                 |
| Bypass auth for a demo                                       | Flip `BYPASS_AUTH = true` in `src/App.jsx`                                           |
| Generate a client invite                                     | Sign in as admin → `/admin` → enter email                                            |
