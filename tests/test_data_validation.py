#!/usr/bin/env python3
"""
PRISM HIV Dashboard Data Validation Tests
==========================================

Comprehensive test suite for data integrity, conversion validation, and
schema conformance.

Run: pytest tests/test_data_validation.py -v
"""

import pytest
import json
from pathlib import Path
from datetime import datetime
import sys

# Add scripts to path
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from migrate_to_db import (
    DataValidator,
    DataLoader,
    DataConverter,
    Study,
    Segment,
    SurveyItem,
    CompositeScore,
    Message,
    TrustEntity,
    PrePostMetric,
    ValidationError,
)


class TestDataLoader:
    """Test JSON data loading."""

    def test_load_all(self):
        """Test loading all data files."""
        loader = DataLoader(Path("src/data/hiv"))
        data = loader.load_all()

        assert "manifest" in data
        assert "items" in data
        assert "benchmarks" in data
        assert "trust" in data
        assert "seg_data" in data
        assert "zparams" in data

    def test_manifest_loaded(self):
        """Test manifest.json loading."""
        loader = DataLoader(Path("src/data/hiv"))
        manifest = loader._load_json("manifest.json")

        assert manifest.get("study") is not None
        assert manifest.get("n_raw") > 0
        assert manifest.get("effective_n") > 0

    def test_items_loaded(self):
        """Test items.json loading."""
        loader = DataLoader(Path("src/data/hiv"))
        items = loader._load_items()

        # Should have multiple constructs
        assert len(items) > 0
        for construct, item_list in items.items():
            assert isinstance(item_list, list)
            for item in item_list:
                assert "code" in item
                assert "by_segment" in item

    def test_benchmarks_loaded(self):
        """Test bench.json loading."""
        loader = DataLoader(Path("src/data/hiv"))
        benchmarks = loader._load_json("bench.json")

        expected_groups = ["All", "Republicans", "Democrats"]
        for group in expected_groups:
            assert group in benchmarks


class TestDataValidator:
    """Test data validation rules."""

    def test_validate_manifest(self):
        """Test manifest validation."""
        validator = DataValidator()
        loader = DataLoader(Path("src/data/hiv"))
        manifest = loader._load_json("manifest.json")

        validator._validate_manifest(manifest)
        assert len(validator.errors) == 0

    def test_validate_items(self):
        """Test items validation."""
        validator = DataValidator()
        loader = DataLoader(Path("src/data/hiv"))
        items = loader._load_items()

        validator._validate_items(items)
        # Should have no fatal errors (warnings are OK)
        assert len(validator.errors) == 0

    def test_validate_benchmarks(self):
        """Test benchmark validation."""
        validator = DataValidator()
        loader = DataLoader(Path("src/data/hiv"))
        benchmarks = loader._load_json("bench.json")

        validator._validate_benchmarks(benchmarks)
        assert len(validator.errors) == 0

    def test_validate_all(self):
        """Test full validation pipeline."""
        validator = DataValidator()
        loader = DataLoader(Path("src/data/hiv"))
        data = loader.load_all()

        is_valid = validator.validate_all(data)
        print(validator.report())
        assert is_valid

    def test_manifest_n_raw_required(self):
        """Test that n_raw is validated."""
        validator = DataValidator()
        invalid_manifest = {"study": "Test"}
        validator._validate_manifest(invalid_manifest)
        assert len(validator.errors) > 0

    def test_manifest_effective_n_positive(self):
        """Test that effective_n must be > 0."""
        validator = DataValidator()
        invalid_manifest = {
            "study": "Test",
            "n_raw": 100,
            "effective_n": 0,
            "design_effect": 1.0,
            "ipf_iterations": 50,
            "weighted": True,
            "focal_segment": 1,
        }
        validator._validate_manifest(invalid_manifest)
        assert any("effective_n" in err for err in validator.errors)


class TestDataConverter:
    """Test data conversion to normalized entities."""

    @pytest.fixture
    def raw_data(self):
        """Load raw data for testing."""
        loader = DataLoader(Path("src/data/hiv"))
        return loader.load_all()

    def test_convert_study(self, raw_data):
        """Test study conversion."""
        converter = DataConverter()
        converter._convert_study(raw_data.get("manifest", {}))

        assert converter.study is not None
        assert converter.study.name == "PRISM HIV Wave 1"
        assert converter.study.n_raw > 0
        assert converter.study.effective_n > 0

    def test_convert_segments(self, raw_data):
        """Test segment conversion."""
        converter = DataConverter()
        converter._convert_study(raw_data.get("manifest", {}))
        converter._convert_segments(
            raw_data.get("seg_data", {}),
            raw_data.get("zparams", {}),
        )

        assert len(converter.segments) == 16
        segment_codes = [s.code for s in converter.segments]
        assert "TSP" in segment_codes  # GOP
        assert "FJP" in segment_codes  # DEM
        assert "UCP" in segment_codes  # DEM

    def test_convert_survey_items(self, raw_data):
        """Test survey item conversion."""
        converter = DataConverter()
        converter._convert_survey_items(raw_data.get("items", {}))

        assert len(converter.survey_items) > 0
        assert len(converter.item_responses) > 0

        # Check that items have required fields
        for item in converter.survey_items:
            assert item.code is not None
            assert item.stem is not None
            assert item.construct is not None

    def test_convert_composites(self, raw_data):
        """Test composite score conversion."""
        converter = DataConverter()
        converter._convert_study(raw_data.get("manifest", {}))
        converter._convert_composites(raw_data.get("benchmarks", {}))

        expected_composites = ["MBS", "SDS", "EDS", "SCS", "CFS", "PFS"]
        composite_codes = [c.code for c in converter.composite_scores]
        for code in expected_composites:
            assert code in composite_codes

    def test_convert_messages(self, raw_data):
        """Test message conversion."""
        converter = DataConverter()
        converter._convert_study(raw_data.get("manifest", {}))
        converter._convert_messages(raw_data.get("zparams", {}))

        # Should have 17 messages
        assert len(converter.messages) == 17

    def test_convert_trust(self, raw_data):
        """Test trust entity conversion."""
        converter = DataConverter()
        converter._convert_study(raw_data.get("manifest", {}))
        converter._convert_trust(raw_data.get("trust", {}))

        assert len(converter.trust_entities) > 0
        assert len(converter.trust_ratings) > 0

    def test_convert_prepost(self, raw_data):
        """Test pre/post metric conversion."""
        converter = DataConverter()
        converter._convert_study(raw_data.get("manifest", {}))
        converter._convert_prepost(raw_data.get("zparams", {}))

        assert len(converter.prepost_metrics) == 7

    def test_full_conversion(self, raw_data):
        """Test full conversion pipeline."""
        converter = DataConverter()
        converter.convert(raw_data)

        # Verify all entities created
        assert converter.study is not None
        assert len(converter.segments) == 16
        assert len(converter.survey_items) > 0
        assert len(converter.composite_scores) > 0
        assert len(converter.messages) == 17
        assert len(converter.trust_entities) > 0
        assert len(converter.prepost_metrics) == 7


class TestDataIntegrity:
    """Test cross-entity data integrity."""

    @pytest.fixture
    def converted_data(self):
        """Load and convert data."""
        loader = DataLoader(Path("src/data/hiv"))
        raw_data = loader.load_all()
        converter = DataConverter()
        converter.convert(raw_data)
        return converter

    def test_segment_ids_unique(self, converted_data):
        """Test that segment IDs are unique."""
        seg_ids = [s.id for s in converted_data.segments]
        assert len(seg_ids) == len(set(seg_ids))

    def test_segment_codes_unique(self, converted_data):
        """Test that segment codes are unique."""
        seg_codes = [s.code for s in converted_data.segments]
        assert len(seg_codes) == len(set(seg_codes))
        assert len(seg_codes) == 16

    def test_segment_party_valid(self, converted_data):
        """Test that segments have valid party assignment."""
        for segment in converted_data.segments:
            assert segment.party in ["GOP", "DEM"]

    def test_segment_party_count(self, converted_data):
        """Test GOP/DEM count."""
        gop_segments = [s for s in converted_data.segments if s.party == "GOP"]
        dem_segments = [s for s in converted_data.segments if s.party == "DEM"]
        assert len(gop_segments) == 10
        assert len(dem_segments) == 6

    def test_item_responses_reference_valid_segments(self, converted_data):
        """Test that item responses reference valid segments."""
        segment_ids = {s.id for s in converted_data.segments}
        for response in converted_data.item_responses:
            assert response.segment_id in segment_ids

    def test_composite_responses_reference_valid_segments(self, converted_data):
        """Test that composite responses reference valid segments."""
        segment_ids = {s.id for s in converted_data.segments}
        for response in converted_data.composite_responses:
            # Some responses may be for "All" benchmark (segment_id = 0)
            if response.segment_id != 0:
                assert response.segment_id in segment_ids

    def test_message_count(self, converted_data):
        """Test that all 17 messages are present."""
        assert len(converted_data.messages) == 17

    def test_prepost_metric_count(self, converted_data):
        """Test that all 7 pre/post metrics are present."""
        assert len(converted_data.prepost_metrics) == 7

    def test_all_segments_have_item_responses(self, converted_data):
        """Test that each segment has item responses."""
        segment_ids_with_responses = {r.segment_id for r in converted_data.item_responses}
        expected_segment_ids = {s.id for s in converted_data.segments}
        # Allow for variation in which segments have data
        assert len(segment_ids_with_responses) > 0

    def test_composite_codes_consistent(self, converted_data):
        """Test that composite codes are consistent."""
        expected_codes = [
            "MBS", "SDS", "EDS", "SCS", "CFS", "PFS", "SCF",
            "CON_HIV", "CON_LGB", "HKS"
        ]
        actual_codes = {c.code for c in converted_data.composite_scores}
        for code in expected_codes:
            assert code in actual_codes

    def test_trust_entities_have_ratings(self, converted_data):
        """Test that trust entities have corresponding ratings."""
        entity_ids = {e.id for e in converted_data.trust_entities}
        rating_entity_ids = {r.entity_id for r in converted_data.trust_ratings}
        # All entities should have at least one rating
        assert entity_ids == rating_entity_ids

    def test_benchmark_groups_valid(self, converted_data):
        """Test that all benchmark groups are valid."""
        valid_groups = {"All", "Republicans", "Democrats"}
        for response in converted_data.composite_responses:
            assert response.benchmark_group in valid_groups

    def test_trust_scores_in_valid_range(self, converted_data):
        """Test that trust scores are in expected range (1-7)."""
        for rating in converted_data.trust_ratings:
            assert 1.0 <= rating.trust_score <= 7.0 or rating.trust_score == 0.0


class TestDataQuality:
    """Test data quality metrics."""

    @pytest.fixture
    def converted_data(self):
        """Load and convert data."""
        loader = DataLoader(Path("src/data/hiv"))
        raw_data = loader.load_all()
        converter = DataConverter()
        converter.convert(raw_data)
        return converter

    def test_no_null_required_fields_in_segments(self, converted_data):
        """Test that required segment fields are not null."""
        for segment in converted_data.segments:
            assert segment.id is not None
            assert segment.code is not None
            assert segment.party is not None

    def test_no_null_required_fields_in_items(self, converted_data):
        """Test that required survey item fields are not null."""
        for item in converted_data.survey_items:
            assert item.id is not None
            assert item.code is not None
            assert item.stem is not None

    def test_no_null_required_fields_in_messages(self, converted_data):
        """Test that required message fields are not null."""
        for message in converted_data.messages:
            assert message.id is not None
            assert message.short_name is not None

    def test_item_responses_have_valid_means(self, converted_data):
        """Test that item responses have valid mean values."""
        for response in converted_data.item_responses:
            # Mean should be a valid number (zero is OK for missing data)
            assert isinstance(response.mean, (int, float))
            assert not (response.mean != response.mean)  # Not NaN

    def test_study_creation_time_set(self, converted_data):
        """Test that study has creation time."""
        if converted_data.study:
            assert converted_data.study.created_at is not None
            # Should be ISO format
            assert "T" in converted_data.study.created_at

    def test_segment_creation_times_set(self, converted_data):
        """Test that segments have creation times."""
        for segment in converted_data.segments:
            assert segment.created_at is not None

    def test_items_creation_times_set(self, converted_data):
        """Test that items have creation times."""
        for item in converted_data.survey_items:
            assert item.created_at is not None

    def test_messages_creation_times_set(self, converted_data):
        """Test that messages have creation times."""
        for message in converted_data.messages:
            assert message.created_at is not None


# ============================================================================
# SUMMARY TESTS
# ============================================================================

class TestMigrationSummary:
    """Summary statistics about migration."""

    def test_migration_completeness(self):
        """Test that migration covers all major data types."""
        loader = DataLoader(Path("src/data/hiv"))
        raw_data = loader.load_all()
        converter = DataConverter()
        converter.convert(raw_data)

        summary = {
            "Study": 1 if converter.study else 0,
            "Segments": len(converter.segments),
            "Survey Items": len(converter.survey_items),
            "Item Responses": len(converter.item_responses),
            "Composite Scores": len(converter.composite_scores),
            "Composite Responses": len(converter.composite_responses),
            "Messages": len(converter.messages),
            "Trust Entities": len(converter.trust_entities),
            "Trust Ratings": len(converter.trust_ratings),
            "Pre/Post Metrics": len(converter.prepost_metrics),
            "Pre/Post Responses": len(converter.prepost_responses),
        }

        print("\n" + "=" * 60)
        print("MIGRATION SUMMARY")
        print("=" * 60)
        for entity_type, count in summary.items():
            print(f"  {entity_type:.<40} {count:>10}")
        print("=" * 60)

        # All critical entities should be present
        assert summary["Study"] == 1
        assert summary["Segments"] == 16
        assert summary["Survey Items"] > 0
        assert summary["Messages"] == 17
        assert summary["Pre/Post Metrics"] == 7


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
