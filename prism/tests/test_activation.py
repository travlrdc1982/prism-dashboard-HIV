"""
Activation: synthetic unit tests + prototype equivalence + a real
calibration run on the HIV Wave 1 reference input.
"""
import importlib.util
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from prism.activation import (
    ActivationConfig, HIV_WAVE1_ACTIVATION,
    compute_optin_outcomes, calibrate_activation_logistic,
    apply_activation_model)
from prism.composites import HIV_WAVE1_COMPOSITES, compute_all_prism

HANDOFF = Path("/tmp/prism_handoff_v2/prism_handoff")
PKG_ROOT = Path(__file__).resolve().parents[1]


# ── Synthetic units ────────────────────────────────────────────────────

def _toy():
    return pd.DataFrame({
        "OPTIN":     [1, 1, 1, 2, np.nan],
        "OPTIN_1r1": ["a@b.c", "", "x@y.z", "", None],     # email
        "OPTIN_1r2": ["555",   "",  "",     "", None],     # phone
    })


def test_optin_grading_ladder():
    out = compute_optin_outcomes(_toy(), HIV_WAVE1_ACTIVATION)
    assert list(out["OPTIN_INDEX"]) == [2, 0, 1, 0, 0]
    assert list(out["OPTIN_GRADED"]) == [1.0, 0.25, 0.75, 0.0, 0.0]
    assert list(out["OPTIN_BINARY"]) == [1, 1, 1, 0, 0]


def test_eligibility_filter_masks():
    df = _toy()
    df["ELIG"] = [1, 1, 0, 1, 1]
    cfg = ActivationConfig(eligible_filter={"var": "ELIG", "value": 1})
    out = compute_optin_outcomes(df, cfg)
    assert pd.isna(out["OPTIN_INDEX"].iloc[2])
    assert pd.isna(out["OPTIN_GRADED"].iloc[2])


def test_apply_mode_requires_coefficients():
    with pytest.raises(AssertionError, match="apply"):
        ActivationConfig(calibration_mode="apply").validate()


def test_apply_matches_hand_logistic():
    cfg = ActivationConfig(calibration_mode="apply",
                           fitted_intercept=-0.759,
                           fitted_ars_slope=1.547,
                           fitted_bcs_slope=0.769)
    df = pd.DataFrame({"XQARS": [0.0, 0.5, 1.0], "XSMr4": [0.0, 0.5, 1.0]})
    got = apply_activation_model(df, cfg)
    z = -0.759 + 1.547 * df["XQARS"] + 0.769 * df["XSMr4"]
    assert np.allclose(got, 1 / (1 + np.exp(-z)))


def test_calibration_recovers_known_coefficients():
    rng = np.random.default_rng(7)
    n = 20000
    ars = rng.uniform(0, 1, n); bcs = rng.uniform(0, 1, n)
    z = -0.8 + 1.5 * ars + 0.7 * bcs
    y = rng.binomial(1, 1 / (1 + np.exp(-z)))
    df = pd.DataFrame({"OPTIN_BINARY": y, "XQARS": ars, "XSMr4": bcs})
    res = calibrate_activation_logistic(df, HIV_WAVE1_ACTIVATION)
    assert res["converged"]
    assert abs(res["intercept"] - (-0.8)) < 0.1
    assert abs(res["ars_slope"] - 1.5) < 0.15
    assert abs(res["bcs_slope"] - 0.7) < 0.15


# ── Prototype equivalence + real-data calibration ──────────────────────

def _load_prototype():
    spec = importlib.util.spec_from_file_location(
        "proto_activation",
        PKG_ROOT / "reference" / "prototypes" / "prism_activation.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def hiv_df():
    p = HANDOFF / "04_test_data" / "INPUT_260433.sav"
    if not p.exists():
        pytest.skip("handoff test data not present in this environment")
    import pyreadstat
    df, _ = pyreadstat.read_sav(str(p))
    df = compute_all_prism(df, HIV_WAVE1_COMPOSITES)        # needs XQARS
    return compute_optin_outcomes(df, HIV_WAVE1_ACTIVATION)


def test_outcomes_equivalent_to_prototype(hiv_df):
    proto = _load_prototype()
    import pyreadstat
    raw, _ = pyreadstat.read_sav(
        str(HANDOFF / "04_test_data" / "INPUT_260433.sav"))
    theirs = proto.compute_optin_outcomes(raw.copy(), {
        "optin_indicator": {"var": "OPTIN", "positive_value": 1},
        "behavioral_cost_fields": [
            {"var": "OPTIN_1r1", "label": "email"},
            {"var": "OPTIN_1r2", "label": "phone"}],
        "grading": {"no_optin": 0.0, "optin_no_fields": 0.25,
                    "optin_one_field": 0.75, "optin_both_fields": 1.0},
        "binarize_for_logistic": {"zero_when": [0.0],
                                  "one_when": [0.25, 0.75, 1.0]},
    })
    for c in ("OPTIN_INDEX", "OPTIN_GRADED", "OPTIN_BINARY"):
        a, b = hiv_df[c], theirs[c]
        assert (a.isna() == b.isna()).all(), c
        m = a.notna()
        assert (a[m] == b[m]).all(), c


def test_hiv_wave1_calibration_runs_and_is_sane(hiv_df):
    res = calibrate_activation_logistic(hiv_df, HIV_WAVE1_ACTIVATION)
    assert res["converged"]
    assert res["n"] > 2500
    assert 0.01 < res["optin_rate"] < 0.99
    # slopes should be positive (more ready / more behavioral capital →
    # more likely to opt in) — directionality sanity, not value lock
    assert res["ars_slope"] > 0
    print(f"\nHIV Wave 1 fit: b0={res['intercept']:.3f} "
          f"ars={res['ars_slope']:.3f} bcs={res['bcs_slope']:.3f} "
          f"n={res['n']} optin={res['optin_rate']:.1%} "
          f"HL p={res['hosmer_lemeshow_p']:.3f}")
