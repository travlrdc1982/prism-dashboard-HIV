"""WeightConfig — the per-study weighting block."""

from dataclasses import dataclass, field
from typing import Dict, List, Optional

OTHER_HANDLING = ("fold", "random_split")


@dataclass(frozen=True)
class WeightConfig:
    # Instrument-specific: rake dimension -> {var, recode{value: category}}
    rake_dimensions: List[str] = field(default_factory=list)
    variable_mapping: Dict[str, Dict] = field(default_factory=dict)

    # Segment variable handling (numeric ids or string codes)
    segment_var: str = "XSEG_ASSIGNED"
    segment_id_to_code: Dict[int, str] = field(default_factory=dict)

    # QGENDER "Other" handling (spec watch-out): fold to a fixed
    # category (Wave 1 convention: Female) or split randomly with a
    # fixed seed (Wave 2+ convention).
    sex_other_source_value: Optional[int] = 3
    sex_other_handling: str = "fold"          # 'fold' | 'random_split'
    sex_other_fold_to: str = "Female"
    sex_other_split_between: List[str] = field(
        default_factory=lambda: ["Male", "Female"])
    sex_other_seed: int = 26433

    # Platform-conventional rake controls (overridable per study)
    trim_low: float = 0.25
    trim_high: float = 5.0
    max_iterations: int = 100
    tolerance: float = 1.0e-7

    # Joint-convergence outer loop (analyst decision: both margin sets
    # enforced simultaneously, superseding the one-pass prototype).
    # Default tolerance 0.005 (half a point) is the knee of the
    # DEFF-vs-precision curve on HIV Wave 1: ~5 outer passes, every
    # margin within 0.5pp (far below sampling noise), DEFF 1.96 vs
    # 2.02 at the trim-limited floor — and vs the one-pass prototype's
    # 9.9pp worst demographic gap (GOP 65+). Tighten or loosen per
    # study in YAML; the residual table reports either way.
    outer_max_iterations: int = 50
    outer_tolerance: float = 0.005      # max margin gap, proportion units

    def validate(self):
        assert self.rake_dimensions, "rake_dimensions must not be empty"
        for dim in self.rake_dimensions:
            assert dim in self.variable_mapping, (
                f"rake dimension {dim!r} missing from variable_mapping")
        assert self.sex_other_handling in OTHER_HANDLING
        assert 0 < self.trim_low < 1 < self.trim_high
        return self


# HIV Wave 1 bindings (verbatim from the prototype HIV_WAVE1_CONFIG;
# 'Other' gender folded to Female per the Wave 1 convention).
HIV_WAVE1_WEIGHTING = WeightConfig(
    rake_dimensions=["sex", "age", "race", "education", "region"],
    variable_mapping={
        "sex": {"var": "QGENDER",
                "recode": {1: "Male", 2: "Female"}},
        "age": {"var": "QAGECAT5",
                "recode": {1: "18-29", 2: "30-44", 3: "45-64",
                           4: "45-64", 5: "65+"}},
        "race": {"var": "QRACE_ETHNIC",
                 "recode": {1: "White", 2: "Black", 3: "Other",
                            4: "Other", 5: "Hispanic"}},
        "education": {"var": "XEDU_CAT",
                      "recode": {1: "Non-College", 2: "Non-College",
                                 3: "Non-College", 4: "College",
                                 5: "College"}},
        "region": {"var": "XQREGION",
                   "recode": {1: "Northeast", 2: "Midwest",
                              3: "South", 4: "West"}},
    },
    segment_id_to_code={
        1: "TSP", 2: "CEC", 3: "TC", 4: "HF", 5: "PP",
        6: "WE", 7: "PFF", 8: "HHN", 9: "MFL", 10: "VS",
        11: "UCP", 12: "FJP", 13: "HCP", 14: "HAD", 15: "HCI", 16: "GHI"},
)
