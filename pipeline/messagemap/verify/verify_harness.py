"""
PRISM Message Map -- verification harness.

This harness exists ONLY because of the schema drift between
src/prism_variants_parser.py (writes msg_id / tokens) and
src/prism_build_dashboard.py (expects id / proofs). The unchanged
orchestrator crashes at the messages-metadata assembly step
(prism_build_dashboard.py line 396, KeyError on m['id']).

This file is a thin re-implementation of the orchestrator that skips
the broken metadata step but is otherwise byte-for-byte the same
compute path (it imports the same functions from src/). It writes
outputs/dashboard_verify.json with everything needed to diff against
the shipped outputs/dashboard.json on the numerics and structure that
matter for regression testing.

LIFECYCLE: delete this harness (and outputs/dashboard_verify.json)
once BOTH of the following are true:
  (1) Phase B step 8 has reconciled the parser and orchestrator, AND
  (2) an integration test runs the unchanged-orchestrator path against
      the refactored pipeline and passes (i.e. confirms the orchestrator
      produces a full dashboard.json including the messages section,
      identical to the shipped artifact within locked tolerances).
Until both land, this harness is the only way to run the cell+scalar
verify cleanly, so it stays.

Run from repo root:
    cd messagemap
    python verify/verify_harness.py
"""
import sys
import os
import json
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import numpy as np
import pandas as pd
import pyreadstat

# Import from src/ unchanged. These are the same functions the
# unchanged orchestrator calls; this harness exercises exactly the
# same compute path.
from prism_index import compute_persuasion_index, compute_residualized_shift
from prism_step3_exposure import build_exposure_matrix
from prism_build_dashboard import (
    SEGMENTS,
    BASKETS,
    construct_outcome,
    compute_cells_for_outcome,
    compute_topline,
    compute_simple_sop,
    cells_to_records,
    topline_to_structure,
)


# Paths. Same env-var overrides as the orchestrator; defaults assume
# the standard repo layout (repo-root data/ for the .sav,
# pipeline/messagemap/data for the design file).
_REPO = ROOT.parent.parent  # pipeline/messagemap → pipeline → repo root
SAV_PATH = os.environ.get("PRISM_SAV", str(_REPO / "data" / "260433.sav"))
DESIGN_PATH = os.environ.get("PRISM_DESIGN", str(ROOT / "data" / "Gilead_Design_File.dat"))
OUT_PATH = str(ROOT / "outputs" / "dashboard_verify.json")


def main():
    t_total = time.time()
    print("=" * 72)
    print("PRISM verify harness (cell + scalar reproduction, no messages metadata)")
    print("=" * 72)

    # Steps 1-2: load .sav, compute index + residualized shift
    print("\n[1] Loading .sav and computing index + residualized shift...")
    t = time.time()
    df, _ = pyreadstat.read_sav(SAV_PATH)
    df, diag_idx = compute_persuasion_index(df)
    df, diag_res = compute_residualized_shift(df)
    print(f"    n={len(df)}, alpha_pre={diag_idx['cronbach_alpha_pre']:.4f}, "
          f"alpha_post={diag_idx['cronbach_alpha_post']:.4f}, "
          f"R²={diag_res['r_squared']:.4f}, beta_pre={diag_res['beta_pre']:.4f} "
          f"({time.time()-t:.1f}s)")

    # Step 3: exposure matrix
    print("\n[2] Building exposure matrix...")
    t = time.time()
    exposure, tasks, diag_exp = build_exposure_matrix(df, design_path=DESIGN_PATH)
    print(f"    {diag_exp['total_exposure_rows']:,} exposure records ({time.time()-t:.1f}s)")

    # Step 4a: cells for persuasion outcome
    print("\n[3] Computing cells: persuasion_messaging (outcome = residual_shift)...")
    t = time.time()
    df, outcome_col_p = construct_outcome(df, "persuasion_messaging")
    cells_persuasion, diag_p = compute_cells_for_outcome(df, exposure, outcome_col_p, n_bootstrap=500)
    print(f"    {len(cells_persuasion)} cells, sigma_w={diag_p['sigma_within']:.4f}, "
          f"sigma_b={diag_p['sigma_between']:.4f} ({time.time()-t:.1f}s)")

    # Step 4b: cells for base outcome
    print("\n[4] Computing cells: base_messaging (outcome = pre_composite, centered by segment)...")
    t = time.time()
    df, outcome_col_b = construct_outcome(df, "base_messaging")
    cells_base, diag_b = compute_cells_for_outcome(df, exposure, outcome_col_b, n_bootstrap=500)
    print(f"    {len(cells_base)} cells, sigma_w={diag_b['sigma_within']:.4f}, "
          f"sigma_b={diag_b['sigma_between']:.4f} ({time.time()-t:.1f}s)")

    # Step 5: topline SoP + utility
    print("\n[5] Computing topline (SoP + Utility per segment x message)...")
    t = time.time()
    topline = compute_topline(exposure, df, n_bootstrap=300)
    print(f"    {len(topline)} (seg x msg) topline rows ({time.time()-t:.1f}s)")

    # Step 6: simple SoP plot
    print("\n[6] Computing simple SoP plot data (5 baskets)...")
    t = time.time()
    simple_sop = compute_simple_sop(exposure, BASKETS)
    print(f"    {len(simple_sop)} baskets ({time.time()-t:.1f}s)")

    # Compose segment metadata with sample sizes (same logic as orchestrator)
    seg_n = df["XSEG_ASSIGNED"].value_counts().to_dict()
    segments_out = []
    for sid in range(1, 17):
        meta = SEGMENTS[sid]
        segments_out.append({
            "id": sid, "code": meta["code"], "label": meta["label"],
            "party": meta["party"], "priority_tier": meta["priority_tier"],
            "n": int(seg_n.get(sid, 0)),
        })

    # Assemble verify dashboard. SKIP the messages section (the
    # parser/orchestrator drift). The variants section is also omitted
    # since it is a verbatim pass-through of prism_variants.json and
    # carries no computed content. Everything that matters for the
    # numeric regression is present.
    dashboard = {
        "study": {
            "id": "PRISM_HIV_2026",
            "title": "PRISM HIV Treatment & Prevention",
            "client": "Gilead",
            "analyst": "Bryan Dumont",
            "n_total": len(df),
            "index": {
                "n_items": diag_idx["n_items"],
                "alpha_pre":  round(diag_idx["cronbach_alpha_pre"], 3),
                "alpha_post": round(diag_idx["cronbach_alpha_post"], 3),
                "composite_shift_mean": round(diag_idx["composite_shift_mean"], 3),
                "scale_range": diag_idx["scale_range"],
            },
            "residualization": {
                "r_squared": round(diag_res["r_squared"], 3),
                "beta_pre":  round(diag_res["beta_pre"], 3),
            },
        },
        "segments": segments_out,
        # messages: omitted (parser/orchestrator drift); see harness docstring
        "baskets": [{
            "id": b["id"], "name": b["name"],
            "segments": b["segments"], "weight": b["weight"]
        } for b in BASKETS],
        "lift_variants": [
            {"name": "persuasion_messaging", "label": "PERSUASION MESSAGING",
             "description": "How much engagement with this variant moves attitudinal alignment above baseline",
             "sigma_within":  round(diag_p["sigma_within"], 4),
             "sigma_between": round(diag_p["sigma_between"], 4),
             "color_scale": {"min": -0.30, "max": 0.30, "neutral": 0}},
            {"name": "base_messaging", "label": "BASE MESSAGING",
             "description": ("How much more aligned message-engagers are than their "
                             "segment baseline — high cells = your supporters love this variant"),
             "sigma_within":  round(diag_b["sigma_within"], 4),
             "sigma_between": round(diag_b["sigma_between"], 4),
             "color_scale": {"min": -0.30, "max": 0.30, "neutral": 0}},
        ],
        "message_map_cells": {
            "persuasion_messaging": cells_to_records(cells_persuasion),
            "base_messaging":       cells_to_records(cells_base),
        },
        "message_topline": topline_to_structure(topline, SEGMENTS),
        "sop_simple": simple_sop,
        # variants: omitted (pure pass-through of prism_variants.json)
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(dashboard, f, indent=2, ensure_ascii=False)
    size_kb = os.path.getsize(OUT_PATH) / 1024
    print(f"\n[Wrote {OUT_PATH} ({size_kb:.0f} KB)]")
    print(f"[Total runtime: {time.time()-t_total:.1f}s]")
    return dashboard


if __name__ == "__main__":
    main()
