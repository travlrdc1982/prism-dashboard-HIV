"""IPF rake primitive + trim. Platform-locked algorithm."""

import numpy as np
import pandas as pd


def rake(df: pd.DataFrame, weight_col: str, dimensions, targets,
         max_iter: int = 100, tol: float = 1e-7,
         total: float = None) -> dict:
    """Iterative proportional fitting, in place on df[weight_col].

    targets: {dimension: {category: target_proportion}}.
    total:   the weight mass the proportions refer to. Defaults to the
             CURRENT sum of weights — this is what lets the two-stage
             joint loop compose: re-raking a cluster's demographics
             preserves whatever total the segment stage gave it.
    Returns {iterations, converged, max_change}.
    """
    if total is None:
        total = float(df[weight_col].sum())
    w = df[weight_col].to_numpy(dtype=float, copy=True)
    # Pre-encode each dimension as integer codes + per-code target sums
    dims_encoded = []
    for dim in dimensions:
        cats = list(targets[dim].keys())
        cat_to_idx = {c: i for i, c in enumerate(cats)}
        codes = df[dim].map(cat_to_idx).to_numpy()
        codes = np.where(pd.isna(codes), -1, codes).astype(int)
        tgt = np.array([targets[dim][c] * total for c in cats])
        dims_encoded.append((codes, tgt, len(cats)))

    max_change = 0.0
    for iteration in range(max_iter):
        max_change = 0.0
        for codes, tgt, k in dims_encoded:
            sums = np.bincount(codes[codes >= 0], weights=w[codes >= 0],
                               minlength=k)
            factors = np.ones(k)
            nz = sums > 0
            factors[nz] = tgt[nz] / sums[nz]
            w[codes >= 0] *= factors[codes[codes >= 0]]
            if nz.any():
                max_change = max(max_change,
                                 float(np.abs(factors[nz] - 1.0).max()))
        if max_change < tol:
            df[weight_col] = w
            return {"iterations": iteration + 1, "converged": True,
                    "max_change": max_change}
    df[weight_col] = w
    return {"iterations": max_iter, "converged": False,
            "max_change": max_change}


def trim_and_renormalize(df: pd.DataFrame, weight_col: str,
                         low: float, high: float,
                         total: float = None) -> None:
    """Cap weights to [low, high], renormalize to `total` (default N)."""
    if total is None:
        total = float(len(df))
    df[weight_col] = df[weight_col].clip(lower=low, upper=high)
    df[weight_col] = df[weight_col] * total / df[weight_col].sum()
