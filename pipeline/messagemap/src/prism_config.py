"""
PRISM Message Map -- study config schema.

Pydantic v2 models for messagemap/config/study.yaml. The schema is the
contract between the YAML, the workbook, and the .sav: anything the
pipeline reads from configuration goes through these models. If a
required field is missing or typed wrong, the load fails before any
compute runs.

The schema enforces three classes of rule:

1. Field-level types (handled by Pydantic native typing).
2. Per-field invariants via field_validator (e.g. alpha in [0, 1]).
3. Cross-field invariants via model_validator (e.g. alpha_hard <
   alpha_soft, basket segment IDs are subset of segments.expected_ids,
   default_outcome matches a lift_variant name).

Canonical naming conventions for the legacy_rename targets are checked
against patterns derived from sav_conventions. This catches typos like
"M001_tken" or "task1_best" (missing zero pad) at load time rather than
at pipeline run time.

Loading:
    from prism_config import load_study_config
    cfg = load_study_config("config/study.yaml")

The returned cfg is a fully validated StudyConfig instance, immutable
by convention (set frozen=True on models for true immutability if
analyst attempts at-runtime mutation become a concern).
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Union

import yaml
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


# ─────────────────────────────────────────────────────────────────────
# Canonical-name regexes used to validate legacy_rename targets.
# These mirror the patterns in sav_conventions and the documented
# naming convention in HANDOFF_NOTES Part 1.
# ─────────────────────────────────────────────────────────────────────

_CANONICAL_RE = {
    "token":   re.compile(r"^M\d{3}_token$"),
    "best":    re.compile(r"^task\d{2}_best$"),
    "worst":   re.compile(r"^task\d{2}_worst$"),
    "pre":     re.compile(r"^idx\d{3}_pre$"),
    "post":    re.compile(r"^idx\d{3}_post$"),
}
_CANONICAL_FIXED = {"persona_framing", "design_version", "XSEG_ASSIGNED"}


def _is_canonical_target(name: str) -> bool:
    if name in _CANONICAL_FIXED:
        return True
    return any(rx.match(name) for rx in _CANONICAL_RE.values())


# ─────────────────────────────────────────────────────────────────────
# Sub-models
# ─────────────────────────────────────────────────────────────────────


class StudyMeta(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    title: str
    client: str
    field_dates: str
    analyst: str
    version: str


class Sources(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sav_path: str
    design_file: str
    variants_workbook: str
    variants_sheet: str
    weight_var: Optional[str] = None
    record_id_var: str


class SavConventions(BaseModel):
    model_config = ConfigDict(extra="forbid")
    arm_var: str
    segment_var: str
    design_version_var: str
    token_var_pattern: str
    task_best_pattern: str
    task_worst_pattern: str
    index_pre_pattern: str
    index_post_pattern: str
    best_worst_encoding: Literal["msg_id_numeric", "shown_position"]

    @field_validator("token_var_pattern", "task_best_pattern", "task_worst_pattern",
                     "index_pre_pattern", "index_post_pattern")
    @classmethod
    def _pattern_has_format_placeholder(cls, v: str) -> str:
        # patterns must contain at least one {key} placeholder for the
        # generator to substitute (msg_num, task, idx_num)
        if "{" not in v or "}" not in v:
            raise ValueError(f"pattern {v!r} has no format placeholder")
        return v


class DataConfidenceThresholds(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ok_min_n: int = Field(gt=0)
    thin_min_n: int = Field(gt=0)

    @model_validator(mode="after")
    def _thin_below_ok(self) -> "DataConfidenceThresholds":
        if self.thin_min_n >= self.ok_min_n:
            raise ValueError(
                f"data_confidence: thin_min_n ({self.thin_min_n}) must be "
                f"strictly less than ok_min_n ({self.ok_min_n})"
            )
        return self


class SegmentBindings(BaseModel):
    # assignment variable lives in sav_conventions.segment_var; the
    # expected id list is derived from segment_registry. Only the
    # study-specific judgments remain here.
    model_config = ConfigDict(extra="forbid")
    priority_tier_in_study: Dict[int, int]
    data_confidence: DataConfidenceThresholds

    @field_validator("priority_tier_in_study")
    @classmethod
    def _priority_tiers_valid(cls, v: Dict[int, int]) -> Dict[int, int]:
        for sid, tier in v.items():
            if tier not in (1, 2, 3):
                raise ValueError(
                    f"priority_tier_in_study[{sid}] = {tier} (must be 1, 2, or 3)"
                )
        return v


class ScaleSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")
    min: int
    max: int
    type: str

    @model_validator(mode="after")
    def _min_lt_max(self) -> "ScaleSpec":
        if self.min >= self.max:
            raise ValueError(f"scale.min ({self.min}) must be < scale.max ({self.max})")
        return self


class IndexItem(BaseModel):
    # Index variable numbers are positional (1-based list order); the
    # idx{NNN}_pre/_post patterns format with the item's position.
    model_config = ConfigDict(extra="forbid")
    label: str
    reverse: bool


class IndexConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: List[IndexItem]
    scale: ScaleSpec
    composite_method: Literal["mean", "sum"]
    alpha_soft_threshold: float = Field(ge=0.0, le=1.0)
    alpha_hard_threshold: float = Field(ge=0.0, le=1.0)
    on_hard_fail: Literal["block_build", "warn", "override"]

    @model_validator(mode="after")
    def _alpha_hard_below_soft(self) -> "IndexConfig":
        if self.alpha_hard_threshold >= self.alpha_soft_threshold:
            raise ValueError(
                f"alpha_hard_threshold ({self.alpha_hard_threshold}) must be "
                f"strictly less than alpha_soft_threshold ({self.alpha_soft_threshold})"
            )
        return self


class ResidualizationConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    outcome_var: str
    predictors: List[str]
    output_col: str
    min_n_to_fit: int = Field(gt=0)

    @field_validator("predictors")
    @classmethod
    def _predictors_nonempty(cls, v: List[str]) -> List[str]:
        if not v:
            raise ValueError("residualization.predictors must be non-empty")
        if len(v) != len(set(v)):
            raise ValueError(f"residualization.predictors contains duplicates: {v}")
        return v


class MaxDiffConfig(BaseModel):
    # n_messages and the per-message token map are derived from the
    # variants workbook; the design file path lives in sources.design_file.
    model_config = ConfigDict(extra="forbid")
    n_tasks: int = Field(gt=0)
    items_per_task: int = Field(gt=0)


class PlatformConstraints(BaseModel):
    model_config = ConfigDict(extra="forbid")
    max_messages_per_study: int = Field(gt=0)
    max_tokens_per_message: int = Field(gt=0)
    max_personas: int = Field(gt=0)
    max_tasks_per_respondent: int = Field(gt=0)
    max_items_per_task: int = Field(gt=0)


class ShrinkageSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")
    method: Literal["empirical_bayes", "none"]
    target: Literal["message_marginal", "global_mean"]


class BootstrapSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")
    n_iter: int = Field(gt=0)
    seed: int


class EstimationConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    cell_estimator: Literal["weighted_shift_signed"]
    outcome_centering: Literal["by_segment_mean", "by_global_mean", "none"]
    shrinkage: ShrinkageSpec
    bootstrap: BootstrapSpec
    ci_level: float = Field(gt=0.0, lt=1.0)
    significance_rule: Literal["ci_excludes_zero"]
    thin_cell_threshold: int = Field(gt=0)
    shrink_weight_warn_below: float = Field(ge=0.0, le=1.0)


class ColorScale(BaseModel):
    model_config = ConfigDict(extra="forbid")
    min: float
    max: float
    neutral: float

    @model_validator(mode="after")
    def _ordering(self) -> "ColorScale":
        if not (self.min <= self.neutral <= self.max):
            raise ValueError(
                f"color_scale: require min ({self.min}) <= neutral "
                f"({self.neutral}) <= max ({self.max})"
            )
        return self


class OutcomeConstruction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    method: Literal["residualized_shift", "centered_level"]
    source_col: str
    centering: Optional[Literal["by_segment_mean", "by_global_mean"]] = None

    @model_validator(mode="after")
    def _centered_level_requires_centering(self) -> "OutcomeConstruction":
        if self.method == "centered_level" and self.centering is None:
            raise ValueError(
                "outcome_construction.method=centered_level requires a "
                "centering field (by_segment_mean or by_global_mean)"
            )
        if self.method == "residualized_shift" and self.centering is not None:
            raise ValueError(
                "outcome_construction.method=residualized_shift does not take "
                "a centering field (the residual is already mean-zero by "
                "construction); remove the centering key"
            )
        return self


class LiftVariant(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str
    label: str
    description: str
    outcome_construction: OutcomeConstruction
    color_scale: ColorScale


class ToplineConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    metrics_enabled: List[Literal["share_of_preference", "utility_score"]]
    bw_normalization: Literal["per_respondent_exposure"]
    utility_rescale: Literal["zero_centered_0_100"]
    sop_formula: Literal["softmax_exp_meanbw"]
    bootstrap_ci: bool
    bootstrap_n_iter: int = Field(gt=0)


class SopSimpleConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool
    default_basket: str


class Basket(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    name: str
    # 'all' | 'party:GOP' | 'party:DEM' | 'tier:any' | 'tier:N' | [ids...]
    segments: Union[Literal["all"], List[int], str]
    weight: Literal["equal", "population"]

    @field_validator("segments")
    @classmethod
    def _selector_syntax(cls, v):
        if isinstance(v, (list,)) or v == "all":
            return v
        if re.match(r"^party:(GOP|DEM)$", v) or re.match(r"^tier:(any|[123])$", v):
            return v
        raise ValueError(
            f"basket segments selector {v!r} not recognized "
            f"(all | party:GOP | party:DEM | tier:any | tier:N | [ids...])"
        )


class CellRenderConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    show_uncertainty: Literal["always", "on_hover", "never"]
    fade_low_confidence: bool
    value_decimals: int = Field(ge=0, le=4)


class SegmentDisplayConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    context_segments: Literal["collapsed", "expanded", "hidden"]
    show_data_confidence_flag: bool


class ViewSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool
    default: bool


class DashboardConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    default_view: str
    views: Dict[str, ViewSpec]
    default_outcome: str
    outcome_toggle_visible: bool
    default_basket: str
    basket_selector_visible: bool
    cell_render: CellRenderConfig
    segment_display: SegmentDisplayConfig

    @model_validator(mode="after")
    def _default_view_in_views(self) -> "DashboardConfig":
        if self.default_view not in self.views:
            raise ValueError(
                f"dashboard.default_view = {self.default_view!r} not in views "
                f"({sorted(self.views.keys())})"
            )
        if not self.views[self.default_view].enabled:
            raise ValueError(
                f"dashboard.default_view = {self.default_view!r} is not enabled"
            )
        return self


class OutputPaths(BaseModel):
    model_config = ConfigDict(extra="forbid")
    dashboard_json: str
    cells_csv: str
    exposure_csv: str
    variants_json: str


class SegmentRegistryEntry(BaseModel):
    """One row of the shared segment table (consumed by BOTH engines)."""
    model_config = ConfigDict(extra="forbid")
    id: int = Field(ge=1)
    code: str
    name: str
    party: Literal["GOP", "DEM"]


# ─────────────────────────────────────────────────────────────────────
# Root model
# ─────────────────────────────────────────────────────────────────────


class StudyConfig(BaseModel):
    """Root of the study.yaml schema."""
    model_config = ConfigDict(extra="forbid")

    study: StudyMeta
    sources: Sources
    sav_conventions: SavConventions
    legacy_rename: Dict[str, str] = Field(default_factory=dict)
    segments: SegmentBindings
    index: IndexConfig
    residualization: ResidualizationConfig
    maxdiff: MaxDiffConfig
    platform_constraints: PlatformConstraints
    estimation: EstimationConfig
    lift_variants: List[LiftVariant]
    topline: ToplineConfig
    sop_simple: SopSimpleConfig
    baskets: List[Basket]
    dashboard: DashboardConfig
    output: OutputPaths
    segment_registry: List[SegmentRegistryEntry]
    # Topline engine registries (study/labels/modules/trust_lbl/batteries/
    # influencer_blocks/items/pre_post). Deep schema is documented in
    # pipeline/topline/BUILD_GUIDE.md; validated structurally here only.
    topline_config: Dict[str, Any]

    # ── Per-field validators ─────────────────────────────────────────

    @field_validator("legacy_rename")
    @classmethod
    def _rename_targets_unique_and_canonical(cls, v: Dict[str, str]) -> Dict[str, str]:
        # Targets (right side) must be unique: no two legacy vars may
        # rename to the same canonical name (that would silently drop one).
        targets = list(v.values())
        seen: Dict[str, List[str]] = {}
        for legacy, canonical in v.items():
            seen.setdefault(canonical, []).append(legacy)
        dups = {c: legs for c, legs in seen.items() if len(legs) > 1}
        if dups:
            raise ValueError(
                f"legacy_rename: target canonical names are not unique. "
                f"Collisions: {dups}"
            )
        # Each target must match one of the canonical patterns or fixed names.
        bad = [t for t in targets if not _is_canonical_target(t)]
        if bad:
            raise ValueError(
                f"legacy_rename: target canonical names do not match the "
                f"canonical naming convention "
                f"(M{{NNN}}_token | task{{NN}}_best | task{{NN}}_worst | "
                f"idx{{NNN}}_pre | idx{{NNN}}_post | persona_framing | "
                f"design_version | XSEG_ASSIGNED): {bad}"
            )
        return v

    @field_validator("baskets")
    @classmethod
    def _basket_ids_unique(cls, v: List[Basket]) -> List[Basket]:
        ids = [b.id for b in v]
        if len(ids) != len(set(ids)):
            dup = sorted({i for i in ids if ids.count(i) > 1})
            raise ValueError(f"baskets: duplicate basket ids: {dup}")
        return v

    @field_validator("lift_variants")
    @classmethod
    def _lift_variant_names_unique(cls, v: List[LiftVariant]) -> List[LiftVariant]:
        names = [lv.name for lv in v]
        if len(names) != len(set(names)):
            dup = sorted({n for n in names if names.count(n) > 1})
            raise ValueError(f"lift_variants: duplicate names: {dup}")
        if not v:
            raise ValueError("lift_variants must have at least one entry")
        return v

    # ── Cross-field model_validators ─────────────────────────────────

    @model_validator(mode="after")
    def _basket_segments_subset_of_registry(self) -> "StudyConfig":
        expected = {r.id for r in self.segment_registry}
        for b in self.baskets:
            if not isinstance(b.segments, list):
                continue  # selectors resolve against the registry by construction
            extra = set(b.segments) - expected
            if extra:
                raise ValueError(
                    f"basket {b.id!r}: segment IDs {sorted(extra)} not in "
                    f"segment_registry ({sorted(expected)})"
                )
            if len(set(b.segments)) != len(b.segments):
                dup = sorted({s for s in b.segments if b.segments.count(s) > 1})
                raise ValueError(f"basket {b.id!r}: duplicate segments: {dup}")
        return self

    @model_validator(mode="after")
    def _dashboard_defaults_resolve(self) -> "StudyConfig":
        # default_outcome must match a lift_variant name
        lv_names = {lv.name for lv in self.lift_variants}
        if self.dashboard.default_outcome not in lv_names:
            raise ValueError(
                f"dashboard.default_outcome = "
                f"{self.dashboard.default_outcome!r} is not a name in "
                f"lift_variants ({sorted(lv_names)})"
            )
        # default_basket must match a basket id
        basket_ids = {b.id for b in self.baskets}
        if self.dashboard.default_basket not in basket_ids:
            raise ValueError(
                f"dashboard.default_basket = "
                f"{self.dashboard.default_basket!r} is not a basket id "
                f"({sorted(basket_ids)})"
            )
        if self.sop_simple.default_basket not in basket_ids:
            raise ValueError(
                f"sop_simple.default_basket = "
                f"{self.sop_simple.default_basket!r} is not a basket id "
                f"({sorted(basket_ids)})"
            )
        return self

    @model_validator(mode="after")
    def _maxdiff_within_platform_constraints(self) -> "StudyConfig":
        pc = self.platform_constraints
        md = self.maxdiff
        # (message-count vs max_messages_per_study is enforced at load
        #  time in study_config.message_config(), where the variants-
        #  derived count is known)
        if md.n_tasks > pc.max_tasks_per_respondent:
            raise ValueError(
                f"maxdiff.n_tasks ({md.n_tasks}) exceeds "
                f"platform_constraints.max_tasks_per_respondent "
                f"({pc.max_tasks_per_respondent})"
            )
        if md.items_per_task > pc.max_items_per_task:
            raise ValueError(
                f"maxdiff.items_per_task ({md.items_per_task}) exceeds "
                f"platform_constraints.max_items_per_task "
                f"({pc.max_items_per_task})"
            )
        return self

    @model_validator(mode="after")
    def _residualization_predictor_includes_segment_var(self) -> "StudyConfig":
        # The segment var must appear in predictors (or the residualization
        # doesn't carry segment FEs and the cell estimator's by-segment
        # comparisons become biased).
        seg = self.sav_conventions.segment_var
        if seg not in self.residualization.predictors:
            raise ValueError(
                f"residualization.predictors must include the segment var "
                f"({seg!r}) for segment fixed effects. Got: "
                f"{self.residualization.predictors}"
            )
        return self


    @model_validator(mode="after")
    def _registry_well_formed(self) -> "StudyConfig":
        reg_ids = [r.id for r in self.segment_registry]
        if len(reg_ids) != len(set(reg_ids)):
            raise ValueError(f"segment_registry ids are not unique: {reg_ids}")
        codes = [r.code for r in self.segment_registry]
        if len(codes) != len(set(codes)):
            raise ValueError("segment_registry codes are not unique")
        # priority tiers must reference registry ids
        bad = [sid for sid in self.segments.priority_tier_in_study
               if sid not in set(reg_ids)]
        if bad:
            raise ValueError(
                f"priority_tier_in_study references segment IDs not in "
                f"segment_registry: {bad}"
            )
        return self



# ─────────────────────────────────────────────────────────────────────
# Loader
# ─────────────────────────────────────────────────────────────────────


def load_study_config(path: str | Path) -> StudyConfig:
    """Load and validate a study.yaml. Returns a StudyConfig instance.

    Raises pydantic.ValidationError if the YAML violates the schema,
    or ValueError / FileNotFoundError on read failure.
    """
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"study config not found: {p}")
    with p.open("r", encoding="utf-8") as f:
        data: Any = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise ValueError(
            f"study config at {p} did not parse as a YAML mapping (got "
            f"{type(data).__name__})"
        )
    return StudyConfig.model_validate(data)
