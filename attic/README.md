# attic — retired code

Retired 2026-08-28 (user directive "delete pickles", part of the legacy retirement):

- `prism_simulation_api.py`, `prism_*_predict.py` — the consultant-era FastAPI serving
  path and its model wrappers. The three legacy pickles they loaded
  (`PersuasionModels/prism_{seg,delta,pre_gen}_models.pkl`, committed 2026-07-02) are
  DELETED from the tree (recoverable from git history if ever needed forensically).
  Superseded by the simulation repo's v3 production models
  (`research/persuasion/prism_pooled_models_v3.pkl` via `prism_pooled_predict.py`,
  plain-numpy) and the offline static-SPA pipeline — this dashboard has no runtime API.
  The Dockerfile that served the API is deleted with it.
- `convert_study.py`, `create_template.py` — earlier retirements.

Nothing in the build path references any of this.
