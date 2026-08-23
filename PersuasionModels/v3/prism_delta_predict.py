"""PRISM v3 opinion-movement prediction - drop-in for the legacy
PersuasionModels/prism_delta_predict.py (same function signatures).

Predicts standardized OPINION_DELTA for an avatar. Per-study v3 models cover
VAX MFN HDA KID OBE (HPI) and GLP1 AL VICP MA PREG (COMBINED). HIV has no per-study
delta entry here: HIV GOP delta was negative under every pooled spec (serve HIV from
its own fitted model only - LOSO_REPORT.md), so HIV routes to the pooled model which
was trained HIV-inclusive.

Pooled fallback (any study without a per-study model): the production per-party delta
model. GOP uses PRE x V interaction terms; DEM needs the topic's issue profile
(pass issue_profile={vector: mean battery code} for new studies).

PRE standardization: pass pre_score already standardized via pre_std, OR raw via
pre_score + pre_scale exactly like the legacy module (same fallback scale params).
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from prism_v3_core import (  # noqa: E402
    PER_STUDY, POOLED, VECTORS, avatar_vectors, eval_terms, party_of,
)

_MODELS = PER_STUDY["delta"]

# legacy scale params for standardizing raw pre_score at prediction time
_scale_params = {
    7: {"mean": 5.02, "std": 1.51},
    100: {"mean": 65.7, "std": 24.7},
}


def _pre_std(avatar):
    if "pre_std" in avatar:
        return float(avatar["pre_std"])
    params = _scale_params.get(int(avatar.get("pre_scale", 7)), _scale_params[7])
    return (float(avatar["pre_score"]) - params["mean"]) / params["std"]


def predict_opinion_delta(avatar, issue_profile=None):
    """Predict standardized opinion shift for one avatar x study x outcome.

    avatar: dict with segment (1-16), study, outcome_item (per-study models only),
            pre_score (+ pre_scale 7|100) or pre_std, V_* vectors (legacy V_EQUITY ok).
    issue_profile: {vector: mean battery code} - needed for the DEM pooled fallback on
            studies outside the training pool.

    Returns float (positive = moves toward support), or None on failure.
    """
    segment = int(avatar["segment"])
    study = str(avatar["study"])
    party = party_of(segment)
    pre = _pre_std(avatar)

    row = {"SEGMENT_COMBINED": str(segment), "SEG": segment,
           "PRE_SCORE_STD": pre, "PRE_STD": pre,
           "OUTCOME_ITEM": str(avatar.get("outcome_item", ""))}
    row.update(avatar_vectors(avatar))

    entry = _MODELS.get((study, party))
    if entry is not None:
        return float(eval_terms(entry["terms"], row))

    # pooled per-party fallback (HIV-inclusive pool)
    entry = POOLED["delta"][party]
    for v in VECTORS:
        row[f"PV_{v}"] = pre * row[f"V_{v}"]
        if issue_profile is not None:
            row[f"VI_{v}"] = row[f"V_{v}"] * float(issue_profile.get(v, 0.0))
    y = 0.0
    for name, coef in zip(entry["features"], entry["beta"]):
        if name == "const":
            y += coef
        elif name.startswith("SEG_"):
            y += coef * (1.0 if int(name[4:]) == segment else 0.0)
        else:
            y += coef * float(row.get(name, 0.0))
    return float(y)


def available_models():
    """Return list of (study, party) keys with fitted per-study models."""
    return sorted(_MODELS.keys())
