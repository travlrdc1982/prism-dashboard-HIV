"""
PRISM topline — Bayesian SoP + Utility.

Replaces the prior frequentist/bootstrap topline:
  - SoP per audience: Dirichlet posterior over the K=N_MESSAGES shares,
    with a hierarchical prior that borrows strength toward the
    total-sample share so small audience cells stabilize. Posterior
    mean is the displayed SoP %; 95% credible interval is the central
    posterior interval; p_top1 / p_top3 are Monte-Carlo ranking
    probabilities from posterior draws.
  - Utility per (segment × message): hierarchical Normal–Normal
    shrinkage on bw_norm toward the segment-level zero mean (B-W is
    zero-sum within a respondent's MaxDiff). Posterior mean is the
    displayed signed Utility; 95% CI is the Normal posterior CI; a
    secondary 0–100 rescale is emitted using a study-configurable
    fixed scale so cross-segment comparisons are valid.

Everything in this module is a pure NumPy function. No I/O, no
config loading, no JSON shaping. Callers (prism_build_dashboard) own
those concerns.

References (kept tight on purpose; the math is standard):
  - Dirichlet posterior: Gelman BDA3 §3.4
  - Hierarchical shrinkage: Carlin & Louis "Bayes & Empirical Bayes
    Methods" §3.3, identical closed form to the cell-lift EB used in
    prism_step4_lift_v2.eb_shrink_vec.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from typing import Mapping, Optional, Sequence


# ═════════════════════════════════════════════════════════════════════
# SoP — hierarchical Dirichlet posterior over message shares
# ═════════════════════════════════════════════════════════════════════

def _aggregate_wins_losses(exposure: pd.DataFrame,
                           seg_filter: Optional[Sequence[int]] = None,
                           n_msgs: int = 17) -> np.ndarray:
    """Sum (best - worst) signed engagement counts per message over a
    subset of segments. We use bw_score as the "vote" (signed, MaxDiff
    convention: +1 = chosen best, -1 = chosen worst, 0 = saw but didn't
    pick). The Dirichlet treats the positive engagement as multinomial
    success counts; clipped at zero so a backfire message contributes
    zero successes rather than negative ones.

    Returns: counts vector of length n_msgs+1 (1-indexed; index 0 unused).
    """
    e = exposure
    if seg_filter is not None:
        e = e[e['segment'].isin(seg_filter)]
    if len(e) == 0:
        return np.zeros(n_msgs + 1, dtype=float)
    wins = (e.assign(w=lambda d: np.maximum(d['bw_score'], 0.0))
              .groupby('item')['w']
              .sum())
    counts = np.zeros(n_msgs + 1, dtype=float)
    for m in range(1, n_msgs + 1):
        counts[m] = float(wins.get(m, 0.0))
    return counts


def dirichlet_posterior_summary(counts: np.ndarray,
                                prior: np.ndarray,
                                n_draws: int = 4000,
                                rng_seed: int = 42) -> dict:
    """Posterior summary for Dirichlet(α₀ + counts).

    Returns:
      sop_pct        posterior mean × 100, vector len K (1-indexed)
      ci_low/high    central 95% credible interval × 100
      p_top1         P(message is the rank-1 share)
      p_top3         P(message is in the top-3 shares)
      rank           1-based rank by posterior mean (1 = highest)
      alpha_post     posterior concentration vector (diagnostic)
    """
    rng = np.random.default_rng(rng_seed)
    K = len(counts)
    alpha = prior + counts
    # Defensive: keep all α > 0 so np.random.dirichlet is well-defined.
    alpha = np.maximum(alpha, 1e-12)
    # We don't draw for index 0 (1-indexed convention); slice [1:]
    a = alpha[1:]
    draws = rng.dirichlet(a, size=n_draws)        # (n_draws, K-1)
    means = draws.mean(axis=0) * 100.0
    lo    = np.percentile(draws, 2.5,  axis=0) * 100.0
    hi    = np.percentile(draws, 97.5, axis=0) * 100.0

    # Rank distribution: argmax over draws → which message is #1?
    ranks_per_draw = (-draws).argsort(axis=1).argsort(axis=1) + 1   # 1..K-1
    p_top1 = (ranks_per_draw == 1).mean(axis=0)
    p_top3 = (ranks_per_draw <= 3).mean(axis=0)

    # Wrap back into 1-indexed K-length vectors so the caller is consistent.
    sop_pct = np.zeros(K)
    ci_lo   = np.zeros(K)
    ci_hi   = np.zeros(K)
    pt1     = np.zeros(K)
    pt3     = np.zeros(K)
    sop_pct[1:] = means
    ci_lo[1:]   = lo
    ci_hi[1:]   = hi
    pt1[1:]     = p_top1
    pt3[1:]     = p_top3

    # Rank by posterior mean (ties broken by Monte-Carlo p_top1).
    order_score = sop_pct[1:] + 1e-6 * pt1[1:]
    rank_idx = (-order_score).argsort()
    rank = np.zeros(K, dtype=int)
    for r, k in enumerate(rank_idx, start=1):
        rank[k + 1] = r

    return {
        'sop_pct': sop_pct,
        'ci_low':  ci_lo,
        'ci_high': ci_hi,
        'p_top1':  pt1,
        'p_top3':  pt3,
        'rank':    rank,
        'alpha_post': alpha,
    }


def sop_simple_bayes(exposure: pd.DataFrame,
                     baskets: Sequence[dict],
                     n_msgs: int = 17,
                     prior_alpha: float = 1.0,
                     hierarchical_K: float = 17.0,
                     n_draws: int = 4000,
                     rng_seed: int = 42) -> dict:
    """Per-basket Bayesian SoP.

    Hierarchical prior: α_m = prior_alpha + hierarchical_K · global_share_m
    where global_share_m is the total-sample posterior MEAN (so each
    basket borrows strength from the population without distorting its
    own posterior).

    Pass-1: total-sample posterior with flat Dirichlet(prior_alpha).
    Pass-2: each basket uses prior α_m built from the pass-1 means.

    Returns: { basket_id: { name, segments, messages: [ {message,
              sop_pct, ci_low, ci_high, p_top1, p_top3, rank, n} ] } }
    """
    # ── Pass 1: total-sample posterior mean as the hierarchical anchor.
    total_counts = _aggregate_wins_losses(exposure, seg_filter=None,
                                          n_msgs=n_msgs)
    pass1_prior = np.full(n_msgs + 1, prior_alpha, dtype=float)
    pass1 = dirichlet_posterior_summary(
        total_counts, pass1_prior, n_draws=n_draws, rng_seed=rng_seed
    )
    # Convert mean-percent back to a unit-summing share vector.
    global_share = pass1['sop_pct'] / 100.0
    # The shared prior across baskets (length K, 1-indexed).
    shared_prior = prior_alpha + hierarchical_K * global_share

    out = {}
    for bi, basket in enumerate(baskets):
        segs = basket['segments']
        counts_b = _aggregate_wins_losses(exposure, seg_filter=segs,
                                          n_msgs=n_msgs)
        summary = dirichlet_posterior_summary(
            counts_b, shared_prior,
            n_draws=n_draws, rng_seed=rng_seed + bi + 1,
        )
        n_b = int((exposure['segment'].isin(segs)).sum())
        msgs = []
        for m in range(1, n_msgs + 1):
            msgs.append({
                'message':   m,
                'sop_pct':   float(summary['sop_pct'][m]),
                'ci_low':    float(summary['ci_low'][m]),
                'ci_high':   float(summary['ci_high'][m]),
                'p_top1':    float(summary['p_top1'][m]),
                'p_top3':    float(summary['p_top3'][m]),
                'rank':      int(summary['rank'][m]),
                'n':         int((exposure[(exposure['segment'].isin(segs))
                                            & (exposure['item'] == m)]).shape[0]),
            })
        out[basket['id']] = {
            'name': basket['name'],
            'segments': list(segs),
            'messages': msgs,
        }
    return out


# ═════════════════════════════════════════════════════════════════════
# Utility — hierarchical Normal–Normal shrinkage on signed bw_norm
# ═════════════════════════════════════════════════════════════════════

def hierarchical_utility(exposure: pd.DataFrame,
                         segments: Mapping[int, dict],
                         n_msgs: int = 17,
                         scale: Optional[dict] = None,
                         rng_seed: int = 42,
                         n_draws: int = 4000) -> pd.DataFrame:
    """Hierarchical posterior Utility per (segment × message).

    Model:
      x_i ~ Normal(μ_{seg,msg}, σ_w²)    [respondent-level bw_norm]
      μ_{seg,msg} ~ Normal(0, τ²)        [B-W is zero-sum within a
                                         respondent so the prior mean
                                         per message is 0; τ² captures
                                         cross-message variance within
                                         a segment]

    Posterior mean (closed form):
      μ̂ = (n/σ_w²)·x̄ / (n/σ_w² + 1/τ²)
         = w · x̄   where  w = n·τ² / (n·τ² + σ_w²)
      posterior variance = σ_w²·τ² / (n·τ² + σ_w²)

    σ_w² is the pooled respondent-level variance of bw_norm.
    τ²  is the cross-message variance of MLE means within each segment,
    averaged across segments (empirical Bayes).

    `scale = {'min': float, 'max': float}` (study-configurable) is used
    to rescale the signed posterior mean onto a 0..100 secondary scale
    for convenience. If absent, the function picks scale_min/max from
    pooled 1st/99th percentiles of bw_norm.

    Returns a DataFrame with columns:
      segment, item, n, bw_mean, utility_signed, utility_0_100,
      utility_ci_low_signed, utility_ci_high_signed,
      utility_ci_low_0_100, utility_ci_high_0_100,
      shrink_weight
    """
    e = exposure.copy()
    e['bw_norm'] = e['bw_score'] / e['n_shown'].clip(lower=1)
    e['segment'] = e['segment'].astype(int)
    e['item']    = e['item'].astype(int)

    # Pooled within-respondent residual SD: residualize bw_norm by
    # (segment × message) MLE means then take SD.
    grp = e.groupby(['segment', 'item'])['bw_norm']
    mle = grp.transform('mean')
    residual = e['bw_norm'] - mle
    sigma_w = float(residual.std(ddof=1))
    if not np.isfinite(sigma_w) or sigma_w <= 0:
        sigma_w = 1.0

    # Cross-message variance within each segment, averaged.
    seg_means = grp.mean().reset_index().rename(columns={'bw_norm': 'mle'})
    tau_per_seg = seg_means.groupby('segment')['mle'].var(ddof=1)
    tau_sq = float(tau_per_seg.mean())
    if not np.isfinite(tau_sq) or tau_sq <= 0:
        # Fall back to a tiny prior so shrinkage doesn't dominate.
        tau_sq = float(seg_means['mle'].var(ddof=1) or 1e-6)

    sigma_w_sq = sigma_w * sigma_w

    cell = (grp.agg(['mean', 'size'])
              .reset_index()
              .rename(columns={'mean': 'bw_mean', 'size': 'n'}))
    cell['n'] = cell['n'].astype(int)
    n_arr = cell['n'].values.astype(float)
    x_bar = cell['bw_mean'].values.astype(float)

    # Closed-form shrinkage toward 0.
    w = (n_arr * tau_sq) / (n_arr * tau_sq + sigma_w_sq)
    mu_hat = w * x_bar
    var_post = (sigma_w_sq * tau_sq) / (n_arr * tau_sq + sigma_w_sq)
    sd_post = np.sqrt(var_post)
    ci_lo_signed = mu_hat - 1.959963984540054 * sd_post
    ci_hi_signed = mu_hat + 1.959963984540054 * sd_post

    # 0..100 rescale on a fixed, study-configurable scale.
    if scale and {'min', 'max'}.issubset(scale.keys()):
        s_min, s_max = float(scale['min']), float(scale['max'])
    else:
        s_min = float(np.percentile(e['bw_norm'].values, 1.0))
        s_max = float(np.percentile(e['bw_norm'].values, 99.0))
        if s_max <= s_min:
            s_max = s_min + 1.0
    def rescale(x):
        return float(np.clip(100.0 * (x - s_min) / (s_max - s_min), 0.0, 100.0))

    cell['utility_signed']         = mu_hat
    cell['utility_0_100']          = [rescale(v) for v in mu_hat]
    cell['utility_ci_low_signed']  = ci_lo_signed
    cell['utility_ci_high_signed'] = ci_hi_signed
    cell['utility_ci_low_0_100']   = [rescale(v) for v in ci_lo_signed]
    cell['utility_ci_high_0_100']  = [rescale(v) for v in ci_hi_signed]
    cell['shrink_weight']          = w
    # diagnostics
    cell.attrs['sigma_within'] = sigma_w
    cell.attrs['tau_squared']  = tau_sq
    cell.attrs['scale_min']    = s_min
    cell.attrs['scale_max']    = s_max
    return cell


# ═════════════════════════════════════════════════════════════════════
# Per-(segment × message) SoP — derived from the per-segment Dirichlet
# ═════════════════════════════════════════════════════════════════════

def sop_per_segment_bayes(exposure: pd.DataFrame,
                          segments: Mapping[int, dict],
                          n_msgs: int = 17,
                          prior_alpha: float = 1.0,
                          hierarchical_K: float = 17.0,
                          n_draws: int = 4000,
                          rng_seed: int = 42) -> pd.DataFrame:
    """Per (segment × message) SoP posterior. Uses the same hierarchical
    prior as sop_simple_bayes (anchored at the total-sample posterior
    mean), but draws one posterior per segment.

    Returns DataFrame: segment, item, n, sop_pct, ci_low, ci_high,
                       p_top1, p_top3, rank
    """
    # Build the hierarchical prior from the total-sample pass.
    total_counts = _aggregate_wins_losses(exposure, seg_filter=None,
                                          n_msgs=n_msgs)
    flat_prior = np.full(n_msgs + 1, prior_alpha, dtype=float)
    pass1 = dirichlet_posterior_summary(total_counts, flat_prior,
                                        n_draws=n_draws,
                                        rng_seed=rng_seed)
    global_share = pass1['sop_pct'] / 100.0
    shared_prior = prior_alpha + hierarchical_K * global_share

    rows = []
    for seg_id in sorted(segments.keys()):
        counts_s = _aggregate_wins_losses(exposure, seg_filter=[seg_id],
                                          n_msgs=n_msgs)
        s = dirichlet_posterior_summary(counts_s, shared_prior,
                                        n_draws=n_draws,
                                        rng_seed=rng_seed + seg_id)
        n_s = int((exposure['segment'] == seg_id).sum())
        for m in range(1, n_msgs + 1):
            rows.append({
                'segment': seg_id,
                'item':    m,
                'n':       n_s,
                'sop_pct':  float(s['sop_pct'][m]),
                'ci_low':   float(s['ci_low'][m]),
                'ci_high':  float(s['ci_high'][m]),
                'p_top1':   float(s['p_top1'][m]),
                'p_top3':   float(s['p_top3'][m]),
                'rank':     int(s['rank'][m]),
            })
    return pd.DataFrame(rows)


__all__ = [
    'dirichlet_posterior_summary',
    'sop_simple_bayes',
    'sop_per_segment_bayes',
    'hierarchical_utility',
]
