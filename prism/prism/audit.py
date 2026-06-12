"""
Decipher audit (analyst decision: recompute + audit).

The package recomputes every composite in Python (the system of record)
and compares against any Decipher-computed columns present in the input
SAV, producing a per-column summary CSV: where Decipher's math is sound
the values match; where it diverges, the known cause is annotated.
"""

import numpy as np
import pandas as pd

# Known, documented divergence causes for HIV Wave 1-era Decipher exports.
KNOWN_CAUSES = {
    "XQALIGN_PRE_C": "label offset only (Decipher 1-5, platform 0-4); math identical",
    "XQP1": "Decipher lacks the DK-midpoint recode",
    "XQP3": "Decipher lacks the DK-midpoint recode",
    "XQARS": "downstream of XQP1/XQP3 DK recode",
    "XQARSadj": "downstream of the broken Decipher XSM2 trap (flags ~100%)",
    "XROIr1": "Decipher alignment rounded upstream (max diff < 0.005)",
    "XROIr2": "downstream of Decipher alignment rounding",
    "XROIr3": "downstream of Decipher alignment rounding",
    "XROIr4": "downstream of Decipher alignment rounding",
    "XROIr5": "downstream of XQARS (DK recode)",
    "XROIr6": "downstream of XQARSadj (broken trap) and XROIr5",
    "XROIr7": "sum of divergent components",
    "XROI_cat": "small drift from XROIr5; ~99.5% agreement",
}


def audit_against_decipher(decipher_df: pd.DataFrame,
                           recomputed_df: pd.DataFrame) -> pd.DataFrame:
    """Summary frame comparing recomputed composites to the Decipher
    columns that existed in the input. One row per audited column."""
    rows = []
    candidates = [c for c in recomputed_df.columns
                  if c.startswith("X") and c in decipher_df.columns]
    for c in sorted(candidates):
        d = pd.to_numeric(decipher_df[c], errors="coerce")
        p = pd.to_numeric(recomputed_df[c], errors="coerce")
        both = d.notna() & p.notna()
        n = int(both.sum())
        if n == 0:
            continue
        diff = (d[both] - p[both]).abs()
        match = int((diff < 1e-6).sum())
        rows.append({
            "column": c,
            "n_compared": n,
            "n_match": match,
            "pct_match": round(100 * match / n, 2),
            "max_abs_diff": float(diff.max()),
            "note": ("clean" if match == n
                     else KNOWN_CAUSES.get(c, "UNEXPECTED divergence — investigate")),
        })
    return pd.DataFrame(rows)
