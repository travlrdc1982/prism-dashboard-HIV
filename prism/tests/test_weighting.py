"""
Weighting: rake primitive units, joint-convergence synthetic proof,
placeholder guard, seeded sex-split reproducibility, and the real HIV
Wave 1 run validated structurally (the analyst-chosen weight gate:
sum-to-N + on-target margins, NOT bit-reproduction of the one-pass
prototype).
"""
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from prism.benchmarks import PRISM_SEGMENTS_V1
from prism.benchmarks.populations import VOTERS_V1, US_ADULTS_V1
from prism.weighting import (
    HIV_WAVE1_WEIGHTING, WeightConfig, apply_two_stage_weighting,
    rake, trim_and_renormalize, weight_diagnostics)

HANDOFF = Path("/tmp/prism_handoff_v2/prism_handoff")


# ── Rake primitive ─────────────────────────────────────────────────────

def test_rake_hits_simple_targets():
    df = pd.DataFrame({"sex": ["M"] * 70 + ["F"] * 30, "W": 1.0})
    res = rake(df, "W", ["sex"], {"sex": {"M": 0.5, "F": 0.5}})
    assert res["converged"]
    assert abs(df.loc[df.sex == "M", "W"].sum() - 50) < 1e-4
    assert abs(df["W"].sum() - 100) < 1e-6


def test_trim_caps_and_renormalizes():
    df = pd.DataFrame({"W": [0.01, 1.0, 9.0, 1.0]})
    trim_and_renormalize(df, "W", 0.25, 5.0)
    assert df["W"].min() >= 0.25 * (len(df) / 7.25) - 1e-9  # post-renorm scale
    assert abs(df["W"].sum() - 4) < 1e-9


# ── Joint convergence: the headline improvement ────────────────────────

def _synthetic_cross_pressured():
    """Cluster-aware sample where demographics correlate with segment,
    creating exactly the Stage1↔Stage2 cross-pressure the one-pass
    prototype leaves unresolved."""
    rng = np.random.default_rng(11)
    n = 4000
    seg_codes = PRISM_SEGMENTS_V1.codes()
    seg = rng.choice(seg_codes, size=n)
    cluster = pd.Series(seg).map(PRISM_SEGMENTS_V1.cluster)
    # demographics skewed BY segment id so the two rakes interact
    sex = np.where(rng.uniform(size=n)
                   < np.where(cluster == "GOP", 0.7, 0.35), 1, 2)
    age = rng.choice([1, 2, 3, 5], size=n,
                     p=[0.15, 0.2, 0.45, 0.2])
    # race drawn cluster-conditionally so the cluster targets are
    # REACHABLE within the trim caps (the point of this synthetic is
    # stage-interaction, not trim-binding)
    gop_race = rng.choice([1, 2, 3, 5], size=n, p=[0.82, 0.04, 0.06, 0.08])
    dem_race = rng.choice([1, 2, 3, 5], size=n, p=[0.55, 0.25, 0.08, 0.12])
    race = np.where(cluster == "GOP", gop_race, dem_race)
    edu = rng.choice([1, 4], size=n, p=[0.55, 0.45])
    region = rng.choice([1, 2, 3, 4], size=n, p=[0.15, 0.2, 0.4, 0.25])
    code_to_id = {c: i for i, c in enumerate(seg_codes, 1)}
    return pd.DataFrame({
        "QGENDER": sex, "QAGECAT5": age, "QRACE_ETHNIC": race,
        "XEDU_CAT": edu, "XQREGION": region,
        "XSEG_ASSIGNED": pd.Series(seg).map(code_to_id).astype(float)})


def test_joint_convergence_hits_both_margin_sets():
    df = _synthetic_cross_pressured()
    out, diag = apply_two_stage_weighting(
        df, HIV_WAVE1_WEIGHTING, VOTERS_V1, PRISM_SEGMENTS_V1)
    assert diag["converged"], diag.get("warning")
    assert abs(out["WEIGHT"].sum() - len(out)) < 1e-6
    assert diag["max_gap"] < HIV_WAVE1_WEIGHTING.outer_tolerance
    # every margin row individually on target
    for dim, cat, tgt, ach, gap in diag["margin_recovery"]:
        assert abs(gap) < 2 * HIV_WAVE1_WEIGHTING.outer_tolerance, (
            dim, cat, gap)


def test_one_pass_would_have_drifted():
    """Prove the outer loop earns its keep: outer pass 1 alone (the
    prototype behavior) leaves a larger max gap than the converged
    result."""
    df = _synthetic_cross_pressured()
    out, diag = apply_two_stage_weighting(
        df, HIV_WAVE1_WEIGHTING, VOTERS_V1, PRISM_SEGMENTS_V1)
    first_pass_gap = diag["history"][0]["max_gap"]
    assert first_pass_gap > diag["max_gap"]
    assert diag["outer_iterations"] >= 2


# ── Guards ─────────────────────────────────────────────────────────────

def test_placeholder_population_refused():
    df = _synthetic_cross_pressured()
    with pytest.raises(ValueError, match="PLACEHOLDER"):
        apply_two_stage_weighting(
            df, HIV_WAVE1_WEIGHTING, US_ADULTS_V1, PRISM_SEGMENTS_V1)


def test_sex_other_random_split_is_seeded():
    base = _synthetic_cross_pressured()
    base.loc[:99, "QGENDER"] = 3
    cfg = WeightConfig(**{**HIV_WAVE1_WEIGHTING.__dict__,
                          "sex_other_handling": "random_split"})
    a, _ = apply_two_stage_weighting(base.copy(), cfg, VOTERS_V1,
                                     PRISM_SEGMENTS_V1)
    b, _ = apply_two_stage_weighting(base.copy(), cfg, VOTERS_V1,
                                     PRISM_SEGMENTS_V1)
    assert (a["sex"] == b["sex"]).all()                  # reproducible
    assert set(a.loc[:99, "sex"]) == {"Male", "Female"}  # actually split


# ── Real HIV Wave 1 run (structural gate) ──────────────────────────────

@pytest.fixture(scope="module")
def hiv_weighted():
    p = HANDOFF / "04_test_data" / "INPUT_260433.sav"
    if not p.exists():
        pytest.skip("handoff test data not present in this environment")
    import pyreadstat
    df, _ = pyreadstat.read_sav(str(p))
    return apply_two_stage_weighting(
        df, HIV_WAVE1_WEIGHTING, VOTERS_V1, PRISM_SEGMENTS_V1)


def test_hiv_weights_structurally_valid(hiv_weighted):
    out, diag = hiv_weighted
    assert abs(out["WEIGHT"].sum() - len(out)) < 1e-6
    assert out["WEIGHT"].between(0, HIV_WAVE1_WEIGHTING.trim_high + 1e-9).all()
    d = weight_diagnostics(out)
    assert 1.0 <= d["deff"] < 3.0, f"implausible DEFF {d['deff']}"
    print(f"\nHIV Wave 1 joint rake: outer={diag['outer_iterations']} "
          f"converged={diag['converged']} max_gap={diag['max_gap']:.6f} "
          f"DEFF={d['deff']:.3f} neff={d['neff']:.0f}")


def test_hiv_margins_on_target_or_reported(hiv_weighted):
    """Joint promise: both margin sets within tolerance — or, if the
    trim caps genuinely block exact convergence, the residual table
    says so loudly (never silent)."""
    out, diag = hiv_weighted
    if diag["converged"]:
        assert diag["max_gap"] < HIV_WAVE1_WEIGHTING.outer_tolerance
    else:
        assert "warning" in diag
        assert diag["max_gap"] < 0.02, (
            "residual gaps too large even for trim-capped convergence")
