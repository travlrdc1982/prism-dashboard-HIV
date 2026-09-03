"""
PRISM Segment-Level Prediction Module
======================================
Used by Enes in the avatar/simulation system.

Load models once at startup. Call predict_msg_rating() for each
avatar x message evaluation.

All models are segment-level: they predict the expected mean MSG_RATING
for a given segment x message combination. The avatar IS the segment
representative, so this is the correct unit of analysis.

Usage:
    from prism_seg_predict import predict_msg_rating, rank_messages

    # Avatar: segment 3 (TC), evaluating a VAX message
    avatar = {
        'segment': 3,
        'study':   'VAX2',
        'V_TRUST':    0.82,
        'V_SCIENCE':  1.15,
        'V_MARKETS':  0.44,
        'V_FREEDOM': -0.31,
    }

    msg = {
        'msg_id':   'VAX2_4',
        'TRUST':     2,
        'SCIENCE':   2,
        'MARKETS':   0,
        'FREEDOM':  -1,
        'REFORM':    0,
        'EQUITY':    0,
        'LEADERSHIP':1,
        'INDUSTRY':  0,
    }

    rating = predict_msg_rating(avatar, msg)
    # Returns: float (standardized predicted rating)

    # Rank a full message set
    messages = [msg1, msg2, msg3, ...]
    rankings = rank_messages(avatar, messages)
"""

import pickle
import pandas as pd
import numpy as np
import os

_DIR = os.path.dirname(os.path.abspath(__file__))

# Load all models once at module level
_models = pickle.load(open(os.path.join(_DIR, 'prism_seg_models.pkl'), 'rb'))

GOP_SEGS    = list(range(1, 11))
DEM_SEGS    = list(range(11, 17))
GOP_VECTORS = ['TRUST', 'SCIENCE', 'MARKETS', 'FREEDOM']
DEM_VECTORS = ['REFORM', 'EQUITY', 'LEADERSHIP', 'INDUSTRY']


def predict_msg_rating(avatar, msg):
    """
    Predict standardized MSG_RATING for one avatar x message pair.

    avatar: dict with keys:
      segment   (int, 1-16)
      study     (str, e.g. 'VAX', 'MFN', 'ESI')
      V_TRUST, V_SCIENCE, V_MARKETS, V_FREEDOM     (GOP avatars)
      V_REFORM, V_EQUITY, V_LEADERSHIP, V_INDUSTRY (DEM avatars)

    msg: dict with keys:
      msg_id    (str, for reference)
      TRUST, SCIENCE, MARKETS, FREEDOM,
      REFORM, EQUITY, LEADERSHIP, INDUSTRY
      (all int, -2 to +2 scale)

    Returns: float (standardized predicted rating), or None if no model exists.
    """
    segment = int(avatar['segment'])
    study   = str(avatar['study'])
    party   = 'GOP' if segment in GOP_SEGS else 'DEM'
    vectors = GOP_VECTORS if party == 'GOP' else DEM_VECTORS

    model_key = (study, party)
    if model_key not in _models:
        return None   # No model for this study/party combination

    model = _models[model_key]

    row = {'SEGMENT_COMBINED': str(segment)}
    for v in vectors:
        row[f'V_{v}']     = float(avatar.get(f'V_{v}', 0.0))
        row[f'MSG_{v}']   = float(msg.get(v, 0))
        row[f'ALIGN_{v}'] = row[f'V_{v}'] * row[f'MSG_{v}']

    X = pd.DataFrame([row])

    try:
        return float(model.predict(X)[0])
    except Exception as e:
        print(f"  [predict_msg_rating] Warning ({study}/{party}/seg{segment}): {e}")
        return None


def rank_messages(avatar, messages, top_n=None):
    """
    Rank a list of messages by predicted rating for one avatar.

    avatar:   dict (see predict_msg_rating)
    messages: list of dicts, each with msg_id + vector codes
    top_n:    return only top N (None = all)

    Returns: list of (msg_id, predicted_rating) sorted descending,
             with None predictions excluded.
    """
    scores = []
    for msg in messages:
        rating = predict_msg_rating(avatar, msg)
        if rating is not None:
            scores.append((msg.get('msg_id', 'unknown'), rating))

    scores.sort(key=lambda x: x[1], reverse=True)
    return scores[:top_n] if top_n else scores


def available_models():
    """Return list of (study, party) keys with fitted models."""
    return sorted(_models.keys())
