"""
PRISM composite scoring — platform-locked math.

Every function takes (df, config) and returns the modified DataFrame.
Idempotent; missing values flow through pandas nullable semantics with
no silent imputation. Refactored from the validated prototype
(reference/prototypes/prism_composites.py) — the test suite proves
byte-equivalence against it on the HIV Wave 1 reference input.

This module is the system of record. It deliberately CORRECTS two bugs
in the deployed Decipher XML (see README.md): the XSM2 trap comparison
(c3, not c1) and nothing else — the rank-constant difference (8-rank
here vs 7-rank in Decipher execs) is NOT a bug, both produce the
intended 1-7 priority score from their respective inputs.

PLATFORM-LOCKED CONSTANTS — changing any of these is a platform-version
event that breaks cross-study comparability. They are not study config.
"""

import numpy as np
import pandas as pd

from .config import CompositeConfig

# Even-width coalition cutpoints on the 1-7 alignment scale
COALITION_BINS = [-np.inf, 3, 4, 5, 6, np.inf]      # → 1..5
# Diagnostic PRE-alignment category bins (legacy 0-4 coding)
ALIGN_PRE_C_BINS = [-np.inf, 4, 5, 5.6, 6.6, np.inf]  # → 0..4

# ARS weighting (calibrated; locked)
ARS_WEIGHTS = {"QP3": 0.40, "QP1": 0.30, "QP2": 0.30}
# QP1/QP3 DK-midpoint recode (1=SD, 2=D, 3=DK, 4=A, 5=SA)
QP_RECODE = {1: 1, 2: 2, 3: 4, 4: 5, 5: 3}

# Validity penalty on activation
PENALTY_FAIL = 0.6
PENALTY_PASS = 1.0

# ROI component scaling (locked)
ROI_MOVE_CLIP_DENOM = 0.8     # MOVE/0.8 clipped 0-1 → persuasion units
ROI_PERSUASION_SCALE = 40
ROI_COALITION_SCALE = 30
ROI_ACTIVATION_SCALE = 30


# ── Demographic recodes ────────────────────────────────────────────────

def recode_race_eth(df, config: CompositeConfig):
    """XRACE_ETH — 4-category race/ethnicity (Census Vintage 2024 frame)."""
    df["XRACE_ETH"] = df[config.race_var].map(config.race_recode)
    return df


# ── PRE/POST item recodes ──────────────────────────────────────────────

def recode_priority_rank(df, config: CompositeConfig):
    """XQPRE_1r1 / XPOST_1r1 — rank (1=most important) → priority score
    (higher = more important): (scale+1) − rank.

    The SAV stores the visible 1-N rank, so the constant is scale+1 = 8.
    (Decipher execs see zero-indexed .ival and use 7 — same result; do
    not "fix" the discrepancy.)
    """
    k = config.rank_scale_size + 1
    df["XQPRE_1r1"] = k - df[config.priority_rank_pre]
    df["XPOST_1r1"] = k - df[config.priority_rank_post]
    return df


def recode_reversed_items(df, config: CompositeConfig):
    """Reverse-code items so high = substantive agreement: (max+1) − x."""
    k = config.likert_max + 1
    for src, dst in config.reverse_coded.items():
        df[dst] = k - df[src]
    return df


def compute_item_deltas(df, config: CompositeConfig):
    """XQPRE_POST_r1..rK — per-item PRE → POST change scores."""
    for i, (pre, post) in enumerate(
            zip(config.pre_items, config.post_items), start=1):
        df[f"XQPRE_POST_r{i}"] = df[post] - df[pre]
    return df


# ── Alignment composites ───────────────────────────────────────────────

def compute_alignment(df, config: CompositeConfig):
    """XALIGN_PRE / XALIGN_POST / XALIGN_MOVE — item means + shift."""
    df["XALIGN_PRE"] = df[config.pre_items].mean(axis=1)
    df["XALIGN_POST"] = df[config.post_items].mean(axis=1)
    df["XALIGN_MOVE"] = df["XALIGN_POST"] - df["XALIGN_PRE"]
    return df


def categorize_alignment_pre(df, config: CompositeConfig):
    """XQALIGN_PRE_C — 5-category PRE alignment, legacy 0-4 coding.
    (The Decipher export of this variable is 1-5: a pure label offset,
    math identical — documented in the audit.)"""
    df["XQALIGN_PRE_C"] = pd.cut(
        df["XALIGN_PRE"], bins=ALIGN_PRE_C_BINS,
        labels=[0, 1, 2, 3, 4], right=False).astype("Int64")
    return df


# ── Coalition categorization (locked) ──────────────────────────────────

def categorize_coalition(df, config: CompositeConfig):
    """XCOALITION — 1=REJECTOR..5=CHAMPION from ALIGN_POST (locked bins)."""
    df["XCOALITION"] = pd.cut(
        df["XALIGN_POST"], bins=COALITION_BINS,
        labels=[1, 2, 3, 4, 5], right=False).astype("Int64")
    return df


def normalize_coalition(df, config: CompositeConfig):
    """XCOAL_NORM — 0-1 normalized coalition score."""
    df["XCOAL_NORM"] = (df["XCOALITION"].astype(float) - 1) / 4
    return df


# ── Validity & penalty ─────────────────────────────────────────────────

def compute_validity_flag(df, config: CompositeConfig):
    """XSM2 — 1 if overclaim flagged OR trap failed (CORRECTED logic:
    the trap expects trap_expected, c3 in HIV Wave 1; the deployed
    Decipher XML checks c1 and flags 100% of respondents)."""
    overclaim_failed = df[config.overclaim_var] == 1
    trap = df[config.trap_var]
    trap_failed = trap.notna() & (trap != config.trap_expected)
    df["XSM2"] = (overclaim_failed | trap_failed).astype(int)
    return df


def compute_penalty(df, config: CompositeConfig):
    """XPenalty — 0.6 if flagged invalid, 1.0 if clean."""
    df["XPenalty"] = np.where(df["XSM2"] == 1, PENALTY_FAIL, PENALTY_PASS)
    return df


# ── ARS — Action Readiness Score ───────────────────────────────────────

def compute_qp_normalized(df, config: CompositeConfig):
    """XQP1/XQP2/XQP3 — 0-1 normalized; QP1/QP3 get the DK-midpoint
    recode first (QP2, the rate item, has no DK)."""
    a = config.ars_items
    df["XQP1"] = (df[a["QP1"]].map(QP_RECODE) - 1) / 4
    df["XQP2"] = (df[a["QP2"]] - 1) / 4
    df["XQP3"] = (df[a["QP3"]].map(QP_RECODE) - 1) / 4
    return df


def compute_ars(df, config: CompositeConfig):
    """XQARS — weighted Action Readiness Score (0-1)."""
    df["XQARS"] = (ARS_WEIGHTS["QP3"] * df["XQP3"]
                   + ARS_WEIGHTS["QP1"] * df["XQP1"]
                   + ARS_WEIGHTS["QP2"] * df["XQP2"])
    return df


def compute_ars_adjusted(df, config: CompositeConfig):
    """XQARSadj — ARS × validity penalty."""
    df["XQARSadj"] = df["XQARS"] * df["XPenalty"]
    return df


# ── ROI composites ─────────────────────────────────────────────────────

def compute_roi_components(df, config: CompositeConfig):
    """XROIr1..r7 — ROI components; r5 applies the per-study activation
    coefficients (fit by prism.activation, carried in config)."""
    df["XROIr1"] = df["XALIGN_POST"] / 7
    df["XROIr2"] = df["XALIGN_MOVE"] * (1 + df[config.bcs_var])
    df["XROIr3"] = ((df["XALIGN_MOVE"] / ROI_MOVE_CLIP_DENOM)
                    .clip(lower=0, upper=1) * ROI_PERSUASION_SCALE)
    df["XROIr4"] = df["XROIr1"] * ROI_COALITION_SCALE
    z = (config.act_intercept
         + config.act_ars_slope * df["XQARS"]
         + config.act_bcs_slope * df[config.bcs_var])
    df["XROIr5"] = 1 / (1 + np.exp(-z))
    df["XROIr6"] = df["XROIr5"] * df["XQARSadj"] * ROI_ACTIVATION_SCALE
    df["XROIr7"] = df["XROIr3"] + df["XROIr4"] + df["XROIr6"]
    return df


def categorize_roi(df, config: CompositeConfig):
    """XROI_cat — 1=BACKFIRE..5=HIGHEST ROI (issue-calibrated thresholds)."""
    move, post, actprob = df["XALIGN_MOVE"], df["XALIGN_POST"], df["XROIr5"]
    cat = pd.Series(2, index=df.index, dtype="Int64")          # NO PERSUASION
    cat[move > 0] = 3                                          # PERSUADABLE
    cat[(move > 0) & (actprob >= config.roi_strong_actprob)
        & (post >= config.roi_strong_post)] = 4                # STRONG
    cat[(move > 0) & (actprob >= config.roi_highest_actprob)
        & (post >= config.roi_highest_post)] = 5               # HIGHEST
    cat[move < 0] = 1                                          # BACKFIRE
    cat[move.isna() | post.isna() | actprob.isna()] = pd.NA
    df["XROI_cat"] = cat
    return df


# ── Orchestrator ───────────────────────────────────────────────────────

PIPELINE = [
    ("Demographic recodes", recode_race_eth),
    ("Priority rank", recode_priority_rank),
    ("Reverse-coded items", recode_reversed_items),
    ("Item-level deltas", compute_item_deltas),
    ("Alignment composites", compute_alignment),
    ("PRE alignment category", categorize_alignment_pre),
    ("Coalition category", categorize_coalition),
    ("Coalition normalized", normalize_coalition),
    ("Validity flag (XSM2)", compute_validity_flag),
    ("Penalty multiplier", compute_penalty),
    ("QP normalized", compute_qp_normalized),
    ("ARS", compute_ars),
    ("ARS adjusted", compute_ars_adjusted),
    ("ROI components", compute_roi_components),
    ("ROI category", categorize_roi),
]


def compute_all_prism(df, config: CompositeConfig, verbose=False):
    """Run the full composite pipeline in dependency order."""
    config.validate()
    for name, fn in PIPELINE:
        df = fn(df, config)
        if verbose:
            print(f"  ✓ {name}")
    return df
