"""
Activation logistic calibration — per-study ML fit (analyst ruling:
all three coefficients are estimated from each study's Wave 1 data;
the model FORM is platform-locked).

Replicates the historical SPSS specification:
    LOGISTIC REGRESSION VARIABLES=OPTIN_BINARY /METHOD=ENTER ARS BCS
    /SAVE=PRED /PRINT=GOODFIT CI(95) /CRITERIA=ITERATE(20)
"""

import numpy as np
import pandas as pd

from .config import ActivationConfig


def calibrate_activation_logistic(df: pd.DataFrame, config: ActivationConfig,
                                  outcome_var: str = "OPTIN_BINARY") -> dict:
    """Fit the activation logistic; returns coefficients + diagnostics
    + full-sample predicted probabilities (NaN where predictors missing)."""
    import statsmodels.api as sm

    ars, bcs = config.ars_var, config.bcs_var
    work = df[[outcome_var, ars, bcs]].dropna()
    if len(work) == 0:
        raise ValueError(
            f"No cases with non-missing {outcome_var}, {ars}, {bcs}. "
            f"Check eligibility filter and outcome construction.")

    y = work[outcome_var].astype(int)
    X = sm.add_constant(work[[ars, bcs]])
    model = sm.GLM(y, X, family=sm.families.Binomial()).fit(maxiter=20)

    pred = pd.Series(np.nan, index=df.index, name="ACTPROB")
    pred.loc[work.index] = model.predict(X)
    ci = model.conf_int(alpha=0.05)

    return {
        "intercept": float(model.params["const"]),
        "ars_slope": float(model.params[ars]),
        "bcs_slope": float(model.params[bcs]),
        "intercept_se": float(model.bse["const"]),
        "ars_se": float(model.bse[ars]),
        "bcs_se": float(model.bse[bcs]),
        "intercept_ci": (float(ci.loc["const", 0]), float(ci.loc["const", 1])),
        "ars_ci": (float(ci.loc[ars, 0]), float(ci.loc[ars, 1])),
        "bcs_ci": (float(ci.loc[bcs, 0]), float(ci.loc[bcs, 1])),
        "n": len(work),
        "n_dropped": len(df) - len(work),
        "optin_rate": float(y.mean()),
        "log_likelihood": float(model.llf),
        "aic": float(model.aic),
        "hosmer_lemeshow_p": hosmer_lemeshow(y, model.predict(X)),
        "predicted_probs": pred,
        "converged": bool(model.converged),
    }


def hosmer_lemeshow(y_true, y_pred, n_bins: int = 10) -> float:
    """Hosmer-Lemeshow goodness-of-fit p-value (matches SPSS GOODFIT)."""
    from scipy.stats import chi2

    d = pd.DataFrame({"y": np.asarray(y_true), "p": np.asarray(y_pred)})
    d["bin"] = pd.qcut(d["p"], q=n_bins, duplicates="drop")
    grp = d.groupby("bin", observed=True).agg(
        obs_1=("y", "sum"), n=("y", "size"), exp_1=("p", "sum"))
    grp["obs_0"] = grp["n"] - grp["obs_1"]
    grp["exp_0"] = grp["n"] - grp["exp_1"]
    grp = grp[(grp["exp_1"] > 0.5) & (grp["exp_0"] > 0.5)]
    if len(grp) < 3:
        return float("nan")
    chi_sq = (((grp["obs_1"] - grp["exp_1"]) ** 2 / grp["exp_1"])
              + ((grp["obs_0"] - grp["exp_0"]) ** 2 / grp["exp_0"])).sum()
    return float(1 - chi2.cdf(chi_sq, len(grp) - 2))


def format_calibration_report(result: dict) -> str:
    """Markdown calibration report for the diagnostics bundle."""
    return "\n".join([
        "## Activation Logistic Calibration",
        "",
        "**Model:** P(OPTIN_BINARY = 1) = logistic(β₀ + β₁·ARS + β₂·BCS)",
        "",
        "### Coefficients (95% CIs)",
        "",
        "| Term      | Estimate | SE     | 95% CI                |",
        "|-----------|----------|--------|------------------------|",
        f"| Intercept | {result['intercept']:>8.3f} | {result['intercept_se']:.3f} "
        f"| ({result['intercept_ci'][0]:.3f}, {result['intercept_ci'][1]:.3f}) |",
        f"| ARS slope | {result['ars_slope']:>8.3f} | {result['ars_se']:.3f} "
        f"| ({result['ars_ci'][0]:.3f}, {result['ars_ci'][1]:.3f}) |",
        f"| BCS slope | {result['bcs_slope']:>8.3f} | {result['bcs_se']:.3f} "
        f"| ({result['bcs_ci'][0]:.3f}, {result['bcs_ci'][1]:.3f}) |",
        "",
        "### Sample and Fit",
        "",
        f"- N used:              {result['n']:>6}",
        f"- N dropped (missing): {result['n_dropped']:>6}",
        f"- OPTIN rate:          {result['optin_rate']:.1%}",
        f"- Converged:           {result['converged']}",
        f"- Log-likelihood:      {result['log_likelihood']:>8.2f}",
        f"- AIC:                 {result['aic']:>8.2f}",
        f"- Hosmer-Lemeshow p:   {result['hosmer_lemeshow_p']:>6.3f}",
        "",
    ])
