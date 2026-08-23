"""PRISM v3 segment-level receptiveness prediction - drop-in for the legacy
PersuasionModels/prism_seg_predict.py (same function signatures).

Predicts the standardized segment x message receptiveness rating for an avatar
evaluating a message. Per-study v3 models cover VAX MFN HDA KID OBE (HPI stored
utilities), GLP1 (workbook HB), and MA AL VICP PREG HIV (raw best-worst count
utilities, H2 pool widening). A study without a per-study model falls back to the
pooled production model's raw member (flagged in the return, see predict_msg_rating).

Input differences vs legacy (see prism_v3_core docstring): message codes are
consensus v2 (-3..+3); legacy EQUITY keys map to JUSTICE; all 8 vectors are used and
missing avatar vectors default to 0.

Usage:
    from prism_seg_predict import predict_msg_rating, rank_messages
    rating = predict_msg_rating({'segment': 3, 'study': 'HIV', 'V_TRUST': 0.8, ...},
                                {'msg_id': 'HIV_4', 'TRUST': 2, 'EQUITY': 1, ...})
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from prism_v3_core import (  # noqa: E402
    PER_STUDY, POOLED, VECTORS, avatar_vectors, eval_terms, msg_codes, party_of,
)

_MODELS = PER_STUDY["receptiveness"]


def _row(avatar, msg):
    segment = int(avatar["segment"])
    row = {"SEGMENT_COMBINED": str(segment), "SEG": segment}
    row.update(avatar_vectors(avatar))
    row.update(msg_codes(msg))
    for v in VECTORS:
        row[f"ALIGN_{v}"] = row[f"V_{v}"] * row[f"MSG_{v}"]
    return row


def predict_msg_rating(avatar, msg, allow_pooled_fallback=True):
    """Predict standardized receptiveness for one avatar x message pair.

    avatar: dict with segment (1-16), study, V_* (any subset of the 8 v3 vectors;
            legacy V_EQUITY accepted as V_JUSTICE).
    msg:    dict with msg_id + consensus v2 codes keyed TRUST/SCIENCE/MARKETS/FREEDOM/
            REFORM/EQUITY-or-JUSTICE/LEADERSHIP/INDUSTRY.

    Returns float, or None when no per-study model exists and pooled fallback is off.
    The pooled fallback (raw member of the production ensemble) carries the standing
    caveat: cross-topic message ranking needs an in-topic pilot anchor.
    """
    study = str(avatar["study"])
    party = party_of(avatar["segment"])
    row = _row(avatar, msg)
    entry = _MODELS.get((study, party))
    if entry is not None:
        return float(eval_terms(entry["terms"], row))
    if not allow_pooled_fallback:
        return None
    member = POOLED["receptiveness"]["members"]["raw"]
    y = 0.0
    for name, coef in zip(member["features"], member["beta"]):
        if name == "const":
            y += coef
        elif name.startswith("SEG_"):
            y += coef * (1.0 if int(name[4:]) == int(avatar["segment"]) else 0.0)
        else:
            y += coef * float(row.get(name, 0.0))
    return float(y)


def rank_messages(avatar, messages, top_n=None):
    """Rank messages by predicted rating for one avatar. Returns [(msg_id, rating)]
    sorted descending; None predictions excluded."""
    scores = []
    for msg in messages:
        rating = predict_msg_rating(avatar, msg)
        if rating is not None:
            scores.append((msg.get("msg_id", "unknown"), rating))
    scores.sort(key=lambda x: x[1], reverse=True)
    return scores[:top_n] if top_n else scores


def available_models():
    """Return list of (study, party) keys with fitted per-study models."""
    return sorted(_MODELS.keys())
