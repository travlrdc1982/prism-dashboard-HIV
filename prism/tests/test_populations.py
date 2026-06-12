"""Survey population library: structure, voters values, placeholder guards."""
import pytest

from prism.benchmarks.populations import (
    POPULATIONS, get_population, VOTERS_V1,
)


@pytest.mark.parametrize("pop_id", sorted(POPULATIONS))
def test_every_population_validates(pop_id):
    assert POPULATIONS[pop_id].validate()


def test_voters_is_real_and_cluster_aware():
    assert not VOTERS_V1.placeholder
    assert VOTERS_V1.cluster_aware
    assert set(VOTERS_V1.clusters()) == {"DEM", "GOP"}
    assert len(VOTERS_V1.cluster_definitions["GOP"]) == 10
    assert len(VOTERS_V1.cluster_definitions["DEM"]) == 6


def test_voters_locked_spot_values():
    # Verbatim from the prototype voter_benchmarks_v1.py.
    assert VOTERS_V1.targets["DEM"]["sex"]["Female"] == 0.60
    assert VOTERS_V1.targets["GOP"]["sex"]["Male"] == 0.55
    assert VOTERS_V1.targets["GOP"]["race"]["White"] == 0.87
    assert VOTERS_V1.targets["DEM"]["region"]["South"] == 0.3332
    assert VOTERS_V1.targets["GOP"]["region"]["South"] == 0.4393
    assert VOTERS_V1.targets["DEM"]["education"]["College"] == 0.54


def test_non_voter_templates_are_flagged_placeholders():
    for pop_id, pop in POPULATIONS.items():
        if pop_id == "voters_v1":
            continue
        assert pop.placeholder, f"{pop_id} must be flagged placeholder until real values load"
        assert not pop.cluster_aware


def test_unknown_population_errors_clearly():
    with pytest.raises(KeyError, match="Unknown survey population"):
        get_population("nope_v0")
