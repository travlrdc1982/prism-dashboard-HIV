"""PRISM v3 baseline-support prediction - drop-in for the legacy
PersuasionModels/prism_pre_gen_predict.py (same function signatures).

SEMANTIC NOTE (flagged for user review): the legacy module predicted PRE_SCORE from a
pre-gen pooled model with vector x issue-profile interactions. The v3 program replaced
that family with ALIGNMENT - direction-harmonized POST support ~ V8 (+ segment dummies
for GOP), pooled over the HIV-inclusive 10-study pool. predict_pre_score() therefore
returns the v3 alignment estimate of baseline issue support: for pre-generation
purposes this is the avatar's standing support for the client's position, which is
what the legacy pre-gen number was used for downstream. The issue_profile argument is
accepted for signature compatibility and used only when a per-study alignment model is
missing AND the caller wants the delta-style DEM interaction path - the pooled v3
alignment model itself carries no issue terms.

Per-study alignment models (with item_stats for de-standardizing to the item's raw
scale) cover VAX MFN HDA KID OBE GLP1 AL VICP MA PREG.
"""

import sys
import os

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from prism_v3_core import (  # noqa: E402
    PER_STUDY, POOLED, VECTORS, avatar_vectors, eval_terms, party_of,
)

_MODELS = PER_STUDY["alignment"]

_scale_params = {
    7: {"mean": 5.02, "std": 1.51},
    100: {"mean": 65.7, "std": 24.7},
}


def predict_pre_score(avatar, issue_profile=None):
    """Predict baseline issue support for one avatar (v3 alignment family).

    avatar: dict with segment (1-16), study, V_* vectors (legacy V_EQUITY ok),
            optional outcome_item (used with per-study item_stats to de-standardize),
            optional outcome_scale (7|100, fallback de-standardization).

    Returns (pre_std, pre_raw); (None, None) on failure.
    """
    segment = int(avatar["segment"])
    study = str(avatar["study"])
    party = party_of(segment)

    row = {"SEGMENT_COMBINED": str(segment), "SEG": segment,
           "OUTCOME_ITEM": str(avatar.get("outcome_item", ""))}
    row.update(avatar_vectors(avatar))

    entry = _MODELS.get((study, party))
    if entry is not None:
        pre_std = float(eval_terms(entry["terms"], row))
        stats = entry.get("item_stats", {}).get(row["OUTCOME_ITEM"])
    else:
        pooled = POOLED["alignment"][party]
        y = 0.0
        for name, coef in zip(pooled["features"], pooled["beta"]):
            if name == "const":
                y += coef
            elif name.startswith("SEG_"):
                y += coef * (1.0 if int(name[4:]) == segment else 0.0)
            else:
                y += coef * float(row.get(name, 0.0))
        pre_std, stats = float(y), None

    out_scale = int(avatar.get("outcome_scale", 7))
    if stats is not None:
        # the item's own training stats define the scale - no legacy clipping
        pre_raw = float(pre_std * stats["std"] + stats["mean"])
    else:
        params = _scale_params.get(out_scale, _scale_params[7])
        pre_raw = float(np.clip(pre_std * params["std"] + params["mean"], 1, out_scale))
    return pre_std, pre_raw


def compute_issue_profile(messages):
    """Mean vector codes across a message set ({vector: mean}); legacy EQUITY key ok.
    Feed to prism_delta_predict.predict_opinion_delta(issue_profile=...) for the DEM
    pooled path on new studies."""
    if not messages:
        return {v: 0.0 for v in VECTORS}
    out = {}
    for v in VECTORS:
        vals = []
        for m in messages:
            val = m.get(v, m.get("EQUITY") if v == "JUSTICE" else None)
            if val is not None:
                vals.append(float(val))
        out[v] = float(np.mean(vals)) if vals else 0.0
    return out


def available_studies():
    """Studies with per-study alignment models."""
    return sorted({k[0] for k in _MODELS})
