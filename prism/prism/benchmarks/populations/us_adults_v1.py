"""
us_adults_v1 — PLACEHOLDER survey population.

General U.S. adult population (non-cluster-aware), for studies whose
universe is all adults rather than voters. Dimension structure matches
voters_v1 categorization. Values below are PLACEHOLDERS — structurally
valid so the module imports and tests can exercise the non-cluster-aware
path, but NOT real population estimates. Replace values + sources and
flip placeholder=False before any client use.
"""

from .base import SurveyPopulation

US_ADULTS_V1 = SurveyPopulation(
    population_id="us_adults_v1",
    version="0.0-placeholder",
    population_description="General U.S. adults, 18+ (PLACEHOLDER values).",
    last_updated="2026-06-12",
    cluster_aware=False,
    sources={d: "PLACEHOLDER — load real values before use"
             for d in ("sex", "age", "race", "education", "region")},
    targets={
        "ALL": {
            "sex":       {"Male": 0.49, "Female": 0.51},
            "age":       {"18-29": 0.21, "30-44": 0.25, "45-64": 0.32, "65+": 0.22},
            "race":      {"White": 0.60, "Black": 0.12, "Hispanic": 0.18, "Other": 0.10},
            "education": {"College": 0.38, "Non-College": 0.62},
            "region":    {"Northeast": 0.17, "Midwest": 0.21, "South": 0.38, "West": 0.24},
        },
    },
    placeholder=True,
)
