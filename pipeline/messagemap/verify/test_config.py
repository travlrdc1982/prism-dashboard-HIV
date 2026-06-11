"""
Smoke test for prism_config.py.

1. Load study/study.yaml as-is. Expect success; print a summary.
2. Mutate the in-memory dict in three ways that should each be
   caught by a different validator, and confirm each one raises.

Run:
    cd messagemap
    python verify/test_config.py
"""

import sys
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import yaml
from pydantic import ValidationError

from prism_config import StudyConfig, load_study_config


def _expect_fail(label: str, cfg_dict: dict, expected_substring: str) -> None:
    """Try to validate cfg_dict. Print PASS if it raises with expected_substring
    in any of its error messages; FAIL otherwise."""
    try:
        StudyConfig.model_validate(cfg_dict)
    except ValidationError as e:
        msgs = "\n".join(str(err) for err in e.errors())
        if expected_substring in msgs:
            print(f"  [PASS] {label}")
            return
        print(f"  [FAIL] {label}")
        print(f"         expected substring: {expected_substring!r}")
        print(f"         actual messages:\n{msgs}")
        return
    print(f"  [FAIL] {label}: validation did not raise")


def main() -> None:
    yaml_path = ROOT.parent.parent / "study" / "study.yaml"
    print("=" * 72)
    print("Part 1: load real study.yaml")
    print("=" * 72)

    cfg = load_study_config(yaml_path)
    print(f"  Loaded {yaml_path}")
    print(f"  study.id              = {cfg.study.id}")
    print(f"  index.items           = {len(cfg.index.items)} items, "
          f"scale {cfg.index.scale.min}..{cfg.index.scale.max}")
    print(f"  index.alpha           = soft {cfg.index.alpha_soft_threshold}, "
          f"hard {cfg.index.alpha_hard_threshold}, on_fail "
          f"{cfg.index.on_hard_fail}")
    print(f"  residualization       = predict {cfg.residualization.outcome_var} on "
          f"{cfg.residualization.predictors}")
    print(f"  maxdiff               = "
          f"{cfg.maxdiff.n_tasks} tasks x {cfg.maxdiff.items_per_task} items/task")
    print(f"  estimation.bootstrap  = {cfg.estimation.bootstrap.n_iter} iter, "
          f"seed {cfg.estimation.bootstrap.seed}")
    print(f"  estimation.ci_level   = {cfg.estimation.ci_level}")
    print(f"  lift_variants         = {[lv.name for lv in cfg.lift_variants]}")
    print(f"  baskets               = {[b.id for b in cfg.baskets]}")
    print(f"  dashboard defaults    = view={cfg.dashboard.default_view}, "
          f"outcome={cfg.dashboard.default_outcome}, "
          f"basket={cfg.dashboard.default_basket}")
    print(f"  legacy_rename         = {len(cfg.legacy_rename)} entries")
    print(f"  segment_registry ids  = {[r.id for r in cfg.segment_registry]}")
    print(f"  segments.priority    = {cfg.segments.priority_tier_in_study}")
    print("  validation PASS")

    print()
    print("=" * 72)
    print("Part 2: deliberate fail-cases")
    print("=" * 72)

    raw = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))

    # ── Fail 1: alpha_hard > alpha_soft ────────────────────────────
    bad = deepcopy(raw)
    bad["index"]["alpha_hard_threshold"] = 0.80
    bad["index"]["alpha_soft_threshold"] = 0.70
    _expect_fail(
        "alpha_hard (0.80) >= alpha_soft (0.70) should fail",
        bad,
        "alpha_hard_threshold (0.8) must be strictly less than alpha_soft_threshold",
    )

    # ── Fail 2: legacy_rename target collision ─────────────────────
    bad = deepcopy(raw)
    bad["legacy_rename"]["HIV_R1"] = "M002_token"  # already maps HIV_R2 -> M002_token
    _expect_fail(
        "two legacy vars renaming to the same canonical name should fail",
        bad,
        "target canonical names are not unique",
    )

    # ── Fail 3: basket references a segment ID not in the registry ─
    bad = deepcopy(raw)
    bad["baskets"][1]["segments"] = [11, 12, 13, 99]  # 99 not in registry
    _expect_fail(
        "basket referencing segment ID 99 (not in registry) should fail",
        bad,
        "segment IDs [99] not in segment_registry",
    )

    # ── Fail 4: legacy_rename target violates canonical naming ─────
    bad = deepcopy(raw)
    bad["legacy_rename"]["HIV_RANDOM"] = "persona_framign"  # typo: framign
    _expect_fail(
        "legacy_rename target with typo (persona_framign) should fail",
        bad,
        "do not match the canonical naming convention",
    )

    # ── Fail 5: dashboard.default_outcome doesn't match a lift_variant ──
    bad = deepcopy(raw)
    bad["dashboard"]["default_outcome"] = "no_such_outcome"
    _expect_fail(
        "dashboard.default_outcome pointing at a nonexistent variant should fail",
        bad,
        "is not a name in lift_variants",
    )

    # ── Fail 6: scale.min >= scale.max ─────────────────────────────
    bad = deepcopy(raw)
    bad["index"]["scale"]["min"] = 7
    bad["index"]["scale"]["max"] = 7
    _expect_fail(
        "scale.min (7) >= scale.max (7) should fail",
        bad,
        "scale.min (7) must be < scale.max (7)",
    )

    # ── Fail 7: maxdiff exceeds platform_constraints ───────────────
    bad = deepcopy(raw)
    bad["maxdiff"]["n_tasks"] = 26   # max is 20
    _expect_fail(
        "maxdiff.n_tasks (26) exceeding max_tasks_per_respondent (20) should fail",
        bad,
        "exceeds platform_constraints.max_tasks_per_respondent",
    )

    # ── Fail 8: data_confidence thin_min_n >= ok_min_n ─────────────
    bad = deepcopy(raw)
    bad["segments"]["data_confidence"]["thin_min_n"] = 150  # ok is 100
    _expect_fail(
        "data_confidence: thin_min_n (150) >= ok_min_n (100) should fail",
        bad,
        "thin_min_n (150) must be strictly less than ok_min_n",
    )


if __name__ == "__main__":
    main()
