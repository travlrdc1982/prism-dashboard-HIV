"""
End-to-end pipeline + the CHAIN TEST: package output feeds the
dashboard's topline engine, which finally has its WEIGHT column.
"""
import sys
from pathlib import Path

import pandas as pd
import pytest

HANDOFF = Path("/tmp/prism_handoff_v2/prism_handoff")
PKG_ROOT = Path(__file__).resolve().parents[1]
REPO = PKG_ROOT.parent
STUDIES = PKG_ROOT / "prism" / "studies"


@pytest.fixture(scope="module")
def run_result(tmp_path_factory):
    p = HANDOFF / "04_test_data" / "INPUT_260433.sav"
    if not p.exists():
        pytest.skip("handoff test data not present in this environment")
    from prism.pipeline import run_study
    out = tmp_path_factory.mktemp("hiv_out")
    return run_study(STUDIES / "hiv_wave1.yaml", p, out, verbose=False)


def test_outputs_exist(run_result):
    for k in ("weighted_sav", "weights_csv", "dq_flags_csv",
              "audit_csv", "diagnostics_md"):
        assert Path(run_result[k]).exists(), k


def test_weights_structure(run_result):
    import pyreadstat
    df, _ = pyreadstat.read_sav(run_result["weighted_sav"])
    assert "WEIGHT" in df.columns
    assert len(df) == 3087                       # exclusion_policy: none
    assert abs(df["WEIGHT"].sum() - len(df)) < 1e-4


def test_dq_flags_byte_match_reference(run_result):
    got = pd.read_csv(run_result["dq_flags_csv"])
    ref = pd.read_csv(HANDOFF / "04_test_data" / "REFERENCE_dq_flags.csv")
    m = ref.merge(got, on="record", suffixes=("_ref", "_got"))
    assert len(m) == 3087
    for c in ("F_speeder", "F_overclaim", "F_straight", "F_maxdiff",
              "F_noise", "F_total", "recommend_remove"):
        assert (m[f"{c}_ref"] == m[f"{c}_got"]).all(), c


def test_audit_csv_facts(run_result):
    audit = pd.read_csv(run_result["audit_csv"])
    clean = dict(zip(audit["column"], audit["note"]))
    for c in ("XQPRE_6R", "XPOST_6R", "XCOALITION", "XQP2"):
        assert clean[c] == "clean", c
    assert "UNEXPECTED" not in " ".join(audit["note"])


def test_provenance_stamp(run_result):
    prov = run_result["provenance"]
    for k in ("package_version", "study_yaml_sha", "input_sav_sha",
              "numpy", "pandas", "activation_coefficients"):
        assert prov.get(k), k


def test_chain_into_dashboard_topline(run_result):
    """THE CHAIN TEST: the weighted SAV drives the dashboard's topline
    engine (compute_core), which has been blocked on a WEIGHT-bearing
    SAV this whole time. dashboard.json must build."""
    import json
    import pyreadstat
    sys.path.insert(0, str(REPO / "pipeline" / "topline"))
    import compute_core

    df, _ = pyreadstat.read_sav(run_result["weighted_sav"])
    out_dir = Path(run_result["weighted_sav"]).parent / "topline"
    compute_core.build_topline(df, out_dir=out_dir, weight_var="WEIGHT")
    dj = json.loads((out_dir / "dashboard.json").read_text())
    assert dj["study"]["n_total"] == 3087
    assert len(dj["segments"]) == 16
    assert dj["items"], "topline items section empty"
