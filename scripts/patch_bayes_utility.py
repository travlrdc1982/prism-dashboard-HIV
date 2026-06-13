#!/usr/bin/env python3
"""
Surgical Bayesian-Utility patch.

ONLY adds the new Bayesian utility fields to the existing
src/data/topline/dashboard.json. Does NOT recompute the cube. Does
NOT recompute SoP. Does NOT recompute simple SoP. Does NOT touch
variants / baskets / segments / study / lift_variants / ui.

What this script writes:
  message_topline[i].by_segment[code].utility_signed         (new)
  message_topline[i].by_segment[code].utility_0_100          (new)
  message_topline[i].by_segment[code].utility_ci_low_signed  (new)
  message_topline[i].by_segment[code].utility_ci_high_signed (new)
  message_topline[i].by_segment[code].utility_ci_low_0_100   (new)
  message_topline[i].by_segment[code].utility_ci_high_0_100  (new)
  message_topline[i].by_segment[code].utility_shrink_weight  (new)

What this script DOES NOT TOUCH (verifiable by `git diff`):
  any existing field on any existing object — n, bw_mean, sop_pct,
  sop_ci_low, sop_ci_high, the legacy 0-100 utility, OR any other
  top-level key in dashboard.json.

Run from the repo root:
    python scripts/patch_bayes_utility.py
"""
import json
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SAV = REPO / "data" / "260433.sav"
DASHBOARD = REPO / "src" / "data" / "topline" / "dashboard.json"

# Make the messagemap modules importable.
MM_SRC = REPO / "pipeline" / "messagemap" / "src"
PIPELINE = REPO / "pipeline"
sys.path.insert(0, str(MM_SRC))
sys.path.insert(0, str(PIPELINE))

import pyreadstat
from prism_step3_exposure import build_exposure_matrix
from prism_topline_bayes import hierarchical_utility
from study_config import (
    load_config as _load_config,
    segments_messagemap as _segments_messagemap,
)


def main():
    print(f"Repo:       {REPO}")
    print(f"SAV:        {SAV}")
    print(f"Dashboard:  {DASHBOARD}")
    if not SAV.exists():
        sys.exit(f"  ✗ .sav not found: {SAV}")
    if not DASHBOARD.exists():
        sys.exit(f"  ✗ dashboard.json not found: {DASHBOARD}")

    # ── 1. Load .sav + build exposure matrix ──────────────────────
    cfg = _load_config()
    SEGMENTS = _segments_messagemap(cfg)
    n_msgs = len(cfg.get("message_config", [])) or 17
    print(f"\nStudy:      {cfg['study']['id']}  · "
          f"{len(SEGMENTS)} segments · {n_msgs} messages")

    print("\n[1/4] Loading .sav...")
    t = time.time()
    df, _ = pyreadstat.read_sav(str(SAV))
    print(f"      n={len(df)} respondents  ({time.time()-t:.1f}s)")

    design_path = REPO / "pipeline" / "messagemap" / "data" / "Gilead_Design_File.dat"
    print(f"\n[2/4] Building exposure matrix from design...")
    t = time.time()
    exposure, _tasks, diag = build_exposure_matrix(df, design_path=str(design_path))
    print(f"      {diag['total_exposure_rows']:,} exposure records  "
          f"({time.time()-t:.1f}s)")

    # ── 2. Bayesian utility (the ONLY computation this script does) ──
    print("\n[3/4] hierarchical_utility — Bayesian Normal-Normal shrinkage...")
    t = time.time()
    util = hierarchical_utility(exposure, SEGMENTS, n_msgs=n_msgs)
    print(f"      σ_within={util.attrs['sigma_within']:.4f}  "
          f"τ²={util.attrs['tau_squared']:.4f}  "
          f"scale=[{util.attrs['scale_min']:+.3f}, "
          f"{util.attrs['scale_max']:+.3f}]  "
          f"({time.time()-t:.1f}s)")

    # ── 3. Surgical merge into dashboard.json ─────────────────────
    print("\n[4/4] Patching dashboard.json (additive only)...")
    with open(DASHBOARD, "r", encoding="utf-8") as f:
        dash = json.load(f)

    code_by_seg = {sid: meta["code"] for sid, meta in SEGMENTS.items()}

    # Build a (item, code) → row lookup once.
    util_by_key = {}
    for _, r in util.iterrows():
        sid = int(r["segment"])
        code = code_by_seg.get(sid)
        if code is None:
            continue
        util_by_key[(int(r["item"]), code)] = r

    def rnd(v, n=4):
        if v is None:
            return None
        try:
            f = float(v)
        except Exception:
            return None
        # NaN / inf → None
        if f != f or f in (float("inf"), float("-inf")):
            return None
        return round(f, n)

    n_patched = 0
    n_skipped = 0
    affected_keys = (
        "utility_signed", "utility_0_100",
        "utility_ci_low_signed", "utility_ci_high_signed",
        "utility_ci_low_0_100", "utility_ci_high_0_100",
        "utility_shrink_weight",
    )

    for entry in dash.get("message_topline", []):
        m = int(entry.get("message"))
        for code, cell in (entry.get("by_segment") or {}).items():
            r = util_by_key.get((m, code))
            if r is None:
                n_skipped += 1
                continue
            cell["utility_signed"]         = rnd(r["utility_signed"], 4)
            cell["utility_0_100"]          = rnd(r["utility_0_100"], 1)
            cell["utility_ci_low_signed"]  = rnd(r["utility_ci_low_signed"], 4)
            cell["utility_ci_high_signed"] = rnd(r["utility_ci_high_signed"], 4)
            cell["utility_ci_low_0_100"]   = rnd(r["utility_ci_low_0_100"], 1)
            cell["utility_ci_high_0_100"]  = rnd(r["utility_ci_high_0_100"], 1)
            cell["utility_shrink_weight"]  = rnd(r["shrink_weight"], 3)
            n_patched += 1

    with open(DASHBOARD, "w", encoding="utf-8") as f:
        json.dump(dash, f, indent=2, ensure_ascii=False)

    print(f"      patched {n_patched} (msg × seg) cells; "
          f"{n_skipped} skipped (no matching utility row)")
    print(f"      keys written per cell: {', '.join(affected_keys)}")

    print("\n═══ Done ═══")
    print(f"  Run `git diff -- {DASHBOARD.relative_to(REPO)}` to verify "
          f"only the seven utility keys were added.")


if __name__ == "__main__":
    main()
