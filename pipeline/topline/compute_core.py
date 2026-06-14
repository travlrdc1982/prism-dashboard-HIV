"""
PRISM Topline — core compute module.

This file contains the STUDY configuration and the build_topline(df) function.
It can be called from two entry points:

  (1) Standalone CLI:    compute.py reads a .sav file via pyreadstat,
                         then calls build_topline(df).
  (2) Inside SPSS:       an .sps syntax file reads the active dataset
                         via spssdata, then calls build_topline(df).

In both cases, `df` must be a pandas DataFrame with:
  - One column per SPSS variable (exact name and case)
  - Including XSEG_ASSIGNED (numeric 1-16, canonical PRISM segments)
  - All variables referenced in ITEMS / PRE_POST registries
  - Optionally a weight variable (assigned to df['WGT'] before build_topline runs;
    if absent, build_topline assigns WGT = 1.0)
"""
import pandas as pd
import json
from collections import OrderedDict
from math import sqrt
from pathlib import Path


# ═════════════════════════════════════════════════════════════════════
# WORKBOOK ROI OVERRIDES
# ─────────────────────────────────────────────────────────────────────
# Reads HIV_Study_Template.xlsx (analyst-configured tier / coalition /
# activation / influence per segment) and applies them to roi_data
# before render_svg(). This makes /roi (workbook-sourced) and /topline
# ROI (SVG-rendered) show identical numbers. Pure additive helper —
# falls back silently if the workbook is missing.
#
# Mapping (workbook column → roi_data field):
#   tier            → priority_tier
#   supporters * 100 → coalition_support   (workbook stores fraction)
#   activation * 100 → activation_prob
#   influence  * 100 → influence_pct
#
# Workbook lookup uses the project root by default; override with the
# PRISM_WORKBOOK env var if compute_core.py runs elsewhere.
# ═════════════════════════════════════════════════════════════════════

def _apply_workbook_roi_overrides(roi_data):
    """Apply the analyst's SegmentMetrics judgments to roi_data. Parsing
    lives in pipeline/workbook.py — the single workbook code path shared
    with extract_hiv.py (field-equality verified at the R2 switch)."""
    import os
    _default = _cfg['sources']['judgments_workbook']   # study/judgments.xlsx
    wb_path = os.environ.get('PRISM_WORKBOOK', _default)
    if not Path(wb_path).exists():
        # Try repo root relative to this file's location (pipeline/topline/)
        candidate = Path(__file__).resolve().parent.parent.parent / _default
        if candidate.exists():
            wb_path = str(candidate)
        else:
            raise FileNotFoundError(f"Judgments workbook not found at {wb_path}")

    import sys as _sys
    _sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    import workbook as _wbmod
    sm, _, _ = _wbmod.read_segment_metrics(_wbmod.load(wb_path))
    overrides = 0
    for code, m in sm.items():
        if code not in roi_data:
            continue
        if m['tier'] is not None:
            roi_data[code]['priority_tier'] = m['tier']
        roi_data[code]['coalition_support'] = m['supporters']
        roi_data[code]['activation_prob'] = m['activation']
        roi_data[code]['influence_pct'] = m['influence']
        overrides += 1
    print(f"Applied workbook ROI overrides: {overrides} segments from {wb_path}")


# ═════════════════════════════════════════════════════════════════════
# STUDY CONFIG — loaded from study/study.yaml (topline_config: section).
# ─────────────────────────────────────────────────────────────────────
# The engine carries no hardcoded study constants. Field semantics for
# the item registries are documented in pipeline/topline/BUILD_GUIDE.md;
# segments come from the shared segment_registry (one table for both
# the topline and messagemap engines).
# ═════════════════════════════════════════════════════════════════════
import sys as _sys
_sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from study_config import (load_config as _load_config,
                          segments_topline as _segments_topline,
                          topline_study as _topline_study,
                          pop_share_by_code as _pop_share_by_code)

_cfg = _load_config()
_tl = _cfg['topline_config']

STUDY             = _topline_study(_cfg)
# `rendered` is artifact metadata, not configuration — stamp at build time.
import datetime as _dt
STUDY['rendered'] = _dt.date.today().isoformat()
LABELS            = _tl['labels']
MODULES           = _tl['modules']
TRUST_LBL         = _tl['trust_lbl']
BATTERIES         = _tl['batteries']
INFLUENCER_BLOCKS = _tl['influencer_blocks']
ITEMS             = _tl['items']
PRE_POST          = _tl['pre_post']
DEMOGRAPHICS      = _tl['demographics']
SEGMENTS          = _segments_topline(_cfg)   # [[id, code, name, party], ...]
POP_SHARE_BY_CODE = _pop_share_by_code(_cfg)  # {code: pop_share fraction}


def ztest_prop_vs_rest(seg_count, seg_n, total_count, total_n):
    """Two-proportion z-test: segment vs. (total minus segment)."""
    rest_n = total_n - seg_n
    if rest_n <= 0 or seg_n <= 0:
        return 0.0
    rest_count = total_count - seg_count
    p1 = seg_count / seg_n
    p2 = rest_count / rest_n
    p_pool = (seg_count + rest_count) / (seg_n + rest_n)
    if p_pool <= 0 or p_pool >= 1:
        return 0.0
    se = sqrt(p_pool * (1 - p_pool) * (1/seg_n + 1/rest_n))
    if se == 0:
        return 0.0
    return (p1 - p2) / se

def sig_level(z):
    az = abs(z)
    if az >= 2.576: return 2  # p < .01
    if az >= 1.96:  return 1  # p < .05
    return 0

def _norm_sf_two_sided(z):
    """Two-sided p-value from a z statistic, via erfc. No scipy dependency."""
    from math import erfc, sqrt as _sqrt
    return erfc(abs(z) / _sqrt(2.0))

def _binom_p_two_sided_half(n, k):
    """Two-sided p-value for binomial(n, 0.5), point mass at k or more extreme.
    Used for exact McNemar when discordant n < 25.
    """
    from math import comb
    k_extreme = max(k, n - k)
    tail = sum(comb(n, i) for i in range(k_extreme, n + 1))
    p = 2.0 * tail / (2.0 ** n)
    return min(p, 1.0)

def mcnemar_test(b, c):
    """McNemar's paired test on a 2x2 of top-3 status (PRE vs POST).
    b = count of respondents who moved 0 -> 1 (not-top3 PRE, top3 POST)
    c = count of respondents who moved 1 -> 0 (top3 PRE, not-top3 POST)
    Returns (chi_square_or_None, p_value, method_key).
    method_key maps to LABELS at render time:
      'method_mcnemar_chi2' / 'method_mcnemar_exact' / 'method_no_discord'.
    """
    n = b + c
    if n == 0:
        return None, 1.0, 'method_no_discord'
    if n >= 25:
        chi2 = (abs(b - c) - 1) ** 2 / n
        z = chi2 ** 0.5
        p = _norm_sf_two_sided(z)
        return round(chi2, 2), p, 'method_mcnemar_chi2'
    else:
        p = _binom_p_two_sided_half(n, max(b, c))
        return None, p, 'method_mcnemar_exact'

def delta_sig_level(p):
    """Three-tier sig level for delta tests: 0=ns, 1=p<.10, 2=p<.05, 3=p<.01."""
    if p < 0.01: return 3
    if p < 0.05: return 2
    if p < 0.10: return 1
    return 0

def welch_t_two_sample(x1, x2):
    """Welch's t-test on two independent samples of continuous values.
    Returns (t_statistic, p_value_two_sided). Used for Delta-vs-rest popover info.
    """
    from math import sqrt as _sqrt
    n1, n2 = len(x1), len(x2)
    if n1 < 2 or n2 < 2:
        return 0.0, 1.0
    m1 = sum(x1) / n1
    m2 = sum(x2) / n2
    v1 = sum((x - m1) ** 2 for x in x1) / (n1 - 1)
    v2 = sum((x - m2) ** 2 for x in x2) / (n2 - 1)
    se = _sqrt(v1 / n1 + v2 / n2)
    if se == 0:
        return 0.0, 1.0
    t = (m1 - m2) / se
    # Approximate two-sided p via normal (Welch df not needed for our use)
    p = _norm_sf_two_sided(t)
    return t, p

def _stats(values, weights, scale=7):
    mask = values.notna()
    v = values[mask]; w = weights[mask]
    if len(v) == 0: return None
    n = int(mask.sum())
    n_wgt = float(w.sum())
    mean = float((v * w).sum() / w.sum())
    freq, counts = [], []
    for k in range(1, scale+1):
        f = float(w[v == k].sum() / w.sum() * 100)
        c = int((v == k).sum())
        freq.append(round(f, 1)); counts.append(c)
    bot3 = round(sum(freq[0:3]), 1)
    neut = round(freq[3], 1)
    top3 = round(sum(freq[4:7]), 1)
    return {
        'n': n, 'n_wgt': round(n_wgt, 1), 'mean': round(mean, 2),
        'freq': freq, 'bot3': bot3, 'neut': neut, 'top3': top3,
        'net': round(top3 - bot3, 1),
        'top3_count': sum(counts[4:7]), 'bot3_count': sum(counts[0:3]),
    }

def _clamp(v, lo=1, hi=7):
    return max(lo, min(hi, int(round(v))))


def _freq_for_var(values, weights, mask, options, recode=None):
    """Compute frequency distribution of `values` (filtered by `mask`)
    across the response-option list. Returns dict keyed by option value with
    {n, pct, n_wgt, pct_wgt} per option, plus '_n_total' and '_n_wgt_total'.

    Optional `recode` argument applies a value transformation before tallying.
    Currently supports {'ruca_collapse': True} which maps RUCA 1-3 → 'urban',
    4-6 → 'suburban', 7-10 → 'rural'.
    """
    v = values[mask]
    w = weights[mask]
    # Apply recode if needed
    if recode and recode.get('ruca_collapse'):
        v = v.apply(_ruca_collapse)
    n_total = int(mask.sum())
    n_wgt_total = float(w.sum())
    out = {'_n_total': n_total, '_n_wgt_total': round(n_wgt_total, 1)}
    for opt in options:
        opt_val = opt[0]
        sel = (v == opt_val)
        n = int(sel.sum())
        n_wgt = float(w[sel].sum())
        out[opt_val] = {
            'n':       n,
            'pct':     round(n / n_total * 100, 1) if n_total else 0.0,
            'n_wgt':   round(n_wgt, 1),
            'pct_wgt': round(n_wgt / n_wgt_total * 100, 1) if n_wgt_total else 0.0,
        }
    return out


def _ruca_collapse(val):
    """Collapse 10-level RUCA to 5 categories.

    Urban = 1
    Suburban = 2-3
    Exurban = 4-6
    Small Town Rural = 7-9
    Rural = 10
    """
    if pd.isna(val):
        return None
    v = int(val)
    if v == 1:
        return 'urban'
    if 2 <= v <= 3:
        return 'suburban'
    if 4 <= v <= 6:
        return 'exurban'
    if 7 <= v <= 9:
        return 'smalltown'
    if v == 10:
        return 'rural'
    return None


def _influencer_cell(values, weights, mask, metric, entry):
    """Compute one Influencer360 banner cell value depending on metric type.

    metric:
      'pct_yes'       → entry['yes_value'] default 1, returns % matching that value
      'any_activity'  → returns % not matching entry['never_value'] (default 1)
                        i.e., share who reported any activity above 'Never'
      'mean'          → returns weighted mean (used for BCS / XSMr4)
      'categorical'   → returns full distribution dict {value: pct, ...}

    Returns a dict with at minimum: {'n', 'val'} where val depends on metric.
    Also returns 'count' (raw matching unweighted count) for proportional metrics,
    and 'values' (raw value list) for 'mean' metric — both used downstream for
    significance testing.
    """
    v = values[mask]
    w = weights[mask]
    n = int(mask.sum())
    n_wgt = float(w.sum())
    if metric == 'mean':
        if n_wgt > 0:
            wm = (v * w).sum() / n_wgt
        else:
            wm = 0.0
        # Return raw values list (used by Welch t-test downstream); also keep
        # the indices so we can filter rest-of-sample for the t-test.
        return {'n': n, 'val': round(float(wm), 3), 'metric': 'mean',
                'mask': mask, '_is_mean': True}
    if metric == 'categorical':
        opts = entry.get('options', [])
        return {
            'n': n,
            'metric': 'categorical',
            'dist': _freq_for_var(values, weights, mask, opts),
        }
    if metric == 'any_activity':
        never_val = entry.get('never_value', 1)
        any_mask = (v != never_val)
        any_count = int(any_mask.sum())
        any_n_wgt = float(w[any_mask].sum())
        pct = (any_n_wgt / n_wgt * 100) if n_wgt > 0 else 0.0
        return {'n': n, 'val': round(pct, 1), 'metric': 'any_activity', 'count': any_count}
    # Default: pct_yes
    yes_val = entry.get('yes_value', 1)
    yes_mask = (v == yes_val)
    yes_count = int(yes_mask.sum())
    yes_n_wgt = float(w[yes_mask].sum())
    pct = (yes_n_wgt / n_wgt * 100) if n_wgt > 0 else 0.0
    return {'n': n, 'val': round(pct, 1), 'metric': 'pct_yes', 'count': yes_count}


def expand_battery_items(items, batteries):
    """Walk ITEMS and expand any entry referencing a battery.

    An item with 'battery': '<name>' inherits all defaults from BATTERIES[<name>],
    with three conveniences auto-filled:
      - survey.intro    → only on the first item in the battery
      - survey.progress → '{position} of {total} statements'
      - survey.text     → defaults to item.wording
      - codebook.var    → defaults to item.id

    Items that don't reference a battery pass through unchanged.

    'position_override' on an item forces its survey position number (used when
    only one of an N-item battery is in the data, e.g., stigma SB_1 showing
    as '3 of 13'). Otherwise position is auto-incremented within the battery.
    """
    import copy
    expanded = []
    battery_position = {}  # tracks per-battery position counter
    for raw in items:
        if 'battery' not in raw:
            expanded.append(copy.deepcopy(raw))
            continue
        bname = raw['battery']
        if bname not in batteries:
            raise KeyError(f"Item {raw.get('id')} references unknown battery '{bname}'")
        battery = batteries[bname]
        # Position within the battery (auto-increment unless overridden)
        if 'position_override' in raw:
            position = raw['position_override']
        else:
            position = battery_position.get(bname, 0) + 1
            battery_position[bname] = position
        # Don't increment counter for overridden items
        if 'position_override' not in raw:
            battery_position[bname] = position
        total = battery.get('total', position)
        is_first_in_battery = (position == 1)

        # Build merged item starting from battery defaults
        merged = {}
        # Top-level inherited fields
        for k in ('section', 'scale', 'scale_anchors', 'metric_label_scale'):
            if k in battery:
                merged[k] = copy.deepcopy(battery[k])
        # Survey: deep-merge battery defaults with item overrides
        survey = copy.deepcopy(battery.get('survey', {}))
        if 'survey' in raw:
            survey.update(raw['survey'])
        # Auto-fills for survey
        if 'progress' not in survey:
            survey['progress'] = f'{position} of {total} statements'
        if 'text' not in survey:
            survey['text'] = raw.get('wording', '')
        # Intro only on first item in battery
        if not is_first_in_battery and 'intro' in survey:
            survey.pop('intro')
        merged['survey'] = survey
        # Codebook: deep-merge
        codebook = copy.deepcopy(battery.get('codebook', {}))
        if 'codebook' in raw:
            codebook.update(raw['codebook'])
        if 'codebook_extra' in raw:
            codebook.update(raw['codebook_extra'])
        if 'var' not in codebook:
            codebook['var'] = raw.get('id', '')
        merged['codebook'] = codebook

        # Now overlay item's own fields (overrides anything from the battery)
        for k, v in raw.items():
            if k in ('battery', 'survey', 'codebook', 'codebook_extra', 'position_override'):
                continue
            merged[k] = v

        expanded.append(merged)
    return expanded

# ═════════════════════════════════════════════════════════════════════
# MAIN BUILD FUNCTION — call this from any entry point
# ═════════════════════════════════════════════════════════════════════

def build_topline(df, out_dir='.', weight_var=None):
    """Compute all stats and write dashboard.json + results_long.csv + dashboard.html.

    Parameters
    ----------
    df : pandas.DataFrame
        Active dataset. Must contain XSEG_ASSIGNED and all variables
        referenced in ITEMS / PRE_POST.
    out_dir : str or Path
        Directory to write outputs into. Defaults to current directory.
    weight_var : str, optional
        Name of the weight column in df. If None, applies WGT = 1.0
        (unweighted; matches preliminary-data convention).
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # Defensive copy so we don't mutate the caller's dataframe
    df = df.copy()

    # Weight
    if weight_var is not None:
        if weight_var not in df.columns:
            raise KeyError(f"Weight variable '{weight_var}' not in dataframe columns")
        df['WGT'] = pd.to_numeric(df[weight_var], errors='coerce').fillna(1.0)
    else:
        df['WGT'] = 1.0

    # Segment code from XSEG_ASSIGNED
    if 'XSEG_ASSIGNED' not in df.columns:
        raise KeyError("XSEG_ASSIGNED not in dataframe columns. PRISM-canonical segmentation required.")
    seg_id2code = {sid: code for sid, code, _, _ in SEGMENTS}
    df['SEG'] = pd.to_numeric(df['XSEG_ASSIGNED'], errors='coerce').map(seg_id2code)

    def _compute_item(var):
        """Compute Total + 16-segment stats for one variable."""
        if var not in df.columns:
            raise KeyError(f"Variable '{var}' not in dataframe columns")
        # Numeric-ify in case it came in as object/string from SPSS
        col = pd.to_numeric(df[var], errors='coerce')
        out = OrderedDict()
        s = _stats(col, df['WGT'])
        if s: out['TOTAL'] = s
        total = out.get('TOTAL')
        for sid, code, name, party in SEGMENTS:
            mask = df['SEG'] == code
            s = _stats(col[mask], df['WGT'][mask])
            if s:
                if total:
                    z = ztest_prop_vs_rest(s['top3_count'], s['n'], total['top3_count'], total['n'])
                    s['z_top3'] = round(z, 2)
                    s['sig_top3'] = sig_level(z)
                    s['sig_dir'] = (1 if z > 0 else -1) if s['sig_top3'] > 0 else 0
                out[code] = s
        return out

    # Sample composition
    STUDY_TOTAL_N = int(len(df))
    STUDY_TOTAL_N_WGT = float(df['WGT'].sum())
    total_n = STUDY_TOTAL_N           # kept as alias for downstream code that uses it locally
    total_n_wgt = STUDY_TOTAL_N_WGT
    sample = []
    for sid, code, name, party in SEGMENTS:
        sub = df[df['SEG'] == code]
        n = int(len(sub))
        n_wgt = float(sub['WGT'].sum())
        sample.append({
            'id': sid, 'code': code, 'name': name, 'party': party,
            'n': n, 'n_wgt': round(n_wgt, 1),
            'pct': round(n / total_n * 100, 1) if total_n else 0,
            'pct_wgt': round(n_wgt / total_n_wgt * 100, 1) if total_n_wgt else 0,
        })

    # ── Expand any battery-referenced items into fully-formed item dicts ──
    items_expanded = expand_battery_items(ITEMS, BATTERIES)

    # Items
    item_results = {it['id']: _compute_item(it['id']) for it in items_expanded}

    # PRE_POST
    pp_results = {}
    for pp in PRE_POST:
        pre = _compute_item(pp['pre_var'])
        post = _compute_item(pp['post_var'])

        # ── Paired test prep: for each cut, get the per-respondent top-3 indicators
        # for PRE and POST, restricted to respondents with valid responses on BOTH.
        pre_col = pd.to_numeric(df[pp['pre_var']], errors='coerce')
        post_col = pd.to_numeric(df[pp['post_var']], errors='coerce')
        paired_mask_all = pre_col.notna() & post_col.notna()
        pre_t3 = (pre_col.between(5, 7)).astype(int)
        post_t3 = (post_col.between(5, 7)).astype(int)

        # Compute Total delta-top-3 vector (POST top3 - PRE top3 per respondent)
        # for the Δ-vs-rest test (Option 2).
        delta_t3_signed = (post_t3 - pre_t3).where(paired_mask_all)

        def _paired_stats_for_cut(cut_mask):
            """Return McNemar stats for the cut."""
            m = paired_mask_all & cut_mask
            a = int(((pre_t3 == 0) & (post_t3 == 0) & m).sum())  # stayed not-top3
            b = int(((pre_t3 == 0) & (post_t3 == 1) & m).sum())  # 0 -> 1 (gained)
            c = int(((pre_t3 == 1) & (post_t3 == 0) & m).sum())  # 1 -> 0 (lost)
            d = int(((pre_t3 == 1) & (post_t3 == 1) & m).sum())  # stayed top3
            n_paired = a + b + c + d
            chi2, p, method = mcnemar_test(b, c)
            lvl = delta_sig_level(p)
            return {
                'n_paired': n_paired,
                'switch_gain': b,         # not-top3 → top3
                'switch_loss': c,         # top3 → not-top3
                'mcnemar_chi2': chi2,
                'mcnemar_p': round(p, 4),
                'mcnemar_method': method,
                'sig_delta': lvl,
                'sig_dir_delta': (1 if b > c else (-1 if c > b else 0)) if lvl > 0 else 0,
            }

        def _delta_vs_rest_for_cut(cut_mask):
            """Welch's t-test on segment Δ-top3 vs. rest-of-sample Δ-top3."""
            seg = delta_t3_signed[cut_mask].dropna()
            rest = delta_t3_signed[~cut_mask].dropna()
            t, p = welch_t_two_sample(list(seg), list(rest))
            lvl = delta_sig_level(p)
            return {
                't_delta_vs_rest': round(t, 2),
                'p_delta_vs_rest': round(p, 4),
                'sig_delta_vs_rest': lvl,
            }

        # Compute delta cells with sig
        delta = OrderedDict()

        # TOTAL row
        total_mask = pd.Series([True] * len(df), index=df.index)
        if 'TOTAL' in pre.keys() and 'TOTAL' in post.keys():
            d = {
                'mean': round(post['TOTAL']['mean'] - pre['TOTAL']['mean'], 2),
                'bot3': round(post['TOTAL']['bot3'] - pre['TOTAL']['bot3'], 1),
                'top3': round(post['TOTAL']['top3'] - pre['TOTAL']['top3'], 1),
                'net':  round(post['TOTAL']['net']  - pre['TOTAL']['net'],  1),
                'n_pre': pre['TOTAL']['n'], 'n_post': post['TOTAL']['n'],
            }
            d.update(_paired_stats_for_cut(total_mask))
            # Total has no "rest" to compare against
            d['t_delta_vs_rest'] = None
            d['p_delta_vs_rest'] = None
            d['sig_delta_vs_rest'] = 0
            delta['TOTAL'] = d

        # Segment rows
        for sid, code, name, party in SEGMENTS:
            if code in pre and code in post:
                cut_mask = (df['SEG'] == code)
                d = {
                    'mean': round(post[code]['mean'] - pre[code]['mean'], 2),
                    'bot3': round(post[code]['bot3'] - pre[code]['bot3'], 1),
                    'top3': round(post[code]['top3'] - pre[code]['top3'], 1),
                    'net':  round(post[code]['net']  - pre[code]['net'],  1),
                    'n_pre': pre[code]['n'], 'n_post': post[code]['n'],
                }
                d.update(_paired_stats_for_cut(cut_mask))
                d.update(_delta_vs_rest_for_cut(cut_mask))
                delta[code] = d

        pp_results[pp['id']] = {'pre': pre, 'post': post, 'delta': delta}

    # Survey-pane selected position (deep-copy registries so we don't mutate module globals)
    import copy
    pp_out = copy.deepcopy(PRE_POST)
    items_out = copy.deepcopy(items_expanded)
    for pp in pp_out:
        post_total = pp_results[pp['id']]['post'].get('TOTAL')
        if not post_total or not pp.get('survey'): continue
        mean = post_total['mean']
        style = pp['survey'].get('style', 'CARDSHUFFLE')
        is_inverted = pp.get('data_inverted_for_display', False)
        if style == 'RANKSORT':
            pos = _clamp(8 - mean)
            focal = pp['survey'].get('focal')
            items_list = list(pp['survey'].get('items', []))
            if focal in items_list:
                items_list.remove(focal)
                items_list.insert(pos - 1, focal)
                pp['survey']['items'] = items_list
        elif is_inverted:
            pos = _clamp(8 - mean)
        else:
            pos = _clamp(mean)
        pp['survey']['selected_pos'] = pos

    for it in items_out:
        total = item_results[it['id']].get('TOTAL')
        if not total or not it.get('survey'): continue
        mean = total['mean']
        is_inverted = it.get('data_inverted_for_display', False)
        pos = _clamp(8 - mean) if is_inverted else _clamp(mean)
        it['survey']['selected_pos'] = pos

    # ── Long-format CSV write deferred to end (after all compute) ──
    # We can't write the CSV here because demographics, influencer, and
    # stigma_extras compute hasn't run yet. The CSV write is moved to just
    # before the JSON write so all sources are represented.

    # Build segment_masks dict (used by Demographics and Influencer360 compute below)
    segment_masks = {s['code']: (df['SEG'] == s['code']) for s in sample}

    # ── Compute Demographics module (per-segment frequency distributions) ─
    demographics_data = []
    demo_active = any(m.get('id') == 'demos' and m.get('active') for m in MODULES)
    if demo_active:
        for dq in DEMOGRAPHICS:
            # ── binary_set style: multi-item block (e.g. Personal Contact) ──
            # Structurally like an Influencer binary_set block — N independent
            # binary items rendered as N rows, % Yes per segment.
            if dq.get('style') == 'binary_set':
                w = pd.to_numeric(df[weight_var], errors='coerce').fillna(1.0) if weight_var else pd.Series([1.0] * len(df))
                entry = {
                    'id':              dq['id'],
                    'wording':         dq['wording'],
                    'style':           'binary_set',
                    'block_label':     dq.get('block_label', f"Demographics — {dq['id']}"),
                    'weight_relevant': dq.get('weight_relevant', False),
                    'pane_extra':      dq.get('pane_extra', {}),
                    'items':           [],
                }
                for item in dq['items']:
                    var = item['var']
                    if var not in df.columns:
                        print(f"WARNING: Demographics binary_set var {var} not in .sav; skipping")
                        continue
                    v = pd.to_numeric(df[var], errors='coerce')
                    cut_entry = {
                        'var':       var,
                        'code':      item['code'],
                        'wording':   item['wording'],
                        'category':  item.get('category', ''),
                        'cuts':      {},
                    }
                    cell_entry = {'yes_value': 1}
                    mask_total = v.notna()
                    cut_entry['cuts']['TOTAL'] = _influencer_cell(v, w, mask_total, 'pct_yes', cell_entry)
                    for s in sample:
                        seg_mask = segment_masks.get(s['code'])
                        if seg_mask is None: continue
                        mask = seg_mask & v.notna()
                        cut_entry['cuts'][s['code']] = _influencer_cell(v, w, mask, 'pct_yes', cell_entry)
                    # Sig testing (z-test of proportion vs. rest of sample)
                    total_count = cut_entry['cuts']['TOTAL'].get('count', 0)
                    total_n     = cut_entry['cuts']['TOTAL']['n']
                    for s in sample:
                        seg_cell = cut_entry['cuts'].get(s['code'])
                        if not seg_cell: continue
                        z = ztest_prop_vs_rest(seg_cell.get('count', 0), seg_cell['n'], total_count, total_n)
                        seg_cell['z']   = round(z, 2)
                        seg_cell['sig'] = sig_level(z)
                    entry['items'].append(cut_entry)
                demographics_data.append(entry)
                continue

            # ── Standard single-variable demographic (existing path) ──
            var = dq['var']
            if var not in df.columns:
                print(f"WARNING: Demographics variable {var} not in .sav; skipping")
                continue
            v = pd.to_numeric(df[var], errors='coerce')
            w = pd.to_numeric(df[weight_var], errors='coerce').fillna(1.0) if weight_var else pd.Series([1.0] * len(df))
            # Build per-segment frequency dict, plus TOTAL and per-segment-cut frequencies
            entry = {
                'id':              dq['id'],
                'var':             var,
                'wording':         dq['wording'],
                'style':           dq['style'],
                'options':         dq['options'],
                'pane_extra':      dq.get('pane_extra', {}),
                'pane_meta':       dq.get('pane_meta', {}),
                'recode':          dq.get('recode', {}),
                'block_label':     dq.get('block_label', f"Demographics — {dq['id']}"),
                'weight_relevant': dq.get('weight_relevant', False),
                'derived_from':    dq.get('derived_from', ''),
                'freq':            {},
            }
            # TOTAL cut
            mask_total = v.notna()
            n_total_q = int(mask_total.sum())
            entry['freq']['TOTAL'] = _freq_for_var(v, w, mask_total, dq['options'], recode=dq.get('recode'))

            # Per-segment cuts
            for s in sample:
                seg_mask = segment_masks.get(s['code'])
                if seg_mask is None:
                    continue
                mask = seg_mask & v.notna()
                entry['freq'][s['code']] = _freq_for_var(v, w, mask, dq['options'], recode=dq.get('recode'))

            # ── Significance: z-test of proportion (segment vs. rest of sample) per cell ──
            # For each response option, compare segment % against the rest of the sample.
            total_freq = entry['freq']['TOTAL']
            for opt in dq['options']:
                opt_val = opt[0]
                total_cell = total_freq.get(opt_val)
                if not total_cell:
                    continue
                total_count = total_cell['n']
                total_n = total_freq['_n_total']
                for s in sample:
                    seg_freq = entry['freq'].get(s['code'])
                    if not seg_freq or opt_val not in seg_freq:
                        continue
                    seg_cell = seg_freq[opt_val]
                    z = ztest_prop_vs_rest(seg_cell['n'], seg_freq['_n_total'], total_count, total_n)
                    seg_cell['z']   = round(z, 2)
                    seg_cell['sig'] = sig_level(z)

            # For QAGE: also compute mean/median if pane_meta requests it
            if dq.get('pane_meta', {}).get('continuous_var'):
                cont_var = dq['pane_meta']['continuous_var']
                if cont_var in df.columns:
                    cont = pd.to_numeric(df[cont_var], errors='coerce')
                    entry['pane_meta']['mean'] = round(cont.mean(), 1) if cont.notna().any() else None
                    entry['pane_meta']['median'] = round(cont.median(), 1) if cont.notna().any() else None

            # Compute weight stats per category (only for weight-relevant variables).
            # Stats: range, median, mean of WGT within each response category.
            if entry['weight_relevant']:
                wstats = {}
                # Use the recoded values if recode applies
                v_for_stats = v.copy()
                if dq.get('recode', {}).get('ruca_collapse'):
                    v_for_stats = v.apply(_ruca_collapse)
                for opt in dq['options']:
                    opt_val = opt[0]
                    sel = (v_for_stats == opt_val)
                    ws = w[sel]
                    if len(ws) > 0:
                        wstats[opt_val] = {
                            'min':    round(float(ws.min()), 3),
                            'max':    round(float(ws.max()), 3),
                            'median': round(float(ws.median()), 3),
                            'mean':   round(float(ws.mean()), 3),
                        }
                entry['weight_stats'] = wstats
                # Overall WGT stats (across all valid)
                ws_all = w[mask_total]
                if len(ws_all) > 0:
                    entry['weight_overall'] = {
                        'min':    round(float(ws_all.min()), 3),
                        'max':    round(float(ws_all.max()), 3),
                        'median': round(float(ws_all.median()), 3),
                        'mean':   round(float(ws_all.mean()), 3),
                    }
            demographics_data.append(entry)
        print(f"Computed Demographics: {len(demographics_data)} questions")

    # ── Compute Influencer360 module — 5 blocks, demographics-style ──
    influencer_data = []
    inf_active = any(m.get('id') == 'influencer' and m.get('active') for m in MODULES)
    if inf_active:
        for blk in INFLUENCER_BLOCKS:
            block_entry = {
                'id':              blk['id'],
                'block_label':     blk['block_label'],
                'wording':         blk['wording'],
                'pane_subtitle':   blk.get('pane_subtitle', ''),
                'kind':            blk['kind'],
                'pane_style':      blk['pane_style'],
                'items':           [],
                'freq':            {},   # used only for categorical kind
                'options':         blk.get('options', []),  # used only for categorical kind
            }
            w = pd.to_numeric(df[weight_var], errors='coerce').fillna(1.0) if weight_var else pd.Series([1.0] * len(df))

            if blk['kind'] == 'categorical':
                # Single variable, frequency distribution across response options
                var = blk['var']
                if var not in df.columns:
                    print(f"WARNING: Influencer var {var} missing; skipping block {blk['id']}")
                    continue
                v = pd.to_numeric(df[var], errors='coerce')
                block_entry['var'] = var
                mask_total = v.notna()
                block_entry['freq']['TOTAL'] = _freq_for_var(v, w, mask_total, blk['options'])
                for s in sample:
                    seg_mask = segment_masks.get(s['code'])
                    if seg_mask is None: continue
                    mask = seg_mask & v.notna()
                    block_entry['freq'][s['code']] = _freq_for_var(v, w, mask, blk['options'])
                block_entry['n_total'] = int(mask_total.sum())

                # Sig testing per option × segment (z-test of proportion vs. rest)
                total_freq = block_entry['freq']['TOTAL']
                for opt in blk['options']:
                    opt_val = opt[0]
                    tc = total_freq.get(opt_val)
                    if not tc:
                        continue
                    total_count = tc['n']
                    total_n = total_freq['_n_total']
                    for s in sample:
                        seg_freq = block_entry['freq'].get(s['code'])
                        if not seg_freq or opt_val not in seg_freq: continue
                        seg_cell = seg_freq[opt_val]
                        z = ztest_prop_vs_rest(seg_cell['n'], seg_freq['_n_total'], total_count, total_n)
                        seg_cell['z']   = round(z, 2)
                        seg_cell['sig'] = sig_level(z)

            else:
                # binary_set, frequency, or composites — N items, one row each
                metric = blk.get('metric', 'pct_yes')
                for item in blk['items']:
                    var = item['var']
                    if var not in df.columns:
                        print(f"WARNING: Influencer var {var} missing; skipping item {item['code']}")
                        continue
                    v = pd.to_numeric(df[var], errors='coerce')

                    # Per-item metric override (composites can have item-level metric, e.g., BCS = 'mean')
                    item_metric = item.get('metric', metric)

                    cut_entry = {
                        'var':         var,
                        'code':        item['code'],
                        'wording':     item['wording'],
                        'tier':        item.get('tier', ''),
                        'formula':     item.get('formula', ''),
                        'metric':      item_metric,
                        'cuts':        {},
                    }
                    # Hand the right metric/parameters to _influencer_cell
                    cell_entry = {
                        'yes_value':   blk.get('yes_value', 1),
                        'never_value': blk.get('never_value', 1),
                    }
                    mask_total = v.notna()
                    cut_entry['cuts']['TOTAL'] = _influencer_cell(v, w, mask_total, item_metric, cell_entry)
                    for s in sample:
                        seg_mask = segment_masks.get(s['code'])
                        if seg_mask is None: continue
                        mask = seg_mask & v.notna()
                        cut_entry['cuts'][s['code']] = _influencer_cell(v, w, mask, item_metric, cell_entry)

                    # ── Sig testing for this item ────────────────────────
                    total_cell = cut_entry['cuts']['TOTAL']
                    if item_metric == 'mean':
                        # Welch's t-test: segment values vs. rest-of-sample values
                        for s in sample:
                            seg_cell = cut_entry['cuts'].get(s['code'])
                            if not seg_cell: continue
                            seg_mask = segment_masks.get(s['code'])
                            rest_mask = (~seg_mask) & v.notna()
                            seg_vals = v[seg_mask & v.notna()].tolist()
                            rest_vals = v[rest_mask].tolist()
                            if len(seg_vals) < 2 or len(rest_vals) < 2:
                                seg_cell['t']   = 0.0
                                seg_cell['sig'] = 0
                                continue
                            t, p = welch_t_two_sample(seg_vals, rest_vals)
                            # Map p-value to existing 2-tier sig levels (p<.05, p<.01)
                            sig = 2 if p < 0.01 else (1 if p < 0.05 else 0)
                            seg_cell['t']   = round(t, 2)
                            seg_cell['p']   = round(p, 4)
                            seg_cell['sig'] = sig
                            # Strip the mask/values from the dict before JSON serialization
                            seg_cell.pop('mask', None)
                            seg_cell.pop('_is_mean', None)
                        total_cell.pop('mask', None)
                        total_cell.pop('_is_mean', None)
                    else:
                        # z-test of proportion: yes-count vs. (rest of sample yes-count)
                        total_count = total_cell.get('count', 0)
                        total_n = total_cell['n']
                        for s in sample:
                            seg_cell = cut_entry['cuts'].get(s['code'])
                            if not seg_cell: continue
                            z = ztest_prop_vs_rest(seg_cell.get('count', 0), seg_cell['n'], total_count, total_n)
                            seg_cell['z']   = round(z, 2)
                            seg_cell['sig'] = sig_level(z)

                    block_entry['items'].append(cut_entry)

            influencer_data.append(block_entry)
        n_items = sum(len(b.get('items', [])) for b in influencer_data) + sum(len(b.get('options', [])) for b in influencer_data if b['kind'] == 'categorical')
        print(f"Computed Influencer360: {len(influencer_data)} blocks, {n_items} total rows")

    # ── Compute HIV Stigma Extras: Knowledge block + Composites block ──
    # These render inside the HIV Stigma module after the HIVSTIGMA and MFQ
    # batteries, completing the umbrella section. Two blocks total.
    stigma_extras = {'knowledge': None, 'composites': None}
    stigma_active = any(m.get('id') == 'stigma' and m.get('active') for m in MODULES)
    if stigma_active:
        w_full = pd.to_numeric(df['WGT'], errors='coerce').fillna(1.0)

        # ── Knowledge block (11 binary items, % aware) ──
        # QHIVr1-r11 are coded 1=Heard before, 2=Not aware. We want % aware = % responding 1.
        # Item 5 ("epidemic effectively over") is the FALSE statement; awareness of it
        # is awareness of misinformation, flagged in the row label and codebook.
        knowledge_items_raw = [
            ('QHIVr1',  'HIV_K1',  'HIV weakens the immune system over time. Without treatment, it can progress to AIDS.', False),
            ('QHIVr2',  'HIV_K2',  'With modern treatment, people with HIV can live a normal lifespan but must remain on treatment for life.', False),
            ('QHIVr3',  'HIV_K3',  "People with HIV who are on effective treatment and have an undetectable viral load cannot sexually transmit HIV (U=U).", False),
            ('QHIVr4',  'HIV_K4',  'There are medications (PrEP) that, when taken correctly, are nearly 100% effective at preventing HIV infection.', False),
            ('QHIVr5',  'HIV_K5',  'New HIV diagnoses in the United States have reached zero — the epidemic is effectively over.', True),    # FALSE
            ('QHIVr6',  'HIV_K6',  'More than half of all new HIV diagnoses in the United States occur in the South.', False),
            ('QHIVr7',  'HIV_K7',  'Only about 1 in 3 Americans who could benefit from HIV prevention medication actually receives it.', False),
            ('QHIVr8',  'HIV_K8',  'Preventing one HIV infection can save the healthcare system hundreds of thousands of dollars in long-term treatment costs.', False),
            ('QHIVr9',  'HIV_K9',  'The Ryan White federal program provides HIV care to more than half of all Americans currently living with HIV.', False),
            ('QHIVr10', 'HIV_K10', 'PEPFAR — a U.S. government program — has provided HIV prevention/treatment globally, credited with saving an estimated 25 million lives since 2003.', False),
            ('QHIVr11', 'HIV_K11', 'HIV in the United States disproportionately affects Black Americans, who account for nearly 40% of new diagnoses while making up about 12% of the population.', False),
        ]

        # Compute % aware (= % responding 1) per segment for each item
        knowledge_block = {
            'id': 'knowledge', 'kind': 'binary_set',
            'block_label': 'HIV Stigma — HIV Knowledge / Awareness',
            'pane_subtitle': '"For each item, indicate whether or not you have heard this before, or if it\'s something you were not previously aware of." 11 items on a designed split sample (LOI-reduction allocation, ~80% of respondents, n=820 valid of 1,044). Cells show % aware (responded "Heard before"). Item K5 is the false statement (epidemic is over); awareness reflects exposure to misinformation.',
            'items': [],
        }
        for var, code, wording, is_false in knowledge_items_raw:
            if var not in df.columns:
                print(f"WARNING: Knowledge var {var} missing; skipping")
                continue
            v = pd.to_numeric(df[var], errors='coerce')
            # Recode 1=aware, 2=not aware → binary 1/0
            v_aware = (v == 1).astype(float)
            v_aware[v.isna()] = pd.NA
            cut_entry = {
                'var': var, 'code': code, 'wording': wording,
                'is_false': is_false, 'cuts': {},
            }
            cell_entry = {'yes_value': 1}
            mask_total = v.notna()
            cut_entry['cuts']['TOTAL'] = _influencer_cell(v_aware, w_full, mask_total, 'pct_yes', cell_entry)
            for s in sample:
                seg_mask = segment_masks.get(s['code'])
                if seg_mask is None: continue
                mask = seg_mask & v.notna()
                cut_entry['cuts'][s['code']] = _influencer_cell(v_aware, w_full, mask, 'pct_yes', cell_entry)
            # Sig per segment vs. rest
            tot_count = cut_entry['cuts']['TOTAL'].get('count', 0)
            tot_n = cut_entry['cuts']['TOTAL']['n']
            for s in sample:
                seg_cell = cut_entry['cuts'].get(s['code'])
                if not seg_cell: continue
                z = ztest_prop_vs_rest(seg_cell.get('count', 0), seg_cell['n'], tot_count, tot_n)
                seg_cell['z'] = round(z, 2)
                seg_cell['sig'] = sig_level(z)
            knowledge_block['items'].append(cut_entry)
        stigma_extras['knowledge'] = knowledge_block

        # ── Composites block (8 composites) ──
        # Each composite is computed in-pipeline from the raw item values; no
        # dependency on derived SPSS variables, so this works whether or not
        # the .sav has XMBS/XSDS/etc. precomputed.
        composites_block = {
            'id': 'stigma_composites', 'kind': 'composites',
            'block_label': 'HIV Stigma — Composites',
            'pane_subtitle': 'Eight composites computed from the items above (designed split sample · n≈820-833 valid depending on composite). Stigma family (MBS, SDS, EDS, SCS): 1-7 means on Likert scales. Moral Foundations (CFS, PFS): 1-7 means on relevance scales. SCF (Sanctity-Care): PFS − CFS, signed differential. HKS (HIV Knowledge): sum 0-10 of correct awareness items (K5 excluded as the false statement).',
            'items': [],
        }
        composite_defs = [
            # (code, label, var_list, formula_str, metric_type)
            ('MBS', 'Moral Blame Score',
             ['QHIVSTIGMAr1', 'QHIVSTIGMAr2'],
             'MBS = mean(QHIVSTIGMAr1, QHIVSTIGMAr2)',  'mean'),
            ('SDS', 'Social Distance / Comfort (HIV+)',
             ['QHIVSTIGMAr3', 'QHIVSTIGMAr4'],
             'SDS = mean(QHIVSTIGMAr3, QHIVSTIGMAr4) [higher = more comfort]', 'mean'),
            ('EDS', 'Excessive Demands Score (anti-LGBTQ)',
             ['QHIVSTIGMAr5', 'QHIVSTIGMAr6'],
             'EDS = mean(QHIVSTIGMAr5, QHIVSTIGMAr6)', 'mean'),
            ('SCS', 'Social Comfort (LGBTQ)',
             ['QHIVSTIGMAr7', 'QHIVSTIGMAr8'],
             'SCS = mean(QHIVSTIGMAr7, QHIVSTIGMAr8) [higher = more comfort]', 'mean'),
            ('CFS', 'Care Foundations Score',
             ['QMFQr1', 'QMFQr2'],
             'CFS = mean(QMFQr1, QMFQr2)', 'mean'),
            ('PFS', 'Purity Foundations Score',
             ['QMFQr3', 'QMFQr4'],
             'PFS = mean(QMFQr3, QMFQr4)', 'mean'),
            ('SCF', 'Sanctity-Care Differential',
             ['QMFQr3', 'QMFQr4', 'QMFQr1', 'QMFQr2'],
             'SCF = PFS − CFS  (positive = purity-leaning, negative = care-leaning)', 'mean_diff'),
            ('HKS', 'HIV Knowledge Score (0-10)',
             ['QHIVr1','QHIVr2','QHIVr3','QHIVr4','QHIVr6','QHIVr7','QHIVr8','QHIVr9','QHIVr10','QHIVr11'],
             'HKS = sum of (response==1) across K1-K11 excluding K5  (max=10)', 'sum_aware'),
        ]
        for code, label, var_list, formula, metric_type in composite_defs:
            # Skip if any required var is missing
            if not all(v in df.columns for v in var_list):
                missing = [v for v in var_list if v not in df.columns]
                print(f"WARNING: Composite {code} skipped, missing: {missing}")
                continue

            # Compute the row-level composite score per respondent
            if metric_type == 'mean':
                comp_series = df[var_list].apply(pd.to_numeric, errors='coerce').mean(axis=1)
            elif metric_type == 'mean_diff':
                # First 2 vars = Purity, last 2 vars = Care
                purity = df[var_list[0:2]].apply(pd.to_numeric, errors='coerce').mean(axis=1)
                care   = df[var_list[2:4]].apply(pd.to_numeric, errors='coerce').mean(axis=1)
                comp_series = purity - care
            elif metric_type == 'sum_aware':
                # Count of items where response == 1 (= "heard before / aware").
                # Build the 0/1 frame preserving NaN, so respondents who didn't
                # take the battery (NaN on every item) are excluded by the
                # downstream mask_total = comp_series.notna() rather than being
                # counted as 'aware of nothing.' min_count=1 makes .sum return
                # NaN for all-NaN rows; partial-NaN rows still sum (NaNs treated
                # as not-aware on the items the respondent didn't see).
                #
                # Previously this used (NaN == 1).astype(float) which yields 0.0,
                # not NaN, biasing per-segment HKS downward in proportion to the
                # split-sample non-response rate per segment.
                raw_frame = pd.DataFrame({v: pd.to_numeric(df[v], errors='coerce') for v in var_list})
                aware_frame = (raw_frame == 1).astype(float)
                aware_frame[raw_frame.isna()] = pd.NA
                comp_series = aware_frame.sum(axis=1, min_count=1)
            else:
                continue

            comp_entry = {
                'var': '+'.join(var_list), 'code': code, 'wording': label,
                'formula': formula, 'metric': 'mean', 'cuts': {},
            }
            mask_total = comp_series.notna()

            def _mean_cell(series, weights, mask):
                v = series[mask]
                wt = weights[mask]
                n = int(mask.sum())
                n_wgt = float(wt.sum())
                if n_wgt > 0:
                    val = (v * wt).sum() / n_wgt
                else:
                    val = 0.0
                return {'n': n, 'val': round(float(val), 3), 'metric': 'mean'}

            comp_entry['cuts']['TOTAL'] = _mean_cell(comp_series, w_full, mask_total)
            for s in sample:
                seg_mask = segment_masks.get(s['code'])
                if seg_mask is None: continue
                mask = seg_mask & comp_series.notna()
                comp_entry['cuts'][s['code']] = _mean_cell(comp_series, w_full, mask)

            # Sig: Welch's t for the segment vs. rest of sample
            for s in sample:
                seg_cell = comp_entry['cuts'].get(s['code'])
                if not seg_cell: continue
                seg_mask = segment_masks.get(s['code']) & comp_series.notna()
                rest_mask = (~segment_masks.get(s['code'])) & comp_series.notna()
                seg_vals = comp_series[seg_mask].tolist()
                rest_vals = comp_series[rest_mask].tolist()
                if len(seg_vals) >= 2 and len(rest_vals) >= 2:
                    t, p = welch_t_two_sample(seg_vals, rest_vals)
                    sig = 2 if p < 0.01 else (1 if p < 0.05 else 0)
                    seg_cell['t']   = round(t, 2)
                    seg_cell['p']   = round(p, 4)
                    seg_cell['sig'] = sig
                else:
                    seg_cell['t'] = 0.0
                    seg_cell['sig'] = 0

            composites_block['items'].append(comp_entry)
        stigma_extras['composites'] = composites_block
        print(f"Computed HIV Stigma extras: Knowledge {len(knowledge_block['items'])} items, Composites {len(composites_block['items'])} items")

    # ── ROI module ─────────────────────────────────────────────────
    # Per-segment ROI numerics computed from the .sav (requires that
    # the PRISM preflight has run — ACTPROB, XROI_cat, XQARS are
    # produced by prism/prism/pipeline.py). The workbook is layered
    # on top as analyst overrides (tier, supporters, influence).
    #
    # Fields per segment:
    #   n, n_wgt              raw and weighted segment counts
    #   composite_roi         weighted mean of XROIr7 ÷ grand weighted
    #                         mean of XROIr7 — the "1.33 for UCP / 1.01
    #                         for HHN" total ROI score (lift vs sample
    #                         average, where 1.0 = average ROI). This
    #                         is the Decipher-rooted composite preserved
    #                         for this study's back-compat with the
    #                         workbook + roi-template SVG; the formula
    #                         lives in prism/composites/core.py.
    #   composite_roi_test    PRISM-native candidate composite, signed
    #                         and reach-normalized:
    #                           num = (LoS · MOVE) + (ACTPROB · BCS)
    #                           ROI = num / pop_share
    #                         where:
    #                           LoS  = workbook coalition_support / 100
    #                           MOVE = weighted mean of XALIGN_MOVE (signed)
    #                           ACTPROB = weighted mean of ACTPROB
    #                           BCS  = weighted mean of XSMr4 (0-1)
    #                           pop_share from study.yaml segment_registry
    #                         Also normalized to 1.0-centered lift in
    #                         composite_roi_test_lift.
    #   roi_raw               weighted mean of XROIr7 (0-100 scale before
    #                         normalization) — keep for diagnostics
    #   activation_prob       weighted mean of ACTPROB × 100 (percent)
    #   pct_highest           weighted % XROI_cat == 1 (Highest-ROI bucket)
    #   pct_strong            weighted % XROI_cat == 2 (Strong-ROI bucket)
    #   pct_softer            weighted % XROI_cat == 3 (Softer bucket)
    #   ars_mean              weighted mean of XQARS
    #   bcs_mean              weighted mean of XSMr4 (BCS, 0-1)
    #   move_mean             weighted mean of XALIGN_MOVE (signed)
    #
    # Workbook (_apply_workbook_roi_overrides) layers on top:
    #   priority_tier, coalition_support, activation_prob, influence_pct
    roi_data = {}
    _w = df['WGT']

    # Grand weighted mean of XROIr7 (denominator of composite_roi)
    grand_xroir7 = None
    if 'XROIr7' in df.columns:
        r7 = pd.to_numeric(df['XROIr7'], errors='coerce')
        ok = r7.notna() & _w.notna() & (_w > 0)
        if ok.any():
            grand_xroir7 = float((r7[ok] * _w[ok]).sum() / _w[ok].sum())

    for sid, code, name, party in SEGMENTS:
        mask = df['SEG'] == code
        n_raw = int(mask.sum())
        if n_raw == 0:
            continue
        sw = _w[mask]
        n_wgt = float(sw.sum())
        cell = {
            'n': n_raw,
            'n_wgt': round(n_wgt, 1),
        }
        if 'XROIr7' in df.columns and grand_xroir7:
            r7 = pd.to_numeric(df.loc[mask, 'XROIr7'], errors='coerce')
            ok = r7.notna() & sw.notna() & (sw > 0)
            if ok.any():
                wm = float((r7[ok] * sw[ok]).sum() / sw[ok].sum())
                cell['roi_raw'] = round(wm, 3)
                cell['composite_roi'] = round(wm / grand_xroir7, 3)
        if 'ACTPROB' in df.columns:
            actp = pd.to_numeric(df.loc[mask, 'ACTPROB'], errors='coerce')
            ok = actp.notna() & sw.notna() & (sw > 0)
            if ok.any():
                wm = float((actp[ok] * sw[ok]).sum() / sw[ok].sum())
                cell['activation_prob'] = round(wm * 100.0, 1)
        if 'XQARS' in df.columns:
            ars = pd.to_numeric(df.loc[mask, 'XQARS'], errors='coerce')
            ok = ars.notna() & sw.notna() & (sw > 0)
            if ok.any():
                cell['ars_mean'] = round(
                    float((ars[ok] * sw[ok]).sum() / sw[ok].sum()), 3)
        if 'XROI_cat' in df.columns:
            cat = pd.to_numeric(df.loc[mask, 'XROI_cat'], errors='coerce')
            ok = cat.notna() & sw.notna() & (sw > 0)
            if ok.any():
                wsum = sw[ok].sum()
                # XROI_cat per prism canonical README:
                #   1 = BACKFIRE
                #   2 = NO PERSUASION
                #   3 = PERSUADABLE
                #   4 = STRONG ROI
                #   5 = HIGHEST ROI
                # Persuadability bar chart on /audience-roi displays
                # in descending order [5, 4, 3, 2, 1] with labels
                # [Highest ROI, Strong ROI, Persuadable, No persuasion,
                # Backfire].
                pct = {}
                for c in (1, 2, 3, 4, 5):
                    pct[c] = round(
                        float(((cat[ok] == c) * sw[ok]).sum() / wsum * 100.0), 1)
                cell['pct_backfire']      = pct[1]
                cell['pct_no_persuasion'] = pct[2]
                cell['pct_persuadable']   = pct[3]
                cell['pct_strong_roi']    = pct[4]
                cell['pct_highest_roi']   = pct[5]
                # Display-order array for STUDY_METRICS.persuadability:
                # [Strong sup, Lean sup, Persuadable, Lean opp, Strong opp]
                # Display order [Highest ROI, Strong ROI, Persuadable,
                # No persuasion, Backfire] = XROI_cat [5, 4, 3, 2, 1].
                cell['persuadability'] = [
                    round(pct[5]), round(pct[4]), round(pct[3]),
                    round(pct[2]), round(pct[1]),
                ]
                # high_roi_pct = % STRONG ROI (cat=4) + % HIGHEST ROI
                # (cat=5). This is the field the workbook stores as
                # "highRoi" and the /audience-roi page surfaces.
                cell['pct_high_roi'] = round(pct[4] + pct[5], 1)
        # coalition_support = weighted % XCOALITION > 3 (Supporters +
        # Champions on the platform-locked PRISM cut). Computed from
        # .sav; workbook can't clobber (re-stamped after the workbook
        # overlay, same pattern as influence_pct).
        if 'XCOALITION' in df.columns:
            coal = pd.to_numeric(df.loc[mask, 'XCOALITION'], errors='coerce')
            ok = coal.notna() & sw.notna() & (sw > 0)
            if ok.any():
                cell['coalition_support_computed'] = round(
                    float(((coal[ok] > 3) * sw[ok]).sum() / sw[ok].sum() * 100.0))
        # MOVE (signed) — input to composite_roi_test persuasion term
        if 'XALIGN_MOVE' in df.columns:
            mv = pd.to_numeric(df.loc[mask, 'XALIGN_MOVE'], errors='coerce')
            ok = mv.notna() & sw.notna() & (sw > 0)
            if ok.any():
                cell['move_mean'] = round(
                    float((mv[ok] * sw[ok]).sum() / sw[ok].sum()), 4)
        # BCS (XSMr4) — input to composite_roi_test influence term
        if 'XSMr4' in df.columns:
            bcs = pd.to_numeric(df.loc[mask, 'XSMr4'], errors='coerce')
            ok = bcs.notna() & sw.notna() & (sw > 0)
            if ok.any():
                cell['bcs_mean'] = round(
                    float((bcs[ok] * sw[ok]).sum() / sw[ok].sum()), 4)
        roi_data[code] = cell

    # Apply workbook overrides on top of the computed values (analyst
    # judgment for tier / coalition_support / influence_pct; workbook
    # activation_prob will overwrite the computed one if set).
    try:
        _apply_workbook_roi_overrides(roi_data)
    except Exception as e:
        print(f"WARNING: workbook ROI overrides not applied: {e}")

    # Re-stamp three computed fields AFTER the workbook overlay so the
    # workbook can't silently clobber values that came from the .sav.
    # All three are measured composites, not analyst judgments:
    #   influence_pct       = BCS (XSMr4) × 100
    #   coalition_support   = % XCOALITION > 3 (Supporters + Champions)
    #   activation_prob     = ACTPROB (XROIr5) × 100
    # YAML overrides further below can still pin a manual value.
    for code, cell in roi_data.items():
        bcs = cell.get('bcs_mean')
        if bcs is not None:
            cell['influence_pct'] = round(float(bcs) * 100)
        coal_computed = cell.get('coalition_support_computed')
        if coal_computed is not None:
            cell['coalition_support'] = coal_computed
        # activation_prob was first stamped from ACTPROB inside the loop
        # above; the workbook overlay may have overwritten it. Re-stamp
        # from the .sav-derived value by recomputing here.
        mask = df['SEG'] == code
        sw = df.loc[mask, 'WGT']
        if 'ACTPROB' in df.columns:
            actp = pd.to_numeric(df.loc[mask, 'ACTPROB'], errors='coerce')
            ok = actp.notna() & sw.notna() & (sw > 0)
            if ok.any():
                cell['activation_prob'] = round(
                    float((actp[ok] * sw[ok]).sum() / sw[ok].sum()) * 100.0, 1)

    # Then apply YAML overrides (study.yaml → dashboard.roi.overrides).
    # YAML wins over workbook so the analyst can change a tier
    # assignment without round-tripping through xlsx.
    yaml_overrides = ((_cfg.get('dashboard') or {}).get('roi') or {}).get('overrides') or {}
    n_yaml = 0
    for code, fields in yaml_overrides.items():
        if code not in roi_data or not isinstance(fields, dict):
            continue
        for k, v in fields.items():
            roi_data[code][k] = v
        n_yaml += 1
    if n_yaml:
        print(f"Applied YAML ROI overrides: {n_yaml} segments from study.yaml")

    # ── PRISM-native candidate composite (composite_roi_test) ─────
    # Computed AFTER workbook overrides because the LoS term reads
    # the workbook-supplied coalition_support. Stamped as a separate
    # field so this study's deliverable (composite_roi from XROIr7)
    # is untouched. Two pieces written:
    #   composite_roi_test       raw value (numerator / pop_share)
    #   composite_roi_test_lift  same, normalized to grand mean ≈ 1.0
    test_raw = {}
    for code, cell in roi_data.items():
        los = (cell.get('coalition_support') or 0) / 100.0
        move = cell.get('move_mean')
        act = (cell.get('activation_prob') or 0) / 100.0
        bcs = cell.get('bcs_mean')
        pop = POP_SHARE_BY_CODE.get(code)
        if None in (move, bcs) or not pop:
            continue
        num = (los * move) + (act * bcs)
        test_raw[code] = num / pop
    if test_raw:
        grand = sum(test_raw.values()) / len(test_raw)
        for code, score in test_raw.items():
            roi_data[code]['composite_roi_test'] = round(score, 4)
            if grand:
                roi_data[code]['composite_roi_test_lift'] = round(score / grand, 3)

    # ── Compute field_dates from SPSS 'date' variable (Completion timestamp) ──
    # Date column has two common shapes depending on the writer:
    #   (a) Already parsed by pyreadstat as datetime64 — use directly.
    #       This is what pyreadstat returns when the .sav came back through
    #       a pandas roundtrip (e.g. PRISM preflight's pyreadstat.write_sav).
    #   (b) Raw numeric seconds-since-1582-10-14 (legacy Decipher exports).
    #       Some vendors store microseconds; autodetect by magnitude.
    field_dates_str = STUDY.get('field_dates', 'TBD')
    if 'date' in df.columns:
        try:
            ser = df['date']
            if pd.api.types.is_datetime64_any_dtype(ser):
                dates = ser.dropna()
            else:
                d = pd.to_numeric(ser, errors='coerce').dropna()
                if len(d) == 0:
                    raise ValueError("no parseable values in 'date'")
                # ~3.2e10 seconds covers years 1582-2600. Anything larger
                # is almost certainly microseconds since the same epoch.
                unit = 's' if d.max() < 3.2e10 else 'us'
                base = pd.Timestamp('1582-10-14')
                dates = base + pd.to_timedelta(d, unit=unit)
            if len(dates) > 0:
                first = dates.min().strftime('%b %d, %Y')
                last  = dates.max().strftime('%b %d, %Y')
                field_dates_str = f"{first} – {last}" if first != last else first
        except Exception as e:
            print(f"WARNING: Could not parse date variable: {e}")

    # ── Compute average LOI from 'qtime' variable (seconds) ──
    # Use trimmed median (drop sub-5-second and over-60-minute extremes) and
    # report in minutes. Median is the convention for survey reporting since
    # it's robust to people who leave the survey open or rush.
    loi_minutes_str = STUDY.get('loi_minutes', None)
    if 'qtime' in df.columns:
        try:
            q = pd.to_numeric(df['qtime'], errors='coerce')
            trimmed = q[(q >= 5) & (q <= 3600)]
            if len(trimmed) > 0:
                median_min = trimmed.median() / 60.0
                loi_minutes_str = f"{median_min:.1f}"
        except Exception as e:
            print(f"WARNING: Could not compute LOI from qtime: {e}")

    # Default survey intro text (the welcome screen prose shown to respondents)
    survey_intro_default = (
        "Thanks for taking part. This survey helps us understand how people "
        "think about health care and public policy today. There are no right "
        "or wrong answers — we're interested in your point of view. Let's begin."
    )

    # ── Write long-format CSV (full audit trail across all sources) ─
    # One row per cell across every module: items + pre_post + demographics +
    # influencer + stigma_extras (knowledge + composites). The schema is wider
    # than any single source needs; columns not relevant to a row are empty.
    rows = []
    # Items (Critics, HIVSTIGMA, MFQ)
    for it in items_out:
        for cut, s in item_results[it['id']].items():
            rows.append({
                'source': 'items', 'item': it['id'], 'code': it['code'], 'wave': '', 'cut': cut,
                'n': s['n'], 'n_wgt': s['n_wgt'], 'metric': 'top3',
                'mean': s['mean'], 'top3': s['top3'], 'bot3': s['bot3'], 'net': s['net'],
                'pct': '', 'val': '',
                'f1': s['freq'][0], 'f2': s['freq'][1], 'f3': s['freq'][2],
                'f4': s['freq'][3], 'f5': s['freq'][4], 'f6': s['freq'][5], 'f7': s['freq'][6],
                'sig': s.get('sig_top3', 0), 'stat': s.get('z_top3', 0),
            })
    # Pre/Post
    for pp in pp_out:
        for wave_name, res in [('PRE', pp_results[pp['id']]['pre']), ('POST', pp_results[pp['id']]['post'])]:
            for cut, s in res.items():
                rows.append({
                    'source': 'pre_post', 'item': pp['id'], 'code': pp['code'], 'wave': wave_name, 'cut': cut,
                    'n': s['n'], 'n_wgt': s['n_wgt'], 'metric': 'top3',
                    'mean': s['mean'], 'top3': s['top3'], 'bot3': s['bot3'], 'net': s['net'],
                    'pct': '', 'val': '',
                    'f1': s['freq'][0], 'f2': s['freq'][1], 'f3': s['freq'][2],
                    'f4': s['freq'][3], 'f5': s['freq'][4], 'f6': s['freq'][5], 'f7': s['freq'][6],
                    'sig': s.get('sig_top3', 0), 'stat': s.get('z_top3', 0),
                })
    # Demographics
    for q in demographics_data:
        if q.get('style') == 'binary_set':
            for it in q.get('items', []):
                for cut, cell in it.get('cuts', {}).items():
                    rows.append({
                        'source': 'demos', 'item': it['var'], 'code': it['code'], 'wave': '', 'cut': cut,
                        'n': cell.get('n', ''), 'n_wgt': '',
                        'metric': 'pct_yes',
                        'mean': '', 'top3': '', 'bot3': '', 'net': '',
                        'pct': cell.get('val', ''), 'val': '',
                        'sig': cell.get('sig', 0), 'stat': cell.get('z', 0),
                    })
        else:
            for opt_val, opt_label in q.get('options', []):
                for cut, freq_dict in q.get('freq', {}).items():
                    cell = freq_dict.get(opt_val)
                    if not cell:
                        continue
                    rows.append({
                        'source': 'demos', 'item': q.get('var', ''),
                        'code': f"{q['id']}={opt_label}", 'wave': '', 'cut': cut,
                        'n': cell['n'], 'n_wgt': cell.get('n_wgt', ''),
                        'metric': 'pct',
                        'mean': '', 'top3': '', 'bot3': '', 'net': '',
                        'pct': cell['pct'], 'val': '',
                        'sig': cell.get('sig', 0), 'stat': cell.get('z', 0),
                    })
    # Influencer360
    for blk in influencer_data:
        if blk['kind'] == 'categorical':
            for opt_val, opt_label in blk.get('options', []):
                for cut, freq_dict in blk.get('freq', {}).items():
                    cell = freq_dict.get(opt_val)
                    if not cell:
                        continue
                    rows.append({
                        'source': 'influencer', 'item': blk.get('var', ''),
                        'code': f"{blk['id']}={opt_label}", 'wave': '', 'cut': cut,
                        'n': cell['n'], 'n_wgt': cell.get('n_wgt', ''),
                        'metric': 'pct',
                        'mean': '', 'top3': '', 'bot3': '', 'net': '',
                        'pct': cell['pct'], 'val': '',
                        'sig': cell.get('sig', 0), 'stat': cell.get('z', 0),
                    })
        else:
            for it in blk.get('items', []):
                for cut, cell in it.get('cuts', {}).items():
                    is_mean = cell.get('metric') == 'mean'
                    rows.append({
                        'source': 'influencer', 'item': it['var'], 'code': it['code'], 'wave': '', 'cut': cut,
                        'n': cell.get('n', ''), 'n_wgt': '',
                        'metric': cell.get('metric', ''),
                        'mean': cell.get('val', '') if is_mean else '',
                        'top3': '', 'bot3': '', 'net': '',
                        'pct': cell.get('val', '') if not is_mean else '',
                        'val': cell.get('val', ''),
                        'sig': cell.get('sig', 0),
                        'stat': cell.get('z', cell.get('t', 0)),
                    })
    # HIV Stigma extras: knowledge + composites
    if stigma_extras.get('knowledge') and stigma_extras['knowledge'].get('items'):
        for it in stigma_extras['knowledge']['items']:
            for cut, cell in it.get('cuts', {}).items():
                rows.append({
                    'source': 'knowledge', 'item': it['var'], 'code': it['code'],
                    'wave': 'FALSE' if it.get('is_false') else '', 'cut': cut,
                    'n': cell.get('n', ''), 'n_wgt': '',
                    'metric': 'pct_aware',
                    'mean': '', 'top3': '', 'bot3': '', 'net': '',
                    'pct': cell.get('val', ''), 'val': '',
                    'sig': cell.get('sig', 0), 'stat': cell.get('z', 0),
                })
    if stigma_extras.get('composites') and stigma_extras['composites'].get('items'):
        for it in stigma_extras['composites']['items']:
            for cut, cell in it.get('cuts', {}).items():
                rows.append({
                    'source': 'composites', 'item': it['code'], 'code': it['code'], 'wave': '', 'cut': cut,
                    'n': cell.get('n', ''), 'n_wgt': '',
                    'metric': 'mean',
                    'mean': cell.get('val', ''), 'top3': '', 'bot3': '', 'net': '',
                    'pct': '', 'val': cell.get('val', ''),
                    'sig': cell.get('sig', 0),
                    'stat': cell.get('t', cell.get('z', 0)),
                })

    csv_path = out_dir / 'results_long.csv'
    pd.DataFrame(rows).to_csv(csv_path, index=False)
    # Source breakdown for the build log
    by_source = {}
    for r in rows:
        by_source[r['source']] = by_source.get(r['source'], 0) + 1
    print(f"Wrote {csv_path}: {len(rows)} rows · " + ' '.join(f'{k}={v}' for k, v in by_source.items()))

    # ── Write JSON snapshot ────────────────────────────────────────
    # ── Trust battery → dashboard.json['trust'] ───────────────────
    # Banner-level data: per-segment full 7-point stats (mean + 1-7 freq
    # distribution + top-3 / bot-3) + z-test on top-3 proportion vs rest of
    # sample — same structure as every other 7-point item in the topline
    # (HIV Stigma, Critics). Uses df['WGT'], so the HIV persona tab can
    # derive trust.json from the same single source. The display module (06)
    # stays active:False per the brief; this emits the data, the React side
    # decides whether to show it.
    trust_out = []
    for var, label in TRUST_LBL.items():
        if var not in df.columns:
            continue
        col = pd.to_numeric(df[var], errors='coerce')
        cuts = OrderedDict()
        s_total = _stats(col, df['WGT'])
        if s_total:
            cuts['TOTAL'] = s_total
        for sid, code, name, party in SEGMENTS:
            mask = df['SEG'] == code
            s = _stats(col[mask], df['WGT'][mask])
            if not s:
                continue
            if s_total:
                z = ztest_prop_vs_rest(s['top3_count'], s['n'], s_total['top3_count'], s_total['n'])
                s['z_top3'] = round(z, 2)
                s['sig_top3'] = sig_level(z)
                s['sig_dir'] = (1 if z > 0 else -1) if s['sig_top3'] > 0 else 0
            cuts[code] = s
        if cuts:
            trust_out.append({
                'code': var, 'label': label, 'metric': 'top3', 'scale': 7,
                'cuts': cuts,
            })
    if trust_out:
        print(f"Computed trust battery: {len(trust_out)} messengers (full 7-pt stats + sig)")

    out = {
        'study': {**STUDY,
                  'n_total': STUDY_TOTAL_N,
                  'n_total_wgt': round(STUDY_TOTAL_N_WGT, 1),
                  'field_dates': field_dates_str,
                  'survey_intro': STUDY.get('survey_intro', survey_intro_default),
                  'loi_minutes': loi_minutes_str},
        'labels': LABELS,
        'modules': MODULES, 'segments': sample,
        'items': items_out, 'item_results': item_results,
        'pre_post': pp_out, 'pp_results': pp_results,
        'demographics': demographics_data,
        'influencer': influencer_data,
        'stigma_extras': stigma_extras,
        'trust': trust_out,
        'roi_data': roi_data,
    }
    json_path = out_dir / 'dashboard.json'
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print(f"Wrote {json_path}")

    # ── Inject into template (if found alongside) ─────────────────
    template_path = out_dir / 'dashboard_template.html'
    if template_path.exists():
        html_path = out_dir / 'dashboard.html'
        tpl = template_path.read_text(encoding='utf-8')
        html = tpl.replace('__DATA_PLACEHOLDER__', json.dumps(out))
        html_path.write_text(html, encoding='utf-8')
        print(f"Wrote {html_path} ({len(html):,} bytes)")
    else:
        print(f"(No dashboard_template.html found in {out_dir}; skipped HTML build.)")

    print(f"Total n: {STUDY_TOTAL_N}, segments populated: {sum(1 for s in sample if s['n']>0)}")
    return out
