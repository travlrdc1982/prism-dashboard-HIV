# Refactor Handoff — Updates Since `refactor/phase1` Clone

Bryan Dumont · May 2026

This document brings the `refactor/phase1` branch (last touched May 13, 2026) up to date with what's happened on `main` since, and lays out a recommended path forward.

---

## Quick context

- Your branch was based on `main` as of `19ea4f2` (May 13).
- `main` has advanced ~20 commits since then, much of it substantive pipeline + dashboard work.
- Independently, a new architecture spec — **PRISM Closed-Loop Architecture PRD v0.2** — was adopted, which puts a canonical YAML layer upstream of both the topline pipeline and any API/DB.
- "Dozens of studies planned" is now the explicit scaling target.
- Decision: build the multi-study dashboard in parallel to HIV; cut over once HIV stabilizes. **Do not migrate the live HIV dashboard mid-flight.**

---

## Catalog: what's landed on `main` since you cloned

Twelve PRs grouped by area.

### Topline pipeline (Python)

- **Trust battery emission into `dashboard.json`** — 22 messengers, full 7-pt stats + z-test on top-3 proportion; same WGT weighting as every other composite.
- **`scripts/derive_hiv_seg_data.py`** — derives HIV-tab data (composites, trust, items, z-params, bench) from `dashboard.json` as single source. Reverse-codes SDS/SCS for avoidance framing; pop-weighted party benchmarks computed from segment values.
- **`scripts/refresh.py`** — one-command orchestrator: SPSS pipeline → copy dashboard.json → derive HIV-tab → extract workbook → optional commit+push. Replaces the four-step analyst workflow with `python scripts/refresh.py --commit`.
- **`extract_hiv.py`** — workbook → `study.js` + `studyData.js`; auto-detects K_PREPOST; tier column resolution is case/whitespace-tolerant.
- **`compute.py` parameterized** — accepts `--sav`, `--out-dir`, `--weight` or `PRISM_SAV/PRISM_OUT/PRISM_WEIGHT` env vars.
- **Pipeline warning cleanup** — auto-detect SPSS date unit (seconds vs microseconds); dead `roi_infographic` import removed; ROI SVG moved to a static template so `refresh.py` no longer blanks it.
- **Cross-platform** — forced UTF-8 on every text-mode file open (Windows analyst was hitting cp1252 UnicodeEncodeError on em-dashes).

### Topline UI (React)

- **TrustModule (module 06)** — banner table with full 7-pt cells matching the other batteries; opt-in click-to-sort column headers; sortable BannerTableHead is now a shared opt-in pattern.
- **Pre/post drill-down** — shows PRE / POST / NET stacked per item (was PRE only).
- **ROI module** — renders the static SVG template + JS overrides (`applyRoiOverrides.js`) that substitute workbook values at render time. Production `/roi` and topline ROI now share the same numbers.
- **Data Inspector** — slide-in drawer with filter + CSV export of long-format rows.
- **Topline.addendum.css** — sticky nav, visible scrollbars, banner-full collapse, cell-popover styling.

### HIV persona tab

- Faithful port of `hiv_tab_v5.html` (SCF orientation flipped, scatter bubbles proportional to pop, in-tab segment selector pill row, sort-by-mean toggle on Trusted Sources).
- All flows through `derive_hiv_seg_data.py` → `src/data/hiv/*.json` (single source via `dashboard.json`).

### Auth + admin

- Supabase auth wired, env-driven (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`); **dedicated HIV Supabase project** (`inzcattptmqfbxbswgjd`).
- **Invite-link admin flow** that bypasses Supabase email (unreliable in our setup): `/admin` page generates one-time sign-in URLs via a `generate-invite` edge function. Admin allowlist hardcoded in the function source. Post-invite "Set your password" screen. No SMTP infrastructure required.

### Workbook + analyst docs

- `ANALYST_WORKFLOW.md` — the 3-step refresh (drop .sav, edit workbook, run command).
- `NEW_STUDY_PLAYBOOK.md` — production setup guide for future studies; codifies the scaffold / config / custom architecture model.

### Canonical YAML schema (the big strategic addition — PRD v0.2 L1)

- `canonical/segments.yaml` — 16-seg shared registry.
- `canonical/scales.yaml` — 5 scale types (likert7_agreement / relevance / trust, binary_aware, prepost_top3).
- `canonical/rake_targets/registered_voters_2026.yaml` — schema for demographic + 16-seg pop-share rake targets (values still TODO).
- `canonical/hiv_2026.yaml` — 3,772-line per-study definition: metadata, library refs, batteries, items, composites, modules, plus the full **3-effect message-test design** (MaxDiff utility / persona-tuning lift / proof-point lift) with **17 cores × 36 tokens × 17 cells = 612 inline stimuli cells**.
- `canonical/maxdiff_designs/hiv_2026_design.csv` — Sawtooth BIBD (272 versions × 14 sets/version) as canonical input.

---

## Strategic direction since you cloned

We adopted the PRD v0.2 "closed-loop architecture" as the platform target. Practical consequences for the API+DB direction:

1. **The canonical YAML is now the source of truth**, upstream of both the topline pipeline and your API+DB. The PRD's seven generators (SPSS Syntax, topline registries, Decipher XML, dashboard schema, DQMA runtime, banner spec, simulator inputs) consume that YAML; downstream consumers (compute_core, API, dashboard) become outputs rather than separate inputs.
2. **"Dozens of studies planned"** confirmed — your multi-study DB pattern was the right call, and it's now the explicit target.
3. **Multi-study dashboard timing** — stand up in parallel to HIV; cut over once HIV is stable.

---

## What's keeping from your work

Cherry-pick targets, in priority order:

| Priority | Your work | Why |
|---|---|---|
| 1 | Code splitting (`d0abc4a`) | -82% initial bundle. Independent of architecture choices, pure win. |
| 2 | Design tokens + UI library | Right substrate for the multi-study dashboard. |
| 3 | Responsive CSS fixes (`3672c53`) | AudienceROI sticky scroll + SegmentProfile grid stacking — already in active use. |
| 4 | Test suite | Real safety net. Tests need updating after the trust/derive/refresh additions, but the harness is sound. |
| 5 | `convert_study.py` multi-token model | Prescient — exactly the shape we just added to the canonical YAML for MaxDiff (token 0 = Base; tokens 1+ = layered proof points). |
| 6 | API + SQLite schema | Becomes the data layer for the multi-study dashboard. Needs adjustment (see below) but the bones are right. |

---

## Adjustments needed before API+DB lands

### 1. Schema needs the 3-effect MaxDiff design

Your current schema has `messages`, `message_performance`, `prepost_metrics`. The HIV design adds three things you don't capture cleanly yet:

- **Theme utility** — needs a `maxdiff_responses` (or similar) table for best/worst picks per task; computed utilities per `(study, message, segment)`.
- **Persona-tuning lift** — needs per-respondent arm assignment (`core` vs `persona`) plus the persona-variant text matrix. Your `messages` table needs a `core_text` field + a join to `message_variants` keyed by `segment_id`.
- **Proof-point lift** — your token model in `convert_study.py` is on the right track. The DB needs `message_tokens` (or treat token as a column on `message_variants`) with `token_id`, `token_label`, `text`.

The canonical `hiv_2026.yaml` `message_test` block is the spec to model against.

### 2. Trust battery as a typed entity

Your `trust_entities` + `trust_ratings` schema already supports this — no change needed, but worth wiring the new `dashboard.json['trust']` block as the primary feed.

### 3. ROI source-of-truth

The topline ROI is no longer pipeline-computed — it's the workbook directly, via `applyRoiOverrides.js` patching a static SVG. Your API would need an endpoint for the workbook-derived ROI values (tier / coalition_support / activation_prob / influence_pct per segment), which is what `extract_hiv.py` already produces.

### 4. YAML as input, not Excel

`convert_study.py` started by reading Excel. Long-term, per the PRD, it should read the canonical YAML (which is itself derived from Excel via a sync script). For HIV today the YAML is hand-written; the sync script comes later. **Suggestion**: keep your Excel reader as a fallback path, but have the API ingestion consume YAML where present.

### 5. Rake weighting

Targets now live in `canonical/rake_targets/{population}.yaml`. The SPSS Syntax generator (next on the build list per PRD §9 step 2) will emit RAKE syntax from those. Your API might surface a `/rake_targets/{population_id}` endpoint for the survey-build tools to consume.

---

## Recommended next steps

In order, with rough scope estimates:

| # | Step | Effort |
|---|---|---|
| 1 | Rebase `refactor/phase1` onto current `main` | 2-3 days. ~20 commits to integrate; main conflicts will be `compute_core.py` (you have your version, main has trust + ROI changes), `RoiModule.jsx`, `SegmentProfile.jsx`, `studyData.js`. Suggest: take main wholesale for `compute_core.py` and pipeline scripts; reapply your code-splitting and design-token diff on top. |
| 2 | Read PRD v0.2 + `canonical/hiv_2026.yaml` end-to-end | 0.5 day. Adjust your mental model of "where does study config come from" — it's no longer Excel-direct, it's YAML-via-Excel. |
| 3 | Adjust DB schema for the 3-effect message-test design | 2-3 days. New `message_variants` (segment-keyed text), `message_tokens` (proof-point variants), `maxdiff_responses` (best/worst data), `maxdiff_utilities` (computed per study/segment/message), arm assignment column on `survey_responses`. |
| 4 | Add a YAML ingestion path to `convert_study.py` or migrate it | 1-2 days. Reading `canonical/hiv_2026.yaml` → insert rows into your tables. Keep the Excel path as fallback for analysts who haven't migrated. |
| 5 | Wire `derive_hiv_seg_data.py` output as a feed into your API rather than file-only | 1 day. The JSON outputs in `src/data/hiv/` are what your endpoints currently serve from; once the DB is the canonical store, that becomes a one-time migration + the derive script writes to DB directly. |
| 6 | Cherry-pick coordination | Ongoing. Code splitting + design tokens + responsive fixes are good to land first as standalone PRs; API+DB lands as a focused milestone after the HIV dashboard stabilizes. |

---

## Open questions before rebasing

1. **Hosting plan?** Render or Railway are the two most-mentioned options for FastAPI + SQLite. ~$30–80/month range. Approved in principle.
2. **Schema migration tool?** You have `migrate_to_db.py` as a one-shot. Long-term — Alembic, or versioned `.sql` files? Multi-study means lots of schema drift candidates.
3. **Auth model on the API?** The current dashboard uses Supabase auth client-side. Should the API verify Supabase JWTs (preserves the single auth project) or have its own auth layer?
4. **Norms DB scope?** PRD L6 says `prism_norms.db` is its own database, written via the QC gate. Is that in your scope, or a separate engagement?

---

## Reference links

- Repo: `https://github.com/travlrdc1982/prism-dashboard-HIV`
- Live HIV dashboard: `https://hiv.rcghealthprism.app`
- Canonical YAML: `canonical/hiv_2026.yaml` on `main`
- PRD v0.2: shared separately
- Your branch as it stands: `origin/refactor/phase1` (commit `19ea4f2`)

Ping me with any questions while rebasing — main conflicts are predictable but worth talking through before resolving.
