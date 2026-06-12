"""
Chain test: the dashboard's study config must stay consistent with the
package's platform-locked segment benchmark.

Decision (Jun 2026): the PACKAGE owns the canonical segment shares; the
dashboard imports them. The dashboard's 2-decimal pop_share values are
the largest-remainder rounding of the package's full-precision shares
(integer percents that sum to exactly 100).
"""
from pathlib import Path

import pytest
import yaml

from prism.benchmarks import PRISM_SEGMENTS_V1 as S

REPO = Path(__file__).resolve().parents[2]
STUDY_YAML = REPO / "study" / "study.yaml"


def largest_remainder_percent(shares):
    """{code: full-precision share} -> {code: integer percent}, sum 100."""
    floors = {c: int(v * 100) for c, v in shares.items()}
    remainders = {c: v * 100 - floors[c] for c, v in shares.items()}
    short = 100 - sum(floors.values())
    for c in sorted(remainders, key=remainders.get, reverse=True)[:short]:
        floors[c] += 1
    return floors


@pytest.fixture(scope="module")
def registry():
    if not STUDY_YAML.exists():
        pytest.skip("dashboard study.yaml not present (package lifted out?)")
    cfg = yaml.safe_load(STUDY_YAML.read_text())
    return {r["code"]: r for r in cfg["segment_registry"]}


def test_dashboard_codes_match_package(registry):
    assert set(registry) == set(S.codes())


def test_dashboard_party_matches_package_cluster(registry):
    for code, row in registry.items():
        assert row["party"] == S.cluster(code), code


def test_dashboard_pop_share_is_largest_remainder_projection(registry):
    expected = largest_remainder_percent(S.as_dict())
    for code, row in registry.items():
        got = round(row["pop_share"] * 100)
        assert got == expected[code], (
            f"{code}: dashboard pop_share {row['pop_share']} != "
            f"largest-remainder projection {expected[code]}%")


# Name reconciliation complete (analyst decision, Jun 2026): platform
# spellings are canonical everywhere. Keep the mechanism in case a
# future study needs a temporary pinned divergence.
KNOWN_NAME_DIVERGENCES = {}


def test_names_match_package_except_known_divergences(registry):
    for code, row in registry.items():
        if code in KNOWN_NAME_DIVERGENCES:
            pkg_name, dash_name = KNOWN_NAME_DIVERGENCES[code]
            assert S.name(code) == pkg_name, f"{code}: package name moved"
            assert row["name"] == dash_name, f"{code}: dashboard name moved"
        else:
            assert row["name"] == S.name(code), code
