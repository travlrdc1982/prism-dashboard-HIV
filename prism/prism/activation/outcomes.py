"""
OPTIN outcome construction (refactored verbatim from the prototype;
the test suite proves equivalence).

Four steps:
  1. optional eligibility filter
  2. OPTIN_INDEX  — count of behavioral cost fields filled (0/1/2)
  3. OPTIN_GRADED — 0 / 0.25 / 0.75 / 1.0 (platform-locked grading)
  4. OPTIN_BINARY — 0 vs any positive grade, for the logistic
"""

import numpy as np
import pandas as pd

from .config import ActivationConfig, OPTIN_GRADING, OPTIN_BINARIZE


def compute_optin_outcomes(df: pd.DataFrame, config: ActivationConfig) -> pd.DataFrame:
    config.validate()

    if config.eligible_filter:
        ef = config.eligible_filter
        eligible = df[ef["var"]] == ef["value"]
    else:
        eligible = pd.Series(True, index=df.index)

    counts = pd.Series(0, index=df.index)
    for fld in config.behavioral_cost_fields:
        v = df[fld["var"]]
        filled = v.notna() & (v.astype(str).str.strip() != "")
        counts = counts + filled.astype(int)
    df["OPTIN_INDEX"] = counts.where(eligible)

    optin = df[config.optin_var]
    pos = config.optin_positive_value
    g = OPTIN_GRADING
    graded = pd.Series(np.nan, index=df.index)
    graded[eligible & (optin != pos)] = g["no_optin"]
    graded[eligible & (optin == pos) & (counts == 0)] = g["optin_no_fields"]
    graded[eligible & (optin == pos) & (counts == 1)] = g["optin_one_field"]
    graded[eligible & (optin == pos) & (counts == 2)] = g["optin_both_fields"]
    df["OPTIN_GRADED"] = graded

    binary = pd.Series(np.nan, index=df.index)
    binary[df["OPTIN_GRADED"].isin(OPTIN_BINARIZE["zero_when"])] = 0
    binary[df["OPTIN_GRADED"].isin(OPTIN_BINARIZE["one_when"])] = 1
    df["OPTIN_BINARY"] = binary
    return df
