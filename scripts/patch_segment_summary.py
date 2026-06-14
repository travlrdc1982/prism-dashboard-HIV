#!/usr/bin/env python3
"""
Surgical patch — segment summary drawer config.

Reads `dashboard.segment_summary` from study/study.yaml and writes it
into `dashboard.ui.segment_summary` inside src/data/topline/dashboard.json.

What this script writes:
  ui.segment_summary.copy       (editorial copy — card titles, subtitles,
                                 action chips, contextual notes, message-
                                 box labels)
  ui.segment_summary.overrides  (per-segment pinned message IDs)

What this script DOES NOT TOUCH (verifiable by `git diff`):
  any other top-level key in dashboard.json — cube, sop_simple, baskets,
  variants, message_topline, segments, study, lift_variants. Inside
  `ui`, only the `segment_summary` sub-block is replaced; sibling keys
  (default_view, views, default_outcome, etc.) are left intact.

Run from the repo root:
    python scripts/patch_segment_summary.py
"""
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
YAML = REPO / "study" / "study.yaml"
DASHBOARD = REPO / "src" / "data" / "topline" / "dashboard.json"

# Make pipeline modules importable (uses repo's PyYAML loader).
sys.path.insert(0, str(REPO / "pipeline"))
from study_config import load_config as _load_config


def main():
    print(f"Repo:       {REPO}")
    print(f"YAML:       {YAML}")
    print(f"Dashboard:  {DASHBOARD}")
    if not YAML.exists():
        sys.exit(f"  ✗ study.yaml not found: {YAML}")
    if not DASHBOARD.exists():
        sys.exit(f"  ✗ dashboard.json not found: {DASHBOARD}")

    print("\n[1/3] Reading study.yaml...")
    cfg = _load_config()
    block = (cfg.get("dashboard") or {}).get("segment_summary") or {}
    if not block:
        sys.exit("  ✗ dashboard.segment_summary not found in study.yaml")
    copy = block.get("copy") or {}
    overrides = block.get("overrides") or {}
    rules = block.get("rules") or {}
    n_cards = len((copy.get("cards") or {}))
    n_overrides = len(overrides)
    n_rules = len(rules)
    print(f"      copy.cards: {n_cards} slots  ·  rules: {n_rules}  ·  "
          f"overrides: {n_overrides} segments")

    print("\n[2/3] Reading dashboard.json...")
    with open(DASHBOARD, "r", encoding="utf-8") as f:
        dash = json.load(f)

    ui = dash.setdefault("ui", {})

    print("\n[3/3] Writing ui.segment_summary (replacing only that sub-block)...")
    ui["segment_summary"] = {
        "rules": rules,
        "copy": copy,
        "overrides": overrides,
    }

    with open(DASHBOARD, "w", encoding="utf-8") as f:
        json.dump(dash, f, indent=2, ensure_ascii=False)

    print("\n═══ Done ═══")
    print(f"  Run `git diff -- {DASHBOARD.relative_to(REPO)}` to verify "
          f"only ui.segment_summary changed.")


if __name__ == "__main__":
    main()
