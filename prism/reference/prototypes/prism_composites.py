"""
PRISM Composite Scoring Pipeline
================================

Canonical Python implementation of all PRISM composite scores and recodes.
Migrated from Decipher exec/virtual blocks for use in the dashboard pipeline.

USAGE
-----
    import pandas as pd
    import pyreadstat
    from prism_composites import compute_all_prism

    df, meta = pyreadstat.read_sav("260433.sav")
    df = compute_all_prism(df)

DESIGN PRINCIPLES
-----------------
1. Every function takes a DataFrame and returns the modified DataFrame.
2. All functions are idempotent — safe to re-run.
3. Missing values flow through pandas' nullable semantics; no silent imputation.
4. Source variables are validated; KeyError raised if missing.
5. Code preserves the exact algorithms agreed for HIV Wave 1.

NOTES ON DEPLOYED XML
---------------------
This module is the ground truth — it corrects two bugs known to exist
in the Decipher XML as of the most recent SAV (260433.sav):

  BUG 1 (XSM2): The deployed validity logic checks for c1 ("Strongly
                Disagree") when the trap question instructs respondents
                to select c3 ("Somewhat Disagree"). 100% of respondents
                are currently flagged as invalid. This module uses the
                correct comparison.

  BUG 2 (rank): Decipher's ranksort.8 returns zero-indexed values via
                .ival inside execs, so the deployed XML uses `7 - rank`.
                BUT the SAV stores the visible 1-7 rank value, so in
                Python we use `8 - rank` to produce the intended 1-7
                priority score.
"""

import numpy as np
import pandas as pd
import math


# =============================================================================
# CONSTANTS — locked decisions for HIV Wave 1
# =============================================================================

# Even-width coalition cutpoints (locked across PRISM studies)
COALITION_CUTS = {
    'REJECTOR':  (None, 3),     # ALIGN_POST < 3
    'DOUBTER':   (3, 4),        # 3 <= ALIGN_POST < 4
    'CONVERTER': (4, 5),        # 4 <= ALIGN_POST < 5
    'SUPPORTER': (5, 6),        # 5 <= ALIGN_POST < 6
    'CHAMPION':  (6, None),     # ALIGN_POST >= 6
}

# ARS weights (calibrated — keep original 0.40 / 0.30 / 0.30)
ARS_WEIGHTS = {'QP3': 0.40, 'QP1': 0.30, 'QP2': 0.30}

# QP1 / QP3 row recoding (DK midpoint adjustment)
#   1=Strongly Disagree, 2=Disagree, 3=Don't Know (DK), 4=Agree, 5=Strongly Agree
#   Recoded: DK (3) -> midpoint (4); Agree (4) and Strongly Agree (5) shift up
QP_RECODE = {1: 1, 2: 2, 3: 4, 4: 5, 5: 3}

# Activation logistic coefficients (from calibration study)
ACT_LOGISTIC = {
    'intercept': -0.759,
    'ars_slope':  1.547,
    'bcs_slope':  0.769,
}

# Penalty for failed validity check
PENALTY_FAIL = 0.6   # 40% downweight on activation
PENALTY_PASS = 1.0

# ROI category thresholds (HIV-calibrated)
ROI_THRESHOLDS = {
    'HIGHEST_actprob': 0.50,
    'HIGHEST_post':    5.0,
    'STRONG_actprob':  0.25,
    'STRONG_post':     4.5,
}


# =============================================================================
# DEMOGRAPHIC RECODES
# =============================================================================

def recode_race_eth(df):
    """4-category race/ethnicity from QRACE_ETHNIC.

    Census Vintage 2024 framework:
        1 = White, non-Hispanic
        2 = Black, non-Hispanic
        3 = Hispanic (any race)
        4 = Other, non-Hispanic (collapses Asian + Other)
    """
    mapping = {
        1.0: 1,    # White NH -> White NH
        2.0: 2,    # Black NH -> Black NH
        3.0: 4,    # Asian NH -> Other NH
        4.0: 4,    # Other NH -> Other NH
        5.0: 3,    # Hispanic -> Hispanic
    }
    df['XRACE_ETH'] = df['QRACE_ETHNIC'].map(mapping)
    return df


# =============================================================================
# PRE/POST ITEM RECODES
# =============================================================================

def recode_priority_rank(df):
    """Convert HIV priority rank (1-7) to priority score (1-7).

    QPRE_1 and QPOST_1 are forced rank questions where:
        rank 1 = most important (highest priority)
        rank 7 = least important (lowest priority)

    The priority score inverts this so higher = more important.
        rank 1 -> priority 7
        rank 7 -> priority 1

    Same as deployed XML logic, but Python sees stored rank values 1-7
    so the constant is 8 (Decipher exec sees zero-indexed via .ival, uses 7).
    """
    df['XQPRE_1r1']  = 8 - df['QPRE_1r1']
    df['XPOST_1r1']  = 8 - df['QPOST_1r1']
    return df


def recode_reversed_items(df):
    """Reverse-code QPRE_6 and QPOST_6 to align scale direction.

    These items are worded such that low values indicate agreement with
    the negative pole; flipped so high = agreement with the substantive
    direction. Standard 1-7 Likert reversal: (max+1) - value = 8 - value.
    """
    df['XQPRE_6R'] = 8 - df['QPRE_6']
    df['XPOST_6R'] = 8 - df['QPOST_6']
    return df


def compute_item_deltas(df):
    """Per-item PRE -> POST change scores.

    Stored as XQPRE_POST_r1 through XQPRE_POST_r7 for downstream
    analysis of which items moved most.
    """
    df['XQPRE_POST_r1'] = df['XPOST_1r1']  - df['XQPRE_1r1']
    df['XQPRE_POST_r2'] = df['QPOST_2']    - df['QPRE_2']
    df['XQPRE_POST_r3'] = df['QPOST_3']    - df['QPRE_3']
    df['XQPRE_POST_r4'] = df['QPOST_4']    - df['QPRE_4']
    df['XQPRE_POST_r5'] = df['QPOST_5']    - df['QPRE_5']
    df['XQPRE_POST_r6'] = df['XPOST_6R']   - df['XQPRE_6R']
    df['XQPRE_POST_r7'] = df['QPOST_7r1']  - df['QPRE_7r1']
    return df


# =============================================================================
# ALIGNMENT COMPOSITES
# =============================================================================

def compute_alignment(df):
    """ALIGN_PRE, ALIGN_POST, ALIGN_MOVE composites.

    Average across 7 items, each scored 1-7 (higher = more aligned).
    Items: priority rank, 5 attitude items, reverse-coded vaccine item.
    Some respondents may have missing items; pandas mean handles NaN.
    """
    pre_items = [
        'XQPRE_1r1', 'QPRE_2', 'QPRE_3', 'QPRE_4',
        'QPRE_5', 'XQPRE_6R', 'QPRE_7r1'
    ]
    post_items = [
        'XPOST_1r1', 'QPOST_2', 'QPOST_3', 'QPOST_4',
        'QPOST_5', 'XPOST_6R', 'QPOST_7r1'
    ]

    df['XALIGN_PRE']  = df[pre_items].mean(axis=1)
    df['XALIGN_POST'] = df[post_items].mean(axis=1)
    df['XALIGN_MOVE'] = df['XALIGN_POST'] - df['XALIGN_PRE']
    return df


def categorize_alignment_pre(df):
    """5-category PRE alignment (mirrors XCOALITION boundaries for diagnostic use)."""
    cuts = [-np.inf, 4, 5, 5.6, 6.6, np.inf]
    labels = [0, 1, 2, 3, 4]   # legacy category values
    df['XQALIGN_PRE_C'] = pd.cut(
        df['XALIGN_PRE'], bins=cuts, labels=labels, right=False
    ).astype('Int64')
    return df


# =============================================================================
# COALITION CATEGORIZATION (locked, platform standard)
# =============================================================================

def categorize_coalition(df):
    """5-category coalition position from ALIGN_POST.

    Even-width bins on 1-7 scale:
        1 = REJECTOR   (ALIGN_POST < 3)
        2 = DOUBTER    (3 <= ALIGN_POST < 4)
        3 = CONVERTER  (4 <= ALIGN_POST < 5)
        4 = SUPPORTER  (5 <= ALIGN_POST < 6)
        5 = CHAMPION   (ALIGN_POST >= 6)

    Cutpoints are scale-anchored (SUPPORTER = "agree", CHAMPION = "strongly agree")
    and locked across PRISM studies.
    """
    cuts = [-np.inf, 3, 4, 5, 6, np.inf]
    labels = [1, 2, 3, 4, 5]
    df['XCOALITION'] = pd.cut(
        df['XALIGN_POST'], bins=cuts, labels=labels, right=False
    ).astype('Int64')
    return df


def normalize_coalition(df):
    """0-1 normalized coalition score (for use as continuous multiplier)."""
    df['XCOAL_NORM'] = (df['XCOALITION'].astype(float) - 1) / 4
    return df


# =============================================================================
# SOCIAL MEDIA / INFLUENCE COMPOSITE
# =============================================================================
# These pull from QSM (3 items on social media behavior) and influencer items.
# Built upstream of this module — XSM components arrive in SAV pre-computed.
# Included here for documentation only; recomputation requires source vars
# the SAV does not expose cleanly.

# XSMr1 = Overclaim flag (1 if implausible self-report combinations)
# XSMr2 = L0_raw (raw influence count, 0-18)
# XSMr3 = L0 (normalized influence 0-1)
# XSMr4 = BCS (Behavioral Capital Score, 0-1)


def compute_validity_flag(df):
    """XSM2 validity composite — CORRECTED from deployed XML.

    Deployed XML bug: checks for c1 ("Strongly Disagree") when trap
    question instructs c3 ("Somewhat Disagree"). 100% of respondents
    are currently flagged in the SAV. This function uses the correct
    comparison.

    Logic:
        XSM2 = 1 if overclaim flagged OR if trap question failed
        XSM2 = 0 if both checks pass

    Trap question: QSM2r3 should equal 3 (Somewhat Disagree).
    Compliant respondents have QSM2r3 == 3; failures have any other value.
    """
    overclaim_failed = (df['XSMr1'] == 1)
    trap_failed = (df['QSM2r3'].notna()) & (df['QSM2r3'] != 3)

    df['XSM2'] = (overclaim_failed | trap_failed).astype(int)
    return df


def compute_penalty(df):
    """XPenalty multiplier — 0.6 if flagged invalid, 1.0 if clean.

    Applied as a multiplier on ARS in XQARSadj to downweight
    activation scores from low-quality respondents.
    """
    df['XPenalty'] = np.where(df['XSM2'] == 1, PENALTY_FAIL, PENALTY_PASS)
    return df


# =============================================================================
# ARS — ACTION READINESS SCORE
# =============================================================================

def compute_qp_normalized(df):
    """Normalize QP1/QP2/QP3 to 0-1 scale after handling DK midpoint.

    QP1 and QP3 use a 5-point scale with DK as option 3. The recoding
    maps DK to the midpoint (value 4 after remap) so it doesn't
    artificially deflate the score.

    QP2 is the rate question and doesn't have a DK option; scale is 1-5
    where 5 is most ready. Normalize: (raw - 1) / 4.
    """
    df['XQP1'] = (df['QP1'].map(QP_RECODE) - 1) / 4
    df['XQP2'] = (df['QP2'] - 1) / 4
    df['XQP3'] = (df['QP3'].map(QP_RECODE) - 1) / 4
    return df


def compute_ars(df):
    """XQARS — weighted Action Readiness Score (0-1 scale).

    Calibrated weights:
        QP3 (issue-specific intent):  0.40
        QP1 (general activation):     0.30
        QP2 (recent action freq):     0.30
    """
    df['XQARS'] = (
        ARS_WEIGHTS['QP3'] * df['XQP3'] +
        ARS_WEIGHTS['QP1'] * df['XQP1'] +
        ARS_WEIGHTS['QP2'] * df['XQP2']
    )
    return df


def compute_ars_adjusted(df):
    """XQARSadj — ARS adjusted by validity penalty.

    XQARSadj = XQARS * XPenalty
    Penalty is 0.6 for flagged respondents, 1.0 for clean.
    """
    df['XQARSadj'] = df['XQARS'] * df['XPenalty']
    return df


# =============================================================================
# ROI COMPOSITES
# =============================================================================

def compute_roi_components(df):
    """XROI r1 through r7 — ROI components and final score.

    r1 = ALIGN_POST / 7              (post-test alignment, 0-1 normalized)
    r2 = MOVE * (1 + BCS)            (influencer-amplified persuasion)
    r3 = clip(MOVE/0.8, 0, 1) * 40   (persuasion contribution, 0-40 scaled)
    r4 = r1 * 30                     (coalition contribution, 0-30 scaled)
    r5 = ACT_PROB (logistic)         (activation probability, 0-1)
    r6 = r5 * XQARSadj * 30          (activation contribution, 0-30 scaled)
    r7 = r3 + r4 + r6                (total ROI score, 0-100 scaled)
    """
    # r1: post-test alignment normalized
    df['XROIr1'] = df['XALIGN_POST'] / 7

    # r2: influencer-amplified movement
    df['XROIr2'] = df['XALIGN_MOVE'] * (1 + df['XSMr4'])

    # r3: persuasion contribution (clipped 0-1, scaled to 40)
    df['XROIr3'] = (df['XALIGN_MOVE'] / 0.8).clip(lower=0, upper=1) * 40

    # r4: coalition contribution (scaled to 30)
    df['XROIr4'] = df['XROIr1'] * 30

    # r5: activation probability (logistic)
    z = (
        ACT_LOGISTIC['intercept']
        + ACT_LOGISTIC['ars_slope'] * df['XQARS']
        + ACT_LOGISTIC['bcs_slope'] * df['XSMr4']
    )
    df['XROIr5'] = 1 / (1 + np.exp(-z))

    # r6: activation contribution (scaled to 30)
    df['XROIr6'] = df['XROIr5'] * df['XQARSadj'] * 30

    # r7: total ROI score (0-100 conceptually, but components can sum >100)
    df['XROIr7'] = df['XROIr3'] + df['XROIr4'] + df['XROIr6']

    return df


def categorize_roi(df):
    """5-category ROI classification from MOVE, POST, and ACT_PROB.

    HIV-calibrated thresholds:
        1 = BACKFIRE       (MOVE < 0)
        2 = NO PERSUASION  (else, default)
        3 = PERSUADABLE    (MOVE > 0, didn't qualify above)
        4 = STRONG ROI     (MOVE > 0 AND ACT_PROB >= 0.25 AND POST >= 4.5)
        5 = HIGHEST ROI    (MOVE > 0 AND ACT_PROB >= 0.50 AND POST >= 5.0)

    ROI thresholds are issue-calibrated, may differ across PRISM studies.
    Bin meanings are constant.
    """
    move    = df['XALIGN_MOVE']
    post    = df['XALIGN_POST']
    actprob = df['XROIr5']

    # Default everyone to NO PERSUASION
    cat = pd.Series(2, index=df.index, dtype='Int64')

    # Work from least specific to most specific so most specific wins
    cat[(move > 0)] = 3                                                      # PERSUADABLE
    cat[(move > 0) & (actprob >= ROI_THRESHOLDS['STRONG_actprob']) &         # STRONG
         (post >= ROI_THRESHOLDS['STRONG_post'])] = 4
    cat[(move > 0) & (actprob >= ROI_THRESHOLDS['HIGHEST_actprob']) &        # HIGHEST
         (post >= ROI_THRESHOLDS['HIGHEST_post'])] = 5
    cat[(move < 0)] = 1                                                      # BACKFIRE

    # Preserve NaN where any input was NaN
    bad = move.isna() | post.isna() | actprob.isna()
    cat[bad] = pd.NA

    df['XROI_cat'] = cat
    return df


# =============================================================================
# MASTER ORCHESTRATOR
# =============================================================================

def compute_all_prism(df, verbose=True):
    """Run the full PRISM composite pipeline in dependency order.

    Pipeline order matters because later composites depend on earlier ones:
        1. Demographic recodes (independent)
        2. Item-level recodes (independent)
        3. Item deltas (depend on item recodes)
        4. Alignment composites (depend on item recodes)
        5. Coalition categorization (depends on alignment)
        6. Validity flag + penalty (depend on QSM2 / XSMr1)
        7. ARS components -> ARS -> ARS adjusted (depend on QP1-3 and penalty)
        8. ROI components (depend on alignment, ARS, BCS)
        9. ROI categorization (depends on ROI components)
    """
    pipeline = [
        ('Demographic recodes',     recode_race_eth),
        ('Priority rank',           recode_priority_rank),
        ('Reverse-coded items',     recode_reversed_items),
        ('Item-level deltas',       compute_item_deltas),
        ('Alignment composites',    compute_alignment),
        ('PRE alignment category',  categorize_alignment_pre),
        ('Coalition category',      categorize_coalition),
        ('Coalition normalized',    normalize_coalition),
        ('Validity flag (XSM2)',    compute_validity_flag),
        ('Penalty multiplier',      compute_penalty),
        ('QP normalized',           compute_qp_normalized),
        ('ARS',                     compute_ars),
        ('ARS adjusted',            compute_ars_adjusted),
        ('ROI components',          compute_roi_components),
        ('ROI category',            categorize_roi),
    ]

    for name, fn in pipeline:
        df = fn(df)
        if verbose:
            print(f"  ✓ {name}")

    return df


# =============================================================================
# CONVENIENCE — for use from a notebook or pipeline driver
# =============================================================================

if __name__ == "__main__":
    import sys
    import pyreadstat

    if len(sys.argv) < 2:
        print("Usage: python prism_composites.py <input.sav> [output.sav]")
        sys.exit(1)

    inp = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else inp.replace('.sav', '_recomputed.sav')

    print(f"Reading {inp} ...")
    df, meta = pyreadstat.read_sav(inp)
    print(f"  N = {len(df)}")

    print("Running PRISM pipeline ...")
    df = compute_all_prism(df)

    print(f"Writing {out} ...")
    pyreadstat.write_sav(df, out, column_labels=dict(meta.column_names_to_labels))
    print(f"  Done.")
