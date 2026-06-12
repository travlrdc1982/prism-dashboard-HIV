"""Weight diagnostics: DEFF / effective N, distribution, recovery report."""

import pandas as pd


def weight_diagnostics(df: pd.DataFrame, weight_col: str = "WEIGHT") -> dict:
    w = df[weight_col]
    n = len(df)
    mean_w = w.mean()
    deff = 1 + (w.var(ddof=0) / (mean_w ** 2))
    neff = n / deff
    return {
        "N": n, "sum": float(w.sum()), "mean": float(mean_w),
        "min": float(w.min()), "max": float(w.max()),
        "deff": float(deff), "neff": float(neff),
        "efficiency": float(neff / n),
    }


def format_weighting_report(diag: dict, rake_diag: dict) -> str:
    """Markdown report: distribution, convergence, residual gap table."""
    L = ["## Two-Stage Weighting (joint convergence)", ""]
    L.append(f"- N: {diag['N']}  |  sum: {diag['sum']:.2f}  |  "
             f"mean: {diag['mean']:.4f}")
    L.append(f"- range: [{diag['min']:.4f}, {diag['max']:.4f}]")
    L.append(f"- DEFF: {diag['deff']:.3f}  |  effective N: "
             f"{diag['neff']:.0f}  |  efficiency: {diag['efficiency']:.1%}")
    L.append(f"- outer iterations: {rake_diag['outer_iterations']}  |  "
             f"converged: {rake_diag['converged']}  |  max margin gap: "
             f"{rake_diag['max_gap']:.6f}")
    if rake_diag.get("warning"):
        L += ["", f"**WARNING:** {rake_diag['warning']}"]
    for note in rake_diag.get("notes", []):
        L.append(f"- note: {note}")
    L += ["", "### Margin recovery", "",
          "| Target set / dimension | Category | Target | Achieved | Gap |",
          "|---|---|---|---|---|"]
    for dim, cat, tgt, ach, gap in rake_diag["margin_recovery"]:
        L.append(f"| {dim} | {cat} | {tgt:.4f} | {ach:.4f} | {gap:+.5f} |")
    L.append("")
    return "\n".join(L)
