"""Study YAML schema: hiv_wave1 validates; fail-cases produce clear errors."""
from pathlib import Path

import pytest
import yaml

from prism.studies import StudyConfigError, load_study_config

STUDIES = Path(__file__).resolve().parents[1] / "prism" / "studies"


def test_hiv_wave1_validates():
    cfg = load_study_config(STUDIES / "hiv_wave1.yaml")
    assert cfg.study_id == "hiv_wave1"
    assert cfg.survey_population.population_id == "voters_v1"
    assert cfg.quality.exclusion_policy == "none"
    assert cfg.activation.calibration_mode == "fit"


def _mutate(tmp_path, **edits):
    raw = yaml.safe_load((STUDIES / "hiv_wave1.yaml").read_text())
    for dotted, value in edits.items():
        node = raw
        keys = dotted.split(".")
        for k in keys[:-1]:
            node = node[k]
        node[keys[-1]] = value
    p = tmp_path / "bad.yaml"
    p.write_text(yaml.safe_dump(raw))
    return p


def test_unknown_population_rejected(tmp_path):
    p = _mutate(tmp_path, survey_population="martians_v1")
    with pytest.raises(StudyConfigError, match="Unknown survey population"):
        load_study_config(p)


def test_unknown_benchmark_rejected(tmp_path):
    p = _mutate(tmp_path, segment_benchmark="prism_segments_v9")
    with pytest.raises(StudyConfigError, match="segment_benchmark"):
        load_study_config(p)


def test_dimension_mismatch_rejected(tmp_path):
    p = _mutate(tmp_path, **{"weighting.rake_dimensions":
                             ["sex", "age", "race", "education"]})
    with pytest.raises(StudyConfigError, match="do not match survey population"):
        load_study_config(p)


def test_endash_category_rejected(tmp_path):
    # "45–64" with an EN-DASH instead of "45-64" — would rake to nothing
    raw = yaml.safe_load((STUDIES / "hiv_wave1.yaml").read_text())
    raw["weighting"]["variable_mapping"]["age"]["recode"][3] = "45–64"
    p = tmp_path / "endash.yaml"
    p.write_text(yaml.safe_dump(raw, allow_unicode=True))
    with pytest.raises(StudyConfigError, match="do not exist in"):
        load_study_config(p)


def test_implausible_threshold_rejected(tmp_path):
    p = _mutate(tmp_path, **{"roi.highest_post": 9.5})
    with pytest.raises(StudyConfigError, match="outside"):
        load_study_config(p)
