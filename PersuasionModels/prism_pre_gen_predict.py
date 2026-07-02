"""
PRISM Avatar -- Generalizable Baseline Opinion Prediction
=========================================================
Uses issue vector profiles instead of study dummies.
Works for ANY new study: just supply the mean vector codes
of its message battery as the issue profile.

Usage:
    from prism_pre_gen_predict import predict_pre_score

    # Known study -- profiles loaded automatically
    avatar = {
        'segment': 3, 'study': 'VAX2',
        'outcome_item': 'ITEM1', 'outcome_scale': 7,
        'V_TRUST': 0.82, 'V_SCIENCE': 1.15,
        'V_MARKETS': 0.44, 'V_FREEDOM': -0.31,
    }
    pre_std, pre_raw = predict_pre_score(avatar)

    # NEW study never seen in training -- supply issue profile manually
    new_issue_profile = {
        'ISSUE_TRUST': 0.5, 'ISSUE_SCIENCE': 1.2,
        'ISSUE_MARKETS': -0.3, 'ISSUE_FREEDOM': 0.1,
        'ISSUE_REFORM': -0.5, 'ISSUE_EQUITY': 0.0,
        'ISSUE_LEADERSHIP': 0.8, 'ISSUE_INDUSTRY': 0.6,
    }
    pre_std, pre_raw = predict_pre_score(avatar, issue_profile=new_issue_profile)
"""

import pickle, os
import pandas as pd
import numpy as np

_DIR  = os.path.dirname(os.path.abspath(__file__))
_data = pickle.load(open(os.path.join(_DIR, 'prism_pre_gen_models.pkl'), 'rb'))

_models         = _data['models']
_scale_params   = _data['scale_params']
_issue_profiles = _data['issue_profiles']   # {study_id: {ISSUE_TRUST: ..., ...}}

GOP_SEGS    = list(range(1, 11))
DEM_SEGS    = list(range(11, 17))
GOP_VECTORS = ['TRUST','SCIENCE','MARKETS','FREEDOM']
DEM_VECTORS = ['REFORM','EQUITY','LEADERSHIP','INDUSTRY']
ALL_VECTORS = ['TRUST','SCIENCE','MARKETS','FREEDOM',
               'REFORM','EQUITY','LEADERSHIP','INDUSTRY']


def predict_pre_score(avatar, issue_profile=None):
    """
    Predict baseline opinion for one avatar.

    avatar:        dict with segment, study, outcome_item, outcome_scale, V_*
    issue_profile: dict with ISSUE_* keys. If None, looks up the known
                   study profile from training data. Required for new studies.

    Returns (pre_std, pre_raw). Both None if model unavailable.
    """
    segment      = int(avatar['segment'])
    study        = str(avatar['study'])
    outcome_item = str(avatar['outcome_item'])
    out_scale    = int(avatar.get('outcome_scale', 7))

    party   = 'GOP' if segment in GOP_SEGS else 'DEM'
    vectors = GOP_VECTORS if party == 'GOP' else DEM_VECTORS

    if party not in _models:
        return None, None

    model = _models[party]

    # Resolve issue profile
    if issue_profile is None:
        if study not in _issue_profiles:
            print(f"  [predict_pre_score] No issue profile for study '{study}'. "
                  f"Pass issue_profile= for new studies.")
            return None, None
        profile = _issue_profiles[study]
    else:
        profile = issue_profile

    row = {'SEGMENT_COMBINED': str(segment)}
    for v in vectors:
        row[f'V_{v}'] = float(avatar.get(f'V_{v}', 0.0))
    for v in ALL_VECTORS:
        row[f'ISSUE_{v}'] = float(profile.get(f'ISSUE_{v}', 0.0))

    X = pd.DataFrame([row])

    try:
        pre_std = float(model.predict(X)[0])
    except Exception as e:
        print(f"  [predict_pre_score] Warning: {e}")
        return None, None

    params  = _scale_params.get(out_scale, _scale_params[7])
    pre_raw = float(np.clip(pre_std * params['std'] + params['mean'], 1, out_scale))

    return pre_std, pre_raw


def compute_issue_profile(messages):
    """
    Compute an issue profile from a list of message vector dicts.
    Use this to characterize a new study before calling predict_pre_score().

    messages: list of dicts, each with keys:
              TRUST, SCIENCE, MARKETS, FREEDOM, REFORM, EQUITY, LEADERSHIP, INDUSTRY
              (same -2 to +2 scale as the codebook)

    Returns: dict with ISSUE_* keys (mean vector codes across messages)
    """
    if not messages:
        return {f'ISSUE_{v}': 0.0 for v in ALL_VECTORS}
    df = pd.DataFrame(messages)
    return {f'ISSUE_{v}': float(df[v].mean()) for v in ALL_VECTORS if v in df.columns}


def available_studies():
    return sorted(_issue_profiles.keys())
