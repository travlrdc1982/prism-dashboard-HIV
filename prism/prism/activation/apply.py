"""Apply locked activation coefficients (Wave 2+ / fresh-calibration reuse)."""

import numpy as np
import pandas as pd

from .config import ActivationConfig


def apply_activation_model(df: pd.DataFrame, config: ActivationConfig) -> pd.Series:
    """ACTPROB from the config's locked coefficients."""
    config.validate()
    assert config.calibration_mode == "apply" or all(
        v is not None for v in (config.fitted_intercept,
                                config.fitted_ars_slope,
                                config.fitted_bcs_slope)), (
        "apply_activation_model needs fitted coefficients in the config")
    z = (config.fitted_intercept
         + config.fitted_ars_slope * df[config.ars_var]
         + config.fitted_bcs_slope * df[config.bcs_var])
    return 1.0 / (1.0 + np.exp(-z))
