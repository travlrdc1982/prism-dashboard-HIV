"""
End-to-end pipeline orchestrator.

    from prism.pipeline import run_study
    result = run_study("prism/studies/hiv_wave1.yaml",
                       "data/INPUT.sav", "output/hiv_wave1/")

Order: load+validate config → read SAV → composites → activation
(fit or apply; ROI recomputed with the operative coefficients) → DQ
flags (+ the study's exclusion policy; default keeps everyone) →
two-stage joint-convergence weighting → Decipher audit → diagnostics
→ outputs. The weight column is WEIGHT. Every output carries a
provenance stamp.
"""

import hashlib
import json
from dataclasses import replace
from datetime import date
from pathlib import Path

import pandas as pd

from . import __version__
from .activation import (apply_activation_model,
                         calibrate_activation_logistic,
                         compute_optin_outcomes,
                         format_calibration_report)
from .audit import audit_against_decipher
from .composites import compute_all_prism
from .composites.core import categorize_roi, compute_roi_components
from .quality import compute_dq_flags
from .quality.flags import apply_exclusion_policy
from .studies import load_study_config
from .weighting import (apply_two_stage_weighting, format_weighting_report,
                        weight_diagnostics)


def _md_table(df) -> str:
    """Minimal markdown table (avoids the tabulate dependency)."""
    cols = list(df.columns)
    lines = ["| " + " | ".join(cols) + " |",
             "|" + "|".join("---" for _ in cols) + "|"]
    for _, row in df.iterrows():
        lines.append("| " + " | ".join(str(row[c]) for c in cols) + " |")
    return "\n".join(lines)


def _sha256(path, chunk=1 << 20):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while blob := f.read(chunk):
            h.update(blob)
    return h.hexdigest()[:16]


def run_study(study_config, input_sav, output_dir, verbose=True):
    """Run the full PRISM pipeline. Returns a dict of output paths."""
    import numpy as np
    import pyreadstat

    cfg = load_study_config(study_config)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    log = print if verbose else (lambda *a, **k: None)

    log(f"PRISM {__version__} — {cfg.study_id}")
    log(f"  config: {study_config}")
    log(f"  input:  {input_sav}")

    df, meta = pyreadstat.read_sav(str(input_sav))
    log(f"  N = {len(df)}, {len(df.columns)} columns")
    decipher_snapshot = df.copy()

    # ── Composites ──────────────────────────────────────────────────
    log("Composites...")
    df = compute_all_prism(df, cfg.composites)

    # ── Activation ──────────────────────────────────────────────────
    log(f"Activation ({cfg.activation.calibration_mode})...")
    df = compute_optin_outcomes(df, cfg.activation)
    if cfg.activation.calibration_mode == "fit":
        calib = calibrate_activation_logistic(df, cfg.activation)
        coeffs = {"intercept": calib["intercept"],
                  "ars_slope": calib["ars_slope"],
                  "bcs_slope": calib["bcs_slope"]}
        calib_report = format_calibration_report(calib)
        df["ACTPROB"] = calib["predicted_probs"]
        # Re-run the ROI chain with the freshly-fit coefficients
        comp2 = replace(cfg.composites,
                        act_intercept=coeffs["intercept"],
                        act_ars_slope=coeffs["ars_slope"],
                        act_bcs_slope=coeffs["bcs_slope"])
        df = compute_roi_components(df, comp2)
        df = categorize_roi(df, comp2)
        log(f"  fitted: b0={coeffs['intercept']:.3f} "
            f"ars={coeffs['ars_slope']:.3f} bcs={coeffs['bcs_slope']:.3f}")
    else:
        df["ACTPROB"] = apply_activation_model(df, cfg.activation)
        coeffs = {"intercept": cfg.activation.fitted_intercept,
                  "ars_slope": cfg.activation.fitted_ars_slope,
                  "bcs_slope": cfg.activation.fitted_bcs_slope}
        calib_report = ("## Activation\n\nApplied locked coefficients: "
                        f"{coeffs}\n")

    # ── Data quality ────────────────────────────────────────────────
    log("Data-quality flags...")
    flags = compute_dq_flags(df, cfg.quality)
    n_before = len(df)
    df = apply_exclusion_policy(df, flags, cfg.quality)
    flags_out = flags.copy()
    for c in ("record", "uuid", "qtime", cfg.quality.overclaim_var):
        if c in decipher_snapshot.columns:
            flags_out.insert(0, c, decipher_snapshot[c])
    log(f"  policy '{cfg.quality.exclusion_policy}': "
        f"{n_before} → {len(df)} respondents")

    # ── Weighting ───────────────────────────────────────────────────
    log("Two-stage weighting (joint convergence)...")
    df, rake_diag = apply_two_stage_weighting(
        df, cfg.weighting, cfg.survey_population, cfg.segment_benchmark)
    wdiag = weight_diagnostics(df)
    log(f"  outer={rake_diag['outer_iterations']} "
        f"converged={rake_diag['converged']} "
        f"max_gap={rake_diag['max_gap']:.4f} DEFF={wdiag['deff']:.3f}")

    # ── Decipher audit ──────────────────────────────────────────────
    audit = audit_against_decipher(decipher_snapshot, df)

    # ── Outputs ─────────────────────────────────────────────────────
    log("Writing outputs...")
    paths = {}

    out_df = df.copy()
    for c in out_df.columns:           # pyreadstat can't write Int64/object-NA
        if str(out_df[c].dtype) == "Int64":
            out_df[c] = out_df[c].astype(float)
    out_df = out_df.drop(columns=[c for c in ("_segment_code", "_cluster")
                                  if c in out_df.columns])
    paths["weighted_sav"] = output_dir / f"{cfg.study_id}_weighted.sav"
    pyreadstat.write_sav(out_df, str(paths["weighted_sav"]))

    paths["weights_csv"] = output_dir / f"{cfg.study_id}_weights.csv"
    cols = [c for c in ("record", "uuid") if c in df.columns] + ["WEIGHT"]
    df[cols].to_csv(paths["weights_csv"], index=False)

    paths["dq_flags_csv"] = output_dir / f"{cfg.study_id}_dq_flags.csv"
    flags_out.to_csv(paths["dq_flags_csv"], index=False)

    paths["audit_csv"] = output_dir / f"{cfg.study_id}_decipher_audit.csv"
    audit.to_csv(paths["audit_csv"], index=False)

    # Diagnostics markdown with provenance stamp
    provenance = {
        "package_version": __version__,
        "study_yaml": str(study_config),
        "study_yaml_sha": _sha256(study_config),
        "input_sav": str(input_sav),
        "input_sav_sha": _sha256(input_sav),
        "numpy": np.__version__,
        "pandas": pd.__version__,
        "run_date": date.today().isoformat(),
        "activation_coefficients": coeffs,
        "exclusion_policy": cfg.quality.exclusion_policy,
        "n_input": n_before,
        "n_weighted": len(df),
    }
    md = "\n\n".join([
        f"# PRISM diagnostics — {cfg.study_id}",
        "```json\n" + json.dumps(provenance, indent=2) + "\n```",
        calib_report,
        format_weighting_report(wdiag, rake_diag),
        "## Decipher audit\n\n" + _md_table(audit),
    ])
    paths["diagnostics_md"] = output_dir / f"{cfg.study_id}_diagnostics.md"
    paths["diagnostics_md"].write_text(md, encoding="utf-8")

    log("Done.")
    return {k: str(v) for k, v in paths.items()} | {
        "provenance": provenance, "rake_diagnostics": rake_diag}
