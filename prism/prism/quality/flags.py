"""
Data-quality flags.

Five respondent-level flags plus a removal recommendation. Thresholds
are issue-calibrated YAML parameters (quality: block) with the platform
defaults below; every rule was verified to byte-reproduce the HIV Wave 1
reference (REFERENCE_dq_flags.csv, all 3,087 rows) before being encoded.

THE FLAGS
---------
F_speeder    qtime < median(qtime) × speeder_fraction
             (fraction defaults to 1/3 — the spec's "0.333" is this
             value rounded; byte-reproduction requires the exact third)
F_overclaim  the Decipher-computed overclaim indicator, consumed as
             input (overclaim_var; XSMr1 in HIV Wave 1)
F_straight   straightlined BOTH attitude batteries: std of the pre
             items < threshold AND std of the post items < threshold.
             Item lists exclude the rank-priority item and use the RAW
             (un-reversed) item 6 — a straightliner answers the raw
             grid uniformly.
F_maxdiff    MaxDiff per-task timer < maxdiff_speed_sec
             (QHIV_Timer in HIV Wave 1 is already seconds/task)
F_noise      mean |post − pre| across the noise item pairs > threshold
             (rank item excluded)

F_total      sum of the five flags
recommend_remove  F_total >= removal_recommendation (default 2)

THE DECISION (analyst ruling, Jun 2026)
---------------------------------------
Flags are advisory. The package always emits the FULL dataset; whether
flagged respondents are dropped is a downstream, per-study YAML decision
(exclusions.policy) whose default is the LOOSEST possible loss of
sample: keep everyone ('none'). Stricter policies opt in explicitly:
    none              keep all respondents (default)
    recommend_remove  drop rows where recommend_remove == 1
    f_total_ge_1      drop rows with any flag at all (strictest standard)
"""

from dataclasses import dataclass, field
from typing import Dict, List

import numpy as np
import pandas as pd

EXCLUSION_POLICIES = ("none", "recommend_remove", "f_total_ge_1")


@dataclass(frozen=True)
class QualityConfig:
    """Instrument-specific variable names + issue-calibrated thresholds."""

    # Variable names (instrument-specific)
    qtime_var: str = "qtime"
    overclaim_var: str = "XSMr1"
    maxdiff_timer_var: str = "QHIV_Timer"
    straightline_pre_items: List[str] = field(default_factory=list)
    straightline_post_items: List[str] = field(default_factory=list)
    noise_pre_items: List[str] = field(default_factory=list)
    noise_post_items: List[str] = field(default_factory=list)

    # Thresholds (issue-calibrated; platform defaults)
    speeder_fraction: float = 1.0 / 3.0
    maxdiff_speed_sec: float = 1.0
    straightline_std_threshold: float = 0.5
    prepost_noise_threshold: float = 2.5
    removal_recommendation: int = 2

    # The decision: default = loosest loss of sample
    exclusion_policy: str = "none"

    def validate(self):
        assert self.exclusion_policy in EXCLUSION_POLICIES, (
            f"exclusion_policy {self.exclusion_policy!r} not in "
            f"{EXCLUSION_POLICIES}")
        assert len(self.noise_pre_items) == len(self.noise_post_items), (
            "noise item lists must pair up")
        assert 0 < self.speeder_fraction < 1
        assert self.removal_recommendation >= 1
        return True


def compute_dq_flags(df: pd.DataFrame, config: QualityConfig) -> pd.DataFrame:
    """Return a flags frame aligned to df's index.

    Columns: F_speeder, F_overclaim, F_straight, F_maxdiff, F_noise,
    F_total, recommend_remove — all int 0/1 except F_total.
    """
    config.validate()
    out = pd.DataFrame(index=df.index)

    # F_speeder — total interview time vs the sample median
    qt = pd.to_numeric(df[config.qtime_var], errors="coerce")
    out["F_speeder"] = (qt < qt.median() * config.speeder_fraction).astype(int)

    # F_overclaim — Decipher-computed indicator consumed as-is
    out["F_overclaim"] = (
        pd.to_numeric(df[config.overclaim_var], errors="coerce")
        .fillna(0).astype(int))

    # F_straight — uniform answers on BOTH attitude batteries
    sd_pre = df[config.straightline_pre_items].std(axis=1, ddof=1)
    sd_post = df[config.straightline_post_items].std(axis=1, ddof=1)
    th = config.straightline_std_threshold
    out["F_straight"] = (
        ((sd_pre < th) & (sd_post < th)).fillna(False).astype(int))

    # F_maxdiff — per-task MaxDiff speed
    timer = pd.to_numeric(df[config.maxdiff_timer_var], errors="coerce")
    out["F_maxdiff"] = (timer < config.maxdiff_speed_sec).astype(int)

    # F_noise — implausible average attitude shift
    pre = df[config.noise_pre_items].to_numpy(dtype=float)
    post = df[config.noise_post_items].to_numpy(dtype=float)
    with np.errstate(invalid="ignore"):
        avg_shift = np.nanmean(np.abs(post - pre), axis=1)
    out["F_noise"] = (avg_shift > config.prepost_noise_threshold).astype(int)

    flag_cols = ["F_speeder", "F_overclaim", "F_straight", "F_maxdiff", "F_noise"]
    out["F_total"] = out[flag_cols].sum(axis=1)
    out["recommend_remove"] = (
        out["F_total"] >= config.removal_recommendation).astype(int)
    return out


def apply_exclusion_policy(df: pd.DataFrame, flags: pd.DataFrame,
                           config: QualityConfig) -> pd.DataFrame:
    """Apply the per-study exclusion decision. Default policy 'none'
    returns df unchanged (the loosest loss of sample)."""
    config.validate()
    if config.exclusion_policy == "none":
        return df
    if config.exclusion_policy == "recommend_remove":
        return df.loc[flags["recommend_remove"] == 0]
    if config.exclusion_policy == "f_total_ge_1":
        return df.loc[flags["F_total"] == 0]
    raise AssertionError("unreachable")


# HIV Wave 1's instrument bindings — the canonical first study.
HIV_WAVE1_QUALITY = QualityConfig(
    qtime_var="qtime",
    overclaim_var="XSMr1",
    maxdiff_timer_var="QHIV_Timer",
    straightline_pre_items=[
        "QPRE_2", "QPRE_3", "QPRE_4", "QPRE_5", "QPRE_6", "QPRE_7r1"],
    straightline_post_items=[
        "QPOST_2", "QPOST_3", "QPOST_4", "QPOST_5", "QPOST_6", "QPOST_7r1"],
    noise_pre_items=[
        "QPRE_2", "QPRE_3", "QPRE_4", "QPRE_5", "QPRE_6", "QPRE_7r1"],
    noise_post_items=[
        "QPOST_2", "QPOST_3", "QPOST_4", "QPOST_5", "QPOST_6", "QPOST_7r1"],
)
