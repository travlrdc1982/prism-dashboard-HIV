"""
Survey population registry. Stage 1 demographic weighting reads its rake
target from one of these. voters_v1 is the PRISM default.
"""

from .base import SurveyPopulation
from .voters_v1 import VOTERS_V1
from .us_adults_v1 import US_ADULTS_V1
from .seniors_ma_v1 import SENIORS_MA_V1
from .pregnant_parents_v1 import PREGNANT_PARENTS_V1

POPULATIONS = {
    p.population_id: p
    for p in (VOTERS_V1, US_ADULTS_V1, SENIORS_MA_V1, PREGNANT_PARENTS_V1)
}


def get_population(population_id: str) -> SurveyPopulation:
    """Resolve a population_id from a study YAML to its definition."""
    try:
        return POPULATIONS[population_id]
    except KeyError:
        raise KeyError(
            f"Unknown survey population {population_id!r}. "
            f"Registered: {sorted(POPULATIONS)}") from None


__all__ = ["SurveyPopulation", "POPULATIONS", "get_population",
           "VOTERS_V1", "US_ADULTS_V1", "SENIORS_MA_V1", "PREGNANT_PARENTS_V1"]
