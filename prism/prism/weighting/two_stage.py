"""
Two-stage weighting with JOINT CONVERGENCE (analyst decision, Jun 2026).

Stage 1  demographic rake — cluster-aware populations rake each cluster
         against its own benchmark; others rake the full sample.
Stage 2  segment rake — always against the PRISM canonical shares.

The prototype ran one pass of each and accepted demographic drift from
Stage 2. This orchestrator wraps the stages in an outer loop until BOTH
margin sets sit within outer_tolerance (or the outer iteration cap is
hit, which is reported loudly with the residual gap table — never
silently accepted). The composition trick: Stage 1 rakes each cluster's
demographics against the cluster's CURRENT weighted total, so it
preserves whatever cluster mass Stage 2 just set.

Output column: WEIGHT — the one weight variable, mean 1.0, sum = N.
Within-segment estimates should NOT use it (population-level only).
"""

import numpy as np
import pandas as pd

from .config import WeightConfig
from .rake import rake, trim_and_renormalize


def _recode_rake_vars(df, config: WeightConfig, notes: list) -> pd.DataFrame:
    for dim in config.rake_dimensions:
        mapping = config.variable_mapping[dim]
        src, recode = mapping["var"], mapping["recode"]
        df[dim] = df[src].map(recode)

        # Sex 'Other' handling (fold vs seeded random split)
        if dim == "sex" and config.sex_other_source_value is not None:
            other = df[src] == config.sex_other_source_value
            if other.any():
                if config.sex_other_handling == "fold":
                    df.loc[other, dim] = config.sex_other_fold_to
                    notes.append(f"sex: {int(other.sum())} 'Other' folded "
                                 f"to {config.sex_other_fold_to}")
                else:
                    rng = np.random.default_rng(config.sex_other_seed)
                    draw = rng.choice(config.sex_other_split_between,
                                      size=int(other.sum()))
                    df.loc[other, dim] = draw
                    notes.append(f"sex: {int(other.sum())} 'Other' randomly "
                                 f"split (seed {config.sex_other_seed})")

        n_unmapped = int(df[dim].isna().sum() - df[src].isna().sum())
        if n_unmapped > 0:
            mode = df[dim].mode().iloc[0]
            df[dim] = df[dim].fillna(mode)
            notes.append(f"{dim}: {n_unmapped} unmapped values imputed "
                         f"to mode ({mode})")
    return df


def _margin_gaps(df, weight_col, dims_targets, mask=None) -> list:
    """[(dimension, category, target, achieved, gap), ...] for one
    target set, proportions of the masked subset's weight."""
    sub = df if mask is None else df.loc[mask]
    total = sub[weight_col].sum()
    rows = []
    for dim, cats in dims_targets.items():
        for cat, tgt in cats.items():
            achieved = sub.loc[sub[dim] == cat, weight_col].sum() / total
            rows.append((dim, cat, tgt, achieved, achieved - tgt))
    return rows


def apply_two_stage_weighting(df, weight_config: WeightConfig,
                              survey_population, segment_benchmark,
                              allow_placeholder: bool = False):
    """Returns (df with WEIGHT column, diagnostics dict)."""
    cfg = weight_config.validate()
    survey_population.validate()
    segment_benchmark.validate()
    if survey_population.placeholder and not allow_placeholder:
        raise ValueError(
            f"survey population {survey_population.population_id!r} carries "
            f"PLACEHOLDER benchmark values — load real values (or pass "
            f"allow_placeholder=True for testing only)")

    notes = []
    df = _recode_rake_vars(df, cfg, notes)

    # Segment codes + clusters
    seg = df[cfg.segment_var]
    if seg.dtype.kind == "O" or isinstance(seg.dtype, pd.CategoricalDtype):
        df["_segment_code"] = seg
    else:
        df["_segment_code"] = seg.map(cfg.segment_id_to_code)
    df["_cluster"] = df["_segment_code"].map(
        lambda c: segment_benchmark.cluster(c) if pd.notna(c) else None)
    n_no_cluster = int(df["_cluster"].isna().sum())
    if n_no_cluster:
        notes.append(f"{n_no_cluster} respondents lack a segment/cluster "
                     f"assignment and keep weight 1.0")

    seg_targets = {"_segment_code": {
        c: segment_benchmark.pop_share(c) for c in segment_benchmark.codes()}}
    # Segment proportions are defined over the benchmark's own total
    # (≈1.0001 at full precision) — normalize so they sum to exactly 1.
    seg_total = sum(seg_targets["_segment_code"].values())
    seg_targets["_segment_code"] = {
        c: v / seg_total for c, v in seg_targets["_segment_code"].items()}

    # Stage-1 target sets, keyed by cluster (or ALL)
    if survey_population.cluster_aware:
        stage1_sets = {cl: survey_population.targets[cl]
                       for cl in survey_population.clusters()}
        cluster_masks = {cl: (df["_cluster"] == cl)
                         for cl in survey_population.clusters()}
    else:
        stage1_sets = {"ALL": survey_population.targets["ALL"]}
        cluster_masks = {"ALL": pd.Series(True, index=df.index)}

    df["WEIGHT"] = 1.0
    N = float(len(df))
    history = []

    for outer in range(1, cfg.outer_max_iterations + 1):
        # Stage 1 — demographics, per cluster, against the cluster's
        # CURRENT weighted total (composition with Stage 2)
        s1_info = {}
        for cl, targets in stage1_sets.items():
            mask = cluster_masks[cl]
            sub = df.loc[mask].copy()
            res = rake(sub, "WEIGHT", cfg.rake_dimensions, targets,
                       max_iter=cfg.max_iterations, tol=cfg.tolerance)
            df.loc[mask, "WEIGHT"] = sub["WEIGHT"].values
            s1_info[cl] = res

        # Stage 2 — segments over the full sample
        s2 = rake(df, "WEIGHT", ["_segment_code"], seg_targets,
                  max_iter=cfg.max_iterations, tol=cfg.tolerance)

        # Trim + renormalize to sum N each outer pass
        trim_and_renormalize(df, "WEIGHT", cfg.trim_low, cfg.trim_high,
                             total=N)

        # Joint convergence check across BOTH margin sets
        gaps = []
        for cl, targets in stage1_sets.items():
            gaps += [(f"{cl}/{d}", c, t, a, g) for d, c, t, a, g in
                     _margin_gaps(df, "WEIGHT", targets,
                                  mask=cluster_masks[cl])]
        gaps += [("segments", c, t, a, g) for d, c, t, a, g in
                 _margin_gaps(df, "WEIGHT", seg_targets)]
        max_gap = max(abs(g) for *_, g in gaps)
        history.append({"outer": outer, "max_gap": max_gap,
                        "stage1": {cl: r["iterations"] for cl, r in s1_info.items()},
                        "stage2_iterations": s2["iterations"]})
        if max_gap < cfg.outer_tolerance:
            converged = True
            break
        # Stagnation: the trim caps are binding and further passes can't
        # move the margins — stop and report rather than grind the cap.
        if outer >= 3 and abs(history[-2]["max_gap"] - max_gap) < 1e-7:
            converged = False
            break
    else:
        converged = False

    diagnostics = {
        "converged": converged,
        "outer_iterations": len(history),
        "max_gap": history[-1]["max_gap"],
        "history": history,
        "margin_recovery": gaps,
        "notes": notes,
        "n_no_cluster": n_no_cluster,
    }
    if not converged:
        diagnostics["warning"] = (
            f"joint rake stopped at outer iteration cap "
            f"({cfg.outer_max_iterations}) with max margin gap "
            f"{history[-1]['max_gap']:.5f} — review the residual gap "
            f"table before using these weights")
    return df, diagnostics
