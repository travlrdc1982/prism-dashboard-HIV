"""
PRISM study config loader — the single configuration entry point.

Every pipeline engine (topline compute_core, messagemap prism_*) loads
its study-specific constants from study/study.yaml through this module.
The engines carry NO hardcoded study constants.

Path resolution:
    $PRISM_STUDY_CONFIG  if set, else  <repo>/study/study.yaml

Variable-name resolution:
    The YAML declares canonical variable names (sav_conventions patterns:
    M{NNN}_token, task{NN}_best, idx{NNN}_pre, persona_framing, ...).
    Studies fielded with legacy naming map raw → canonical in
    legacy_rename; resolve_var() inverts that map so engines can address
    the raw .sav columns. A study fielded with canonical names from the
    start has an empty legacy_rename and resolve_var() is the identity.
"""
import os
from functools import lru_cache
from pathlib import Path

import yaml

_REPO = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG = str(_REPO / 'study' / 'study.yaml')


@lru_cache(maxsize=4)
def _load(path):
    with open(path, encoding='utf-8') as f:
        return yaml.safe_load(f)


def load_config(path=None):
    """Load (and cache) the study config."""
    return _load(path or os.environ.get('PRISM_STUDY_CONFIG', DEFAULT_CONFIG))


def inverse_rename(cfg):
    """canonical name → raw .sav name (empty legacy_rename → empty map)."""
    return {v: k for k, v in (cfg.get('legacy_rename') or {}).items()}


def resolve_var(cfg, canonical):
    """Resolve a canonical variable name to the raw .sav column name."""
    return inverse_rename(cfg).get(canonical, canonical)


# ── Segment views ──────────────────────────────────────────────────────

def registry_ids(cfg):
    """The expected segment-id list, derived from segment_registry."""
    return [r['id'] for r in cfg['segment_registry']]


def seg_name_by_id(cfg):
    """{id: code} — replaces per-script SEG_NAME hardcodes."""
    return {r['id']: r['code'] for r in cfg['segment_registry']}


def pop_share_by_code(cfg):
    """{code: canonical population share} — THE population weighting source."""
    return {r['code']: r['pop_share'] for r in cfg['segment_registry']}


def party_ids(cfg, party):
    """Segment-id set for a party ('GOP' or 'DEM')."""
    return {r['id'] for r in cfg['segment_registry'] if r['party'] == party}


def segments_topline(cfg):
    """compute_core's SEGMENTS shape: [[id, code, name, party], ...]."""
    return [[r['id'], r['code'], r['name'], r['party']]
            for r in cfg['segment_registry']]


def segments_messagemap(cfg):
    """prism_build_dashboard's SEGMENTS shape:
    {id: {code, label, party R/D, priority_tier}, ...}."""
    party_map = {'GOP': 'R', 'DEM': 'D'}
    tiers = {int(k): v for k, v in
             (cfg['segments'].get('priority_tier_in_study') or {}).items()}
    return {
        r['id']: {
            'code': r['code'],
            'label': r['name'],
            'party': party_map[r['party']],
            'priority_tier': tiers.get(r['id']),
        }
        for r in cfg['segment_registry']
    }


def topline_study(cfg):
    """compute_core's STUDY dict: identity fields from the top-level
    study block + topline-specific display fields from topline_config."""
    s = cfg['study']
    t = cfg['topline_config']['study']
    return {
        'id': s['id'],
        'title': s['title'],
        'subtitle': t['subtitle'],
        'field_dates': s['field_dates'],
        'version': s['version'],
        'analyst': s['analyst'],
        **{k: v for k, v in t.items() if k != 'subtitle'},
    }


# ── Messagemap analytical config ───────────────────────────────────────

def baskets(cfg):
    """Baskets with selector expressions resolved against the registry:
        all          → every segment
        party:GOP    → segments with that party
        tier:any     → any segment with a priority tier
        tier:N       → segments assigned tier N
        [ids...]     → explicit list, passed through
    """
    tiers = {int(k): v for k, v in
             (cfg['segments'].get('priority_tier_in_study') or {}).items()}
    out = []
    for b in cfg['baskets']:
        sel = b['segments']
        if isinstance(sel, list):
            segs = list(sel)
        elif sel == 'all':
            segs = registry_ids(cfg)
        elif sel.startswith('party:'):
            want = sel.split(':', 1)[1]
            segs = [r['id'] for r in cfg['segment_registry'] if r['party'] == want]
        elif sel.startswith('tier:'):
            want = sel.split(':', 1)[1]
            if want == 'any':
                segs = [i for i in registry_ids(cfg) if i in tiers]
            else:
                segs = [i for i in registry_ids(cfg) if tiers.get(i) == int(want)]
        else:
            raise ValueError(f"basket {b['id']!r}: unknown segment selector {sel!r}")
        if not segs:
            raise ValueError(f"basket {b['id']!r}: selector {sel!r} matched no segments")
        out.append({'id': b['id'], 'name': b['name'],
                    'segments': segs, 'weight': b['weight']})
    return out


def index_items(cfg):
    """prism_index's INDEX_ITEMS shape, with raw .sav var names resolved.
    Index variable numbers are positional (1-based list order)."""
    conv = cfg['sav_conventions']
    out = []
    for n, it in enumerate(cfg['index']['items'], 1):
        out.append({
            'pre':  resolve_var(cfg, conv['index_pre_pattern'].format(idx_num=n)),
            'post': resolve_var(cfg, conv['index_post_pattern'].format(idx_num=n)),
            'reverse': it['reverse'],
            'label': it['label'],
        })
    return out


def _load_variants(cfg):
    """Load the parsed variants workbook (prism_variants.json) — the
    source of truth for message count and per-message token counts."""
    path = os.environ.get(
        'PRISM_VARIANTS_JSON',
        str(_REPO / 'pipeline' / 'messagemap' / 'outputs' / 'prism_variants.json'))
    import json
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def n_messages(cfg):
    """Message count, derived from the variants workbook."""
    return _load_variants(cfg)['n_messages']


def message_config(cfg):
    """prism_step3's MESSAGE_CONFIG shape: [{item, proof_var, n_proofs}].
    Derived from the variants workbook: n_proofs = the workbook's token
    count per message; proof_var = the raw .sav column carrying the
    proof-token assignment (None for base-only messages). Message ids
    must be contiguous MSG_001..MSG_NNN."""
    conv = cfg['sav_conventions']
    variants = _load_variants(cfg)
    max_msgs = cfg.get('platform_constraints', {}).get('max_messages_per_study')
    if max_msgs and variants['n_messages'] > max_msgs:
        raise ValueError(
            f"variants workbook has {variants['n_messages']} messages, "
            f"exceeding platform max_messages_per_study ({max_msgs})")
    max_tok = cfg.get('platform_constraints', {}).get('max_tokens_per_message')
    out = []
    for i, m in enumerate(variants['messages'], 1):
        msg_num = int(str(m['msg_id']).rsplit('_', 1)[-1])
        if msg_num != i:
            raise ValueError(
                f"variants workbook message ids must be contiguous: "
                f"position {i} has {m['msg_id']!r}")
        n_tok = m['n_tokens']
        if max_tok and n_tok > max_tok:
            raise ValueError(
                f"message {msg_num}: {n_tok} token values exceed platform "
                f"max_tokens_per_message ({max_tok})")
        proof_var = (resolve_var(cfg, conv['token_var_pattern'].format(msg_num=msg_num))
                     if n_tok > 1 else None)
        out.append({'item': msg_num, 'proof_var': proof_var, 'n_proofs': n_tok})
    return out


def task_vars(cfg):
    """(best, worst) raw .sav column names per task, 1-indexed dict."""
    conv = cfg['sav_conventions']
    n_tasks = cfg['maxdiff']['n_tasks']
    return {
        t: (resolve_var(cfg, conv['task_best_pattern'].format(task=t)),
            resolve_var(cfg, conv['task_worst_pattern'].format(task=t)))
        for t in range(1, n_tasks + 1)
    }


def sav_vars(cfg):
    """Raw .sav names for the singleton variables the engines address."""
    conv = cfg['sav_conventions']
    return {
        'arm': resolve_var(cfg, conv['arm_var']),
        'segment': resolve_var(cfg, conv['segment_var']),
        'design_version': resolve_var(cfg, conv['design_version_var']),
        'record_id': cfg['sources'].get('record_id_var', 'record'),
    }
