# Cleanup Recommendations — Streamlined Input, Single Configuration

> Companion to `ARCHITECTURE.md`. That doc describes what exists; this one
> describes what to change. Findings verified against the repo as of
> branch `messagemap-integration` (Jun 2026).
>
> Guiding goal per the analyst: **the .sav straight from SPSS should be
> (nearly) the only input, and one configuration file should drive
> everything else.**

---

## 0. The five findings that motivate all of this

These are observed facts, not opinions:

1. **Dead config.** `canonical/hiv_2026.yaml` is 3,774 lines of carefully
   structured study config (items, batteries, composites, modules,
   message_test, core_messages) — and **nothing reads it**. Zero imports
   anywhere in the codebase. Meanwhile `messagemap/config/study.yaml`
   (241 lines) is read only by the Pydantic loader `prism_config.py`,
   and the messagemap pipeline itself still runs on constants hardcoded
   in each `.py` file. The config refactor (P0-1 in
   `messagemap/HANDOFF_NOTES.md`) was never completed. Today the repo
   has **two YAML sources of truth that are both fiction**.

2. **The segment list is defined in ~8 places.** `compute_core.py`
   (`SEGMENTS`), `prism_build_dashboard.py` (`SEGMENTS` dict),
   `derive_hiv_seg_data.py` (`SEG_NAME` + `CANONICAL_POP_BY_CODE`),
   `extract_hiv.py` (`SEG_ORDER`), `src/data/segments.js`,
   `src/data/studyData.js`, `SegmentProfile.jsx` (hardcoded array),
   `IdeologyHeatmap.jsx` (`SEGS`), `SegmentMap.jsx` (`BUBBLES`), plus
   `canonical/segments.yaml`. The canonical-population-share bug (fixed
   in `5aaa83b`) happened precisely because two of these copies disagreed
   about what "population" meant.

3. **The workbook mixes computed values with analyst judgment.**
   `HIV_Study_Template.xlsx` carries wave-1 SoP matrices and sig flags
   (now superseded by the messagemap pipeline computing them from the
   .sav), alongside genuinely judgment-based inputs (tier assignments).
   ROI numbers then flow into the app via **two separate code paths**
   (`extract_hiv.py → study.js` and
   `compute_core._apply_workbook_roi_overrides → roi_data`), kept equal
   by convention only.

4. **The .sav is duplicated, and the pipeline lives inside the React
   tree.** Identical 10 MB copies at `data/260433.sav` and
   `messagemap/data/260433.sav` (untracked, but both are live default
   paths in code). The topline pipeline is at
   `src/components/Topline/ToplineDashboard/compute_core.py` — 2,227
   lines of Python inside a React components directory, with `__pycache__`
   sitting next to `.jsx` files.

5. **The legacy rename layer exists because fielding didn't use canonical
   names.** 60+ lines of `legacy_rename` mappings (`HIV_R7 → M010_token`,
   with documented "irregular pairing") that every future study will
   either copy or trip over.

---

## 1. Target state (one picture)

```
study/                              ← ONE folder = one study
├── study.yaml                      ← ONE config: items, batteries, index,
│                                      segments ref, baskets, messages ref,
│                                      analyst judgments (tiers)
├── data/
│   ├── 260433.sav                  ← straight from SPSS, canonical names
│   └── design.dat                  ← MaxDiff design from survey platform
└── variants.xlsx                   ← message/variant text (content team)

canonical/                          ← cross-study, versioned methodology
├── segments.yaml                   ← THE segment list (codes, names, party,
│                                      population shares) — single copy
└── scales.yaml

pipeline/                           ← ALL Python, outside src/
├── refresh.py                      ← unchanged entry point
├── topline/                        ← engine only (no study constants)
├── messagemap/                     ← engine only (no study constants)
└── derive/

src/data/generated/                 ← everything the pipeline writes;
                                       gitignored from hand-editing,
                                       committed as artifacts
```

One input change (`.sav` or `study.yaml`) → `python pipeline/refresh.py`
→ all artifacts regenerate → push → Vercel. Same workflow as today,
but with one config and no duplicated truths.

---

## 2. Recommendations, in order

### R1 — Finish the config refactor (single `study.yaml`)  *(highest leverage)*

The Pydantic model (`messagemap/src/prism_config.py`) already exists and
validates a rich schema. The work is to make the engines **read** it:

- Merge `canonical/hiv_2026.yaml` (the rich, unread one) and
  `messagemap/config/study.yaml` (the thin, read one) into a single
  `study/study.yaml`. The 3,774-line file already has the right shape —
  items, batteries, composites, modules, message_test — it was clearly
  written as the destination for this refactor.
- Move the hardcoded registries out of the engines and into the YAML:
  - `compute_core.py`: `STUDY`, `SEGMENTS`, `ITEMS`, `PRE_POST`,
    `BATTERIES`, `TRUST_LBL`, `INFLUENCER_BLOCKS` (~1,200 of its 2,227
    lines are study constants, not engine)
  - `prism_index.py`: `INDEX_ITEMS`
  - `prism_step3_exposure.py`: the item/proof mapping block
  - `prism_build_dashboard.py`: `SEGMENTS`, `BASKETS`
- Extend `prism_config.py` to cover the merged schema; it already has
  the cross-validators (basket IDs vs segments, lift-variant names,
  legacy-rename target patterns).
- Delete `canonical/hiv_2026.yaml` and `messagemap/config/study.yaml`
  once both engines read the merged file.

**Payoff:** a new study = new `study.yaml` + new `.sav` + new variants
workbook. Zero Python edits. This is the difference between "HIV
template you fork and surgically edit" and "platform you configure."

**Effort:** the largest single item (~1–2 weeks), but `verify_harness.py`
already exists to prove byte-equality of `dashboard.json` before/after —
the refactor can be done with a hard regression gate at every step.

### R2 — Shrink the workbook to judgment-only; let the .sav carry the data

- **Drop the computed sheets** from `HIV_Study_Template.xlsx`:
  `ControlSoP`, `VariantSoP`, `SigFlags_Control`, `SigFlags_Variant`
  are wave-1 artifacts now computed from the .sav by the messagemap
  pipeline. Carrying them invites the two copies to disagree.
- **Move analyst judgments into `study.yaml`**: tier assignments,
  coalition/activation/influence inputs — these are ~80 numbers, a
  natural YAML block (`segments.judgments:`). If the analyst strongly
  prefers Excel for editing, keep a one-sheet `judgments.xlsx` whose
  only consumer is one loader function — but make it *one* sheet with
  *one* code path.
- **Kill the dual ROI path**: today workbook → `extract_hiv.py` and
  workbook → `_apply_workbook_roi_overrides()` both carry the same
  numbers into the app by different roads. After R1/R2, ROI inputs live
  in config, the pipeline computes `roi_data` once, and both `/roi` and
  the topline ROI module read the same generated artifact.

**Payoff:** the .sav becomes the only data input; the workbook (or YAML
block) holds only what a human decided.

### R3 — Field with canonical names; make `legacy_rename` empty

- For every future study, give the survey platform the canonical
  variable names up front: `persona_framing`, `XSEG_ASSIGNED`,
  `M{NNN}_token`, `task{NN}_best/worst`, `idx{NNN}_pre/post`. The
  patterns are already specified in `sav_conventions` — they just need
  to be in the fielding spec instead of the cleanup spec.
- Keep the `legacy_rename` mechanism (it correctly rescued HIV), but
  treat a non-empty rename map as a per-study deviation to burn down,
  not a normal cost.
- Worth a one-page `FIELDING_SPEC.md` handed to the survey programmer:
  variable names, arm encodings, design-file format. Cheap insurance
  against another "irregular pairing."

**Payoff:** the .sav drops in straight from SPSS with zero translation
layer — the literal "mostly direct from SPSS" goal.

### R4 — One pipeline package, one .sav, no Python in `src/`

Mechanical moves, low risk, big hygiene gain:

- `src/components/Topline/ToplineDashboard/compute*.py` →
  `pipeline/topline/`. (Keep `dashboard_template.html` + `BUILD_GUIDE`
  with it.)
- `extract_hiv.py` (repo root) → `pipeline/extract.py`;
  `scripts/derive_hiv_seg_data.py` → `pipeline/derive.py`;
  `messagemap/src/` → `pipeline/messagemap/`. `scripts/refresh.py`
  updates its paths — the analyst command doesn't change.
- **One .sav location** (`study/data/`); delete the
  `messagemap/data/260433.sav` copy and its default path. All engines
  take the path from `study.yaml` / `PRISM_SAV`.
- One merged `requirements.txt` (the two existing ones overlap on
  pandas/openpyxl/pyreadstat; the union adds numpy/pyyaml/pydantic).
- Add `__pycache__/` to `.gitignore` and remove the committed `.pyc`
  files (they're currently sitting inside `src/components/`).
- Retire dead tools: `convert_study.py` and `create_template.py` are
  pre-refresh-era and outside the workflow — delete or move to
  `attic/` so nobody mistakes them for live paths.

### R5 — Generate the JS data files from canonical; stop hand-maintaining copies

- Make `canonical/segments.yaml` the single segment definition
  (id, code, name, party, **canonical population share**). The pipeline
  emits `src/data/generated/segments.js` (or `.json`) and every React
  page imports from there. Burn down the ~8 hardcoded copies one page
  at a time — `SegmentProfile.jsx` and `SegmentMap.jsx` are the big
  ones.
- Same treatment for population shares specifically: the `5aaa83b` bug
  class (sample-derived vs canonical shares) becomes impossible when
  there's one place the number lives.
- Mark generated files with a `// GENERATED — do not hand-edit` header
  (extract_hiv.py already does this; extend the convention).

### R6 — What *not* to do yet

- **Don't build the DB/API now.** `docs/DATABASE_PATH.md` sketches it,
  and it's the right eventual move for multi-study. But the static-SPA
  model (compute offline → commit JSON → Vercel) has zero ops surface
  and fits the current single-study, analyst-driven cadence. Do R1–R5
  first — they're exactly the prerequisites that make a later DB
  migration mechanical (the YAML schema becomes the DB schema; the
  generated JSON becomes the API response shape).
- **Don't unify the two dashboards' rendering** (Topline vs the four
  app pages) as part of this. Different idioms, both working; cosmetic
  unification is churn without payoff.

---

## 3. Sequencing and dependencies

```
R4 (mechanical moves)  ──┐         can start immediately, no analytics risk
                         ├──► R1 (config refactor) ──► R2 (workbook diet)
R3 (fielding spec)  ─────┘             │
   (parallel, it's a doc)              └──► R5 (generated JS)
```

- **R4 first**: moving files clarifies what's engine vs config before
  the refactor touches logic. Verify with `npx vite build` +
  `python pipeline/refresh.py --skip-pipeline`.
- **R1 second**, gated by `verify_harness.py` byte-equality at every
  extraction step (move one registry → re-run → diff `dashboard.json`
  → commit).
- **R2/R5 after R1**, since both depend on the YAML being the real
  source of truth.
- **R3 is a document** — write it whenever, enforce it at the next
  fielding.

The whole program is roughly 2–3 weeks of focused work, and every step
leaves the repo shippable (no big-bang branch).

---

## 4. End-state analyst workflow (unchanged on the surface)

```bash
# 1. Drop the SPSS export
cp ~/Downloads/260433.sav study/data/

# 2. (Only if judgments changed) edit study/study.yaml tiers block

# 3. One command
python pipeline/refresh.py --commit
```

Same three steps as today — but underneath: one config, one .sav, one
segment list, one ROI path, and a new study is a folder copy plus a
YAML edit instead of a code surgery.
