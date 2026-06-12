"""
Composites: synthetic unit tests (always run) + equivalence against the
frozen prototype + Decipher audit facts (run when handoff data present).
"""
import importlib.util
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from prism.composites import CompositeConfig, HIV_WAVE1_COMPOSITES, compute_all_prism
from prism.composites import core

HANDOFF = Path("/tmp/prism_handoff_v2/prism_handoff")
PKG_ROOT = Path(__file__).resolve().parents[1]


# ── Synthetic unit tests ───────────────────────────────────────────────

def test_priority_rank_inverts():
    df = pd.DataFrame({"QPRE_1r1": [1, 7, 4], "QPOST_1r1": [7, 1, 4]})
    out = core.recode_priority_rank(df, HIV_WAVE1_COMPOSITES)
    assert list(out["XQPRE_1r1"]) == [7, 1, 4]
    assert list(out["XPOST_1r1"]) == [1, 7, 4]


def test_reversal():
    df = pd.DataFrame({"QPRE_6": [1, 7, np.nan], "QPOST_6": [4, 2, 6]})
    out = core.recode_reversed_items(df, HIV_WAVE1_COMPOSITES)
    assert list(out["XQPRE_6R"].fillna(-1)) == [7, 1, -1]


def test_qp_recode_dk_midpoint():
    # raw 3 (DK) lands mid-scale after recode+normalize; raw 5 → 0.5
    df = pd.DataFrame({"QP1": [3], "QP2": [3], "QP3": [5]})
    out = core.compute_qp_normalized(df, HIV_WAVE1_COMPOSITES)
    assert out["XQP1"].iloc[0] == (core.QP_RECODE[3] - 1) / 4 == 0.75
    assert out["XQP2"].iloc[0] == 0.5          # no DK recode on QP2
    assert out["XQP3"].iloc[0] == (core.QP_RECODE[5] - 1) / 4 == 0.5


def test_coalition_bin_edges():
    df = pd.DataFrame({"XALIGN_POST": [2.99, 3.0, 4.0, 5.0, 6.0, 7.0]})
    out = core.categorize_coalition(df, HIV_WAVE1_COMPOSITES)
    assert list(out["XCOALITION"]) == [1, 2, 3, 4, 5, 5]


def test_validity_trap_corrected_logic():
    cfg = HIV_WAVE1_COMPOSITES
    df = pd.DataFrame({
        "XSMr1":  [0, 0, 1, 0],
        "QSM2r3": [3, 1, 3, np.nan],   # pass, fail, pass(but overclaim), NA→pass
    })
    out = core.compute_validity_flag(df, cfg)
    assert list(out["XSM2"]) == [0, 1, 1, 0]
    out = core.compute_penalty(out, cfg)
    assert list(out["XPenalty"]) == [1.0, 0.6, 0.6, 1.0]


def test_roi_categories_and_nan():
    cfg = HIV_WAVE1_COMPOSITES
    df = pd.DataFrame({
        "XALIGN_MOVE": [-0.5, 0.0, 0.3, 0.3, 0.3, np.nan],
        "XALIGN_POST": [5.0, 5.0, 4.0, 4.6, 5.5, 5.0],
        "XROIr5":      [0.9, 0.9, 0.10, 0.30, 0.60, 0.5],
    })
    out = core.categorize_roi(df, cfg)
    got = list(out["XROI_cat"].astype(object))
    assert got[:5] == [1, 2, 3, 4, 5]
    assert got[5] is pd.NA


def test_config_validation():
    with pytest.raises(AssertionError):
        CompositeConfig(roi_strong_post=6.0).validate()  # strong > highest


# ── Equivalence vs the frozen prototype ────────────────────────────────

def _load_prototype():
    spec = importlib.util.spec_from_file_location(
        "proto_composites",
        PKG_ROOT / "reference" / "prototypes" / "prism_composites.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def input_sav():
    p = HANDOFF / "04_test_data" / "INPUT_260433.sav"
    if not p.exists():
        pytest.skip("handoff test data not present in this environment")
    import pyreadstat
    df, _ = pyreadstat.read_sav(str(p))
    return df


def test_byte_equivalence_with_prototype(input_sav):
    proto = _load_prototype()
    ours = compute_all_prism(input_sav.copy(), HIV_WAVE1_COMPOSITES)
    theirs = proto.compute_all_prism(input_sav.copy(), verbose=False)

    out_cols = [
        "XRACE_ETH", "XQPRE_1r1", "XPOST_1r1", "XQPRE_6R", "XPOST_6R",
        *[f"XQPRE_POST_r{i}" for i in range(1, 8)],
        "XALIGN_PRE", "XALIGN_POST", "XALIGN_MOVE", "XQALIGN_PRE_C",
        "XCOALITION", "XCOAL_NORM", "XSM2", "XPenalty",
        "XQP1", "XQP2", "XQP3", "XQARS", "XQARSadj",
        *[f"XROIr{i}" for i in range(1, 8)], "XROI_cat",
    ]
    for c in out_cols:
        a, b = ours[c], theirs[c]
        assert (a.isna() == b.isna()).all(), f"{c}: NaN pattern differs"
        m = a.notna()
        assert (a[m].astype(float) == b[m].astype(float)).all(), (
            f"{c}: values differ from prototype")


# ── Decipher audit facts (the 'recompute + audit' contract) ───────────

def test_audit_clean_columns_match_decipher(input_sav):
    """Columns where Decipher's math is sound must agree exactly."""
    ours = compute_all_prism(input_sav.copy(), HIV_WAVE1_COMPOSITES)
    for c in ["XQPRE_6R", "XPOST_6R", "XCOALITION", "XQP2"]:
        dec, py = input_sav[c], ours[c]
        m = dec.notna() & py.notna()
        assert (dec[m].astype(float) == py[m].astype(float)).all(), c


def test_audit_known_decipher_divergences(input_sav):
    """The documented Decipher bugs produce these exact signatures."""
    ours = compute_all_prism(input_sav.copy(), HIV_WAVE1_COMPOSITES)
    # XSM2 fix: 203 flagged (Decipher's broken trap flags ~everyone;
    # the variable isn't even exported, but the downstream XQARSadj is)
    assert int(ours["XSM2"].sum()) == 203
    # XQALIGN_PRE_C: pure label offset (Decipher 1-5, platform 0-4)
    dec, py = input_sav["XQALIGN_PRE_C"], ours["XQALIGN_PRE_C"]
    m = dec.notna() & py.notna()
    assert (dec[m].astype(int) == py[m].astype(int) + 1).all()
