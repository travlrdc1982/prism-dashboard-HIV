# Opening in Claude Code

## Quick start

1. Unzip `prism_handoff.zip` to a working directory of your choice.
2. Open the directory in Claude Code: `claude` from inside `prism_handoff/`.
3. Have Claude read `README.md` and `HANDOFF_NOTES.md` first.
4. The first session's task is in `HANDOFF_NOTES.md` Part 6, item P0-1: config refactor.

## The 10-minute orientation prompt for Claude Code

Paste this as your first message:

```
You're picking up work on the PRISM Message Map analytical pipeline. Read
README.md and HANDOFF_NOTES.md first — they explain the architecture,
substantive findings, and prioritized backlog.

The code in src/ is research-grade and runs end-to-end on real HIV study
data (n=2,578). The outputs/ directory contains proof-of-life artifacts:
dashboard.json (the rendered output), prism_cells.csv (1,152 cells with
all metadata), prism_exposure_long.csv (43,826 records).

config/study.yaml is the canonical config; right now most of its content
isn't actually being read by the code (the code has constants hardcoded
instead). The first task is the config refactor.

Before writing any code, do three things:
1. Read README.md
2. Read HANDOFF_NOTES.md in full, especially Parts 1, 2, and 5
3. Read config/study.yaml and src/prism_build_dashboard.py to see where
   the current constants live that need to move into the YAML

Then propose a refactor plan before starting.
```

## What's in the package

```
prism_handoff/
├── README.md                    ← Start here
├── HANDOFF_NOTES.md             ← Architecture, decisions, backlog
├── CLAUDE_CODE_INSTRUCTIONS.md  ← This file
├── requirements.txt             ← Python deps
├── config/
│   └── study.yaml               ← Canonical config (not yet wired through)
├── workbooks/
│   └── Gilead_Persona-Tuned_Message_Variants_json.xlsx
├── data/
│   └── Gilead_Design_File.dat
├── src/
│   ├── prism_index.py
│   ├── prism_step3_exposure.py
│   ├── prism_step4_lift_v2.py
│   ├── prism_variants_parser.py
│   └── prism_build_dashboard.py
├── outputs/
│   ├── dashboard.json           ← 936 KB proof-of-life
│   ├── prism_variants.json
│   ├── prism_cells.csv
│   └── prism_exposure_long.csv
└── docs/
    └── METHODOLOGY.md
```

## What's NOT in the package

- `260433.sav` (the actual HIV study .sav) — this is client data; lives in
  Reservoir's secure systems. Pipeline expects it at the path declared in
  `study.yaml > sources.sav_path`.
- The React component for the dashboard UI — that's a separate codebase.
- The Reservoir `compute_core.py` pipeline that this work integrates into
  — Claude Code will need access to it to do the P0-4 integration task.
- Test data / fixtures for unit tests — to be written as part of P2-10.

## A note on the working session that produced this

This handoff is the deliverable of an extended design + build session that
made many architectural decisions. The decisions are documented in
HANDOFF_NOTES.md Part 7 (Decisions already made). Don't relitigate them
unless something concrete has changed.

The substantive findings in HANDOFF_NOTES.md Part 4 are real — they came
out of running the pipeline on the actual HIV .sav. They serve as
regression-test anchors: any refactor that changes these findings has a
bug somewhere.
