"""
PRISM step 4 v2 — vectorized cell-level persuasion lift.

Uses pandas groupby instead of per-cell Python loops. ~50x faster.
"""
import numpy as np
import pandas as pd
from typing import Tuple, Dict


def cell_weighted_shifts(e: pd.DataFrame) -> pd.DataFrame:
    """
    Compute weighted shift per (item, segment, proof_variant, arm) cell via groupby.
    Returns frame with: message, segment, proof, arm, n, lift_raw, residual_sd.
    """
    e = e.copy()
    e['signed_w'] = e['residual_shift'] * e['bw_score']
    e['abs_w']    = np.abs(e['bw_score'])
    
    g = e.groupby(['item', 'segment', 'proof_variant', 'arm'])
    agg = g.agg(
        n=('record_id', 'size'),
        sum_signed=('signed_w', 'sum'),
        sum_abs=('abs_w', 'sum'),
        residual_sd=('residual_shift', lambda x: x.std(ddof=1) if len(x) > 1 else np.nan),
    ).reset_index()
    agg['lift_raw'] = np.where(agg['sum_abs'] > 0, agg['sum_signed'] / agg['sum_abs'], np.nan)
    return agg.rename(columns={'item': 'message', 'proof_variant': 'proof'})


def msg_marginals(e: pd.DataFrame) -> Dict[int, float]:
    """Engagement-weighted shift per message (across all respondents)."""
    g = e.groupby('item').agg(
        sum_signed=('signed_w', 'sum'),
        sum_abs=('abs_w', 'sum'),
    )
    return {int(m): float(r['sum_signed'] / r['sum_abs']) if r['sum_abs'] > 0 else np.nan
            for m, r in g.iterrows()}


def eb_shrink_vec(raw: np.ndarray, n: np.ndarray, sigma_w: float, sigma_b: float,
                  targets: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    """Vectorized EB shrinkage. Returns (shrunk, weights)."""
    shrunk = np.full_like(raw, np.nan, dtype=float)
    weights = np.zeros_like(raw, dtype=float)
    valid = (~np.isnan(raw)) & (n > 0) & (sigma_w > 0) & (sigma_b > 0)
    prec_w = n[valid] / (sigma_w ** 2)
    prec_b = 1.0 / (sigma_b ** 2)
    w = prec_w / (prec_w + prec_b)
    weights[valid] = w
    shrunk[valid] = w * raw[valid] + (1 - w) * targets[valid]
    # Where raw is NaN but we have a target, return target with w=0
    no_raw = np.isnan(raw) & ~np.isnan(targets)
    shrunk[no_raw] = targets[no_raw]
    return shrunk, weights


def compute_cell_lifts_fast(
    df: pd.DataFrame,
    exposure: pd.DataFrame,
    n_bootstrap: int = 500,
    rng_seed: int = 42,
) -> Tuple[pd.DataFrame, Dict]:
    """Vectorized cell-lift estimation with EB shrinkage and bootstrap CIs."""
    rng = np.random.default_rng(rng_seed)
    rec_col = 'record' if 'record' in df.columns else None
    if rec_col:
        resp = df[[rec_col, 'residual_shift', 'XSEG_ASSIGNED', 'HIV_RANDOM']].rename(
            columns={rec_col: 'record_id', 'XSEG_ASSIGNED': 'segment', 'HIV_RANDOM': 'arm'}
        )
    else:
        resp = df[['residual_shift', 'XSEG_ASSIGNED', 'HIV_RANDOM']].copy()
        resp['record_id'] = resp.index
        resp = resp.rename(columns={'XSEG_ASSIGNED': 'segment', 'HIV_RANDOM': 'arm'})

    # Use the exposure-side segment/arm (in case any join issues) — we have them on both sides
    e = exposure[['record_id', 'item', 'bw_score', 'proof_variant']].copy()
    e = e.merge(resp[['record_id', 'residual_shift', 'segment', 'arm']], on='record_id')
    e = e.dropna(subset=['residual_shift', 'segment', 'arm', 'bw_score'])
    e['segment'] = e['segment'].astype(int)
    e['arm'] = e['arm'].astype(int)
    e['proof_variant'] = e['proof_variant'].astype(int)
    e['signed_w'] = e['residual_shift'] * e['bw_score']
    e['abs_w'] = np.abs(e['bw_score'])

    # Point estimates
    print("  Computing point estimates...")
    cells = cell_weighted_shifts(e)
    marg = msg_marginals(e)
    cells['msg_marginal'] = cells['message'].map(marg)

    # Variance components
    sigma_w = float(cells['residual_sd'].mean())
    cells['_dev'] = cells['lift_raw'] - cells['msg_marginal']
    sigma_b = float(cells['_dev'].std(ddof=1))
    print(f"  sigma_within  = {sigma_w:.4f}")
    print(f"  sigma_between = {sigma_b:.4f}")

    # Apply EB shrinkage
    shrunk, w = eb_shrink_vec(
        cells['lift_raw'].values, cells['n'].values.astype(float),
        sigma_w, sigma_b, cells['msg_marginal'].values
    )
    cells['lift_shrunk'] = shrunk
    cells['shrink_weight'] = w

    # ── Bootstrap (vectorized via groupby on resampled record sets) ──
    print(f"  Bootstrapping {n_bootstrap} iterations...")
    unique_recs = e['record_id'].unique()
    n_recs = len(unique_recs)
    rec_to_idx = {r: i for i, r in enumerate(unique_recs)}
    e['rec_idx'] = e['record_id'].map(rec_to_idx).astype(np.int32)
    
    # Pre-build the cell index for each row
    e['cell_key'] = (
        e['item'].astype(int) * 1000
        + e['segment'].astype(int) * 50
        + e['proof_variant'].astype(int) * 10
        + e['arm'].astype(int)
    )
    
    # Sort by record for fast bootstrap-by-respondent
    cell_keys = cells['message'] * 1000 + cells['segment'] * 50 + cells['proof'] * 10 + cells['arm']
    cell_key_to_idx = {int(k): i for i, k in enumerate(cell_keys)}
    n_cells = len(cells)
    
    boot_estimates = np.full((n_bootstrap, n_cells), np.nan, dtype=np.float32)
    
    # Pre-extract numpy arrays
    e_rec_idx = e['rec_idx'].values
    e_cell_key = e['cell_key'].values
    e_signed_w = e['signed_w'].values
    e_abs_w = e['abs_w'].values
    
    for b in range(n_bootstrap):
        # Sample respondents with replacement (by index)
        sample_idx = rng.integers(0, n_recs, size=n_recs)
        # Count how many times each respondent was selected
        rec_counts = np.bincount(sample_idx, minlength=n_recs)
        # For each exposure row, its multiplier = count of that respondent in the bootstrap sample
        multipliers = rec_counts[e_rec_idx]
        # Filter to rows that appear at least once in this bootstrap sample
        mask = multipliers > 0
        # Per-row contributions (weighted by multiplier)
        m_rows = multipliers[mask]
        ck_rows = e_cell_key[mask]
        sw_rows = e_signed_w[mask] * m_rows
        aw_rows = e_abs_w[mask] * m_rows
        
        # Aggregate by cell_key
        # Use pandas groupby on the small subset
        bsub = pd.DataFrame({'ck': ck_rows, 'sw': sw_rows, 'aw': aw_rows})
        agg_b = bsub.groupby('ck', sort=False).agg(sw=('sw', 'sum'), aw=('aw', 'sum'))
        raw_b = np.where(agg_b['aw'] > 0, agg_b['sw'] / agg_b['aw'], np.nan)
        n_b = bsub.groupby('ck', sort=False).size().values
        ck_idx_arr = np.array([cell_key_to_idx[int(k)] for k in agg_b.index if int(k) in cell_key_to_idx])
        # Filter the bootstrap result to only cells we're tracking
        keep = np.array([int(k) in cell_key_to_idx for k in agg_b.index])
        raw_b = raw_b[keep]
        n_b = n_b[keep]
        # Message marginals on this bootstrap sample
        msg_b = bsub.copy()
        msg_b['msg'] = ck_rows // 1000
        mm = msg_b.groupby('msg', sort=False).agg(sw=('sw', 'sum'), aw=('aw', 'sum'))
        mm_dict = {int(m): float(r['sw']/r['aw']) if r['aw'] > 0 else np.nan for m, r in mm.iterrows()}
        # Targets for shrinkage
        msg_for_cells = (np.array([ck for ck in agg_b.index if int(ck) in cell_key_to_idx]) // 1000).astype(int)
        targets_b = np.array([mm_dict.get(int(m), np.nan) for m in msg_for_cells])
        shrunk_b, _ = eb_shrink_vec(raw_b, n_b.astype(float), sigma_w, sigma_b, targets_b)
        # Write
        boot_estimates[b, ck_idx_arr] = shrunk_b
        
        if (b + 1) % 100 == 0:
            print(f"    iter {b+1}/{n_bootstrap}")
    
    # Compute CIs
    cells['ci_low'] = np.nanpercentile(boot_estimates, 2.5, axis=0)
    cells['ci_high'] = np.nanpercentile(boot_estimates, 97.5, axis=0)
    cells = cells.drop(columns=['_dev', 'sum_signed', 'sum_abs', 'residual_sd'])
    
    diag = {
        'sigma_within': sigma_w,
        'sigma_between': sigma_b,
        'n_cells_total': len(cells),
        'n_cells_with_data': int(cells['lift_raw'].notna().sum()),
        'n_bootstrap': n_bootstrap,
    }
    return cells, diag


# ═════════════════════════════════════════════════════════════════════
if __name__ == '__main__':
    import sys, time
    sys.path.insert(0, '/home/claude')
    import pyreadstat
    from prism_index import compute_persuasion_index, compute_residualized_shift
    from prism_step3_exposure import build_exposure_matrix
    
    t0 = time.time()
    print("Loading data...")
    df, meta = pyreadstat.read_sav('/mnt/user-data/uploads/260433.sav')
    df, _ = compute_persuasion_index(df)
    df, _ = compute_residualized_shift(df)
    exposure, _, _ = build_exposure_matrix(
        df, design_path='/mnt/user-data/uploads/Gilead_Design_File.dat'
    )
    print(f"  prep done ({time.time()-t0:.1f}s)\n")
    
    print("=" * 72)
    print("STEP 4: cell-level persuasion lift (vectorized)")
    print("=" * 72)
    t1 = time.time()
    cells, diag = compute_cell_lifts_fast(df, exposure, n_bootstrap=500)
    print(f"\n  step 4 runtime: {time.time()-t1:.1f}s")
    
    cells.to_csv('/home/claude/prism_cells.csv', index=False)
    print(f"\nWrote prism_cells.csv ({len(cells):,} cells)")
    print(f"  cells with valid raw lift: {diag['n_cells_with_data']}/{diag['n_cells_total']}")
    
    print("\n" + "=" * 72)
    print("CELL-LEVEL FINDINGS")
    print("=" * 72)
    
    print("\nMessage marginal lift (engagement-weighted):")
    print(f"  {'Msg':>4s}  {'Marginal':>9s}")
    for m in range(1, 18):
        marg = cells[cells['message']==m]['msg_marginal'].iloc[0]
        marker = '★' if marg > 0.02 else ('!' if marg < -0.02 else ' ')
        print(f"  {m:4d}  {marg:+9.4f}  {marker}")
    
    priority = [11, 12, 13, 16]
    seg_names = {11: 'UCP', 12: 'FJP', 13: 'HCP', 14: 'HAD', 15: 'HCI', 16: 'GHI'}
    arm_names = {1: 'PER', 2: 'COR'}
    
    print("\nOptimal cells across persuadable priority segments (UCP/FJP/HCP/GHI):")
    print(f"  {'Msg':>4s} {'Seg':>4s} {'Arm':>3s} {'Prf':>3s} {'n':>5s} {'Raw':>7s} {'Shrunk':>8s} {'95% CI':>22s} {'wShrink':>8s}")
    for m in range(1, 18):
        sub = cells[(cells['message']==m) & (cells['segment'].isin(priority)) & 
                    cells['lift_shrunk'].notna()]
        if len(sub) == 0:
            continue
        best = sub.loc[sub['lift_shrunk'].idxmax()]
        ci = f"[{best['ci_low']:+.3f},{best['ci_high']:+.3f}]"
        print(f"  {m:4d} {seg_names[int(best['segment'])]:>4s} {arm_names[int(best['arm'])]:>3s} "
              f"{int(best['proof']):3d} {int(best['n']):5d} {best['lift_raw']:+7.3f} "
              f"{best['lift_shrunk']:+8.3f} {ci:>22s} {best['shrink_weight']:>8.3f}")
    
    # Tailoring payoff per priority segment: PERSONA - CORE at the optimal proof
    print("\nTailoring payoff (PERSONA − CORE at each segment's optimal proof per message):")
    print(f"  {'Msg':>4s} ", end='')
    for s in priority:
        print(f"  {seg_names[s]:>6s}", end='')
    print()
    for m in range(1, 18):
        print(f"  {m:4d} ", end='')
        for s in priority:
            persona = cells[(cells['message']==m) & (cells['segment']==s) & (cells['arm']==1) & cells['lift_shrunk'].notna()]
            core    = cells[(cells['message']==m) & (cells['segment']==s) & (cells['arm']==2) & cells['lift_shrunk'].notna()]
            if len(persona) == 0 or len(core) == 0:
                print(f"  {'  n/a':>6s}", end='')
                continue
            p_opt = persona['lift_shrunk'].max()
            c_opt = core['lift_shrunk'].max()
            payoff = p_opt - c_opt
            print(f"  {payoff:+6.3f}", end='')
        print()
    
    print(f"\nTotal runtime: {time.time()-t0:.1f}s")
