"""
PRISM Activation Module
=======================

Constructs the activation outcome variables and fits the activation
logistic regression that produces ACT_PROB for the ROI calculation.

The activation logistic is platform-canonical in form:
    P(OPTIN_BINARY = 1) = logistic(β₀ + β₁·ARS + β₂·BCS)

Coefficients (β₀, β₁, β₂) are estimated per study from Wave 1 data
using maximum likelihood logistic regression, replicating the historical
SPSS specification:

    LOGISTIC REGRESSION VARIABLES=OPTIN_BINARY /METHOD=ENTER ARS BCS
    /SAVE=PRED /PRINT=GOODFIT CI(95)
    /CRITERIA=PIN(0.05) POUT(0.10) ITERATE(20) CUT(0.5).

The OPTIN outcome is constructed in four steps:
    1. Eligibility filter (optional, instrument-specific)
    2. Count behavioral cost fields filled (the OPTIN_INDEX)
    3. Build graded outcome (OPTIN_GRADED): 0 / 0.25 / 0.75 / 1.0
       based on stated opt-in × behavioral cost grading
    4. Binarize for logistic (OPTIN_BINARY): 0 vs any positive

The graded outcome separates cheap talk from revealed preference:
    - 0.00: did not opt in
    - 0.25: opted in but provided no contact info (cheap signal)
    - 0.75: opted in and provided one contact method
    - 1.00: opted in and provided both contact methods (strongest signal)

The 4-tier grading is platform-locked. Two behavioral cost fields is
platform-locked (typically email + phone). The instrument-specific
variable names for OPTIN and the cost fields are configured per study.
"""

import numpy as np
import pandas as pd


# =============================================================================
# OPTIN OUTCOME CONSTRUCTION
# =============================================================================

def compute_optin_outcomes(df, activation_config):
    """
    Build the activation outcome variables.

    Parameters
    ----------
    df : DataFrame
        Survey data, including the OPTIN indicator variable and the two
        behavioral cost field variables specified in config.
    activation_config : dict
        From the study's activation YAML block. Required keys:
            - optin_indicator: {var, positive_value}
            - behavioral_cost_fields: [{var, label}, {var, label}]
            - grading: {no_optin, optin_no_fields, optin_one_field, optin_both_fields}
            - binarize_for_logistic: {zero_when: [...], one_when: [...]}
        Optional keys:
            - eligible_filter: {var, value}  (restricts computation to subset)

    Returns
    -------
    df with three new columns:
        OPTIN_INDEX   — count of behavioral cost fields filled (0, 1, or 2)
        OPTIN_GRADED  — 0 / 0.25 / 0.75 / 1.0 graded score
        OPTIN_BINARY  — 0/1 collapsed version for the logistic
    """
    # Eligibility mask
    if 'eligible_filter' in activation_config and activation_config['eligible_filter']:
        ef = activation_config['eligible_filter']
        eligible = df[ef['var']] == ef['value']
    else:
        eligible = pd.Series(True, index=df.index)

    # Count behavioral cost fields filled
    cost_fields = activation_config['behavioral_cost_fields']
    counts = pd.Series(0, index=df.index)
    for field in cost_fields:
        v = df[field['var']]
        # Treat empty string AND null as not filled
        filled = v.notna() & (v.astype(str).str.strip() != '')
        counts = counts + filled.astype(int)
    df['OPTIN_INDEX'] = counts.where(eligible)

    # Graded outcome
    optin_var = activation_config['optin_indicator']['var']
    pos_val = activation_config['optin_indicator']['positive_value']
    optin = df[optin_var]
    g = activation_config['grading']

    graded = pd.Series(np.nan, index=df.index)
    graded[eligible & (optin != pos_val)] = g['no_optin']
    graded[eligible & (optin == pos_val) & (counts == 0)] = g['optin_no_fields']
    graded[eligible & (optin == pos_val) & (counts == 1)] = g['optin_one_field']
    graded[eligible & (optin == pos_val) & (counts == 2)] = g['optin_both_fields']
    df['OPTIN_GRADED'] = graded

    # Binarize for logistic
    bz = activation_config['binarize_for_logistic']
    binary = pd.Series(np.nan, index=df.index)
    binary[df['OPTIN_GRADED'].isin(bz['zero_when'])] = 0
    binary[df['OPTIN_GRADED'].isin(bz['one_when'])] = 1
    df['OPTIN_BINARY'] = binary

    return df


# =============================================================================
# LOGISTIC CALIBRATION
# =============================================================================

def calibrate_activation_logistic(df, outcome_var='OPTIN_BINARY',
                                    ars_var='XQARS', bcs_var='XSMr4'):
    """
    Fit logistic regression for activation probability.

    Replicates SPSS:
        LOGISTIC REGRESSION VARIABLES=OPTIN_BINARY /METHOD=ENTER ARS BCS
        /SAVE=PRED /PRINT=GOODFIT CI(95)
        /CRITERIA=ITERATE(20)

    Returns
    -------
    dict with fitted parameters, diagnostics, and predicted probabilities.
    """
    import statsmodels.api as sm

    cols = [outcome_var, ars_var, bcs_var]
    work = df[cols].dropna()
    n_dropped = len(df) - len(work)

    if len(work) == 0:
        raise ValueError(
            f"No cases with non-missing {outcome_var}, {ars_var}, {bcs_var}. "
            f"Check eligibility filter and outcome construction."
        )

    y = work[outcome_var].astype(int)
    X = sm.add_constant(work[[ars_var, bcs_var]])

    model = sm.GLM(y, X, family=sm.families.Binomial()).fit(maxiter=20)

    # Generate predicted probabilities for full df (NaN where any predictor missing)
    pred = pd.Series(np.nan, index=df.index, name='ACTPROB')
    pred.loc[work.index] = model.predict(X)

    ci = model.conf_int(alpha=0.05)

    return {
        'intercept':    float(model.params['const']),
        'ars_slope':    float(model.params[ars_var]),
        'bcs_slope':    float(model.params[bcs_var]),
        'intercept_se': float(model.bse['const']),
        'ars_se':       float(model.bse[ars_var]),
        'bcs_se':       float(model.bse[bcs_var]),
        'intercept_ci': (float(ci.loc['const', 0]), float(ci.loc['const', 1])),
        'ars_ci':       (float(ci.loc[ars_var, 0]), float(ci.loc[ars_var, 1])),
        'bcs_ci':       (float(ci.loc[bcs_var, 0]), float(ci.loc[bcs_var, 1])),
        'n':            len(work),
        'n_dropped':    n_dropped,
        'optin_rate':   float(y.mean()),
        'log_likelihood': float(model.llf),
        'aic':          float(model.aic),
        'hosmer_lemeshow_p': hosmer_lemeshow(y, model.predict(X)),
        'predicted_probs': pred,
        'converged':    bool(model.converged),
    }


def hosmer_lemeshow(y_true, y_pred, n_bins=10):
    """
    Hosmer-Lemeshow goodness-of-fit test. Returns p-value.
    Low p (< 0.05) indicates poor fit. Matches SPSS GOODFIT.
    """
    from scipy.stats import chi2

    df = pd.DataFrame({'y': y_true.values, 'p': y_pred.values})
    df['bin'] = pd.qcut(df['p'], q=n_bins, duplicates='drop')
    grp = df.groupby('bin', observed=True).agg(
        obs_1=('y', 'sum'),
        n=('y', 'size'),
        exp_1=('p', 'sum'),
    )
    grp['obs_0'] = grp['n'] - grp['obs_1']
    grp['exp_0'] = grp['n'] - grp['exp_1']

    # Drop bins where expected count is 0 or near-0
    grp = grp[(grp['exp_1'] > 0.5) & (grp['exp_0'] > 0.5)]
    if len(grp) < 3:
        return float('nan')

    chi_sq = ((grp['obs_1'] - grp['exp_1']) ** 2 / grp['exp_1']
              + (grp['obs_0'] - grp['exp_0']) ** 2 / grp['exp_0']).sum()
    df_test = len(grp) - 2
    return float(1 - chi2.cdf(chi_sq, df_test))


# =============================================================================
# APPLY FITTED MODEL (for subsequent waves or new data)
# =============================================================================

def apply_activation_model(df, intercept, ars_slope, bcs_slope,
                             ars_var='XQARS', bcs_var='XSMr4'):
    """
    Compute ACT_PROB using locked coefficients.

    Used when calibration was done on a prior wave and the coefficients
    are reused. Returns Series with predicted probabilities.
    """
    z = intercept + ars_slope * df[ars_var] + bcs_slope * df[bcs_var]
    return 1.0 / (1.0 + np.exp(-z))


# =============================================================================
# DIAGNOSTIC REPORT
# =============================================================================

def format_calibration_report(result):
    """Format calibration results as a human-readable markdown block."""
    lines = [
        "## Activation Logistic Calibration",
        "",
        f"**Model:** P(OPTIN_BINARY = 1) = logistic(β₀ + β₁·ARS + β₂·BCS)",
        "",
        "### Coefficients (95% CIs)",
        "",
        "| Term      | Estimate | SE     | 95% CI                | p (vs 0) |",
        "|-----------|----------|--------|------------------------|----------|",
        f"| Intercept | {result['intercept']:>8.3f} | {result['intercept_se']:.3f} "
        f"| ({result['intercept_ci'][0]:.3f}, {result['intercept_ci'][1]:.3f}) |          |",
        f"| ARS slope | {result['ars_slope']:>8.3f} | {result['ars_se']:.3f} "
        f"| ({result['ars_ci'][0]:.3f}, {result['ars_ci'][1]:.3f}) |          |",
        f"| BCS slope | {result['bcs_slope']:>8.3f} | {result['bcs_se']:.3f} "
        f"| ({result['bcs_ci'][0]:.3f}, {result['bcs_ci'][1]:.3f}) |          |",
        "",
        "### Sample and Fit",
        "",
        f"- N used:                 {result['n']:>6}",
        f"- N dropped (missing):    {result['n_dropped']:>6}",
        f"- OPTIN rate:             {result['optin_rate']:.1%}",
        f"- Converged:              {result['converged']}",
        f"- Log-likelihood:         {result['log_likelihood']:>8.2f}",
        f"- AIC:                    {result['aic']:>8.2f}",
        f"- Hosmer-Lemeshow p:      {result['hosmer_lemeshow_p']:>6.3f}",
        "",
    ]
    return "\n".join(lines)
