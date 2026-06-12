"""
pregnant_parents_v1 — PLACEHOLDER survey population.

Women who are pregnant or have children under 5 (non-cluster-aware).
Template for narrow demographic populations; parity replaces sex in the
dimension set. Values below are PLACEHOLDERS — structurally valid for
tests only. Replace values + sources and flip placeholder=False before
any client use.
"""

from .base import SurveyPopulation

PREGNANT_PARENTS_V1 = SurveyPopulation(
    population_id="pregnant_parents_v1",
    version="0.0-placeholder",
    population_description=(
        "Women pregnant or with children under 5 (PLACEHOLDER values)."),
    last_updated="2026-06-12",
    cluster_aware=False,
    sources={d: "PLACEHOLDER — load real values before use"
             for d in ("age", "race", "education", "region", "parity")},
    targets={
        "ALL": {
            "age":       {"18-29": 0.38, "30-44": 0.58, "45-64": 0.04},
            "race":      {"White": 0.52, "Black": 0.14, "Hispanic": 0.24, "Other": 0.10},
            "education": {"College": 0.42, "Non-College": 0.58},
            "region":    {"Northeast": 0.16, "Midwest": 0.20, "South": 0.39, "West": 0.25},
            "parity":    {"First child": 0.40, "Multiple children": 0.60},
        },
    },
    placeholder=True,
)
