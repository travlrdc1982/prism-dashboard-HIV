# PersuasionModels v3 — drop-in package

v3 retrained models behind the legacy `prism_*_predict.py` signatures. Point imports at
this folder instead of the legacy one; call signatures are unchanged (legacy 4-vector
avatars and `EQUITY` keys still work).

```python
from PersuasionModels.v3.prism_seg_predict import predict_msg_rating, rank_messages
from PersuasionModels.v3.prism_delta_predict import predict_opinion_delta
from PersuasionModels.v3.prism_pre_gen_predict import predict_pre_score, compute_issue_profile
```

## What changed vs legacy

| | legacy | v3 |
|---|---|---|
| Vectors | 4 per party | 8 everywhere (v3 recompute, frozen baseline, data convention); `EQUITY` → `JUSTICE` |
| Message codes | −2..+2 legacy codebook | consensus v2, −3..+3 (`consensus_codes_v2.csv` in the research repo) |
| Receptiveness studies | 12 legacy | VAX MFN HDA KID OBE GLP1 + **MA AL VICP PREG HIV** |
| Delta / alignment | per-study OLS | per-study v3 + pooled HIV-inclusive fallback |
| Pre-gen | pre-score pooled model | **alignment family** (baseline issue support; semantic change, flagged) |
| Pickles | statsmodels objects (version-fragile) | plain coefficient dicts, verified 1:1 against statsmodels at export |

## Pre-generation caveat

Cross-topic message **ranking** failed its ESI holdout. For a new topic, field a small
in-topic pilot (~100 respondents/party on the actual messages) and recalibrate:

```python
from PersuasionModels.v3.prism_v3_core import fit_pilot_anchor, apply_pilot_anchor
cal = fit_pilot_anchor(anchor_df)          # pilot respondent x message rows with MSG_ID, Y
pred = apply_pilot_anchor(cal, full_df)    # validated: mean rankRho 0.25 -> 0.71
```

## Provenance

Exported by `research/persuasion/export_dashboard_models.py` in
`travlrdc1982/simulation` (branch `claude/analytics-phase0`), which verifies every
flattened model against its statsmodels source. Regenerate there and copy
`prism_v3_dashboard_models.pkl` here to refresh. ESI and VAX2 never trained anything
in this package. Reports: `LOSO_REPORT.md`, `HOLDOUT_REPORT.md`,
`PILOT_ANCHOR_REPORT.md` (research repo).
