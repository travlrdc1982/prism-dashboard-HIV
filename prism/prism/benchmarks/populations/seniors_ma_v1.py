"""
seniors_ma_v1 — PLACEHOLDER survey population.

Medicare Advantage enrollees, 65+ (non-cluster-aware). Template for
narrow insured populations; note the dimension set differs from the
default frame (plan type replaces education, no age rake within 65+).
Values below are PLACEHOLDERS — structurally valid for tests only.
Replace values + sources and flip placeholder=False before any client use.
"""

from .base import SurveyPopulation

SENIORS_MA_V1 = SurveyPopulation(
    population_id="seniors_ma_v1",
    version="0.0-placeholder",
    population_description="Medicare Advantage enrollees, 65+ (PLACEHOLDER values).",
    last_updated="2026-06-12",
    cluster_aware=False,
    sources={d: "PLACEHOLDER — load real values before use"
             for d in ("sex", "race", "region", "plan_type")},
    targets={
        "ALL": {
            "sex":       {"Male": 0.45, "Female": 0.55},
            "race":      {"White": 0.68, "Black": 0.12, "Hispanic": 0.13, "Other": 0.07},
            "region":    {"Northeast": 0.18, "Midwest": 0.22, "South": 0.39, "West": 0.21},
            "plan_type": {"HMO": 0.55, "PPO": 0.40, "Other": 0.05},
        },
    },
    placeholder=True,
)
