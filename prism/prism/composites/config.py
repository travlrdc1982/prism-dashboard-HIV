"""
CompositeConfig — everything about composite scoring that varies by
study. Platform-locked math and constants live in core.py and are
deliberately NOT configurable.

Tiers (per the build spec):
  Instrument-specific  variable names, item lists, recode maps, trap
  Issue-calibrated     ROI category thresholds
  Per-study estimated  activation logistic coefficients (fit from each
                       study's Wave 1 data by prism.activation, then
                       written into the study YAML and applied here)
"""

from dataclasses import dataclass, field
from typing import Dict, List


@dataclass(frozen=True)
class CompositeConfig:
    # ── Instrument-specific ────────────────────────────────────────────
    # Demographic recode (4-cat race/ethnicity, Census Vintage 2024 frame)
    race_var: str = "QRACE_ETHNIC"
    race_recode: Dict[float, int] = field(default_factory=lambda: {
        1.0: 1, 2.0: 2, 3.0: 4, 4.0: 4, 5.0: 3})

    # Rank-priority item (None if the study has no priority rank)
    priority_rank_pre: str = "QPRE_1r1"
    priority_rank_post: str = "QPOST_1r1"
    rank_scale_size: int = 7

    # Reverse-coded items: {source_var: recoded_var}
    reverse_coded: Dict[str, str] = field(default_factory=lambda: {
        "QPRE_6": "XQPRE_6R", "QPOST_6": "XPOST_6R"})
    likert_max: int = 7

    # Alignment composite item lists (post-recode names, 1-7 scale each)
    pre_items: List[str] = field(default_factory=lambda: [
        "XQPRE_1r1", "QPRE_2", "QPRE_3", "QPRE_4",
        "QPRE_5", "XQPRE_6R", "QPRE_7r1"])
    post_items: List[str] = field(default_factory=lambda: [
        "XPOST_1r1", "QPOST_2", "QPOST_3", "QPOST_4",
        "QPOST_5", "XPOST_6R", "QPOST_7r1"])

    # Validity trap (XSM2): trap_var must equal trap_expected to pass
    trap_var: str = "QSM2r3"
    trap_expected: int = 3
    overclaim_var: str = "XSMr1"

    # ARS source items + BCS
    ars_items: Dict[str, str] = field(default_factory=lambda: {
        "QP1": "QP1", "QP2": "QP2", "QP3": "QP3"})
    bcs_var: str = "XSMr4"

    # ── Issue-calibrated ───────────────────────────────────────────────
    roi_highest_actprob: float = 0.50
    roi_highest_post: float = 5.0
    roi_strong_actprob: float = 0.25
    roi_strong_post: float = 4.5

    # ── Per-study estimated (by prism.activation; applied here) ────────
    act_intercept: float = -0.759
    act_ars_slope: float = 1.547
    act_bcs_slope: float = 0.769

    def validate(self):
        assert self.rank_scale_size >= 2
        assert len(self.pre_items) == len(self.post_items), (
            "pre/post item lists must pair up")
        assert set(self.ars_items) == {"QP1", "QP2", "QP3"}, (
            "ARS needs exactly QP1/QP2/QP3 bindings")
        assert self.roi_strong_actprob <= self.roi_highest_actprob
        assert self.roi_strong_post <= self.roi_highest_post
        return True


# HIV Wave 1 — the canonical first study. All defaults above ARE the
# HIV Wave 1 bindings, so this is simply the default construction.
HIV_WAVE1_COMPOSITES = CompositeConfig()
