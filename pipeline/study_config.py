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
            'label': r.get('mm_name', r['name']),
            'party': party_map[r['party']],
            'priority_tier': tiers.get(r['id']),
        }
        for r in cfg['segment_registry']
    }


# ── Messagemap analytical config ───────────────────────────────────────

def baskets(cfg):
    """Baskets with 'all' expanded to the full expected-id list."""
    expected = cfg['segments']['expected_ids']
    out = []
    for b in cfg['baskets']:
        segs = list(expected) if b['segments'] == 'all' else list(b['segments'])
        out.append({'id': b['id'], 'name': b['name'],
                    'segments': segs, 'weight': b['weight']})
    return out


def index_items(cfg):
    """prism_index's INDEX_ITEMS shape, with raw .sav var names resolved."""
    conv = cfg['sav_conventions']
    out = []
    for it in cfg['index']['items']:
        n = int(it['idx_id'].split('_')[1])
        out.append({
            'pre':  resolve_var(cfg, conv['index_pre_pattern'].format(idx_num=n)),
            'post': resolve_var(cfg, conv['index_post_pattern'].format(idx_num=n)),
            'reverse': it['reverse'],
            'label': it['label'],
        })
    return out


def message_config(cfg):
    """prism_step3's MESSAGE_CONFIG shape: [{item, proof_var, n_proofs}].
    proof_var is the raw .sav column carrying the proof-token assignment;
    None for messages with a single (base-only) token value."""
    conv = cfg['sav_conventions']
    out = []
    for m in cfg['maxdiff_messages']:
        n_tok = m['n_token_values']
        proof_var = (resolve_var(cfg, conv['token_var_pattern'].format(msg_num=m['msg']))
                     if n_tok > 1 else None)
        out.append({'item': m['msg'], 'proof_var': proof_var, 'n_proofs': n_tok})
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
