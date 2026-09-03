# Model numbers — the numbers-only hand-off contract

`hiv_model_numbers.json` is the ONLY artifact the simulation models deliver to this
dashboard (design decision 2026-08-28: models live in `travlrdc1982/simulation`; the
dashboard receives computed numbers, exactly like every other data file here). No
model code or pickles ship to this repo — this replaces the PersuasionModels-v3
package approach (PR #39, closed as superseded).

## Contract

- `meta` — model version, generation date, regeneration command (run in the
  simulation repo: `python research/persuasion/export_dashboard_numbers.py`, then
  copy the JSON here and commit).
- `badges` — per family: `tier` (observed / validated model / model) + one-sentence
  validation basis. Render these next to any number displayed; they are the honest
  confidence layer.
- `segments[]` — one row per canonical segment (ids 1-16): observed baseline
  (`baseline_pre_obs`) and post-message alignment (`alignment_post_obs`) as weighted
  z-means; `alignment_composed_model` and `mobilization_model` from the production
  pooled models. Units: z within study × party.
- `receptiveness` — observed fielded MaxDiff results: `messages[]` (id + full text)
  and `table[]` (segment × message weighted mean utility + within-segment rank).

## Direction (r5, 2026-09-02)

Every number in this file — observed and model alike — is **client-aligned: higher =
toward the client's position** (engine rule 2026-09-02; the owner's item-level keying
registry `client_direction.yaml` in the simulation repo is the authority). A positive
shift is always movement toward the client. Do not re-orient anything in JS.

## Rules

- Treat this file as an immutable input, like `dashboard.json` — no reprocessing,
  no recomputation in JS.
- A refresh means re-running the exporter in the simulation repo and re-committing
  the JSON here; never edit values by hand.
- New-draft / new-topic message ranking is NOT in this file by design: it is served
  at the directional tier only, inside the confidence gate — see the receptiveness
  badge text.
