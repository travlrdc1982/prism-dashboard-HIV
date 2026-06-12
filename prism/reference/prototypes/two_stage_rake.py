"""
PRISM Two-Stage Weighting
=========================

Stage 1: Demographic weight
    Dem-cluster respondents raked to Dem voter benchmarks
    GOP-cluster respondents raked to GOP voter benchmarks
    Dimensions: sex, age, race, education, region

Stage 2: Segment weight
    All 16 segments raked to PRISM v1.0 canonical population shares

Final WEIGHT column = combined two-stage weight, mean 1.0, sum = N.
"""

import numpy as np
import pandas as pd


# =============================================================================
# RAKE PRIMITIVE
# =============================================================================

def _rake(df, weight_col, dimensions, targets, max_iter=100, tol=1e-7):
    """Iterative proportional fitting on a single dataframe.

    Parameters
    ----------
    df : DataFrame containing weight_col and each dimension column
    weight_col : str, name of weight column (modified in place)
    dimensions : list of column names to rake on
    targets : dict mapping dimension -> {category: target_proportion}
    """
    N = len(df)

    for iteration in range(max_iter):
        max_change = 0.0
        for dim in dimensions:
            for category, target_prop in targets[dim].items():
                mask = df[dim] == category
                current_sum = df.loc[mask, weight_col].sum()
                target_sum = target_prop * N
                if current_sum > 0:
                    factor = target_sum / current_sum
                    df.loc[mask, weight_col] *= factor
                    max_change = max(max_change, abs(factor - 1.0))
        if max_change < tol:
            return iteration + 1
    return max_iter


def _trim_and_renormalize(df, weight_col, low, high):
    """Apply weight caps and renormalize to mean 1.0."""
    df[weight_col] = df[weight_col].clip(lower=low, upper=high)
    N = len(df)
    df[weight_col] = df[weight_col] * N / df[weight_col].sum()


# =============================================================================
# STAGE 1: DEMOGRAPHIC WEIGHT (per cluster)
# =============================================================================

def stage_1_demographic(df, config, dem_benchmark, gop_benchmark):
    """Rake demographics within each cluster against cluster-appropriate benchmark.

    Returns: weight column 'W1' added to df.
    """
    df['W1'] = 1.0

    dem_mask = df['_cluster'] == 'DEM'
    gop_mask = df['_cluster'] == 'GOP'

    dem_df = df.loc[dem_mask].copy()
    gop_df = df.loc[gop_mask].copy()

    dem_iter = _rake(dem_df, 'W1', config['rake_dimensions'], dem_benchmark.targets)
    gop_iter = _rake(gop_df, 'W1', config['rake_dimensions'], gop_benchmark.targets)

    # Trim within each cluster, then renormalize so each cluster's weights average 1.0
    _trim_and_renormalize(dem_df, 'W1', config['trim_low'], config['trim_high'])
    _trim_and_renormalize(gop_df, 'W1', config['trim_low'], config['trim_high'])

    # Write back to combined df
    df.loc[dem_mask, 'W1'] = dem_df['W1'].values
    df.loc[gop_mask, 'W1'] = gop_df['W1'].values

    return {
        'dem_iterations': dem_iter,
        'gop_iterations': gop_iter,
        'dem_n': dem_mask.sum(),
        'gop_n': gop_mask.sum(),
    }


# =============================================================================
# STAGE 2: SEGMENT WEIGHT
# =============================================================================

def stage_2_segment(df, config, segment_benchmark):
    """Rake segment shares to PRISM canonical, starting from Stage 1 weights."""
    df['W2'] = df['W1'].copy()

    seg_targets = {'_segment_code': {
        code: segment_benchmark.pop_share(code)
        for code in segment_benchmark.codes()
    }}

    iterations = _rake(df, 'W2', ['_segment_code'], seg_targets)
    _trim_and_renormalize(df, 'W2', config['trim_low'], config['trim_high'])

    return {'iterations': iterations}


# =============================================================================
# DIAGNOSTICS
# =============================================================================

def diagnostics(df, weight_col, label):
    """Compute weight diagnostics."""
    w = df[weight_col]
    N = len(df)
    mean_w = w.mean()
    cv2 = (w.var(ddof=0) / (mean_w ** 2))
    deff = 1 + cv2
    neff = N / deff
    return {
        'label': label,
        'N': N,
        'sum': w.sum(),
        'mean': mean_w,
        'min': w.min(),
        'max': w.max(),
        'deff': deff,
        'neff': neff,
        'efficiency': neff / N,
    }


def target_recovery(df, weight_col, dimensions, targets, label):
    """Show target recovery per dimension after weighting."""
    print(f"\n{label}")
    print("-" * 60)
    for dim in dimensions:
        print(f"  {dim}:")
        for cat, tgt in targets[dim].items():
            mask = df[dim] == cat
            achieved = df.loc[mask, weight_col].sum() / df[weight_col].sum()
            print(f"    {cat:<14} target {tgt*100:>5.1f}%  achieved {achieved*100:>5.1f}%  gap {(achieved-tgt)*100:+.2f}pp")


# =============================================================================
# MAIN ORCHESTRATOR
# =============================================================================

def apply_two_stage_weighting(df, study_config):
    """Run full two-stage weighting pipeline.

    Parameters
    ----------
    df : DataFrame with PRISM composite columns
    study_config : dict with rake setup, variable mapping, benchmarks

    Returns
    -------
    df with WEIGHT column added (and intermediate W1, W2 for diagnostics)
    """
    cfg = study_config['weighting']

    # Resolve benchmarks
    seg_bench = study_config['segment_benchmark']
    dem_bench = study_config['dem_voter_benchmark']
    gop_bench = study_config['gop_voter_benchmark']

    # Apply recodes to create rake-friendly category labels
    print("Recoding rake variables...")
    for dim, mapping in cfg['variable_mapping'].items():
        src = mapping['var']
        recode = mapping['recode']
        df[dim] = df[src].map(recode)
        n_unmapped = df[dim].isna().sum() - df[src].isna().sum()
        if n_unmapped > 0:
            print(f"  WARNING: {dim} has {n_unmapped} unmapped values, imputing to mode")
            df[dim] = df[dim].fillna(df[dim].mode().iloc[0])

    # Map segment codes
    if isinstance(df['XSEG_ASSIGNED'].dtype, pd.CategoricalDtype) or df['XSEG_ASSIGNED'].dtype.kind == 'O':
        df['_segment_code'] = df['XSEG_ASSIGNED']
    else:
        # Numeric segment IDs need mapping to codes
        df['_segment_code'] = df['XSEG_ASSIGNED'].map(cfg['segment_id_to_code'])

    # Map cluster
    df['_cluster'] = df['_segment_code'].map(lambda c: seg_bench.cluster(c) if pd.notna(c) else None)
    n_no_cluster = df['_cluster'].isna().sum()
    if n_no_cluster > 0:
        print(f"  WARNING: {n_no_cluster} respondents have no cluster assignment")

    # ---- Stage 1 ----
    print("\nStage 1: Demographic rake within clusters...")
    s1 = stage_1_demographic(df, cfg, dem_bench, gop_bench)
    print(f"  DEM cluster (n={s1['dem_n']}): {s1['dem_iterations']} iterations")
    print(f"  GOP cluster (n={s1['gop_n']}): {s1['gop_iterations']} iterations")

    # ---- Stage 2 ----
    print("\nStage 2: Segment-share rake...")
    s2 = stage_2_segment(df, cfg, seg_bench)
    print(f"  Converged in {s2['iterations']} iterations")

    # Final WEIGHT
    df['WEIGHT'] = df['W2']

    return df


# =============================================================================
# HIV WAVE 1 STUDY CONFIG
# =============================================================================

HIV_WAVE1_CONFIG = {
    'study_id': 'hiv_wave1',
    'platform_version': '1.0',

    'weighting': {
        'rake_dimensions': ['sex', 'age', 'race', 'education', 'region'],

        'variable_mapping': {
            'sex': {
                'var': 'QGENDER',
                'recode': {1: 'Male', 2: 'Female', 3: 'Female'},   # Other → Female by convention
            },
            'age': {
                'var': 'QAGECAT5',
                'recode': {1: '18-29', 2: '30-44', 3: '45-64', 4: '45-64', 5: '65+'},
            },
            'race': {
                'var': 'QRACE_ETHNIC',
                'recode': {1: 'White', 2: 'Black', 3: 'Other', 4: 'Other', 5: 'Hispanic'},
            },
            'education': {
                'var': 'XEDU_CAT',
                'recode': {1: 'Non-College', 2: 'Non-College', 3: 'Non-College',
                           4: 'College', 5: 'College'},
            },
            'region': {
                'var': 'XQREGION',
                'recode': {1: 'Northeast', 2: 'Midwest', 3: 'South', 4: 'West'},
            },
        },

        # Map numeric segment IDs to canonical codes (if XSEG_ASSIGNED is numeric)
        'segment_id_to_code': {
            1: 'TSP',  2: 'CEC',  3: 'TC',   4: 'HF',   5: 'PP',
            6: 'WE',   7: 'PFF',  8: 'HHN',  9: 'MFL', 10: 'VS',
            11: 'UCP', 12: 'FJP', 13: 'HCP', 14: 'HAD', 15: 'HCI', 16: 'GHI',
        },

        'trim_low':  0.25,
        'trim_high': 5.0,
    },
}
