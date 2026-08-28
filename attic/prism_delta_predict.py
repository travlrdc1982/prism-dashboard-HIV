"""
PRISM Avatar — Opinion Movement Prediction Module
==================================================
Predicts OPINION_DELTA (standardized) for an avatar given:
  - Their baseline opinion (PRE_SCORE)
  - Their vector profile
  - The study context and outcome item

Usage:
    from prism_delta_predict import predict_opinion_delta

    avatar = {
        'segment':      3,
        'study':        'VAX2',
        'outcome_item': 'ITEM1',
        'pre_score':    5.2,       # baseline opinion (raw scale)
        'pre_scale':    7,         # 7 or 100
        'V_TRUST':      0.82,
        'V_SCIENCE':    1.15,
        'V_MARKETS':    0.44,
        'V_FREEDOM':   -0.31,
    }

    delta = predict_opinion_delta(avatar)
    # Returns: float (standardized predicted opinion shift)
    # Positive = moves toward support; negative = moves away
"""

import pickle
import pandas as pd
import numpy as np
import os

_DIR    = os.path.dirname(os.path.abspath(__file__))
_models = pickle.load(open(os.path.join(_DIR, 'prism_delta_models.pkl'), 'rb'))

# Scale parameters for standardizing PRE_SCORE at prediction time
# (estimated from training data — update if retraining)
_scale_params = {
    7:   {'mean': 5.02, 'std': 1.51},
    100: {'mean': 65.7, 'std': 24.7},
}

GOP_SEGS    = list(range(1, 11))
DEM_SEGS    = list(range(11, 17))
GOP_VECTORS = ['TRUST', 'SCIENCE', 'MARKETS', 'FREEDOM']
DEM_VECTORS = ['REFORM', 'EQUITY', 'LEADERSHIP', 'INDUSTRY']


def predict_opinion_delta(avatar):
    """
    Predict standardized OPINION_DELTA for one avatar x study x outcome.

    avatar: dict with keys:
      segment      (int, 1-16)
      study        (str)
      outcome_item (str, e.g. 'ITEM1', 'POL', 'VALUE')
      pre_score    (float, raw baseline opinion score)
      pre_scale    (int, 7 or 100 — scale of the pre_score)
      V_TRUST / V_SCIENCE / V_MARKETS / V_FREEDOM   (GOP)
      V_REFORM / V_EQUITY / V_LEADERSHIP / V_INDUSTRY (DEM)

    Returns: float (standardized predicted opinion shift), or None.
    Positive = moves toward support. Negative = backfire.
    """
    segment      = int(avatar['segment'])
    study        = str(avatar['study'])
    outcome_item = str(avatar['outcome_item'])
    pre_score    = float(avatar['pre_score'])
    pre_scale    = int(avatar.get('pre_scale', 7))

    party   = 'GOP' if segment in GOP_SEGS else 'DEM'
    vectors = GOP_VECTORS if party == 'GOP' else DEM_VECTORS

    model_key = (study, party)
    if model_key not in _models:
        return None

    model = _models[model_key]

    # Standardize PRE_SCORE using training data scale params
    params   = _scale_params.get(pre_scale, _scale_params[7])
    pre_std  = (pre_score - params['mean']) / params['std']

    row = {
        'PRE_SCORE_STD':    pre_std,
        'SEGMENT_COMBINED': str(segment),
        'OUTCOME_ITEM':     outcome_item,
    }
    for v in vectors:
        row[f'V_{v}'] = float(avatar.get(f'V_{v}', 0.0))

    X = pd.DataFrame([row])

    try:
        return float(model.predict(X)[0])
    except Exception as e:
        print(f"  [predict_opinion_delta] Warning ({study}/{party}/seg{segment}): {e}")
        return None


def available_models():
    """Return list of (study, party) keys with fitted models."""
    return sorted(_models.keys())
