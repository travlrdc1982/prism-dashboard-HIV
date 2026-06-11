"""
PRISM persuasion index + residualized shift
═══════════════════════════════════════════════════════════════════
Step 1-2 of the message map analysis pipeline.

Adds to compute_core.py. Called from build_topline(df) before
MaxDiff lift estimation.

Config-driven: each study declares INDEX_ITEMS, the engine handles
everything else. Reproducible across studies with different item
batteries.
"""
import numpy as np
import pandas as pd
from typing import Tuple, Dict, Any


# ═════════════════════════════════════════════════════════════════
# STUDY CONFIG — PRISM HIV 2026
# ─────────────────────────────────────────────────────────────────
# Per-study declaration: which 7 (or N) pre/post items form the
# persuasion index. 'reverse' is for studies where analyst-reversed
# companion variables don't exist; here, both XQPRE_1r1r1 and XPOST_1r1r1
# are already analyst-reversed (higher = more aligned with client),
# so reverse=False throughout this study.
# ═════════════════════════════════════════════════════════════════

INDEX_ITEMS = [
    {'pre': 'XQPRE_1r1r1', 'post': 'XPOST_1r1r1', 'reverse': False, 'label': 'HIV national priority'},
    {'pre': 'QPRE_2',      'post': 'QPOST_2',     'reverse': False, 'label': 'Community concern'},
    {'pre': 'QPRE_3',      'post': 'QPOST_3',     'reverse': False, 'label': 'Access concern'},
    {'pre': 'QPRE_4',      'post': 'QPOST_4',     'reverse': False, 'label': 'Personal relevance'},
    {'pre': 'QPRE_5',      'post': 'QPOST_5',     'reverse': False, 'label': 'Support expanded access'},
    {'pre': 'XQPRE_6R',    'post': 'XPOST_6R',    'reverse': False, 'label': 'Oppose eligibility cuts'},
    {'pre': 'QPRE_7r1',    'post': 'QPOST_7r1',   'reverse': False, 'label': 'Innovation orientation'},
]
INDEX_SCALE_MIN = 1
INDEX_SCALE_MAX = 7
INDEX_ALPHA_SOFT = 0.70   # Below this, build warns but proceeds
INDEX_ALPHA_HARD = 0.60   # Below this, build fails unless --override-alpha


# ─────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────

def _reverse(x: pd.Series, scale_max: int = INDEX_SCALE_MAX) -> pd.Series:
    """Reverse-code a Likert item: (max + min) - x."""
    return (scale_max + INDEX_SCALE_MIN) - x


def _cronbach_alpha(df_items: pd.DataFrame) -> float:
    """
    Standardized Cronbach's alpha across the items in df_items.
    Uses listwise deletion. Returns NaN if fewer than 2 items
    or if any item has zero variance.
    """
    items = df_items.dropna()
    k = items.shape[1]
    if k < 2 or len(items) < 2:
        return float('nan')
    item_vars = items.var(axis=0, ddof=1)
    if (item_vars == 0).any():
        return float('nan')
    total_var = items.sum(axis=1).var(ddof=1)
    if total_var == 0:
        return float('nan')
    return float((k / (k - 1)) * (1 - item_vars.sum() / total_var))


# ─────────────────────────────────────────────────────────────────
# Step 1: persuasion index
# ─────────────────────────────────────────────────────────────────

def compute_persuasion_index(
    df: pd.DataFrame,
    items: list = INDEX_ITEMS,
    scale_min: int = INDEX_SCALE_MIN,
    scale_max: int = INDEX_SCALE_MAX,
    alpha_soft: float = INDEX_ALPHA_SOFT,
    alpha_hard: float = INDEX_ALPHA_HARD,
    allow_override: bool = False,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Build pre_composite and post_composite as means of N items on
    a common Likert scale, reverse-coding where indicated. Returns
    df with two new columns added, plus a diagnostics dict.

    Raises ValueError if alpha falls below alpha_hard and
    allow_override is False.
    """
    # Verify all variables exist
    missing = []
    for it in items:
        for side in ['pre', 'post']:
            if it[side] not in df.columns:
                missing.append(it[side])
    if missing:
        raise ValueError(f"Index variables missing from df: {missing}")

    # Build the matrix of pre items (with reversal) and same for post
    pre_cols = {}
    post_cols = {}
    for it in items:
        pre_raw = pd.to_numeric(df[it['pre']], errors='coerce')
        post_raw = pd.to_numeric(df[it['post']], errors='coerce')
        if it['reverse']:
            pre_raw = _reverse(pre_raw, scale_max)
            post_raw = _reverse(post_raw, scale_max)
        pre_cols[it['label']] = pre_raw
        post_cols[it['label']] = post_raw

    pre_df = pd.DataFrame(pre_cols)
    post_df = pd.DataFrame(post_cols)

    # Composite = mean of available items per respondent
    # (use mean rather than sum so partial missingness is handled gracefully)
    df = df.copy()
    df['pre_composite'] = pre_df.mean(axis=1, skipna=True)
    df['post_composite'] = post_df.mean(axis=1, skipna=True)
    df['composite_delta_raw'] = df['post_composite'] - df['pre_composite']  # QC only

    # Diagnostics
    alpha_pre = _cronbach_alpha(pre_df)
    alpha_post = _cronbach_alpha(post_df)

    item_diag = []
    for it in items:
        item_diag.append({
            'pre_var': it['pre'],
            'post_var': it['post'],
            'label': it['label'],
            'reverse': it['reverse'],
            'pre_n': int(pre_cols[it['label']].notna().sum()),
            'pre_mean': float(pre_cols[it['label']].mean()),
            'post_mean': float(post_cols[it['label']].mean()),
            'mean_shift': float(post_cols[it['label']].mean() - pre_cols[it['label']].mean()),
        })

    diag = {
        'n_items': len(items),
        'scale_range': [scale_min, scale_max],
        'n_respondents': len(df),
        'n_valid_pre': int(df['pre_composite'].notna().sum()),
        'n_valid_post': int(df['post_composite'].notna().sum()),
        'pre_composite_mean': float(df['pre_composite'].mean()),
        'post_composite_mean': float(df['post_composite'].mean()),
        'composite_shift_mean': float(df['composite_delta_raw'].mean()),
        'composite_shift_sd': float(df['composite_delta_raw'].std(ddof=1)),
        'cronbach_alpha_pre': alpha_pre,
        'cronbach_alpha_post': alpha_post,
        'alpha_soft_threshold': alpha_soft,
        'alpha_hard_threshold': alpha_hard,
        'alpha_status': 'pass' if min(alpha_pre, alpha_post) >= alpha_soft
                        else ('soft_warning' if min(alpha_pre, alpha_post) >= alpha_hard
                              else 'hard_fail'),
        'items': item_diag,
    }

    # Hard-fail behavior
    if diag['alpha_status'] == 'hard_fail' and not allow_override:
        raise ValueError(
            f"Cronbach's alpha below hard threshold ({alpha_hard}): "
            f"pre={alpha_pre:.3f}, post={alpha_post:.3f}. "
            f"Override with allow_override=True if intentional."
        )

    return df, diag


# ─────────────────────────────────────────────────────────────────
# Step 2: residualized shift (persuadability score per respondent)
# ─────────────────────────────────────────────────────────────────

def compute_residualized_shift(
    df: pd.DataFrame,
    segment_col: str = 'XSEG_ASSIGNED',
    pre_col: str = 'pre_composite',
    post_col: str = 'post_composite',
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Predict post-composite from pre-composite + segment dummies.
    Residual = observed_post - predicted_post.

    Interpretation: how much each respondent moved beyond what their
    starting position and segment would have predicted. This is the
    persuadability score used downstream as a respondent weight
    and as the outcome in message-lift estimation.

    Sign convention: positive residual = moved toward client position
    (since composites are already direction-aligned).

    Returns df with 'residual_shift' added, plus diagnostics.
    """
    if pre_col not in df.columns or post_col not in df.columns:
        raise ValueError(f"Need {pre_col} and {post_col} columns; run compute_persuasion_index first.")
    if segment_col not in df.columns:
        raise ValueError(f"Need {segment_col} column for segment dummies.")

    work = df[[pre_col, post_col, segment_col]].dropna().copy()
    n = len(work)
    if n < 50:
        raise ValueError(f"Insufficient cases for residualization: n={n}")

    # Design matrix: intercept + pre_composite + (k-1) segment dummies
    pre = work[pre_col].values
    seg_dummies = pd.get_dummies(work[segment_col].astype(int), prefix='seg', drop_first=True).astype(float)
    X = np.column_stack([np.ones(n), pre, seg_dummies.values])
    y = work[post_col].values

    # OLS by normal equations
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    predicted = X @ beta
    residuals = y - predicted

    # SS_res and R^2 for diagnostics
    ss_res = float(np.sum(residuals ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else float('nan')

    # Write back to df, leaving NaN where the regression couldn't fit
    df = df.copy()
    df['residual_shift'] = np.nan
    df.loc[work.index, 'residual_shift'] = residuals

    # Aggregate persuadability by segment for downstream weighting
    seg_persuadability = (
        df.dropna(subset=['residual_shift', segment_col])
        .groupby(segment_col)['residual_shift']
        .agg(['count', 'mean', 'std'])
        .rename(columns={'count': 'n', 'mean': 'mean_shift', 'std': 'sd_shift'})
        .to_dict('index')
    )

    diag = {
        'n_fitted': n,
        'r_squared': r2,
        'beta_intercept': float(beta[0]),
        'beta_pre': float(beta[1]),
        'residual_mean': float(residuals.mean()),  # should be ~0
        'residual_sd': float(residuals.std(ddof=1)),
        'segment_persuadability': {int(k): v for k, v in seg_persuadability.items()},
    }

    return df, diag


# ═════════════════════════════════════════════════════════════════
# Test run on the actual HIV .sav
# ═════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    import pyreadstat
    df, meta = pyreadstat.read_sav('/mnt/user-data/uploads/260433.sav')

    print("=" * 72)
    print("STEP 1: persuasion index")
    print("=" * 72)
    df, diag1 = compute_persuasion_index(df)

    print(f"\nIndex: {diag1['n_items']} items on {diag1['scale_range']} scale")
    print(f"Valid composites: pre={diag1['n_valid_pre']}, post={diag1['n_valid_post']}")
    print(f"\nPre composite mean:  {diag1['pre_composite_mean']:.3f}")
    print(f"Post composite mean: {diag1['post_composite_mean']:.3f}")
    print(f"Mean composite shift: {diag1['composite_shift_mean']:+.3f}  "
          f"(SD: {diag1['composite_shift_sd']:.3f})")
    print(f"\nCronbach's alpha (pre):  {diag1['cronbach_alpha_pre']:.3f}")
    print(f"Cronbach's alpha (post): {diag1['cronbach_alpha_post']:.3f}")
    print(f"Status: {diag1['alpha_status'].upper()}  "
          f"(soft={diag1['alpha_soft_threshold']}, hard={diag1['alpha_hard_threshold']})")

    print("\nPer-item diagnostics:")
    print(f"  {'Variable':14s} {'Label':30s} {'Pre':>6s} {'Post':>6s} {'Shift':>8s}")
    for it in diag1['items']:
        print(f"  {it['pre_var']:14s} {it['label']:30s} "
              f"{it['pre_mean']:6.2f} {it['post_mean']:6.2f} {it['mean_shift']:+8.3f}")

    print()
    print("=" * 72)
    print("STEP 2: residualized shift")
    print("=" * 72)
    df, diag2 = compute_residualized_shift(df)

    print(f"\nFitted on n={diag2['n_fitted']} cases")
    print(f"R² = {diag2['r_squared']:.4f}")
    print(f"β_pre = {diag2['beta_pre']:.4f}  (1.0 = no shift; <1 indicates regression to mean)")
    print(f"Residual mean: {diag2['residual_mean']:+.6f} (should be ~0)")
    print(f"Residual SD:   {diag2['residual_sd']:.3f}")

    print("\nPer-segment persuadability (mean residualized shift):")
    print(f"  {'Segment':8s} {'n':>5s} {'Mean':>8s} {'SD':>8s}")
    for seg_id, stats in sorted(diag2['segment_persuadability'].items()):
        marker = '★' if stats['mean_shift'] > 0.1 else ('!' if stats['mean_shift'] < -0.05 else ' ')
        print(f"  {seg_id:8d} {stats['n']:5.0f} {stats['mean_shift']:+8.3f} {stats['sd_shift']:8.3f}  {marker}")

    print("\nLegend: ★ = above-average persuadability  ! = boomerang risk\n")
