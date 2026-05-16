* =====================================================================
*  PRISM HIV WAVE 1 — DASHBOARD DATA PIPELINE  (SPSS Python plug-in)
*  Reservoir Communications Group / HAIG · Confidential
* =====================================================================
*
*  INPUTS:  raw Decipher .sav (e.g. 260433.sav)
*           PRISM_WEIGHTING.xlsx  (rake targets)
*  OUTPUT:  six JSON files in OUTPUT_DIR, drop-in for hiv_tab_v5.html
*             manifest.json   pipeline metadata + n_effective
*             zparams.json    standardization constants (M, SD)
*             seg_data.json   per-segment composites + z-scores + rank
*             bench.json      group means (All / Republicans / Democrats)
*             items.json      item-level accordion data
*             trust.json      trust battery, 22 deployable messengers
*
*  CONSTRUCT MAP (Kalichman + Morrison-Morrison embedded in QHIVSTIGMAr1..r8;
*                 r9..r13 are within-subject controls, not used here):
*     QHIVSTIGMAr1, r2  → SB1, SB2     Blame (no recode)
*     QHIVSTIGMAr3, r4  → SD1, SD2     Avoidance  (REVERSE: 8 - x)
*     QHIVSTIGMAr5, r6  → EQ1, EQ2     LGBTQ-resentment (no recode)
*     QHIVSTIGMAr7, r8  → SC1, SC2     LGBTQ-discomfort (REVERSE: 8 - x)
*     QMFQr1, r2        →               CFS components (Care)
*     QMFQr3, r4        →               PFS components (Sanctity)
*     QCON_LGBr1, r2    → CON_LGB, CON_HIV  (already 0/1 in raw .sav)
*     XSEG_ASSIGNED     → SEG          1..16 final PRISM segment
*     QHIVr1..r11       → knowledge battery; r5 = FOIL (excluded from HKS)
*
*  RAKE STRUCTURE:
*     - 16 segment targets (universal)
*     - Party-stratified demographics (within DEM and within GOP):
*         SEX, AGE4, RACE4, EDU2, REGION  (income skipped — not in current rake)
*     - Iterative Proportional Fitting, 50 iter max, then weight trim
*     - Trim caps [0.53, 1.78] tuned empirically to give n_eff ≈ 755
*
*  USAGE:
*     1. Edit the file paths in the !INPUT_FILE / !WEIGHTING_FILE / !OUTPUT_DIR macros.
*     2. Requires SPSS Statistics 22+ with Python plug-in (Essentials for Python).
*     3. Python packages required in SPSS's Python: pandas, numpy, openpyxl.
*     4. Run this syntax.  Six JSON files appear in OUTPUT_DIR.
*
* =====================================================================


* =====================================================================
*  PART A — CONFIGURATION  (edit these paths)
* =====================================================================

DEFINE !INPUT_FILE     () '/Users/bryandumont/Reservoir/PRISM_HIV/Wave1/260433.sav' !ENDDEFINE.
DEFINE !WEIGHTING_FILE () '/Users/bryandumont/Reservoir/PRISM_HIV/Wave1/PRISM_WEIGHTING.xlsx' !ENDDEFINE.
DEFINE !OUTPUT_DIR     () '/Users/bryandumont/Reservoir/PRISM_HIV/Wave1/dashboard_data' !ENDDEFINE.


* =====================================================================
*  PART B — LOAD AND BUILD COMPOSITES  (SPSS-native)
* =====================================================================

GET FILE = !INPUT_FILE.
DATASET NAME prism WINDOW=FRONT.

* Quality filter (Decipher "complete")
SELECT IF (status = 3).
EXECUTE.

* ─── Stigma composites (Kalichman 4-item + Morrison MHS 4-item) ───
COMPUTE SB1 = QHIVSTIGMAr1.
COMPUTE SB2 = QHIVSTIGMAr2.
COMPUTE MBS = MEAN(SB1, SB2).

COMPUTE SD1 = 8 - QHIVSTIGMAr3.
COMPUTE SD2 = 8 - QHIVSTIGMAr4.
COMPUTE SDS = MEAN(SD1, SD2).

COMPUTE EQ1 = QHIVSTIGMAr5.
COMPUTE EQ2 = QHIVSTIGMAr6.
COMPUTE EDS = MEAN(EQ1, EQ2).

COMPUTE SC1 = 8 - QHIVSTIGMAr7.
COMPUTE SC2 = 8 - QHIVSTIGMAr8.
COMPUTE SCS = MEAN(SC1, SC2).

VARIABLE LABELS
  MBS 'MBS: HIV Moral Blame composite (cognitive DV)'
  SDS 'SDS: HIV Avoidance composite (affective DV)'
  EDS 'EDS: LGBTQ Excessive Demands (cognitive mediator)'
  SCS 'SCS: LGBTQ Social Discomfort (affective mediator)'.

* ─── Moral foundations: Care, Sanctity, Sanctity-Care trade-off ───
COMPUTE CFS = MEAN(QMFQr1, QMFQr2).
COMPUTE PFS = MEAN(QMFQr3, QMFQr4).
COMPUTE SCF = PFS - CFS.

VARIABLE LABELS
  CFS 'CFS: Care Foundation score'
  PFS 'PFS: Purity (Sanctity) Foundation score'
  SCF 'SCF: Sanctity − Care trade-off'.

* ─── Personal contact (raw already 0/1) ───
COMPUTE CON_LGB = QCON_LGBr1.
COMPUTE CON_HIV = QCON_LGBr2.

* ─── Segment ───
COMPUTE SEG = XSEG_ASSIGNED.
FORMATS SEG (F2.0).

* ─── Knowledge battery: per-item correctness + 10-item HKS ───
* QHIVr5 is the foil ('epidemic over' — correct answer is False); excluded from HKS.
DO REPEAT V = QHIVr1 QHIVr2 QHIVr3 QHIVr4 QHIVr6 QHIVr7 QHIVr8 QHIVr9 QHIVr10 QHIVr11 /
              SC = QHIVr1_score QHIVr2_score QHIVr3_score QHIVr4_score
                   QHIVr6_score QHIVr7_score QHIVr8_score QHIVr9_score
                   QHIVr10_score QHIVr11_score.
  COMPUTE SC = (V = 1).
  IF (MISSING(V)) SC = $SYSMIS.
END REPEAT.
* QHIVr5 foil scored (correct = False/2) but NOT summed into HKS
COMPUTE QHIVr5_score = (QHIVr5 = 2).
IF (MISSING(QHIVr5)) QHIVr5_score = $SYSMIS.

COMPUTE HKS = SUM(QHIVr1_score, QHIVr2_score, QHIVr3_score, QHIVr4_score,
                  QHIVr6_score, QHIVr7_score, QHIVr8_score, QHIVr9_score,
                  QHIVr10_score, QHIVr11_score).
VARIABLE LABELS HKS 'HKS: HIV Knowledge Sum (10 items, QHIVr5 foil excluded)'.
EXECUTE.


* =====================================================================
*  PART C — RAKE WEIGHTS + DASHBOARD AGGREGATION  (Python plug-in)
* =====================================================================

BEGIN PROGRAM PYTHON.
import spss, spssaux, spssdata
import json, os, sys, datetime
import pandas as pd
import numpy as np

# ─── Resolve macros injected from SPSS ──────────────────────────────
INPUT_FILE     = spss.GetMacroValue('!INPUT_FILE').strip("'\"")
WEIGHTING_FILE = spss.GetMacroValue('!WEIGHTING_FILE').strip("'\"")
OUTPUT_DIR     = spss.GetMacroValue('!OUTPUT_DIR').strip("'\"")
if not os.path.isdir(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

# ─── Configuration ──────────────────────────────────────────────────
SEG_NAMES = {
    1:'TSP', 2:'CEC', 3:'TC', 4:'HF', 5:'PP', 6:'WE', 7:'PFF', 8:'HHN',
    9:'MFL', 10:'VS',
    11:'UCP', 12:'FJP', 13:'HCP', 14:'HAD', 15:'HCI', 16:'GHI'
}
GOP_SEGS = list(range(1, 11))
DEM_SEGS = list(range(11, 17))
FOCAL    = 12
CONSTRUCTS = ['MBS','SDS','EDS','SCS','CFS','PFS','SCF']
KNOWLEDGE_ITEMS = ['QHIVr1','QHIVr2','QHIVr3','QHIVr4','QHIVr6','QHIVr7',
                   'QHIVr8','QHIVr9','QHIVr10','QHIVr11']  # excludes r5 foil

# Trim caps — tuned to produce n_eff ≈ 755
WT_MIN, WT_MAX = 0.53, 1.78

TRUST_LBL = {
    'QTRUSTr1':'FDA / CDC', 'QTRUSTr2':'Pharmaceutical companies',
    'QTRUSTr3':'Personal physician (excluded from deployable list)',
    'QTRUSTr4A':'Infectious disease specialists','QTRUSTr4B':'Nurses / NPs',
    'QTRUSTr4C':'Pharmacists','QTRUSTr5A':'Academic medical centers',
    'QTRUSTr5B':'FQHC / Ryan White','QTRUSTr5C':'Catholic health systems',
    'QTRUSTr6A':'Human Rights Campaign (HRC)','QTRUSTr6B':'GLAAD',
    'QTRUSTr6C':'PFLAG','QTRUSTr6D':'LGBTQ community centers',
    'QTRUSTr7A':'Health podcasters / YT','QTRUSTr7B':'Black media',
    'QTRUSTr7C':'Religious media','QTRUSTr7D':'LGBTQ media',
    'QTRUSTr8A':'Medical journals','QTRUSTr8B':'Science journalists',
    'QTRUSTr8C':'University HIV centers','QTRUSTr9A':'amfAR',
    'QTRUSTr9B':'NMAC','QTRUSTr9C':'AIDS United',
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
    'know': [
        ('QHIVr1',  'Immune system / progression',           'QHIVr1_score',  True),
        ('QHIVr2',  'Lifelong treatment / normal lifespan', 'QHIVr2_score',  True),
        ('QHIVr3',  'U=U (Undetectable=Untransmittable)',   'QHIVr3_score',  True),
        ('QHIVr4',  'PrEP exists',                          'QHIVr4_score',  True),
        ('QHIVr5',  'FOIL: epidemic is over (correct=No)',  'QHIVr5_score',  True),
        ('QHIVr6',  '>50% of new dx in South',              'QHIVr6_score',  True),
        ('QHIVr7',  '1 in 3 receive PrEP',                  'QHIVr7_score',  True),
        ('QHIVr8',  'Prevention saves costs',               'QHIVr8_score',  True),
        ('QHIVr9',  'Ryan White serves >half PLWH',         'QHIVr9_score',  True),
        ('QHIVr10', 'PEPFAR exists',                        'QHIVr10_score', True),
        ('QHIVr11', 'Black Americans disproportionately',   'QHIVr11_score', True),
    ],
    'contact': [
        ('CON-HIV', 'Personally knows person with HIV', 'CON_HIV', True),
        ('CON-LGB', 'Personally knows LGBTQ person',    'CON_LGB', True),
    ]
}


# ═════════════════════════════════════════════════════════════════════
# 1. READ THE WEIGHTING SPEC
# ═════════════════════════════════════════════════════════════════════
def parse_weighting_targets(xlsx_path):
    """Returns (seg_targets, within_party_targets) parsed from xlsx.
       Column layout: col 0 = seg code OR section header / col 1 = label
       / col 2 = DEM target / col 3 = GOP target."""
    raw = pd.read_excel(xlsx_path, header=None)
    seg_targets = {}
    code_to_int = {v: k for k, v in SEG_NAMES.items()}
    for i in range(1, 17):
        row = raw.iloc[i]
        code = str(row[0]).strip()
        if code in code_to_int:
            seg_targets[code_to_int[code]] = float(row[2])

    # Party-stratified demographic targets
    # Convention: 1 = DEM-stratum, 2 = GOP-stratum (matches PARTY recode below)
    wp = {'SEX_RAKE': {}, 'AGE4': {}, 'RACE4': {}, 'EDUC2': {}, 'REGION': {}}

    def fill(dim, rows_cats):
        for row_idx, cat in rows_cats:
            row = raw.iloc[row_idx]
            v_d, v_r = row[2], row[3]
            if pd.notna(v_d): wp[dim][(cat, 1)] = float(v_d)
            if pd.notna(v_r): wp[dim][(cat, 2)] = float(v_r)

    fill('SEX_RAKE', [(23,1), (24,2)])
    fill('AGE4',     [(29,1), (30,2), (31,3), (32,4)])
    fill('RACE4',    [(35,1), (36,2), (38,3), (39,4)])   # Asian folded into Other
    fill('EDUC2',    [(42,1), (43,2)])
    fill('REGION',   [(50,1), (51,2), (52,3), (53,4)])

    # Renormalize within each (dim × party stratum)
    for dim in wp:
        for p in (1, 2):
            cells = {k:v for k,v in wp[dim].items() if k[1] == p}
            s = sum(cells.values())
            if s > 0:
                for k in cells:
                    wp[dim][k] = wp[dim][k] / s

    # Renormalize segment targets
    s = sum(seg_targets.values())
    if s > 0:
        seg_targets = {k: v/s for k,v in seg_targets.items()}

    return seg_targets, wp


# ═════════════════════════════════════════════════════════════════════
# 2. PULL ACTIVE DATASET FROM SPSS INTO PANDAS
# ═════════════════════════════════════════════════════════════════════
varDict = spssaux.VariableDict()
available = set(varDict.variables)

trust_cols = [t for t in TRUST_LBL.keys() if t in available]
k_score_cols = [f'{i}_score' for i in KNOWLEDGE_ITEMS + ['QHIVr5'] if f'{i}_score' in available]

needed = (
    ['SEG','MBS','SDS','EDS','SCS','CFS','PFS','SCF','HKS',
     'SB1','SB2','SD1','SD2','MFQ_r1','MFQ_r2','MFQ_r3','MFQ_r4',
     'QMFQr1','QMFQr2','QMFQr3','QMFQr4',
     'CON_HIV','CON_LGB',
     'QGENDER','QAGECAT5','QRACE_ETHNIC','QEDU','XQREGION']
    + trust_cols + k_score_cols
)
needed = [v for v in needed if v in available]
# Dedup while preserving order
seen = set()
needed = [v for v in needed if not (v in seen or seen.add(v))]

cur = spssdata.Spssdata(indexes=needed)
rows = [list(case) for case in cur]
cur.CClose()
df = pd.DataFrame(rows, columns=needed)
print("Pulled {0} cases x {1} vars from active dataset.".format(len(df), len(needed)))


# ═════════════════════════════════════════════════════════════════════
# 3. RAKE-TIME RECODES + RAKE
# ═════════════════════════════════════════════════════════════════════
df['SEX_RAKE'] = df['QGENDER'].replace({3.0: 2.0})  # "Other" → Female (n=2)
df['AGE4']     = df['QAGECAT5'].replace({1.0:1, 2.0:2, 3.0:3, 4.0:3, 5.0:4})
df['RACE4']    = df['QRACE_ETHNIC'].map({1.0:1, 2.0:2, 3.0:3, 4.0:3, 5.0:4})
df['EDUC2']    = df['QEDU'].map(lambda v: 1 if v in (6.0,7.0,8.0,9.0)
                                          else (2 if v in (1.0,2.0,3.0,4.0,5.0) else np.nan))
df['REGION']   = df['XQREGION'].map(lambda v: v if v in (1.0,2.0,3.0,4.0) else np.nan)
df['PARTY']    = df['SEG'].map(lambda s: 1 if s in DEM_SEGS else 2)  # 1=DEM, 2=GOP

print("\nReading rake targets from: {0}".format(WEIGHTING_FILE))
seg_targets, wp_targets = parse_weighting_targets(WEIGHTING_FILE)

# Convert within-party demographic targets to absolute population shares
# by multiplying within-stratum proportion by overall party share.
gop_share = sum(t for s, t in seg_targets.items() if s in GOP_SEGS)
dem_share = sum(t for s, t in seg_targets.items() if s in DEM_SEGS)

ABS_T = {}
for dim, cells in wp_targets.items():
    ABS_T[dim] = {(v, p): wshare * (dem_share if p == 1 else gop_share)
                  for (v, p), wshare in cells.items()}

# Build rake dimensions list
RAKE_DIMS = [
    (['SEG'], {(s,): t for s, t in seg_targets.items()}),
    (['SEX_RAKE','PARTY'], ABS_T['SEX_RAKE']),
    (['AGE4','PARTY'],     ABS_T['AGE4']),
    (['RACE4','PARTY'],    ABS_T['RACE4']),
    (['EDUC2','PARTY'],    ABS_T['EDUC2']),
    (['REGION','PARTY'],   ABS_T['REGION']),
]

def rake_ipf(df, rake_dims, max_iter=50, tol=1e-4):
    """Iterative Proportional Fitting (raking)."""
    w = np.ones(len(df), dtype=float)
    final_dev = None
    for it in range(1, max_iter + 1):
        max_dev = 0.0
        for cols, targets in rake_dims:
            cell_keys = list(zip(*[df[c].values for c in cols]))
            def valid(key):
                if key not in targets: return False
                for v in key:
                    if v is None: return False
                    if isinstance(v, float) and np.isnan(v): return False
                return True
            in_dim = np.array([valid(k) for k in cell_keys])
            if not in_dim.any(): continue
            total_in_dim = w[in_dim].sum()
            target_sum   = sum(targets.values())
            for cell, t in targets.items():
                mask = np.array([k == cell for k in cell_keys]) & in_dim
                if not mask.any(): continue
                current = w[mask].sum() / total_in_dim
                target  = t / target_sum
                if current > 0:
                    factor = target / current
                    w[mask] *= factor
                    dev = abs(current - target)
                    if dev > max_dev: max_dev = dev
        final_dev = max_dev
        if max_dev < tol:
            return w, it, max_dev
    return w, max_iter, final_dev

print("\nRaking weights via IPF ...")
WT, n_iter, final_dev = rake_ipf(df, RAKE_DIMS)
print("  IPF: {0} iter, final max marginal deviation = {1:.6f}".format(n_iter, final_dev))
print("  Pre-trim: min={0:.3f}, max={1:.3f}".format(WT.min(), WT.max()))

# Apply trim
n_lo = int((WT < WT_MIN).sum())
n_hi = int((WT > WT_MAX).sum())
WT = np.clip(WT, WT_MIN, WT_MAX)
WT *= len(WT) / WT.sum()  # renormalize to mean = 1
print("  Trimmed {0} below {1}, {2} above {3}.".format(n_lo, WT_MIN, n_hi, WT_MAX))

df['WT'] = WT
ess  = (WT.sum() ** 2) / (WT ** 2).sum()
deff = len(WT) / ess
print("  Final weights: min={0:.3f}, mean=1.000, max={1:.3f}".format(WT.min(), WT.max()))
print("  Effective n = {0:.1f} (n={1}, Deff={2:.3f})".format(ess, len(WT), deff))


# ═════════════════════════════════════════════════════════════════════
# 4. WEIGHTED AGGREGATES
# ═════════════════════════════════════════════════════════════════════
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

print("\nComputing dashboard aggregates ...")
zparams = {c: {'mean': wmean(df[c], df['WT']),
               'sd':   wstd(df[c],  df['WT'])} for c in CONSTRUCTS}

seg_data = {}
n_total = df['WT'].sum()
has_knowledge = 'HKS' in df.columns
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

for c in CONSTRUCTS: add_ranks(c + '_raw')
if has_knowledge: add_ranks('HKS')
add_ranks('CON_HIV'); add_ranks('CON_LGB')

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
    rs = [item_row(c, s, v, b) for (c,s,v,b) in defs]
    items[tile] = [r for r in rs if r is not None]

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
    'study': 'PRISM HIV Wave 1',
    'generated_at': datetime.datetime.now().isoformat(),
    'input_file': os.path.basename(INPUT_FILE),
    'weighting_file': os.path.basename(WEIGHTING_FILE),
    'n_raw': int(len(df)),
    'n_effective_kish': float(ess),
    'design_effect': float(deff),
    'rake_iterations': int(n_iter),
    'rake_final_deviation': float(final_dev),
    'trim_caps': [WT_MIN, WT_MAX],
    'weight_min': float(WT.min()),
    'weight_max': float(WT.max()),
    'weighted': True,
    'has_knowledge': bool(has_knowledge),
    'knowledge_items_in_HKS': KNOWLEDGE_ITEMS,
    'foil_item_excluded': 'QHIVr5',
    'focal_segment': FOCAL,
    'focal_segment_name': SEG_NAMES[FOCAL],
    'trust_messengers_included': len(trust),
    'rake_dimensions': [
        'Segment (16, universal)',
        'Sex × Party stratum',
        'Age4 × Party stratum',
        'Race4 × Party stratum (Asian folded into Other)',
        'Education2 × Party stratum',
        'Region × Party stratum',
    ],
    'notes': [
        "All means weighted by IPF-raked WT.",
        "Trim caps tuned to produce n_eff ≈ 755 (Bryan's target).",
        "z-scores standardized against full-sample weighted M, SD.",
        "Personal physician (QTRUSTr3) excluded from deployable trust list.",
        "QHIVSTIGMAr9..r13 are within-subject control items, not used.",
        "QHIVr5 is the foil knowledge item, excluded from HKS sum.",
    ]
}

def write_json(name, obj):
    path = os.path.join(OUTPUT_DIR, name)
    with open(path, 'w') as f:
        json.dump(obj, f, indent=2, default=float)
    print("  wrote {0}".format(path))

print("\nWriting dashboard data files to: {0}".format(OUTPUT_DIR))
write_json('manifest.json',  meta)
write_json('zparams.json',   zparams)
write_json('seg_data.json',  seg_data)
write_json('bench.json',     bench)
write_json('items.json',     items)
write_json('trust.json',     trust)

# Write weights back to disk (CSV) for merging into .sav
weights_df = df[['WT']].copy()
weights_df.to_csv(os.path.join(OUTPUT_DIR, 'weights.csv'), index_label='case_id')
print("  wrote weights.csv (re-merge into .sav with MATCH FILES if needed)")

print("\nDone.")

END PROGRAM.


* =====================================================================
*  PART D — HUMAN-READABLE VALIDATION  (optional)
* =====================================================================
*  Add the computed weight to the SPSS dataset and produce quick MEANS /
*  DESCRIPTIVES tables for visual inspection.  Note: weights.csv must
*  be merged in via MATCH FILES if you want SPSS to apply WEIGHT BY.

DESCRIPTIVES VARIABLES = MBS SDS EDS SCS CFS PFS SCF CON_HIV CON_LGB HKS
  /STATISTICS = MEAN STDDEV MIN MAX N.

MEANS TABLES = MBS SDS EDS SCS SCF HKS CON_HIV CON_LGB BY SEG
  /CELLS = MEAN COUNT.

* End of pipeline.
