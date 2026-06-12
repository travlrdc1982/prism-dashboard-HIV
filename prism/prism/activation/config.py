"""
ActivationConfig — the per-study activation block.

The MODEL FORM is platform-locked: P(OPTIN_BINARY=1) = logistic(b0 +
b1*ARS + b2*BCS), with the four-tier OPTIN grading (0/0.25/0.75/1.0)
and two behavioral cost fields. What varies per study: the instrument
variable names, the optional eligibility filter, and — per the analyst
ruling — ALL THREE coefficients, which are FIT from each study's Wave 1
data (calibration_mode='fit') and then locked into the study YAML for
subsequent waves (calibration_mode='apply').
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional

# Platform-locked grading scheme: separates cheap talk from revealed
# preference (opted in + both contact methods = strongest signal).
OPTIN_GRADING = {
    "no_optin": 0.0,
    "optin_no_fields": 0.25,
    "optin_one_field": 0.75,
    "optin_both_fields": 1.0,
}
# Platform-locked binarization: any positive grade counts as activation.
OPTIN_BINARIZE = {
    "zero_when": [0.0],
    "one_when": [0.25, 0.75, 1.0],
}

CALIBRATION_MODES = ("fit", "apply")


@dataclass(frozen=True)
class ActivationConfig:
    # Instrument-specific
    optin_var: str = "OPTIN"
    optin_positive_value: int = 1
    behavioral_cost_fields: List[Dict[str, str]] = field(default_factory=lambda: [
        {"var": "OPTIN_1r1", "label": "email"},
        {"var": "OPTIN_1r2", "label": "phone"},
    ])
    eligible_filter: Optional[Dict] = None        # {var, value} or None
    ars_var: str = "XQARS"
    bcs_var: str = "XSMr4"

    # 'fit' (Wave 1) or 'apply' (later waves, with locked coefficients)
    calibration_mode: str = "fit"
    fitted_intercept: Optional[float] = None
    fitted_ars_slope: Optional[float] = None
    fitted_bcs_slope: Optional[float] = None

    def validate(self):
        assert self.calibration_mode in CALIBRATION_MODES, (
            f"calibration_mode {self.calibration_mode!r} not in {CALIBRATION_MODES}")
        assert len(self.behavioral_cost_fields) == 2, (
            "two behavioral cost fields is platform-locked")
        if self.calibration_mode == "apply":
            missing = [k for k, v in (
                ("fitted_intercept", self.fitted_intercept),
                ("fitted_ars_slope", self.fitted_ars_slope),
                ("fitted_bcs_slope", self.fitted_bcs_slope)) if v is None]
            assert not missing, (
                f"calibration_mode='apply' requires locked coefficients; "
                f"missing {missing}")
        return True


HIV_WAVE1_ACTIVATION = ActivationConfig()
