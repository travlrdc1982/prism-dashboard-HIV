"""Segments benchmark: locked values, structure, cluster split."""
from prism.benchmarks import PRISM_SEGMENTS_V1 as S


def test_validates():
    assert S.validate()


def test_sixteen_segments_two_clusters():
    assert len(S.codes()) == 16
    assert len(S.codes_in_cluster("GOP")) == 10
    assert len(S.codes_in_cluster("DEM")) == 6


def test_total_within_tolerance():
    assert abs(S.total() - 1.0) <= 0.005


def test_locked_full_precision_spot_values():
    # Values are platform-locked from PRISM_WEIGHTING.xlsx (May 2026).
    # Any change here is a platform-version event, not a study edit.
    assert S.pop_share("TSP") == 0.0240
    assert S.pop_share("CEC") == 0.0649
    assert S.pop_share("PP") == 0.0245
    assert S.pop_share("VS") == 0.0499
    assert S.pop_share("UCP") == 0.1093
    assert S.pop_share("GHI") == 0.1027


def test_display_projection():
    assert S.pop_share_pct("GHI") == "Pop 10%"   # the value the dashboard
    assert S.pop_share_pct("HAD") == "Pop 8%"    # historically got wrong
