"""
Study YAML loader + validator.

The YAML carries instrument-specific, issue-calibrated, and per-study-
estimated parameters; platform-locked values live in code and are never
in the YAML. Validation catches every common configuration error BEFORE
any computation: unknown benchmark references, dimension mismatches,
category-label mismatches (the en-dash trap), implausible thresholds.
"""

from dataclasses import dataclass, replace
from pathlib import Path

import yaml

from ..activation.config import ActivationConfig
from ..benchmarks import PRISM_SEGMENTS_V1
from ..benchmarks.populations import get_population
from ..composites.config import CompositeConfig
from ..quality.flags import QualityConfig
from ..weighting.config import WeightConfig

SEGMENT_BENCHMARKS = {"prism_segments_v1": PRISM_SEGMENTS_V1}


class StudyConfigError(ValueError):
    """A study YAML failed validation. Message says exactly what and where."""


@dataclass(frozen=True)
class StudyConfig:
    study_id: str
    title: str
    platform_version: str
    client: str
    fielded: str
    survey_population: object
    segment_benchmark: object
    composites: CompositeConfig
    activation: ActivationConfig
    weighting: WeightConfig
    quality: QualityConfig


def _need(d, key, where):
    if key not in d:
        raise StudyConfigError(f"{where}: required key {key!r} missing")
    return d[key]


def load_study_config(path) -> StudyConfig:
    path = Path(path)
    if not path.exists():
        raise StudyConfigError(f"study config not found: {path}")
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise StudyConfigError(f"{path} did not parse as a YAML mapping")

    meta = _need(raw, "study", str(path))
    pop_id = _need(raw, "survey_population", str(path))
    try:
        population = get_population(pop_id)
    except KeyError as e:
        raise StudyConfigError(str(e)) from None
    bench_id = _need(raw, "segment_benchmark", str(path))
    if bench_id not in SEGMENT_BENCHMARKS:
        raise StudyConfigError(
            f"unknown segment_benchmark {bench_id!r}; "
            f"registered: {sorted(SEGMENT_BENCHMARKS)}")
    benchmark = SEGMENT_BENCHMARKS[bench_id]

    comp = raw.get("composites", {})
    roi = raw.get("roi", {})
    act = raw.get("activation", {})
    wgt = raw.get("weighting", {})
    qual = raw.get("quality", {})

    composites = CompositeConfig(
        **{k: v for k, v in comp.items()},
        **({f"roi_{k}": v for k, v in roi.items()} if roi else {}),
        **_activation_coeffs_for_composites(act),
    )
    fitted = act.get("fitted_coefficients") or {}
    activation = ActivationConfig(
        optin_var=act.get("optin_var", "OPTIN"),
        optin_positive_value=act.get("optin_positive_value", 1),
        behavioral_cost_fields=act.get("behavioral_cost_fields",
                                       ActivationConfig().behavioral_cost_fields),
        eligible_filter=act.get("eligible_filter"),
        calibration_mode=act.get("calibration_mode", "fit"),
        fitted_intercept=fitted.get("intercept"),
        fitted_ars_slope=fitted.get("ars_slope"),
        fitted_bcs_slope=fitted.get("bcs_slope"),
    )
    weighting = WeightConfig(**wgt) if wgt else WeightConfig()
    quality = QualityConfig(**qual) if qual else QualityConfig()

    cfg = StudyConfig(
        study_id=_need(meta, "id", "study"),
        title=meta.get("title", ""),
        platform_version=str(meta.get("platform_version", "1.0")),
        client=meta.get("client", ""),
        fielded=str(meta.get("fielded", "")),
        survey_population=population,
        segment_benchmark=benchmark,
        composites=composites,
        activation=activation,
        weighting=weighting,
        quality=quality,
    )
    _validate(cfg, path)
    return cfg


def _activation_coeffs_for_composites(act_block) -> dict:
    """If the YAML carries locked fitted coefficients, the composites'
    ROI step uses them; otherwise the CompositeConfig defaults stand
    until the pipeline fits and substitutes fresh ones."""
    fitted = (act_block or {}).get("fitted_coefficients") or {}
    out = {}
    if fitted.get("intercept") is not None:
        out["act_intercept"] = fitted["intercept"]
        out["act_ars_slope"] = fitted["ars_slope"]
        out["act_bcs_slope"] = fitted["bcs_slope"]
    return out


def _validate(cfg: StudyConfig, path):
    cfg.composites.validate()
    cfg.activation.validate()
    cfg.weighting.validate()
    cfg.quality.validate()
    cfg.survey_population.validate()
    cfg.segment_benchmark.validate()

    pop = cfg.survey_population
    pop_dims = set(pop.dimensions())
    rake_dims = set(cfg.weighting.rake_dimensions)
    if rake_dims != pop_dims:
        raise StudyConfigError(
            f"{path}: weighting.rake_dimensions {sorted(rake_dims)} do not "
            f"match survey population {pop.population_id!r} dimensions "
            f"{sorted(pop_dims)}")

    # Category-label equality per dimension (the en-dash trap): every
    # recode target must be a category the benchmark actually has.
    for dim in cfg.weighting.rake_dimensions:
        recode_cats = set(cfg.weighting.variable_mapping[dim]["recode"].values())
        if dim == "sex" and cfg.weighting.sex_other_handling == "fold":
            recode_cats.add(cfg.weighting.sex_other_fold_to)
        for cluster in pop.clusters():
            bench_cats = set(pop.targets[cluster][dim].keys())
            extra = recode_cats - bench_cats
            if extra:
                raise StudyConfigError(
                    f"{path}: weighting.{dim} recode produces categories "
                    f"{sorted(extra)} that do not exist in "
                    f"{pop.population_id}/{cluster} benchmarks "
                    f"{sorted(bench_cats)} — values would rake to nothing")

    # Threshold plausibility
    c = cfg.composites
    for name, v in (("roi_highest_actprob", c.roi_highest_actprob),
                    ("roi_strong_actprob", c.roi_strong_actprob)):
        if not (0 < v < 1):
            raise StudyConfigError(f"{path}: {name}={v} outside (0, 1)")
    for name, v in (("roi_highest_post", c.roi_highest_post),
                    ("roi_strong_post", c.roi_strong_post)):
        if not (1 <= v <= 7):
            raise StudyConfigError(f"{path}: {name}={v} outside [1, 7]")
