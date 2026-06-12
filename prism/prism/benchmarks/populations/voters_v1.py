"""
voters_v1 — DEM/GOP voter demographic benchmarks (the PRISM default).

PROVENANCE
----------
Locked from PRISM_WEIGHTING.xlsx, May 2026. Source notes per dimension:
  - Sex:       CBS Exit 2016 (Dem) / FiveThirtyEight 2021 (GOP)
  - Age:       CBS Exit 2016
  - Race/Eth:  Edison/CBS exit polls 2016 & 2020, Pew, Brookings
  - Education: Brookings 2018 (Dem) / CBS Exit 2016 (GOP)
  - Region:    Wikipedia 2024-2020 (state-vote aggregations)

These represent the durable structural demographic composition of each
party cluster. Income, religion, marital status, and finer education
breakdowns are intentionally excluded (the diploma divide makes the
2-category education split sufficient).

Values refactored verbatim from the prototype voter_benchmarks_v1.py
(DEM_VOTERS_V1 / GOP_VOTERS_V1) into the SurveyPopulation shape.
"""

from .base import SurveyPopulation
from ..segments_v1 import PRISM_SEGMENTS_V1

VOTERS_V1 = SurveyPopulation(
    population_id="voters_v1",
    version="1.0",
    population_description=(
        "U.S. voters, cluster-aware: DEM-cluster respondents raked to "
        "Democratic-voter benchmarks, GOP-cluster respondents to "
        "Republican-voter benchmarks."),
    last_updated="2026-05-15",
    cluster_aware=True,
    cluster_definitions={
        "DEM": PRISM_SEGMENTS_V1.codes_in_cluster("DEM"),
        "GOP": PRISM_SEGMENTS_V1.codes_in_cluster("GOP"),
    },
    sources={
        "sex":       "CBS Exit 2016 (Dem) / FiveThirtyEight 2021 (GOP)",
        "age":       "CBS Exit 2016",
        "race":      "Edison/CBS 2016+2020, Pew, Brookings",
        "education": "Brookings 2018 (Dem) / CBS Exit 2016 (GOP)",
        "region":    "Wikipedia state-vote aggregations 2020-2024",
    },
    targets={
        "DEM": {
            "sex":       {"Male": 0.40, "Female": 0.60},
            "age":       {"18-29": 0.17, "30-44": 0.22, "45-64": 0.36, "65+": 0.25},
            "race":      {"White": 0.61, "Black": 0.21, "Hispanic": 0.12, "Other": 0.06},
            "education": {"College": 0.54, "Non-College": 0.46},
            "region":    {"Northeast": 0.1766, "Midwest": 0.1710, "South": 0.3332, "West": 0.3193},
        },
        "GOP": {
            "sex":       {"Male": 0.55, "Female": 0.45},
            "age":       {"18-29": 0.10, "30-44": 0.19, "45-64": 0.40, "65+": 0.31},
            "race":      {"White": 0.87, "Black": 0.02, "Hispanic": 0.07, "Other": 0.04},
            "education": {"College": 0.45, "Non-College": 0.55},
            "region":    {"Northeast": 0.1091, "Midwest": 0.2016, "South": 0.4393, "West": 0.2499},
        },
    },
)
