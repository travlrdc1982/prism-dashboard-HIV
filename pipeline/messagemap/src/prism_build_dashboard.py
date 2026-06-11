"""
PRISM dashboard.json builder — integrated pipeline.

Runs the full sequence end-to-end:
  1. Load .sav, compute persuasion index + residualized shift
  2. Build exposure matrix from design file + randomizations
  3. Compute cells under both outcomes:
       - persuasion_messaging  (outcome = residual_shift, already zero-centered)
       - base_messaging        (outcome = pre_composite, centered by segment mean)
  4. Compute topline metrics: SoP + Utility per (msg × seg)
  5. Compute simple SoP plot data with 5 baskets
  6. Load variants.json
  7. Assemble dashboard.json
"""
import sys, os, json, time
from pathlib import Path

# Module imports resolve via the standard sibling-file pattern; no need
# to monkey with sys.path beyond making the src/ directory importable.
_SRC_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_SRC_DIR))

# Path resolution. All inputs and the output directory accept env-var
# overrides; defaults assume the standard repo layout
# (pipeline/messagemap/data, pipeline/messagemap/outputs, repo-root data/).
_MESSAGEMAP_DIR = _SRC_DIR.parent          # pipeline/messagemap
_REPO = _MESSAGEMAP_DIR.parent.parent      # repo root (two up: pipeline/, repo)

DEFAULT_SAV           = os.environ.get('PRISM_SAV',           str(_REPO / 'data' / '260433.sav'))
DEFAULT_DESIGN        = os.environ.get('PRISM_DESIGN',        str(_MESSAGEMAP_DIR / 'data' / 'Gilead_Design_File.dat'))
DEFAULT_VARIANTS_JSON = os.environ.get('PRISM_VARIANTS_JSON', str(_MESSAGEMAP_DIR / 'outputs' / 'prism_variants.json'))
DEFAULT_OUT_DIR       = os.environ.get('PRISM_MM_OUT',        str(_MESSAGEMAP_DIR / 'outputs'))

import numpy as np
import pandas as pd
import pyreadstat

from prism_index import compute_persuasion_index, compute_residualized_shift
from prism_step3_exposure import build_exposure_matrix
from prism_step4_lift_v2 import compute_cell_lifts_fast, cell_weighted_shifts, msg_marginals, eb_shrink_vec


# ═════════════════════════════════════════════════════════════════════
# STUDY CONFIG
# ═════════════════════════════════════════════════════════════════════

SEGMENTS = {
    1:  {'code': 'TSP', 'label': 'Trust-the-Science Pragmatists',  'party': 'R', 'priority_tier': None},
    2:  {'code': 'CEC', 'label': 'Consumer Empowerment Champions', 'party': 'R', 'priority_tier': None},
    3:  {'code': 'TC',  'label': 'Traditional Conservatives',      'party': 'R', 'priority_tier': None},
    4:  {'code': 'HF',  'label': 'Health Futurists',               'party': 'R', 'priority_tier': None},
    5:  {'code': 'PP',  'label': 'Price Populists',                'party': 'R', 'priority_tier': None},
    6:  {'code': 'WE',  'label': 'Wellness Evangelists',           'party': 'R', 'priority_tier': None},
    7:  {'code': 'PFF', 'label': 'Paleo Freedom Fighters',         'party': 'R', 'priority_tier': None},
    8:  {'code': 'HHN', 'label': 'Holistic Health Naturalists',    'party': 'R', 'priority_tier': 2},
    9:  {'code': 'MFL', 'label': 'Medical Freedom Libertarians',   'party': 'R', 'priority_tier': None},
    10: {'code': 'VS',  'label': 'Vaccine Skeptics',               'party': 'R', 'priority_tier': None},
    11: {'code': 'UCP', 'label': 'Universal Care Progressives',    'party': 'D', 'priority_tier': 1},
    12: {'code': 'FJP', 'label': 'Faith and Justice Progressives', 'party': 'D', 'priority_tier': 1},
    13: {'code': 'HCP', 'label': 'Health Care Protectionists',    'party': 'D', 'priority_tier': 1},
    14: {'code': 'HAD', 'label': 'Health Abundance Democrats',     'party': 'D', 'priority_tier': 2},
    15: {'code': 'HCI', 'label': 'Health Care Incrementalists',    'party': 'D', 'priority_tier': 2},
    16: {'code': 'GHI', 'label': 'Global Health Institutionalists','party': 'D', 'priority_tier': 1},
}

BASKETS = [
    {'id': 'total',        'name': 'Total Sample',     'segments': list(range(1, 17)), 'weight': 'equal'},
    {'id': 'priority_d',   'name': 'D-side Persuadables','segments': [11, 12, 13, 16],  'weight': 'equal'},
    {'id': 'priority_all', 'name': 'Full Priority Basket', 'segments': [8, 11, 12, 13, 14, 15, 16], 'weight': 'equal'},
    {'id': 'gop',          'name': 'GOP Segments',     'segments': [1,2,3,4,5,6,7,8,9,10], 'weight': 'equal'},
    {'id': 'dem',          'name': 'DEM Segments',     'segments': [11, 12, 13, 14, 15, 16], 'weight': 'equal'},
]


# ═════════════════════════════════════════════════════════════════════
# Outcome construction wrappers
# ═════════════════════════════════════════════════════════════════════

def construct_outcome(df, variant_name, seg_col='XSEG_ASSIGNED'):
    """Prepare the outcome column for a given lift variant."""
    if variant_name == 'persuasion_messaging':
        # residual_shift is already mean-zero by construction (step 2)
        return df, 'residual_shift'
    elif variant_name == 'base_messaging':
        # Center pre_composite by segment mean
        df = df.copy()
        seg_means = df.groupby(seg_col)['pre_composite'].transform('mean')
        df['pre_composite_centered'] = df['pre_composite'] - seg_means
        return df, 'pre_composite_centered'
    else:
        raise ValueError(f"Unknown variant: {variant_name}")


def compute_cells_for_outcome(df, exposure, outcome_col, n_bootstrap=500, rng_seed=42):
    """Run the cell estimator with an arbitrary outcome column."""
    rng = np.random.default_rng(rng_seed)
    resp = df[[outcome_col, 'XSEG_ASSIGNED', 'HIV_RANDOM']].copy()
    resp['record_id'] = resp.index
    resp = resp.rename(columns={'XSEG_ASSIGNED': 'segment', 'HIV_RANDOM': 'arm', outcome_col: '_outcome'})

    e = exposure[['record_id', 'item', 'bw_score', 'proof_variant']].copy()
    e = e.merge(resp[['record_id', '_outcome', 'segment', 'arm']], on='record_id')
    e = e.dropna(subset=['_outcome', 'segment', 'arm', 'bw_score'])
    e['segment'] = e['segment'].astype(int)
    e['arm'] = e['arm'].astype(int)
    e['proof_variant'] = e['proof_variant'].astype(int)
    e['signed_w'] = e['_outcome'] * e['bw_score']
    e['abs_w'] = np.abs(e['bw_score'])

    # Reuse cell_weighted_shifts via column rename
    e_for_helper = e.rename(columns={'_outcome': 'residual_shift'})
    cells = cell_weighted_shifts(e_for_helper)
    marg = msg_marginals(e_for_helper)
    cells['msg_marginal'] = cells['message'].map(marg)

    sigma_w = float(cells['residual_sd'].mean())
    cells['_dev'] = cells['lift_raw'] - cells['msg_marginal']
    sigma_b = float(cells['_dev'].std(ddof=1))

    shrunk, w = eb_shrink_vec(
        cells['lift_raw'].values, cells['n'].values.astype(float),
        sigma_w, sigma_b, cells['msg_marginal'].values
    )
    cells['lift_shrunk'] = shrunk
    cells['shrink_weight'] = w

    # Bootstrap
    unique_recs = e['record_id'].unique()
    n_recs = len(unique_recs)
    rec_to_idx = {r: i for i, r in enumerate(unique_recs)}
    e['rec_idx'] = e['record_id'].map(rec_to_idx).astype(np.int32)
    e['cell_key'] = (
        e['item'].astype(int) * 1000
        + e['segment'].astype(int) * 50
        + e['proof_variant'].astype(int) * 10
        + e['arm'].astype(int)
    )
    cell_keys = cells['message']*1000 + cells['segment']*50 + cells['proof']*10 + cells['arm']
    cell_key_to_idx = {int(k): i for i, k in enumerate(cell_keys)}
    n_cells = len(cells)
    boot = np.full((n_bootstrap, n_cells), np.nan, dtype=np.float32)

    e_rec_idx  = e['rec_idx'].values
    e_cell_key = e['cell_key'].values
    e_signed_w = e['signed_w'].values
    e_abs_w    = e['abs_w'].values

    for b in range(n_bootstrap):
        sample_idx = rng.integers(0, n_recs, size=n_recs)
        rec_counts = np.bincount(sample_idx, minlength=n_recs)
        multipliers = rec_counts[e_rec_idx]
        mask = multipliers > 0
        m_rows = multipliers[mask]
        ck_rows = e_cell_key[mask]
        sw_rows = e_signed_w[mask] * m_rows
        aw_rows = e_abs_w[mask] * m_rows
        bsub = pd.DataFrame({'ck': ck_rows, 'sw': sw_rows, 'aw': aw_rows})
        agg_b = bsub.groupby('ck', sort=False).agg(sw=('sw','sum'), aw=('aw','sum'))
        raw_b = np.where(agg_b['aw'] > 0, agg_b['sw'] / agg_b['aw'], np.nan)
        n_b = bsub.groupby('ck', sort=False).size().values
        keep = np.array([int(k) in cell_key_to_idx for k in agg_b.index])
        raw_b = raw_b[keep]; n_b = n_b[keep]
        msg_b = bsub.copy()
        msg_b['msg'] = ck_rows // 1000
        mm = msg_b.groupby('msg', sort=False).agg(sw=('sw','sum'), aw=('aw','sum'))
        mm_dict = {int(m): float(r['sw']/r['aw']) if r['aw']>0 else np.nan for m, r in mm.iterrows()}
        msg_for_cells = (np.array([ck for ck in agg_b.index if int(ck) in cell_key_to_idx]) // 1000).astype(int)
        targets_b = np.array([mm_dict.get(int(m), np.nan) for m in msg_for_cells])
        shrunk_b, _ = eb_shrink_vec(raw_b, n_b.astype(float), sigma_w, sigma_b, targets_b)
        ck_idx_arr = np.array([cell_key_to_idx[int(k)] for k in agg_b.index if int(k) in cell_key_to_idx])
        boot[b, ck_idx_arr] = shrunk_b

    cells['ci_low']  = np.nanpercentile(boot, 2.5, axis=0)
    cells['ci_high'] = np.nanpercentile(boot, 97.5, axis=0)
    cells = cells.drop(columns=['_dev', 'sum_signed', 'sum_abs', 'residual_sd'])
    return cells, {'sigma_within': sigma_w, 'sigma_between': sigma_b}


# ═════════════════════════════════════════════════════════════════════
# Topline: SoP + Utility per (message × segment)
# ═════════════════════════════════════════════════════════════════════

def compute_topline(exposure, df, n_bootstrap=300, rng_seed=42):
    """
    For each (segment × message):
      bw_norm_i = bw_score_i / n_shown_i  per respondent
      mean_bw_seg_msg = weighted mean across respondents in segment
      Utility = 0..100 rescale of mean_bw within segment (min→0, max→100)
      SoP = softmax of mean_bw within segment (sums to 100% across 17 msgs)
    """
    rng = np.random.default_rng(rng_seed)
    e = exposure.copy()
    e['bw_norm'] = e['bw_score'] / e['n_shown'].clip(lower=1)
    e['segment'] = e['segment'].astype(int)

    # Point estimate: aggregate by (segment, message)
    by_seg_msg = e.groupby(['segment', 'item'])['bw_norm'].agg(['mean', 'size']).reset_index()
    by_seg_msg = by_seg_msg.rename(columns={'mean': 'mean_bw', 'size': 'n'})

    # Utility (0-100 rescale within segment)
    by_seg_msg['utility'] = np.nan
    by_seg_msg['sop_pct'] = np.nan
    for seg, grp in by_seg_msg.groupby('segment'):
        mn, mx = grp['mean_bw'].min(), grp['mean_bw'].max()
        if mx > mn:
            by_seg_msg.loc[grp.index, 'utility'] = 100 * (grp['mean_bw'] - mn) / (mx - mn)
        else:
            by_seg_msg.loc[grp.index, 'utility'] = 50
        exp_bw = np.exp(grp['mean_bw'])
        by_seg_msg.loc[grp.index, 'sop_pct'] = 100 * exp_bw / exp_bw.sum()

    # Bootstrap CIs on sop_pct
    print(f"  Bootstrapping {n_bootstrap} iter for topline SoP CIs...")
    unique_recs = e['record_id'].unique()
    n_recs = len(unique_recs)
    rec_to_idx = {r: i for i, r in enumerate(unique_recs)}
    e['rec_idx'] = e['record_id'].map(rec_to_idx).astype(np.int32)

    # Pre-extract arrays
    e_rec_idx = e['rec_idx'].values
    e_seg     = e['segment'].values
    e_item    = e['item'].values.astype(int)
    e_bw_norm = e['bw_norm'].values

    n_msgs = 17
    n_segs = 16
    boot_sop = np.full((n_bootstrap, n_segs+1, n_msgs+1), np.nan, dtype=np.float32)

    for b in range(n_bootstrap):
        sample_idx = rng.integers(0, n_recs, size=n_recs)
        rec_counts = np.bincount(sample_idx, minlength=n_recs)
        mult = rec_counts[e_rec_idx]
        mask = mult > 0
        seg_b = e_seg[mask]
        item_b = e_item[mask]
        bw_b = e_bw_norm[mask] * mult[mask]
        cnt_b = mult[mask].astype(float)
        # Aggregate: mean bw per (seg, item) where mean = sum(bw*mult)/sum(mult)
        df_b = pd.DataFrame({'seg': seg_b, 'item': item_b, 'sw': bw_b, 'cnt': cnt_b})
        agg = df_b.groupby(['seg', 'item']).agg(sw=('sw','sum'), cnt=('cnt','sum')).reset_index()
        agg['mean_bw'] = agg['sw'] / agg['cnt']
        for seg in agg['seg'].unique():
            grp = agg[agg['seg']==seg]
            exp_bw = np.exp(grp['mean_bw'])
            sop = 100 * exp_bw / exp_bw.sum()
            for _, row in grp.iterrows():
                boot_sop[b, int(seg), int(row['item'])] = sop[row.name] if row.name in sop.index else np.nan

    by_seg_msg['sop_ci_low']  = np.nan
    by_seg_msg['sop_ci_high'] = np.nan
    for i, r in by_seg_msg.iterrows():
        boots = boot_sop[:, int(r['segment']), int(r['item'])]
        boots = boots[~np.isnan(boots)]
        if len(boots) >= 30:
            by_seg_msg.at[i, 'sop_ci_low']  = np.percentile(boots, 2.5)
            by_seg_msg.at[i, 'sop_ci_high'] = np.percentile(boots, 97.5)

    return by_seg_msg


def compute_simple_sop(exposure, baskets):
    """Simple SoP for the bar-chart view: sample-aggregated or basket-aggregated per message."""
    e = exposure.copy()
    e['bw_norm'] = e['bw_score'] / e['n_shown'].clip(lower=1)
    e['segment'] = e['segment'].astype(int)

    out = {}
    for basket in baskets:
        segs = basket['segments']
        sub = e[e['segment'].isin(segs)]
        if len(sub) == 0:
            continue
        per_msg = sub.groupby('item')['bw_norm'].mean()
        exp_bw = np.exp(per_msg)
        sop = 100 * exp_bw / exp_bw.sum()
        ranks = sop.rank(ascending=False).astype(int)
        msgs = []
        for m in range(1, 18):
            msgs.append({
                'message': m,
                'sop_pct': float(sop.get(m, 0)),
                'mean_bw': float(per_msg.get(m, 0)),
                'rank':    int(ranks.get(m, 17)),
                'n':       int((sub['item']==m).sum()),
            })
        out[basket['id']] = {
            'name': basket['name'],
            'segments': segs,
            'messages': msgs,
        }
    return out


# ═════════════════════════════════════════════════════════════════════
# JSON assembly
# ═════════════════════════════════════════════════════════════════════

def cells_to_records(cells_df):
    """Convert cell dataframe to list of dicts for JSON output."""
    out = []
    for _, r in cells_df.iterrows():
        out.append({
            'message': int(r['message']),
            'segment': int(r['segment']),
            'arm': int(r['arm']),
            'proof': int(r['proof']),
            'n': int(r['n']),
            'lift_raw': round(float(r['lift_raw']), 4) if pd.notna(r['lift_raw']) else None,
            'lift_shrunk': round(float(r['lift_shrunk']), 4) if pd.notna(r['lift_shrunk']) else None,
            'ci_low':  round(float(r['ci_low']),  4) if pd.notna(r['ci_low']) else None,
            'ci_high': round(float(r['ci_high']), 4) if pd.notna(r['ci_high']) else None,
            'shrink_weight': round(float(r['shrink_weight']), 3) if pd.notna(r['shrink_weight']) else None,
            'msg_marginal': round(float(r['msg_marginal']), 4) if pd.notna(r['msg_marginal']) else None,
        })
    return out


def topline_to_structure(topline_df, segments):
    """Convert topline dataframe to nested structure."""
    code_by_seg = {sid: meta['code'] for sid, meta in segments.items()}
    out = []
    for m in range(1, 18):
        msub = topline_df[topline_df['item']==m]
        by_segment = {}
        for _, r in msub.iterrows():
            sid = int(r['segment'])
            by_segment[code_by_seg[sid]] = {
                'n': int(r['n']),
                'bw_mean':  round(float(r['mean_bw']), 4),
                'utility':  round(float(r['utility']), 1),
                'sop_pct':  round(float(r['sop_pct']), 2),
                'sop_ci_low':  round(float(r['sop_ci_low']),  2) if pd.notna(r['sop_ci_low']) else None,
                'sop_ci_high': round(float(r['sop_ci_high']), 2) if pd.notna(r['sop_ci_high']) else None,
            }
        out.append({'message': m, 'by_segment': by_segment})
    return out


# ═════════════════════════════════════════════════════════════════════
# Main
# ═════════════════════════════════════════════════════════════════════

def main():
    t_total = time.time()
    print("=" * 72)
    print("PRISM HIV 2026 — full pipeline run")
    print("=" * 72)

    # ── Steps 1-3 ─────────────────────────────────────────────────────
    print("\n[1] Loading .sav and computing index + residualized shift...")
    t = time.time()
    df, _ = pyreadstat.read_sav(DEFAULT_SAV)
    df, diag_idx = compute_persuasion_index(df)
    df, diag_res = compute_residualized_shift(df)
    print(f"    n={len(df)}, alpha_pre={diag_idx['cronbach_alpha_pre']:.3f}, "
          f"alpha_post={diag_idx['cronbach_alpha_post']:.3f}, R²={diag_res['r_squared']:.3f} "
          f"({time.time()-t:.1f}s)")

    print("\n[2] Building exposure matrix...")
    t = time.time()
    exposure, tasks, diag_exp = build_exposure_matrix(
        df, design_path=DEFAULT_DESIGN
    )
    print(f"    {diag_exp['total_exposure_rows']:,} exposure records ({time.time()-t:.1f}s)")

    # ── Step 4 (twice, once per outcome) ──────────────────────────────
    print("\n[3] Computing cells: persuasion_messaging (outcome = residual_shift)...")
    t = time.time()
    df, outcome_col_p = construct_outcome(df, 'persuasion_messaging')
    cells_persuasion, diag_p = compute_cells_for_outcome(df, exposure, outcome_col_p, n_bootstrap=500)
    print(f"    {len(cells_persuasion)} cells, σ_within={diag_p['sigma_within']:.3f}, "
          f"σ_between={diag_p['sigma_between']:.3f} ({time.time()-t:.1f}s)")

    print("\n[4] Computing cells: base_messaging (outcome = pre_composite, centered by segment)...")
    t = time.time()
    df, outcome_col_b = construct_outcome(df, 'base_messaging')
    cells_base, diag_b = compute_cells_for_outcome(df, exposure, outcome_col_b, n_bootstrap=500)
    print(f"    {len(cells_base)} cells, σ_within={diag_b['sigma_within']:.3f}, "
          f"σ_between={diag_b['sigma_between']:.3f} ({time.time()-t:.1f}s)")

    # ── Topline ───────────────────────────────────────────────────────
    print("\n[5] Computing topline (SoP + Utility per segment × message)...")
    t = time.time()
    topline = compute_topline(exposure, df, n_bootstrap=300)
    print(f"    {len(topline)} (seg × msg) topline rows ({time.time()-t:.1f}s)")

    print("\n[6] Computing simple SoP plot data (5 baskets)...")
    t = time.time()
    simple_sop = compute_simple_sop(exposure, BASKETS)
    print(f"    {len(simple_sop)} baskets × 17 messages ({time.time()-t:.1f}s)")

    # ── Load variants ─────────────────────────────────────────────────
    print("\n[7] Loading variants JSON...")
    with open(DEFAULT_VARIANTS_JSON, 'r') as f:
        variants_data = json.load(f)
    print(f"    {variants_data['n_messages']} messages × {len(variants_data['segment_codes'])} segments")

    # ── Compose segment metadata with sample sizes ────────────────────
    seg_n = df['XSEG_ASSIGNED'].value_counts().to_dict()
    segments_out = []
    for sid in range(1, 17):
        meta = SEGMENTS[sid]
        segments_out.append({
            'id': sid, 'code': meta['code'], 'label': meta['label'],
            'party': meta['party'], 'priority_tier': meta['priority_tier'],
            'n': int(seg_n.get(sid, 0)),
        })

    # ── Compose messages metadata ─────────────────────────────────────
    # Translate the parser's canonical schema (msg_id="MSG_001", tokens=[...
    # {token, is_base, proof_short_label, proof_full_text}]) into the
    # dashboard.json messages schema (id=int, proofs=[{proof_id, short_label,
    # full_label}]). Base tokens get the conventional 'base' / 'base (no
    # proof)' labels; proof tokens use the workbook-derived labels verbatim.
    def _msg_id_to_int(msg_id_str):
        # 'MSG_001' -> 1; falls back to None on malformed input
        try:
            return int(str(msg_id_str).rsplit('_', 1)[-1])
        except (ValueError, AttributeError):
            return None

    messages_out = []
    for m in variants_data['messages']:
        proofs = []
        for t in m.get('tokens', []):
            is_base = bool(t.get('is_base'))
            proofs.append({
                'proof_id': int(t['token']),
                'short_label': 'base' if is_base else (t.get('proof_short_label') or ''),
                'full_label':  'base (no proof)' if is_base else (t.get('proof_full_text') or ''),
            })
        messages_out.append({
            'id': _msg_id_to_int(m['msg_id']),
            'theme_label': m.get('theme_label', ''),
            'n_proofs': m.get('n_tokens', len(proofs)),   # inclusive count (base + proofs)
            'proofs': proofs,
        })

    # ── Assemble ──────────────────────────────────────────────────────
    print("\n[8] Assembling dashboard.json...")
    dashboard = {
        'study': {
            'id': 'PRISM_HIV_2026',
            'title': 'PRISM HIV Treatment & Prevention',
            'client': 'Gilead',
            'analyst': 'Bryan Dumont',
            'n_total': len(df),
            'index': {
                'n_items': diag_idx['n_items'],
                'alpha_pre':  round(diag_idx['cronbach_alpha_pre'], 3),
                'alpha_post': round(diag_idx['cronbach_alpha_post'], 3),
                'composite_shift_mean': round(diag_idx['composite_shift_mean'], 3),
                'scale_range': diag_idx['scale_range'],
            },
            'residualization': {
                'r_squared': round(diag_res['r_squared'], 3),
                'beta_pre':  round(diag_res['beta_pre'], 3),
            },
        },
        'segments': segments_out,
        'messages': messages_out,
        'baskets': [{
            'id': b['id'], 'name': b['name'],
            'segments': b['segments'], 'weight': b['weight']
        } for b in BASKETS],
        'lift_variants': [
            {'name': 'persuasion_messaging', 'label': 'PERSUASION MESSAGING',
             'description': 'How much engagement with this variant moves attitudinal alignment above baseline',
             'sigma_within':  round(diag_p['sigma_within'], 4),
             'sigma_between': round(diag_p['sigma_between'], 4),
             'color_scale': {'min': -0.30, 'max': 0.30, 'neutral': 0}},
            {'name': 'base_messaging', 'label': 'BASE MESSAGING',
             'description': 'How much more aligned message-engagers are than their segment baseline — high cells = your supporters love this variant',
             'sigma_within':  round(diag_b['sigma_within'], 4),
             'sigma_between': round(diag_b['sigma_between'], 4),
             'color_scale': {'min': -0.30, 'max': 0.30, 'neutral': 0}},
        ],
        'message_map_cells': {
            'persuasion_messaging': cells_to_records(cells_persuasion),
            'base_messaging':       cells_to_records(cells_base),
        },
        'message_topline': topline_to_structure(topline, SEGMENTS),
        'sop_simple': simple_sop,
        'variants': {
            'segment_codes': variants_data['segment_codes'],
            'messages': variants_data['messages'],  # full text per (msg, proof, segment)
        },
    }

    out_path = str(Path(DEFAULT_OUT_DIR) / 'dashboard.json')
    os.makedirs(DEFAULT_OUT_DIR, exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(dashboard, f, indent=2, ensure_ascii=False)
    size_kb = os.path.getsize(out_path) / 1024
    print(f"    Wrote {out_path} ({size_kb:.0f} KB)")

    print(f"\n[Total pipeline runtime: {time.time()-t_total:.1f}s]")
    return dashboard


if __name__ == '__main__':
    dashboard = main()

    # ── Print summary of what's in the dashboard.json ─────────────────
    print("\n" + "=" * 72)
    print("DASHBOARD.JSON SUMMARY")
    print("=" * 72)
    print(f"\nStudy: {dashboard['study']['title']}")
    print(f"  n = {dashboard['study']['n_total']}")
    print(f"  Index alpha: pre={dashboard['study']['index']['alpha_pre']}, post={dashboard['study']['index']['alpha_post']}")
    print(f"\nSegments: {len(dashboard['segments'])}")
    print(f"Messages: {len(dashboard['messages'])}")
    print(f"Baskets: {len(dashboard['baskets'])}")
    print(f"\nLift variants:")
    for lv in dashboard['lift_variants']:
        n_cells = len(dashboard['message_map_cells'][lv['name']])
        print(f"  • {lv['label']}: {n_cells} cells, σ_w={lv['sigma_within']}, σ_b={lv['sigma_between']}")
    print(f"\nMessage topline: {len(dashboard['message_topline'])} messages")
    print(f"SoP simple plot: {len(dashboard['sop_simple'])} baskets")
    print(f"\nFile sections: {list(dashboard.keys())}")
