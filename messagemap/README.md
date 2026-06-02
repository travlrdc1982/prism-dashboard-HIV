# PRISM Message Map — Handoff to Claude Code

## What this is

The analytical engine and dashboard data pipeline for PRISM's Message Map module, demonstrated end-to-end on the Gilead HIV 2026 study (n=2,578).

The engine takes a study's .sav file, MaxDiff design file, and variant text workbook, and produces a `dashboard.json` that drives the message map visualization. Real cell values, defensible methodology, reproducible across studies via YAML config.

This is research-grade code that runs and produces correct results. It needs production hardening (config-driven engine refactor, schema validation, error handling, test coverage) before it ships as a platform module. The handoff is at exactly that boundary: working analysis, design decisions all made and documented, ready for the platform-engineering pass.

## What works end to end right now

```
.sav + design.dat + workbook.xlsx + study.yaml
    │
    ├─ persuasion index construction (7-item composite, Cronbach validated)
    ├─ residualized shift (post regressed on pre + segment FE)
    ├─ exposure matrix (respondent × message × token × persona_framing)
    ├─ cell-level lift estimation
    │     - engagement-weighted signed B-W in numerator, |B-W| in denominator
    │     - empirical Bayes shrinkage toward message marginal
    │     - 500-iter bootstrap CIs by respondent resample
    │     - run TWICE: once for persuasion outcome, once for base-support outcome
    ├─ topline SoP + Utility per (msg × seg) with bootstrap CIs
    ├─ simple SoP plot data across 5 baskets
    └─ dashboard.json assembled with all sections
```

Total pipeline runtime: ~20 seconds end to end on the real HIV data.

## Package layout

```
prism_handoff/
├── README.md                                   ← this file
├── HANDOFF_NOTES.md                            ← design rationale and open issues
├── config/
│   └── study.yaml                              ← canonical study config (THE source of truth for analytical params)
├── workbooks/
│   └── Gilead_Persona-Tuned_Message_Variants_json.xlsx   ← variant library (content source of truth)
├── data/
│   └── Gilead_Design_File.dat                  ← MaxDiff design (272 versions × 14 sets × 4 items)
│   └── (260433.sav lives in client systems; not bundled — pipeline expects it at sources.sav_path)
├── src/
│   ├── prism_index.py                          ← steps 1 + 2: composite + residualized shift
│   ├── prism_step3_exposure.py                 ← step 3: respondent × message exposure matrix
│   ├── prism_step4_lift_v2.py                  ← step 4: vectorized cell lift + EB shrinkage + bootstrap
│   ├── prism_variants_parser.py                ← workbook → variants.json
│   └── prism_build_dashboard.py                ← orchestrator: runs all steps, builds dashboard.json
└── outputs/
    ├── dashboard.json                          ← the produced dashboard data (936 KB)
    ├── prism_variants.json                     ← parsed variant library (196 KB)
    ├── prism_cells.csv                         ← 1,152 cells × outcome (research artifact)
    └── prism_exposure_long.csv                 ← 43,826 exposure records (research artifact)
```

## Running the current code

```bash
cd prism_handoff

# 1. Parse the workbook (one-time per study, or when content changes)
python src/prism_variants_parser.py

# 2. Run the full pipeline
python src/prism_build_dashboard.py
```

The orchestrator currently hardcodes paths to the HIV study files. The first task for Claude Code is the config refactor described in HANDOFF_NOTES.md — pull constants out into study.yaml, thread the config through.

## Quick conceptual map

**The product**: a dashboard that shows persuasion lift (and base support) per message × segment × persona-framing × proof-token cell. Click a row to expand into the proof-token grid for that message. Toggle between PERSUASION MESSAGING and BASE MESSAGING outcomes. Filter by basket (Total / Priority D / Priority All / GOP / DEM).

**The substantive question**: given limited creative budget, which (message, token, persona-framing) combinations should we ship to which audiences to produce the most attitudinal movement (PERSUASION) or own-channel resonance (BASE)?

**The cell estimator**:
```
cell value = Σ (residual_shift_i × bw_score_i) / Σ |bw_score_i|
             within (message, segment, persona_framing, token)
shrunk toward message marginal via empirical Bayes
95% CI from 500-iter respondent bootstrap
```

**Why two outcomes**: persuasion lift answers "what moves people"; base support answers "what your aligned audience already loves." Different operational questions, same cell structure, toggle in the dashboard.

## What still needs to be done

See HANDOFF_NOTES.md for the prioritized backlog. Headlines:

1. **Config refactor** — pull constants out of code into study.yaml; thread config through every function
2. **Schema validator** — Pydantic models for study.yaml + cross-validation against workbook and .sav
3. **Variable rename function** — apply legacy_rename block at pipeline start; produce canonical names
4. **Workbook → YAML generator** — emit YAML from workbook (or reverse), so analyst doesn't maintain both
5. **Survey programming generator** — Decipher XML from workbook + YAML
6. **SPSS syntax generator** — .sps from workbook + YAML
7. **Test suite** — unit tests for each module, integration test against HIV data
8. **React component update** — point at canonical dashboard.json structure (this is separate from the Python work)

## Verification

The pipeline has been run end-to-end on real data. Substantive findings have been cross-checked manually and discussed in detail across a long design conversation. The current `outputs/dashboard.json` is the actual output of running the engine on the HIV .sav. The substantive findings it contains are real, defensible, and surprising in productive ways (see HANDOFF_NOTES.md).
