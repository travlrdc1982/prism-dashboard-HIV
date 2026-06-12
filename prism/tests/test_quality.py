"""DQ flags must byte-reproduce the HIV Wave 1 reference."""
from pathlib import Path

import pandas as pd
import pyreadstat
import pytest

from prism.quality import compute_dq_flags
from prism.quality.flags import HIV_WAVE1_QUALITY, QualityConfig, apply_exclusion_policy

HANDOFF = Path("/tmp/prism_handoff_v2/prism_handoff")
FLAG_COLS = ["F_speeder", "F_overclaim", "F_straight", "F_maxdiff",
             "F_noise", "F_total", "recommend_remove"]


@pytest.fixture(scope="module")
def reference():
    p = HANDOFF / "04_test_data" / "REFERENCE_dq_flags.csv"
    if not p.exists():
        pytest.skip("handoff test data not present in this environment")
    return pd.read_csv(p)


@pytest.fixture(scope="module")
def input_df(reference):
    cfg = HIV_WAVE1_QUALITY
    cols = (["record", cfg.qtime_var, cfg.overclaim_var, cfg.maxdiff_timer_var]
            + cfg.straightline_pre_items + cfg.straightline_post_items)
    df, _ = pyreadstat.read_sav(
        str(HANDOFF / "04_test_data" / "INPUT_260433.sav"),
        usecols=sorted(set(cols)))
    return df


def test_flags_byte_reproduce_reference(reference, input_df):
    flags = compute_dq_flags(input_df, HIV_WAVE1_QUALITY)
    merged = reference.merge(
        flags.join(input_df["record"]), on="record",
        suffixes=("_ref", "_got"))
    assert len(merged) == len(reference) == 3087
    for col in FLAG_COLS:
        mism = (merged[f"{col}_ref"] != merged[f"{col}_got"]).sum()
        assert mism == 0, f"{col}: {mism} mismatches vs reference"


def test_default_policy_is_loosest(reference, input_df):
    # Analyst decision: default exclusion policy drops nobody.
    flags = compute_dq_flags(input_df, HIV_WAVE1_QUALITY)
    kept = apply_exclusion_policy(input_df, flags, HIV_WAVE1_QUALITY)
    assert len(kept) == len(input_df)


def test_stricter_policies_opt_in(reference, input_df):
    flags = compute_dq_flags(input_df, HIV_WAVE1_QUALITY)
    cfg_rr = QualityConfig(**{**HIV_WAVE1_QUALITY.__dict__,
                              "exclusion_policy": "recommend_remove"})
    kept = apply_exclusion_policy(input_df, flags, cfg_rr)
    assert len(kept) == 3087 - 130   # the 130 worst cases

    cfg_strict = QualityConfig(**{**HIV_WAVE1_QUALITY.__dict__,
                                  "exclusion_policy": "f_total_ge_1"})
    kept2 = apply_exclusion_policy(input_df, flags, cfg_strict)
    assert len(kept2) == (flags["F_total"] == 0).sum()


def test_bad_policy_rejected():
    with pytest.raises(AssertionError, match="exclusion_policy"):
        QualityConfig(exclusion_policy="everyone_must_go").validate()
