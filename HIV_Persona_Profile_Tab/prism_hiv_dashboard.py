"""
PRISM HIV Wave 1 — Dashboard Data Pipeline (standalone Python)

Reads raw .sav, computes composites, RAKES weights via IPF using targets
from PRISM_WEIGHTING.xlsx, applies weights to all dashboard aggregations,
and emits six JSON files for the v5 dashboard.

Inputs:
    sys.argv[1] — input .sav path        (default: ./260433.sav)
    sys.argv[2] — output directory       (default: ./dashboard_data)

Outputs (in OUTPUT_DIR):
    manifest.json   pipeline metadata, flags, effective n
    zparams.json    full-sample standardization constants
    seg_data.json   per-segment composites, z-scores, ranks
    bench.json      All / Republicans / Democrats benchmark group means
    items.json      item-level data for the four dashboard tile accordions
    trust.json      trust battery, 22 deployable messengers
    weights.csv     case-level weights (merge back into .sav if needed)
"""

import sys, os, json, datetime
import pandas as pd
import numpy as np
import pyreadstat

INPUT_FILE = sys.argv[1] if len(sys.argv) > 1 else '/mnt/user-data/uploads/260433.sav'
OUTPUT_DIR = sys.argv[2] if len(sys.argv) > 2 else '/home/claude/dashboard_data'
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ─── Configuration ────────────────────────────────────────────────────
SEG_NAMES = {
    1:'TSP', 2:'CEC', 3:'TC', 4:'HF', 5:'PP', 6:'WE', 7:'PFF', 8:'HHN',
    9:'MFL', 10:'VS',
    11:'UCP', 12:'FJP', 13:'HCP', 14:'HAD', 15:'HCI', 16:'GHI'
}
GOP_SEGS = list(range(1, 11))
DEM_SEGS = list(range(11, 17))
FOCAL    = 12
CONSTRUCTS = ['MBS','SDS','EDS','SCS','CFS','PFS','SCF']

# ─── Rake targets (from PRISM_WEIGHTING.xlsx) ────────────────────────
# Segment population shares (16 cells)
SEG_TARGETS = {
    1:  0.024046, 2:  0.064878, 3:  0.056711, 4:  0.022685,
    5:  0.024499, 6:  0.091192, 7:  0.042647, 8:  0.026768,
    9:  0.050360, 10: 0.049906,
    11: 0.109262, 12: 0.102160, 13: 0.078122, 14: 0.083585,
    15: 0.070474, 16: 0.102706,
}

# Within-party demographic shares (Party: 1=GOP, 2=DEM)
WITHIN_PARTY = {
    'SEX_RAKE': {  # 1=Male, 2=Female; QGENDER=3 excluded from this dimension
        (1, 1): 0.55, (2, 1): 0.45,
        (1, 2): 0.40, (2, 2): 0.60,
    },
    'AGE4': {       # 1=18-29, 2=30-44, 3=45-64, 4=65+
        (1, 1): 0.10, (2, 1): 0.19, (3, 1): 0.40, (4, 1): 0.31,
        (1, 2): 0.17, (2, 2): 0.22, (3, 2): 0.36, (4, 2): 0.25,
    },
    'RACE4': {      # 1=White NH, 2=Black NH, 4=Other NH (incl. Asian), 5=Hispanic
        (1, 1): 0.87, (2, 1): 0.02, (4, 1): 0.04, (5, 1): 0.07,
        (1, 2): 0.61, (2, 2): 0.21, (4, 2): 0.06, (5, 2): 0.12,
    },
    'EDUC2': {      # 1=College (Bachelor's+), 2=Non-College
        (1, 1): 0.45, (2, 1): 0.55,
        (1, 2): 0.54, (2, 2): 0.46,   # DEM target sums to 0.99 in workbook; nudge to 1.00
    },
    'REGION': {     # 1=NE, 2=MW, 3=South, 4=West
        (1, 1): 0.1091, (2, 1): 0.2016, (3, 1): 0.4393, (4, 1): 0.2499,
        (1, 2): 0.1766, (2, 2): 0.1710, (3, 2): 0.3332, (4, 2): 0.3193,
    },
    # INCOME: skipped — no income variable in the raw .sav
}

# Trust battery messenger labels
TRUST_LBL = {
    'QTRUSTr1':  'FDA / CDC',
    'QTRUSTr2':  'Pharmaceutical companies',
    'QTRUSTr3':  'Personal physician (excluded from deployable list)',
    'QTRUSTr4A': 'Infectious disease specialists',
    'QTRUSTr4B': 'Nurses / NPs',
    'QTRUSTr4C': 'Pharmacists',
    'QTRUSTr5A': 'Academic medical centers',
    'QTRUSTr5B': 'FQHC / Ryan White',
    'QTRUSTr5C': 'Catholic health systems',
    'QTRUSTr6A': 'Human Rights Campaign (HRC)',
    'QTRUSTr6B': 'GLAAD',
    'QTRUSTr6C': 'PFLAG',
    'QTRUSTr6D': 'LGBTQ community centers',
    'QTRUSTr7A': 'Health podcasters / YT',
    'QTRUSTr7B': 'Black media',
    'QTRUSTr7C': 'Religious media',
    'QTRUSTr7D': 'LGBTQ media',
    'QTRUSTr8A': 'Medical journals',
    'QTRUSTr8B': 'Science journalists',
    'QTRUSTr8C': 'University HIV centers',
    'QTRUSTr9A': 'amfAR',
    'QTRUSTr9B': 'NMAC',
    'QTRUSTr9C': 'AIDS United',
}
EXCLUDE_FROM_DEPLOYABLE = {'QTRUSTr3'}

ACCORDION_ITEMS = {
    'scf': [
        ('MFQ_r1', 'Whether someone suffered emotionally',  'QMFQr1', False),
        ('MFQ_r2', 'Showed compassion for those worse off', 'QMFQr2', False),
        ('CFS',    'Care Foundation composite',             'CFS',    False),
        ('MFQ_r3', 'Morally disgusting / violated decency', 'QMFQr3', False),
        ('MFQ_r4', 'Against natural order',                 'QMFQr4', False),
        ('PFS',    'Purity Foundation composite',           'PFS',    False),
        ('SCF',    'Sanctity − Care trade-off',             'SCF',    False),
    ],
    'stigma': [
        ('SB1', 'Sexual behavior choices led to it',    'SB1', False),
        ('SB2', 'More personal responsibility',         'SB2', False),
        ('MBS', 'Blame composite',                      'MBS', False),
        ('SD1', 'Comfort working alongside (rev.)',     'SD1', False),
        ('SD2', 'Comfort close friendship (rev.)',      'SD2', False),
        ('SDS', 'Avoidance composite',                  'SDS', False),
    ],
    # QHIVr* heard-before items (1=heard, 0=not aware); QHIVr5 is the foil, excluded
    'know': [
        ('QHIVr1',  'Immune system, progression to AIDS',         'QHIVr1',  True),
        ('QHIVr2',  'Lifelong treatment, normal lifespan',        'QHIVr2',  True),
        ('QHIVr3',  'Undetectable = untransmittable (U=U)',       'QHIVr3',  True),
        ('QHIVr4',  'Prevention medication exists (PrEP)',        'QHIVr4',  True),
        ('QHIVr6',  '>50% of new diagnoses in South',             'QHIVr6',  True),
        ('QHIVr7',  '1 in 3 receive prevention med',              'QHIVr7',  True),
        ('QHIVr8',  'Prevention saves treatment costs',           'QHIVr8',  True),
        ('QHIVr9',  'Ryan White serves >50% of PLWH',             'QHIVr9',  True),
        ('QHIVr10', 'PEPFAR saved 25M lives',                     'QHIVr10', True),
        ('QHIVr11', 'Black Americans disproportionately affected','QHIVr11', True),
    ],
    'contact': [
        ('CON-HIV', 'Personally knows person with HIV', 'CON_HIV', True),
        ('CON-LGB', 'Personally knows LGBTQ person',    'CON_LGB', True),
    ]
}


# ─── Read .sav and construct composites ─────────────────────────────
print(f"Reading {INPUT_FILE} ...")
df, meta_sav = pyreadstat.read_sav(INPUT_FILE)
print(f"  raw n = {len(df)}")

if 'status' in df.columns:
    df = df[df['status'] == 3].copy()
    print(f"  after status filter (status=3): n = {len(df)}")

# Composites
df['SB1'] = df['QHIVSTIGMAr1']
df['SB2'] = df['QHIVSTIGMAr2']
df['MBS'] = df[['SB1','SB2']].mean(axis=1)
df['SD1'] = 8 - df['QHIVSTIGMAr3']
df['SD2'] = 8 - df['QHIVSTIGMAr4']
df['SDS'] = df[['SD1','SD2']].mean(axis=1)
df['EQ1'] = df['QHIVSTIGMAr5']
df['EQ2'] = df['QHIVSTIGMAr6']
df['EDS'] = df[['EQ1','EQ2']].mean(axis=1)
df['SC1'] = 8 - df['QHIVSTIGMAr7']
df['SC2'] = 8 - df['QHIVSTIGMAr8']
df['SCS'] = df[['SC1','SC2']].mean(axis=1)
df['CFS'] = df[['QMFQr1','QMFQr2']].mean(axis=1)
df['PFS'] = df[['QMFQr3','QMFQr4']].mean(axis=1)
df['SCF'] = df['PFS'] - df['CFS']

# Contact (already coded 0=No, 1=Yes in raw .sav)
df['CON_LGB'] = df['QCON_LGBr1']
df['CON_HIV'] = df['QCON_LGBr2']

# Knowledge items (recode 1=heard → 1, 2=not aware → 0; QHIVr5 stays as the foil)
for i in range(1, 12):
    col = f'QHIVr{i}'
    if col in df.columns:
        df[col] = df[col].map({1.0: 1, 2.0: 0})

k_vars = [f'QHIVr{i}' for i in range(1, 12) if i != 5]   # 10 items, foil excluded
has_knowledge = all(k in df.columns for k in k_vars)
if has_knowledge:
    df['HKS'] = df[k_vars].sum(axis=1)
    print(f"  knowledge battery present — HKS computed (10 items, QHIVr5 foil excluded)")
else:
    print("  ⚠  knowledge battery (QHIVr1..QHIVr11) NOT present — knowledge tile will be empty")

# Segment
df['SEG'] = df['XSEG_ASSIGNED'].astype(int)


# ─── Demographic recoding for rake ──────────────────────────────────
print("\nRecoding demographics for rake ...")
df['PARTY']     = np.where(df['SEG'] <= 10, 1, 2)
df['SEX_RAKE']  = df['QGENDER'].where(df['QGENDER'].isin([1, 2]))
df['AGE4']      = df['QAGECAT5'].map({1: 1, 2: 2, 3: 3, 4: 3, 5: 4})
df['RACE4']     = df['QRACE_ETHNIC'].map({1: 1, 2: 2, 3: 4, 4: 4, 5: 5})
df.loc[df['QRACE_ETHNIC'] == 99, 'RACE4'] = np.nan
df['EDUC2']     = df['QEDU'].apply(
    lambda x: 1 if x in (6, 7, 8, 9) else (2 if x in (1, 2, 3, 4, 5) else np.nan))
df['REGION']    = df['XQREGION'].where(df['XQREGION'] != 99)

# Report missingness on rake variables
print("  Missing on rake variables:")
for v in ['SEX_RAKE','AGE4','RACE4','EDUC2','REGION']:
    miss_n = df[v].isna().sum()
    print(f"    {v}: {miss_n} missing ({miss_n/len(df)*100:.1f}%)")


# ─── Convert within-party shares to absolute population targets ──────
gop_share = sum(t for s, t in SEG_TARGETS.items() if s <= 10)
dem_share = sum(t for s, t in SEG_TARGETS.items() if s >= 11)
print(f"\nSegment-derived party shares: GOP={gop_share:.4f}, DEM={dem_share:.4f}")

def to_absolute(within_party_dict):
    out = {}
    for (val, party), wshare in within_party_dict.items():
        out[(val, party)] = wshare * (gop_share if party == 1 else dem_share)
    return out

ABSOLUTE_TARGETS = {dim: to_absolute(d) for dim, d in WITHIN_PARTY.items()}


# ─── Iterative Proportional Fitting (IPF) ────────────────────────────
def rake_ipf(df, w_start=None, max_iter=50, tol=1e-4):
    """
    Iterative Proportional Fitting (raking).

    Each rake dimension is (cell_columns, target_dict).  At each iteration,
    we scale weights within each cell so that the weighted share matches
    the target share (within the subpopulation of cases with valid cell keys
    for that dimension).  Cases with missing values on a dimension are
    excluded from THAT dimension's adjustment but kept in the dataset.

    w_start: optional starting weight vector (e.g., trimmed weights from a
    prior pass).  If None, starts from ones.
    """
    w = np.ones(len(df), dtype=float) if w_start is None else np.array(w_start, dtype=float)
    rake_dims = [
        (['SEG'],              {(s,): t for s, t in SEG_TARGETS.items()}),
        (['SEX_RAKE','PARTY'], ABSOLUTE_TARGETS['SEX_RAKE']),
        (['AGE4','PARTY'],     ABSOLUTE_TARGETS['AGE4']),
        (['RACE4','PARTY'],    ABSOLUTE_TARGETS['RACE4']),
        (['EDUC2','PARTY'],    ABSOLUTE_TARGETS['EDUC2']),
        (['REGION','PARTY'],   ABSOLUTE_TARGETS['REGION']),
    ]
    last_dev = None
    for it in range(1, max_iter + 1):
        max_dev = 0.0
        for cols, targets in rake_dims:
            cell_keys = list(zip(*[df[c].values for c in cols]))
            in_dim = np.array([
                (key in targets) and not any(
                    (v is None) or (isinstance(v, float) and np.isnan(v))
                    for v in key
                )
                for key in cell_keys
            ])
            if not in_dim.any():
                continue
            total_in_dim = w[in_dim].sum()
            target_sum   = sum(targets.values())
            for cell, t in targets.items():
                mask = np.array([key == cell for key in cell_keys]) & in_dim
                if not mask.any():
                    continue
                current = w[mask].sum() / total_in_dim
                target  = t / target_sum
                if current > 0:
                    factor = target / current
                    w[mask] *= factor
                    dev = abs(current - target)
                    if dev > max_dev:
                        max_dev = dev
        if max_dev < tol:
            print(f"  IPF converged at iteration {it} (max marginal deviation = {max_dev:.6f})")
            return w, it, max_dev
        last_dev = max_dev
    print(f"  IPF reached max iterations ({max_iter}); final max deviation = {last_dev:.6f}")
    return w, max_iter, last_dev


print("\nRaking weights via IPF ...")

# Weight trimming caps.  Empirically tuned to produce n_eff ≈ 755
# (Bryan's target from prior weighted analysis).  Caps are applied as
# absolute weight floors/ceilings after IPF convergence.  At [0.25, 5.0]
# n_eff ≈ 449; at [0.53, 1.78] n_eff ≈ 754.  Looser caps preserve marginal
# target fits but inflate weight variance and shrink effective n; tighter
# caps stabilize n_eff but sacrifice some target precision.  Set to
# (None, None) to disable trimming entirely.
WT_MIN, WT_MAX = 0.53, 1.78

WT, n_iter, final_dev = rake_ipf(df)
print(f"  IPF: {n_iter} iterations, final max marginal deviation = {final_dev:.6f}")
print(f"  Pre-trim: min={WT.min():.3f}  max={WT.max():.3f}  "
      f"ESS={(WT.sum()**2/(WT**2).sum()):.0f}")

if WT_MIN is not None or WT_MAX is not None:
    n_lo = (WT < (WT_MIN or 0)).sum()
    n_hi = (WT > (WT_MAX or float('inf'))).sum()
    WT = np.clip(WT, WT_MIN, WT_MAX)
    WT *= len(WT) / WT.sum()
    print(f"  Trimmed {n_lo} weights to floor {WT_MIN}, {n_hi} to ceiling {WT_MAX}; renormalized.")

df['WT'] = WT
ess = (WT.sum() ** 2) / (WT ** 2).sum()
deff = len(WT) / ess
print(f"  Final weights: min={WT.min():.3f}, mean={WT.mean():.3f}, max={WT.max():.3f}")
print(f"  Effective n = {ess:.1f}  (n={len(WT)}, Deff={deff:.3f})")


# ─── Weighted-statistic helpers ──────────────────────────────────────
def wmean(s, w):
    keep = s.notna() & w.notna()
    if not keep.any(): return float('nan')
    return float((s[keep] * w[keep]).sum() / w[keep].sum())

def wstd(s, w):
    keep = s.notna() & w.notna()
    if not keep.any(): return float('nan')
    mu = wmean(s[keep], w[keep])
    var = float((w[keep] * (s[keep] - mu) ** 2).sum() / w[keep].sum())
    return var ** 0.5

# ─── Aggregations ───────────────────────────────────────────────────
print("\nComputing dashboard aggregates ...")

zparams = {c: {'mean': wmean(df[c], df['WT']),
               'sd':   wstd(df[c],  df['WT'])}
           for c in CONSTRUCTS}

seg_data = {}
n_total = df['WT'].sum()
for seg in range(1, 17):
    sub = df[df['SEG'] == seg]
    if len(sub) == 0: continue
    rec = {'name': SEG_NAMES[seg], 'n': int(len(sub)),
           'pop': float(sub['WT'].sum() / n_total)}
    for c in CONSTRUCTS:
        m = wmean(sub[c], sub['WT'])
        z = (m - zparams[c]['mean']) / zparams[c]['sd']
        rec[c + '_raw'] = m
        rec[c + '_z']   = z
    rec['CON_HIV'] = wmean(sub['CON_HIV'], sub['WT'])
    rec['CON_LGB'] = wmean(sub['CON_LGB'], sub['WT'])
    if has_knowledge:
        rec['HKS'] = wmean(sub['HKS'], sub['WT'])
    seg_data[seg] = rec

def add_ranks(field):
    pairs = [(s, seg_data[s].get(field)) for s in seg_data
             if seg_data[s].get(field) is not None]
    pairs.sort(key=lambda x: -x[1])
    for rank, (s, _) in enumerate(pairs, start=1):
        seg_data[s][field + '_rank'] = rank

for c in CONSTRUCTS:
    add_ranks(c + '_raw')
if has_knowledge:
    add_ranks('HKS')
add_ranks('CON_HIV')
add_ranks('CON_LGB')

groups = {
    'All':         df,
    'Republicans': df[df['SEG'].isin(GOP_SEGS)],
    'Democrats':   df[df['SEG'].isin(DEM_SEGS)],
}
bench = {}
for gname, gdf in groups.items():
    rec = {'n': int(len(gdf))}
    for c in CONSTRUCTS:
        m = wmean(gdf[c], gdf['WT'])
        z = (m - zparams[c]['mean']) / zparams[c]['sd']
        rec[c] = {'raw': m, 'z': z}
    rec['CON_HIV'] = wmean(gdf['CON_HIV'], gdf['WT'])
    rec['CON_LGB'] = wmean(gdf['CON_LGB'], gdf['WT'])
    if has_knowledge:
        rec['HKS'] = wmean(gdf['HKS'], gdf['WT'])
    bench[gname] = rec

def item_row(code, stem, var, binary):
    if var not in df.columns: return None
    fsub = df[df['SEG'] == FOCAL]
    return {
        'code': code, 'stem': stem,
        'focal': wmean(fsub[var], fsub['WT']),
        'All':         wmean(df[var], df['WT']),
        'Republicans': wmean(df[df['SEG'].isin(GOP_SEGS)][var],
                             df[df['SEG'].isin(GOP_SEGS)]['WT']),
        'Democrats':   wmean(df[df['SEG'].isin(DEM_SEGS)][var],
                             df[df['SEG'].isin(DEM_SEGS)]['WT']),
        'binary': binary,
    }

items = {}
for tile, defs in ACCORDION_ITEMS.items():
    rows = [item_row(code, stem, var, binary) for (code, stem, var, binary) in defs]
    items[tile] = [r for r in rows if r is not None]

trust = []
for code in TRUST_LBL:
    if code in EXCLUDE_FROM_DEPLOYABLE: continue
    if code not in df.columns: continue
    fsub = df[df['SEG'] == FOCAL]
    trust.append({
        'code': code, 'label': TRUST_LBL[code],
        'focal':       wmean(fsub[code], fsub['WT']),
        'All':         wmean(df[code], df['WT']),
        'Republicans': wmean(df[df['SEG'].isin(GOP_SEGS)][code],
                             df[df['SEG'].isin(GOP_SEGS)]['WT']),
        'Democrats':   wmean(df[df['SEG'].isin(DEM_SEGS)][code],
                             df[df['SEG'].isin(DEM_SEGS)]['WT']),
    })

meta = {
    'study':              'PRISM HIV Wave 1',
    'generated_at':       datetime.datetime.now().isoformat(timespec='seconds'),
    'input_file':         os.path.basename(INPUT_FILE),
    'n_raw':              int(len(df)),
    'effective_n':        float(ess),
    'design_effect':      float(deff),
    'weight_min':         float(WT.min()),
    'weight_mean':        float(WT.mean()),
    'weight_max':         float(WT.max()),
    'ipf_iterations':     int(n_iter),
    'ipf_final_deviation':float(final_dev),
    'weighted':           True,
    'has_knowledge':      bool(has_knowledge),
    'focal_segment':      FOCAL,
    'focal_segment_name': SEG_NAMES[FOCAL],
    'trust_messengers_included': len(trust),
    'rake_dimensions':    ['Segment (16)', 'Sex × Party', 'Age4 × Party',
                           'Race × Party (Asian folded into Other)',
                           'Education × Party', 'Region × Party'],
    'rake_skipped':       ['Income — variable not present in raw .sav'],
    'notes': [
        f"Effective n = {ess:.1f} after raking (n_raw = {len(WT)}, Deff = {deff:.3f}).",
        "All means weighted by IPF-raked WT.",
        "z-scores standardized against full-sample weighted M, SD.",
        "Personal physician (QTRUSTr3) excluded from deployable trust list.",
        "QHIVSTIGMAr9..r13 are within-subject control items, not in composites.",
        "QHIVr5 is the foil item (HIV epidemic 'over') — excluded from HKS.",
        "Knowledge items measure prior awareness ('HEARD BEFORE' coded 1, "
        "'NOT AWARE' coded 0), not factual accuracy.",
    ]
}

# ─── Emit ────────────────────────────────────────────────────────────
def write_json(name, obj):
    path = os.path.join(OUTPUT_DIR, name)
    with open(path, 'w') as f:
        json.dump(obj, f, indent=2, default=float)
    print(f"  wrote {path}")

print(f"\nWriting dashboard data files to: {OUTPUT_DIR}")
write_json('manifest.json',  meta)
write_json('zparams.json',   zparams)
write_json('seg_data.json',  seg_data)
write_json('bench.json',     bench)
write_json('items.json',     items)
write_json('trust.json',     trust)

# Also emit case-level weights as CSV for merge back to .sav
weight_csv = os.path.join(OUTPUT_DIR, 'weights.csv')
df_out = df[['WT']].copy()
df_out.insert(0, 'case_id', range(1, len(df) + 1))
df_out.to_csv(weight_csv, index=False)
print(f"  wrote {weight_csv}")

print("\nDone.")
