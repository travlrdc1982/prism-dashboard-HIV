"""PRISM v3 model core: loader + evaluator shared by the v3 drop-in predict modules.

Backed by prism_v3_dashboard_models.pkl, exported from the research repo
(travlrdc1982/simulation, research/persuasion/export_dashboard_models.py). Every model
is a plain {term_name: coefficient} dict - no statsmodels, no patsy, no version
fragility. Term forms: Intercept, C(SEGMENT_COMBINED)[T.k], C(OUTCOME_ITEM)[T.x], and
plain numeric feature columns.

Differences from the legacy PersuasionModels package:
- 8 vectors everywhere (v3 recomputed on the frozen baseline, data sign convention).
  Legacy 4-vector avatars still work: missing vectors default to 0.0.
- Legacy key EQUITY maps to v3 JUSTICE (avatar V_EQUITY and message EQUITY codes).
- Message codes are consensus v2 (-3..+3, research/message_coding/consensus_codes_v2.csv),
  not the legacy -2..+2 codebook.
- Studies covered per family are wider (incl. MA, AL, VICP, PREG, GLP1, HIV) and the
  pooled production models (HIV-inclusive, H2-widened) provide the pre-generation path
  WITH the standing caveat: cross-topic message ranking failed its ESI holdout - use
  fit_pilot_anchor()/apply_pilot_anchor() with an in-topic pilot (~100 respondents per
  party; see PILOT_ANCHOR_REPORT.md in the research repo).
- ESI and VAX2 never trained any of these models.
"""

import os
import pickle
import re

import numpy as np
import pandas as pd

_DIR = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(_DIR, "prism_v3_dashboard_models.pkl"), "rb") as _fh:
    _PKG = pickle.load(_fh)

META = _PKG["meta"]
PER_STUDY = _PKG["per_study"]
POOLED = _PKG["pooled"]
VECTORS = list(META["vectors"])  # TRUST SCIENCE MARKETS FREEDOM REFORM JUSTICE LEADERSHIP INDUSTRY

GOP_SEGS = list(range(1, 11))
DEM_SEGS = list(range(11, 17))
LEGACY_KEY = {"EQUITY": "JUSTICE"}  # legacy name -> v3 name

_TERM_RE = re.compile(r"C\((\w+)\)\[T\.(.+)\]$")


def eval_terms(terms, row):
    """Evaluate one flattened model on a dict-like row."""
    y = 0.0
    for name, coef in terms.items():
        if name == "Intercept":
            y += coef
            continue
        m = _TERM_RE.match(name)
        if m:
            if str(row.get(m.group(1))) == m.group(2):
                y += coef
        else:
            y += coef * float(row.get(name, 0.0))
    return y


def party_of(segment):
    return "GOP" if int(segment) in GOP_SEGS else "DEM"


def avatar_vectors(avatar):
    """All 8 v3 vectors from an avatar dict; legacy V_EQUITY accepted; missing -> 0."""
    out = {}
    for v in VECTORS:
        val = avatar.get(f"V_{v}")
        if val is None and v == "JUSTICE":
            val = avatar.get("V_EQUITY")
        out[f"V_{v}"] = float(val) if val is not None else 0.0
    return out


def msg_codes(msg):
    """All 8 message codes from a message dict; legacy EQUITY key accepted."""
    out = {}
    for v in VECTORS:
        val = msg.get(v)
        if val is None:
            for legacy, v3 in LEGACY_KEY.items():
                if v3 == v:
                    val = msg.get(legacy)
        out[f"MSG_{v}"] = float(val) if val is not None else 0.0
    return out


# ---------------------------------------------------------------------------
# Pooled production models (pre-generation path)
# ---------------------------------------------------------------------------


def _apply_pooled(entry, df):
    X = [np.ones(len(df))]
    for name in entry["features"][1:]:
        if name.startswith("SEG_"):
            X.append((df["SEG"].astype(int) == int(name[4:])).astype(float).values)
        else:
            col = df[name] if name in df else pd.Series(0.0, index=df.index)
            X.append(pd.to_numeric(col, errors="coerce").fillna(0.0).values)
    return np.column_stack(X) @ entry["beta"]


def predict_receptiveness_pooled(df, use_legacy=None):
    """Respondent x message rows: V_*, SEG, MSG_* (consensus codes). Standardized
    receptiveness from the calibrated pooled ensemble. CAVEAT: anchor with an
    in-topic pilot before trusting cross-topic message rankings."""
    df = df.copy()
    for v in VECTORS:
        df[f"ALIGN_{v}"] = df[f"V_{v}"] * df[f"MSG_{v}"]
        s = df[f"MSG_{v}"]
        df[f"SMSG_{v}"] = (s - s.mean()) / s.std() if s.std() > 0 else s * 0.0
        df[f"SALIGN_{v}"] = df[f"V_{v}"] * df[f"SMSG_{v}"]
        if f"LMSG_{v}" in df:
            df[f"LALIGN_{v}"] = df[f"V_{v}"] * df[f"LMSG_{v}"]
    if use_legacy is None:
        use_legacy = all(f"LMSG_{v}" in df for v in VECTORS)
    names = ["raw", "std"] + (["legacy"] if use_legacy else [])
    zs = []
    for m in names:
        p = _apply_pooled(POOLED["receptiveness"]["members"][m], df)
        zs.append((p - p.mean()) / p.std() if p.std() > 0 else p)
    ens = np.mean(zs, axis=0)
    cal = POOLED["receptiveness"]["calibration"]
    return cal["a"] + cal["b"] * ens


def fit_pilot_anchor(anchor_df, shrink_k=30.0):
    """Fit the pilot-anchor recalibration from a small in-topic anchor cell
    (respondent x message rows with MSG_ID and Y = observed standardized utility).
    ~100 respondents per party validated (rankRho 0.25 -> 0.71)."""
    pred = predict_receptiveness_pooled(anchor_df)
    y = pd.to_numeric(anchor_df["Y"], errors="coerce").values
    m = ~np.isnan(y) & ~np.isnan(pred)
    b = float(np.cov(pred[m], y[m])[0, 1] / max(np.var(pred[m]), 1e-9))
    a = float(np.mean(y[m]) - b * np.mean(pred[m]))
    resid = pd.Series(y[m] - (a + b * pred[m]), index=anchor_df.index[m])
    stat = resid.groupby(anchor_df.loc[resid.index, "MSG_ID"]).agg(["mean", "size"])
    w = stat["size"] / (stat["size"] + shrink_k)
    return {"a": a, "b": b, "offsets": (w * stat["mean"]).to_dict(), "shrink_k": shrink_k}


def apply_pilot_anchor(anchor, df, pred=None):
    """Apply a fit_pilot_anchor() recalibration to new respondent x message rows."""
    if pred is None:
        pred = predict_receptiveness_pooled(df)
    off = df["MSG_ID"].map(anchor["offsets"]).fillna(0.0).values
    return anchor["a"] + anchor["b"] * np.asarray(pred) + off
