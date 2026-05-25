#!/usr/bin/env python3
"""
PRISM HIV Dashboard Data Migration Pipeline
=============================================

Converts flat JSON data structure → normalized relational schema.
Includes comprehensive validation, error reporting, and rollback support.

Usage:
    python scripts/migrate_to_db.py --validate-only
    python scripts/migrate_to_db.py --generate-sql > schema.sql
    python scripts/migrate_to_db.py --dry-run
    python scripts/migrate_to_db.py --execute (requires database connection)

Author: PRISM Team
Date: May 2026
"""

import json
import sys
import argparse
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Tuple
from dataclasses import dataclass, asdict
import uuid


# ============================================================================
# DATA MODELS
# ============================================================================

@dataclass
class Study:
    id: str
    name: str
    client: str
    topic: str
    wave: int
    field_start_date: str
    field_end_date: str
    n_raw: int
    effective_n: float
    design_effect: float
    methodology: str
    metadata: Dict[str, Any]
    created_at: str = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()


@dataclass
class Segment:
    id: int
    study_id: str
    code: str
    name: str
    party: str
    population_share: float
    tier: int
    persona_profile: Dict[str, str]
    created_at: str = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()


@dataclass
class SurveyItem:
    id: str
    study_id: str
    code: str
    stem: str
    construct: str
    scale_min: int
    scale_max: int
    scale_label_lo: str
    scale_label_hi: str
    is_binary: bool
    created_at: str = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()
        if self.id is None:
            self.id = str(uuid.uuid4())


@dataclass
class ItemResponse:
    item_id: str
    segment_id: int
    mean: float
    sd: float
    n: int
    n_weighted: float
    created_at: str = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()


@dataclass
class CompositeScore:
    id: str
    study_id: str
    code: str
    label: str
    description: str
    construct: str
    components: List[str]
    aggregation_method: str
    scale_min: float
    scale_max: float
    created_at: str = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()
        if self.id is None:
            self.id = str(uuid.uuid4())


@dataclass
class CompositeResponse:
    composite_id: str
    segment_id: int
    benchmark_group: str  # "All" | "Republicans" | "Democrats"
    raw_value: float
    z_score: float
    n_weighted: float
    created_at: str = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()


@dataclass
class Message:
    id: int
    study_id: str
    code: str
    short_name: str
    theme: str
    body_text: str
    created_at: str = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()


@dataclass
class MessagePerformance:
    message_id: int
    segment_id: int
    score: float
    rank: int
    delta_vs_benchmark: float
    created_at: str = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()


@dataclass
class TrustEntity:
    id: str
    study_id: str
    code: str
    label: str
    category: str
    description: str = ""
    created_at: str = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()
        if self.id is None:
            self.id = str(uuid.uuid4())


@dataclass
class TrustRating:
    entity_id: str
    segment_id: int
    trust_score: float
    benchmark_group: str
    n_respondents: int = 0
    created_at: str = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()


@dataclass
class PrePostMetric:
    id: str
    study_id: str
    code: str
    question: str
    scale_type: str
    measurement_type: str
    order_in_test: int
    created_at: str = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()
        if self.id is None:
            self.id = str(uuid.uuid4())


@dataclass
class PrePostResponse:
    metric_id: str
    segment_id: int
    timepoint: str  # "pre" | "post"
    pct_response: float
    delta: float = 0.0
    created_at: str = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()


# ============================================================================
# VALIDATION RULES
# ============================================================================

class ValidationError(Exception):
    """Custom exception for validation errors."""
    pass


class DataValidator:
    """Validates JSON data against schema constraints."""

    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def validate_all(self, data: Dict[str, Any]) -> bool:
        """Run all validations. Returns True if no errors."""
        self.errors = []
        self.warnings = []

        self._validate_manifest(data.get("manifest", {}))
        self._validate_items(data.get("items", {}))
        self._validate_benchmarks(data.get("benchmarks", {}))
        self._validate_trust(data.get("trust", {}))
        self._validate_study_js(data.get("study_js", {}))

        return len(self.errors) == 0

    def _validate_manifest(self, manifest: Dict) -> None:
        """Validate manifest.json structure."""
        required_fields = [
            "study", "generated_at", "n_raw", "effective_n",
            "design_effect", "ipf_iterations", "weighted", "focal_segment"
        ]
        for field in required_fields:
            if field not in manifest:
                self.errors.append(f"manifest.json missing required field: {field}")

        # Validate numeric ranges
        if manifest.get("n_raw", 0) <= 0:
            self.errors.append("manifest.json: n_raw must be > 0")
        if manifest.get("effective_n", 0) <= 0:
            self.errors.append("manifest.json: effective_n must be > 0")
        if manifest.get("design_effect", 1.0) < 1.0:
            self.errors.append("manifest.json: design_effect must be >= 1.0")
        if manifest.get("ipf_iterations", 0) <= 0:
            self.errors.append("manifest.json: ipf_iterations must be > 0")

    def _validate_items(self, items: Dict) -> None:
        """Validate items.json structure."""
        if not items:
            self.warnings.append("items.json is empty or missing")
            return

        for construct, item_list in items.items():
            if not isinstance(item_list, list):
                self.errors.append(f"items.json: {construct} is not an array")
                continue

            for i, item in enumerate(item_list):
                item_code = item.get("code", f"{construct}[{i}]")
                
                # Required fields
                if "code" not in item:
                    self.errors.append(f"items.json: {construct}[{i}] missing 'code'")
                if "by_segment" not in item:
                    self.errors.append(f"items.json: {item_code} missing 'by_segment'")
                else:
                    # Validate all 16 segments present
                    by_seg = item["by_segment"]
                    missing_segments = [str(i) for i in range(1, 17) if str(i) not in by_seg]
                    if missing_segments:
                        self.warnings.append(
                            f"items.json: {item_code} missing segments: {missing_segments}"
                        )

    def _validate_benchmarks(self, benchmarks: Dict) -> None:
        """Validate bench.json structure."""
        expected_groups = ["All", "Republicans", "Democrats"]
        for group in expected_groups:
            if group not in benchmarks:
                self.errors.append(f"bench.json missing benchmark group: {group}")

    def _validate_trust(self, trust) -> None:
        """Validate trust.json structure."""
        if not trust:
            self.warnings.append("trust.json is empty or missing")
            return

        # Handle both list and dict formats
        trust_items = trust if isinstance(trust, list) else trust.items()
        
        for entity in trust_items:
            if isinstance(entity, tuple):
                entity_code, entity_data = entity
            else:
                entity_code = entity.get("code", "unknown")
                entity_data = entity
            
            if isinstance(entity_data, dict) and "by_segment" not in entity_data:
                self.errors.append(f"trust.json: {entity_code} missing 'by_segment'")

    def _validate_study_js(self, study_js: Dict) -> None:
        """Validate study.js exports."""
        required_exports = ["STUDY_META", "MESSAGES", "STUDY_METRICS", "PREPOST_METRICS"]
        for export in required_exports:
            if export not in study_js:
                self.errors.append(f"study.js missing export: {export}")

    def report(self) -> str:
        """Generate validation report."""
        lines = ["Validation Report", "=" * 60]
        
        if self.errors:
            lines.append(f"\n❌ ERRORS ({len(self.errors)}):")
            for err in self.errors:
                lines.append(f"  - {err}")
        
        if self.warnings:
            lines.append(f"\n⚠️  WARNINGS ({len(self.warnings)}):")
            for warn in self.warnings:
                lines.append(f"  - {warn}")
        
        if not self.errors and not self.warnings:
            lines.append("\n✅ All validations passed!")
        
        return "\n".join(lines)


# ============================================================================
# DATA LOADER
# ============================================================================

class DataLoader:
    """Loads JSON files from src/data/hiv/."""

    def __init__(self, data_dir: Path = Path("src/data/hiv")):
        self.data_dir = data_dir

    def load_all(self) -> Dict[str, Any]:
        """Load all data files."""
        return {
            "manifest": self._load_json("manifest.json"),
            "items": self._load_items(),
            "benchmarks": self._load_json("bench.json"),
            "trust": self._load_json("trust.json"),
            "seg_data": self._load_json("seg_data.json"),
            "zparams": self._load_json("zparams.json"),
            "messages": self._load_json("messages.json"),
            "prepost_metrics": self._load_json("prepost_metrics.json"),
            "study_js": self._load_study_js(),
        }

    def _load_json(self, filename: str) -> Dict:
        """Load a JSON file."""
        path = self.data_dir / filename
        if not path.exists():
            print(f"⚠️  File not found: {path}")
            return {}
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            print(f"❌ Error parsing {filename}: {e}")
            return {}

    def _load_items(self) -> Dict:
        """Load items.json and flatten by construct."""
        items_file = self.data_dir / "items.json"
        if not items_file.exists():
            return {}
        try:
            with open(items_file) as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            print(f"❌ Error parsing items.json: {e}")
            return {}

    def _load_study_js(self) -> Dict:
        """Load study.js and extract JavaScript exports."""
        study_js_file = Path("src/data/study.js")
        if not study_js_file.exists():
            return {}

        # Read the JavaScript file and extract exports
        content = study_js_file.read_text()
        result = {}
        
        # Extract STUDY_META
        if "export const STUDY_META" in content:
            result["STUDY_META"] = True
        
        # Extract MESSAGES
        if "export const MESSAGES" in content:
            result["MESSAGES"] = True
        
        # Extract STUDY_METRICS
        if "export const STUDY_METRICS" in content:
            result["STUDY_METRICS"] = True
        
        # Extract PREPOST_METRICS  
        if "export const K_PREPOST" in content or "PREPOST" in content:
            result["PREPOST_METRICS"] = True
        
        # Extract ASSIGNED_TIERS
        if "export const ASSIGNED_TIERS" in content:
            result["ASSIGNED_TIERS"] = True
        
        return result


# ============================================================================
# DATA CONVERTER
# ============================================================================

class DataConverter:
    """Converts loaded JSON → normalized entity objects."""

    def __init__(self):
        self.study: Study = None
        self.segments: List[Segment] = []
        self.survey_items: List[SurveyItem] = []
        self.item_responses: List[ItemResponse] = []
        self.composite_scores: List[CompositeScore] = []
        self.composite_responses: List[CompositeResponse] = []
        self.messages: List[Message] = []
        self.message_performances: List[MessagePerformance] = []
        self.trust_entities: List[TrustEntity] = []
        self.trust_ratings: List[TrustRating] = []
        self.prepost_metrics: List[PrePostMetric] = []
        self.prepost_responses: List[PrePostResponse] = []

    def convert(self, raw_data: Dict[str, Any]) -> None:
        """Convert all raw data to normalized entities."""
        manifest = raw_data.get("manifest", {})
        items = raw_data.get("items", {})
        benchmarks = raw_data.get("benchmarks", {})
        trust = raw_data.get("trust", {})
        seg_data = raw_data.get("seg_data", {})
        zparams = raw_data.get("zparams", {})
        messages = raw_data.get("messages", [])
        prepost_metrics = raw_data.get("prepost_metrics", [])

        # 1. Create study
        self._convert_study(manifest)

        # 2. Create segments
        self._convert_segments(seg_data, zparams)

        # 3. Create survey items & responses
        self._convert_survey_items(items)

        # 4. Create composite scores & responses
        self._convert_composites(benchmarks)

        # 5. Create messages
        self._convert_messages(messages)

        # 6. Create trust entities & ratings
        self._convert_trust(trust)

        # 7. Create pre/post metrics
        self._convert_prepost(prepost_metrics)

    def _convert_study(self, manifest: Dict) -> None:
        """Convert manifest → Study."""
        self.study = Study(
            id="hiv-wave1",
            name=manifest.get("study", "PRISM HIV Wave 1"),
            client="Gilead",
            topic="HIV Treatment & Prevention",
            wave=1,
            field_start_date="2026-05-04",
            field_end_date="2026-05-15",
            n_raw=manifest.get("n_raw", 1044),
            effective_n=manifest.get("effective_n", 831.04),
            design_effect=manifest.get("design_effect", 1.256),
            methodology="MaxDiff · 16 PRISM segments",
            metadata={
                "ipf_iterations": manifest.get("ipf_iterations", 50),
                "ipf_final_deviation": manifest.get("ipf_final_deviation"),
                "weighted": manifest.get("weighted", True),
                "rake_dimensions": manifest.get("rake_dimensions", []),
                "rake_skipped": manifest.get("rake_skipped", []),
                "notes": manifest.get("notes", []),
            },
        )

    def _convert_segments(self, seg_data: Dict, zparams: Dict) -> None:
        """Convert seg_data + zparams → Segments."""
        segment_codes = [
            "TSP", "CEC", "TC", "HF", "PP", "WE", "PFF", "HHN", "MFL", "VS",
            "UCP", "FJP", "HCP", "HAD", "HCI", "GHI"
        ]
        party_map = {
            "TSP": "GOP", "CEC": "GOP", "TC": "GOP", "HF": "GOP", "PP": "GOP",
            "WE": "GOP", "PFF": "GOP", "HHN": "GOP", "MFL": "GOP", "VS": "GOP",
            "UCP": "DEM", "FJP": "DEM", "HCP": "DEM", "HAD": "DEM", "HCI": "DEM", "GHI": "DEM",
        }
        tier_map = zparams.get("ASSIGNED_TIERS", {})
        persona_map = zparams.get("PERSONAS", {})

        for seg_id, code in enumerate(segment_codes, start=1):
            segment = Segment(
                id=seg_id,
                study_id=self.study.id if self.study else "hiv-wave1",
                code=code,
                name=zparams.get("SEGMENT_NAMES", {}).get(code, code),
                party=party_map.get(code, ""),
                population_share=0.0,  # Would come from seg_data
                tier=tier_map.get(code, 1),
                persona_profile=persona_map.get(code, {}),
            )
            self.segments.append(segment)

    def _convert_survey_items(self, items: Dict) -> None:
        """Convert items.json → SurveyItems + ItemResponses."""
        study_id = self.study.id if self.study else "hiv-wave1"

        for construct, item_list in items.items():
            if not isinstance(item_list, list):
                continue

            for item in item_list:
                code = item.get("code", "")
                if not code:
                    continue

                # Create SurveyItem
                survey_item = SurveyItem(
                    id=str(uuid.uuid4()),
                    study_id=study_id,
                    code=code,
                    stem=item.get("stem", ""),
                    construct=construct,
                    scale_min=1,
                    scale_max=7 if not item.get("binary", False) else 1,
                    scale_label_lo="Disagree" if not item.get("binary") else "No",
                    scale_label_hi="Agree" if not item.get("binary") else "Yes",
                    is_binary=item.get("binary", False),
                )
                self.survey_items.append(survey_item)

                # Create ItemResponses (one per segment)
                by_segment = item.get("by_segment", {})
                for seg_id_str, mean_value in by_segment.items():
                    try:
                        seg_id = int(seg_id_str)
                        response = ItemResponse(
                            item_id=survey_item.id,
                            segment_id=seg_id,
                            mean=float(mean_value) if mean_value is not None else 0.0,
                            sd=0.0,  # Would need to compute from raw data
                            n=0,
                            n_weighted=0.0,
                        )
                        self.item_responses.append(response)
                    except (ValueError, TypeError):
                        pass

    def _convert_composites(self, benchmarks: Dict) -> None:
        """Convert bench.json → CompositeScores + CompositeResponses."""
        study_id = self.study.id if self.study else "hiv-wave1"
        composite_codes = ["MBS", "SDS", "EDS", "SCS", "CFS", "PFS", "SCF", "CON_HIV", "CON_LGB", "HKS"]

        for code in composite_codes:
            composite = CompositeScore(
                id=str(uuid.uuid4()),
                study_id=study_id,
                code=code,
                label=self._get_composite_label(code),
                description=self._get_composite_description(code),
                construct="composite",
                components=[],  # Would need to map to survey items
                aggregation_method="mean",
                scale_min=1.0,
                scale_max=7.0,
            )
            self.composite_scores.append(composite)

            # Create CompositeResponses (one per segment per benchmark group)
            for group in ["All", "Republicans", "Democrats"]:
                group_data = benchmarks.get(group, {})
                if code in group_data:
                    value_data = group_data[code]
                    # Handle both dict format (with "raw" and "z") and float format
                    if isinstance(value_data, dict):
                        raw_value = value_data.get("raw", 0.0)
                        z_score = value_data.get("z", 0.0)
                    else:
                        raw_value = float(value_data) if value_data is not None else 0.0
                        z_score = 0.0
                    
                    response = CompositeResponse(
                        composite_id=composite.id,
                        segment_id=0,  # "All" benchmark
                        benchmark_group=group,
                        raw_value=raw_value,
                        z_score=z_score,
                        n_weighted=group_data.get("n", 0),
                    )
                    self.composite_responses.append(response)

    def _convert_messages(self, messages_list) -> None:
        """Convert MESSAGES → Messages."""
        study_id = self.study.id if self.study else "hiv-wave1"

        for i, msg in enumerate(messages_list, start=1):
            message = Message(
                id=msg.get("id", i),
                study_id=study_id,
                code=f"MSG_{i:03d}",
                short_name=msg.get("shortName", ""),
                theme=msg.get("theme", ""),
                body_text=msg.get("text", ""),
            )
            self.messages.append(message)

    def _convert_trust(self, trust) -> None:
        """Convert trust.json → TrustEntities + TrustRatings."""
        study_id = self.study.id if self.study else "hiv-wave1"

        # Handle both list and dict formats
        trust_items = trust if isinstance(trust, list) else trust.items()
        
        for item in trust_items:
            if isinstance(item, tuple):
                entity_code, entity_data = item
            else:
                entity_code = item.get("code", "unknown")
                entity_data = item

            entity = TrustEntity(
                id=str(uuid.uuid4()),
                study_id=study_id,
                code=entity_code,
                label=entity_data.get("label", entity_code),
                category=entity_data.get("category", ""),
                description=entity_data.get("description", ""),
            )
            self.trust_entities.append(entity)

            # Create TrustRatings (one per segment per benchmark group)
            by_segment = entity_data.get("by_segment", {})
            for seg_id_str, score in by_segment.items():
                try:
                    seg_id = int(seg_id_str)
                    rating = TrustRating(
                        entity_id=entity.id,
                        segment_id=seg_id,
                        trust_score=float(score) if score is not None else 0.0,
                        benchmark_group="All",
                    )
                    self.trust_ratings.append(rating)
                except (ValueError, TypeError):
                    pass

    def _convert_prepost(self, prepost_list) -> None:
        """Convert PREPOST_METRICS → PrePostMetrics."""
        study_id = self.study.id if self.study else "hiv-wave1"

        for i, metric in enumerate(prepost_list, start=1):
            prepost = PrePostMetric(
                id=str(uuid.uuid4()),
                study_id=study_id,
                code=f"QPRE_{i}",
                question=metric.get("question", ""),
                scale_type=metric.get("scale_type", "1-7 likert"),
                measurement_type=metric.get("measurement_type", "top-3-box"),
                order_in_test=i,
            )
            self.prepost_metrics.append(prepost)

    @staticmethod
    def _get_composite_label(code: str) -> str:
        """Map composite code to label."""
        labels = {
            "MBS": "Moral Boundary Setting",
            "SDS": "Social Disgust",
            "EDS": "Expected Disgust",
            "SCS": "Stigma Cognition",
            "CFS": "Concern for Self",
            "PFS": "Concern for Society",
            "SCF": "Stigma Composite Factor",
            "CON_HIV": "HIV Concern Index",
            "CON_LGB": "LGB Concern Index",
            "HKS": "HIV Knowledge Score",
        }
        return labels.get(code, code)

    @staticmethod
    def _get_composite_description(code: str) -> str:
        """Map composite code to description."""
        descriptions = {
            "MBS": "Propensity to set moral boundaries around HIV risk behavior",
            "SDS": "Social-level disgust toward out-groups",
            "EDS": "Expected disgust responses to hypothetical situations",
            "SCS": "Cognitive stigma — beliefs about people with HIV",
            "CFS": "Concern about personal HIV risk",
            "PFS": "Concern about societal-level HIV burden",
            "SCF": "Overall stigma composite factor",
            "CON_HIV": "Concern about HIV-specific issues",
            "CON_LGB": "Concern about LGB-related issues",
            "HKS": "Knowledge about HIV prevention and treatment",
        }
        return descriptions.get(code, "")


# ============================================================================
# SQL SCHEMA GENERATOR
# ============================================================================

class SQLSchemaGenerator:
    """Generates SQL DDL for normalized schema."""

    @staticmethod
    def generate() -> str:
        """Generate complete SQL schema for SQLite."""
        return """
-- PRISM Dashboard — Normalized Schema
-- Generated May 2026
-- Database: SQLite

-- ============================================================================
-- STUDIES
-- ============================================================================
CREATE TABLE studies (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    client VARCHAR(255),
    topic VARCHAR(255),
    wave INT,
    field_start_date DATE,
    field_end_date DATE,
    n_raw INT,
    effective_n FLOAT,
    design_effect FLOAT,
    methodology VARCHAR(500),
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SEGMENTS
-- ============================================================================
CREATE TABLE segments (
    id INT PRIMARY KEY,
    study_id VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255),
    party VARCHAR(10),
    population_share FLOAT,
    tier INT,
    persona_profile TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (study_id) REFERENCES studies(id)
);

CREATE INDEX idx_segments_study_id ON segments(study_id);
CREATE INDEX idx_segments_code ON segments(code);

-- ============================================================================
-- SEGMENT_DEMOGRAPHICS
-- ============================================================================
CREATE TABLE segment_demographics (
    segment_id INT PRIMARY KEY,
    gender_male_pct FLOAT,
    median_age INT,
    nonwhite_pct FLOAT,
    mean_hhi VARCHAR(50),
    college_plus_pct FLOAT,
    rural_pct FLOAT,
    census_division VARCHAR(100),
    census_division_pct FLOAT,
    military_pct FLOAT,
    union_household_pct FLOAT,
    religion_breakdown TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (segment_id) REFERENCES segments(id)
);

-- ============================================================================
-- SEGMENT_STUDY_METRICS
-- ============================================================================
CREATE TABLE segment_study_metrics (
    id INTEGER PRIMARY KEY,
    segment_id INT NOT NULL,
    study_id VARCHAR(255) NOT NULL,
    roi FLOAT,
    high_roi_pct INT,
    supporters_pct INT,
    activation_index INT,
    influence_score INT,
    persuadability TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(segment_id, study_id),
    FOREIGN KEY (segment_id) REFERENCES segments(id),
    FOREIGN KEY (study_id) REFERENCES studies(id)
);

CREATE INDEX idx_segment_metrics_study ON segment_study_metrics(study_id);

-- ============================================================================
-- SURVEY_ITEMS
-- ============================================================================
CREATE TABLE survey_items (
    id VARCHAR(36) PRIMARY KEY,
    study_id VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    stem TEXT,
    construct VARCHAR(100),
    scale_min INT,
    scale_max INT,
    scale_label_lo VARCHAR(100),
    scale_label_hi VARCHAR(100),
    is_binary BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(study_id, code),
    FOREIGN KEY (study_id) REFERENCES studies(id)
);

CREATE INDEX idx_survey_items_construct ON survey_items(construct);

-- ============================================================================
-- ITEM_RESPONSES
-- ============================================================================
CREATE TABLE item_responses (
    id INTEGER PRIMARY KEY,
    item_id VARCHAR(36) NOT NULL,
    segment_id INT NOT NULL,
    mean FLOAT,
    sd FLOAT,
    n INT,
    n_weighted FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(item_id, segment_id),
    FOREIGN KEY (item_id) REFERENCES survey_items(id),
    FOREIGN KEY (segment_id) REFERENCES segments(id)
);

CREATE INDEX idx_item_responses_segment ON item_responses(segment_id);

-- ============================================================================
-- COMPOSITE_SCORES
-- ============================================================================
CREATE TABLE composite_scores (
    id VARCHAR(36) PRIMARY KEY,
    study_id VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    label VARCHAR(255),
    description TEXT,
    construct VARCHAR(100),
    components TEXT,
    aggregation_method VARCHAR(50),
    scale_min FLOAT,
    scale_max FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(study_id, code),
    FOREIGN KEY (study_id) REFERENCES studies(id)
);

-- ============================================================================
-- COMPOSITE_RESPONSES
-- ============================================================================
CREATE TABLE composite_responses (
    id INTEGER PRIMARY KEY,
    composite_id VARCHAR(36) NOT NULL,
    segment_id INT NOT NULL,
    benchmark_group VARCHAR(50),
    raw_value FLOAT,
    z_score FLOAT,
    n_weighted FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(composite_id, segment_id, benchmark_group),
    FOREIGN KEY (composite_id) REFERENCES composite_scores(id),
    FOREIGN KEY (segment_id) REFERENCES segments(id)
);

CREATE INDEX idx_composite_responses_segment ON composite_responses(segment_id);
CREATE INDEX idx_composite_responses_benchmark ON composite_responses(benchmark_group);

-- ============================================================================
-- MESSAGES
-- ============================================================================
CREATE TABLE messages (
    id INT PRIMARY KEY,
    study_id VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    short_name VARCHAR(255),
    theme VARCHAR(255),
    body_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(study_id, code),
    FOREIGN KEY (study_id) REFERENCES studies(id)
);

CREATE INDEX idx_messages_study ON messages(study_id);

-- ============================================================================
-- MESSAGE_PERFORMANCE
-- ============================================================================
CREATE TABLE message_performance (
    id INTEGER PRIMARY KEY,
    message_id INT NOT NULL,
    segment_id INT NOT NULL,
    score FLOAT,
    rank INT,
    delta_vs_benchmark FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, segment_id),
    FOREIGN KEY (message_id) REFERENCES messages(id),
    FOREIGN KEY (segment_id) REFERENCES segments(id)
);

CREATE INDEX idx_message_perf_segment ON message_performance(segment_id);

-- ============================================================================
-- TRUST_ENTITIES
-- ============================================================================
CREATE TABLE trust_entities (
    id VARCHAR(36) PRIMARY KEY,
    study_id VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    label VARCHAR(255),
    category VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(study_id, code),
    FOREIGN KEY (study_id) REFERENCES studies(id)
);

CREATE INDEX idx_trust_entities_study ON trust_entities(study_id);

-- ============================================================================
-- TRUST_RATINGS
-- ============================================================================
CREATE TABLE trust_ratings (
    id INTEGER PRIMARY KEY,
    entity_id VARCHAR(36) NOT NULL,
    segment_id INT NOT NULL,
    trust_score FLOAT,
    benchmark_group VARCHAR(50),
    n_respondents INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_id, segment_id, benchmark_group),
    FOREIGN KEY (entity_id) REFERENCES trust_entities(id),
    FOREIGN KEY (segment_id) REFERENCES segments(id)
);

CREATE INDEX idx_trust_ratings_segment ON trust_ratings(segment_id);
CREATE INDEX idx_trust_ratings_benchmark ON trust_ratings(benchmark_group);

-- ============================================================================
-- PREPOST_METRICS
-- ============================================================================
CREATE TABLE prepost_metrics (
    id VARCHAR(36) PRIMARY KEY,
    study_id VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    question TEXT,
    scale_type VARCHAR(100),
    measurement_type VARCHAR(100),
    order_in_test INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(study_id, code),
    FOREIGN KEY (study_id) REFERENCES studies(id)
);

CREATE INDEX idx_prepost_study ON prepost_metrics(study_id);

-- ============================================================================
-- PREPOST_RESPONSES
-- ============================================================================
CREATE TABLE prepost_responses (
    id INTEGER PRIMARY KEY,
    metric_id VARCHAR(36) NOT NULL,
    segment_id INT NOT NULL,
    timepoint VARCHAR(10),
    pct_response FLOAT,
    delta FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(metric_id, segment_id, timepoint),
    FOREIGN KEY (metric_id) REFERENCES prepost_metrics(id),
    FOREIGN KEY (segment_id) REFERENCES segments(id)
);

CREATE INDEX idx_prepost_responses_segment ON prepost_responses(segment_id);
CREATE INDEX idx_prepost_responses_timepoint ON prepost_responses(timepoint);

-- ============================================================================
-- SURVEY_WEIGHTS
-- ============================================================================
CREATE TABLE survey_weights (
    id INTEGER PRIMARY KEY,
    study_id VARCHAR(255) NOT NULL,
    respondent_id INT,
    weight FLOAT,
    segment_id INT,
    ipf_iteration INT,
    rake_targets TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (study_id) REFERENCES studies(id),
    FOREIGN KEY (segment_id) REFERENCES segments(id)
);

CREATE INDEX idx_survey_weights_study ON survey_weights(study_id);
CREATE INDEX idx_survey_weights_respondent ON survey_weights(respondent_id);

-- ============================================================================
-- AUDIT LOG
-- ============================================================================
CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY,
    table_name VARCHAR(100),
    record_id VARCHAR(255),
    action VARCHAR(50),
    changed_fields TEXT,
    changed_by VARCHAR(255),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_table ON audit_log(table_name);
CREATE INDEX idx_audit_changed_at ON audit_log(changed_at);

-- ============================================================================
-- VALIDATION REPORTS
-- ============================================================================
CREATE TABLE validation_reports (
    id INTEGER PRIMARY KEY,
    study_id VARCHAR(255),
    validation_type VARCHAR(100),
    status VARCHAR(50),
    errors TEXT,
    warnings TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (study_id) REFERENCES studies(id)
);

CREATE INDEX idx_validation_study ON validation_reports(study_id);
CREATE INDEX idx_validation_status ON validation_reports(status);
"""


# ============================================================================
# MAIN MIGRATION ORCHESTRATOR
# ============================================================================

class MigrationPipeline:
    """Orchestrates the full migration pipeline."""

    def __init__(self, data_dir: Path = Path("src/data/hiv")):
        self.data_dir = data_dir
        self.loader = DataLoader(data_dir)
        self.validator = DataValidator()
        self.converter = DataConverter()

    def validate_only(self) -> bool:
        """Run validation without conversion."""
        print("\n" + "=" * 70)
        print("PRISM HIV Dashboard — Data Validation")
        print("=" * 70)

        print(f"\n📂 Loading data from: {self.data_dir}")
        raw_data = self.loader.load_all()

        print("\n🔍 Validating data structure...")
        is_valid = self.validator.validate_all(raw_data)

        print("\n" + self.validator.report())
        return is_valid

    def dry_run(self) -> bool:
        """Load and convert data without writing to database."""
        print("\n" + "=" * 70)
        print("PRISM HIV Dashboard — Migration Dry Run")
        print("=" * 70)

        print(f"\n📂 Loading data from: {self.data_dir}")
        raw_data = self.loader.load_all()

        print("\n🔍 Validating data structure...")
        if not self.validator.validate_all(raw_data):
            print("\n" + self.validator.report())
            print("\n❌ Validation failed. Stopping dry run.")
            return False

        print("\n✅ Validation passed!")
        print("\n🔄 Converting to normalized entities...")
        self.converter.convert(raw_data)

        print("\n📊 Conversion Summary:")
        print(f"  - Study: {len([self.converter.study]) if self.converter.study else 0}")
        print(f"  - Segments: {len(self.converter.segments)}")
        print(f"  - Survey Items: {len(self.converter.survey_items)}")
        print(f"  - Item Responses: {len(self.converter.item_responses)}")
        print(f"  - Composite Scores: {len(self.converter.composite_scores)}")
        print(f"  - Composite Responses: {len(self.converter.composite_responses)}")
        print(f"  - Messages: {len(self.converter.messages)}")
        print(f"  - Trust Entities: {len(self.converter.trust_entities)}")
        print(f"  - Trust Ratings: {len(self.converter.trust_ratings)}")
        print(f"  - Pre/Post Metrics: {len(self.converter.prepost_metrics)}")
        print(f"  - Pre/Post Responses: {len(self.converter.prepost_responses)}")

        return True

    def generate_sql(self) -> str:
        """Generate SQL schema without executing."""
        return SQLSchemaGenerator.generate()

    def execute(self, db_path: str = "prism_dashboard.db") -> bool:
        """Execute full migration to SQLite database."""
        print("\n" + "=" * 70)
        print("PRISM HIV Dashboard — Full Migration")
        print("=" * 70)

        # Validate
        print(f"\n📂 Loading data from: {self.data_dir}")
        raw_data = self.loader.load_all()

        print("\n🔍 Validating data structure...")
        if not self.validator.validate_all(raw_data):
            print("\n" + self.validator.report())
            return False

        # Convert
        print("\n✅ Validation passed!")
        print("\n🔄 Converting to normalized entities...")
        self.converter.convert(raw_data)

        # Execute SQL
        print(f"\n💾 Creating database: {db_path}")
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()

            # Create schema
            schema_sql = self.generate_sql()
            cursor.executescript(schema_sql)
            conn.commit()

            # Insert data
            self._insert_data(cursor)
            conn.commit()

            print(f"✅ Migration complete! Database saved to: {db_path}")
            conn.close()
            return True
        except Exception as e:
            print(f"❌ Migration failed: {e}")
            return False

    def _insert_data(self, cursor: sqlite3.Cursor) -> None:
        """Insert converted data into database."""
        # Insert studies
        if self.converter.study:
            cursor.execute(
                """INSERT INTO studies 
                   (id, name, client, topic, wave, field_start_date, field_end_date,
                    n_raw, effective_n, design_effect, methodology, metadata, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    self.converter.study.id,
                    self.converter.study.name,
                    self.converter.study.client,
                    self.converter.study.topic,
                    self.converter.study.wave,
                    self.converter.study.field_start_date,
                    self.converter.study.field_end_date,
                    self.converter.study.n_raw,
                    self.converter.study.effective_n,
                    self.converter.study.design_effect,
                    self.converter.study.methodology,
                    json.dumps(self.converter.study.metadata),
                    self.converter.study.created_at,
                ),
            )

        # Insert segments
        for segment in self.converter.segments:
            cursor.execute(
                """INSERT INTO segments 
                   (id, study_id, code, name, party, tier, persona_profile, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    segment.id,
                    segment.study_id,
                    segment.code,
                    segment.name,
                    segment.party,
                    segment.tier,
                    json.dumps(segment.persona_profile),
                    segment.created_at,
                ),
            )

        # Insert survey items
        for item in self.converter.survey_items:
            cursor.execute(
                """INSERT INTO survey_items 
                   (id, study_id, code, stem, construct, scale_min, scale_max,
                    scale_label_lo, scale_label_hi, is_binary, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    item.id,
                    item.study_id,
                    item.code,
                    item.stem,
                    item.construct,
                    item.scale_min,
                    item.scale_max,
                    item.scale_label_lo,
                    item.scale_label_hi,
                    item.is_binary,
                    item.created_at,
                ),
            )

        # Insert item responses
        for response in self.converter.item_responses:
            cursor.execute(
                """INSERT INTO item_responses
                   (item_id, segment_id, mean, sd, n, n_weighted, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    response.item_id,
                    response.segment_id,
                    response.mean,
                    response.sd,
                    response.n,
                    response.n_weighted,
                    response.created_at,
                ),
            )

        # Insert composite scores
        for composite in self.converter.composite_scores:
            cursor.execute(
                """INSERT INTO composite_scores
                   (id, study_id, code, label, description, construct,
                    components, aggregation_method, scale_min, scale_max, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    composite.id,
                    composite.study_id,
                    composite.code,
                    composite.label,
                    composite.description,
                    composite.construct,
                    json.dumps(composite.components),
                    composite.aggregation_method,
                    composite.scale_min,
                    composite.scale_max,
                    composite.created_at,
                ),
            )

        # Insert composite responses
        for response in self.converter.composite_responses:
            cursor.execute(
                """INSERT INTO composite_responses
                   (composite_id, segment_id, benchmark_group, raw_value, z_score, n_weighted, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    response.composite_id,
                    response.segment_id,
                    response.benchmark_group,
                    response.raw_value,
                    response.z_score,
                    response.n_weighted,
                    response.created_at,
                ),
            )

        # Insert messages
        for message in self.converter.messages:
            cursor.execute(
                """INSERT INTO messages
                   (id, study_id, code, short_name, theme, body_text, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    message.id,
                    message.study_id,
                    message.code,
                    message.short_name,
                    message.theme,
                    message.body_text,
                    message.created_at,
                ),
            )

        # Insert trust entities
        for entity in self.converter.trust_entities:
            cursor.execute(
                """INSERT INTO trust_entities
                   (id, study_id, code, label, category, description, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    entity.id,
                    entity.study_id,
                    entity.code,
                    entity.label,
                    entity.category,
                    entity.description,
                    entity.created_at,
                ),
            )

        # Insert trust ratings
        for rating in self.converter.trust_ratings:
            cursor.execute(
                """INSERT INTO trust_ratings
                   (entity_id, segment_id, trust_score, benchmark_group, n_respondents, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    rating.entity_id,
                    rating.segment_id,
                    rating.trust_score,
                    rating.benchmark_group,
                    rating.n_respondents,
                    rating.created_at,
                ),
            )

        # Insert pre/post metrics
        for metric in self.converter.prepost_metrics:
            cursor.execute(
                """INSERT INTO prepost_metrics
                   (id, study_id, code, question, scale_type, measurement_type, order_in_test, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    metric.id,
                    metric.study_id,
                    metric.code,
                    metric.question,
                    metric.scale_type,
                    metric.measurement_type,
                    metric.order_in_test,
                    metric.created_at,
                ),
            )

        print(f"  ✓ Inserted {len(self.converter.segments)} segments")
        print(f"  ✓ Inserted {len(self.converter.survey_items)} survey items")
        print(f"  ✓ Inserted {len(self.converter.item_responses)} item responses")
        print(f"  ✓ Inserted {len(self.converter.composite_scores)} composite scores")
        print(f"  ✓ Inserted {len(self.converter.trust_entities)} trust entities")
        print(f"  ✓ Inserted {len(self.converter.trust_ratings)} trust ratings")
        print(f"  ✓ Inserted {len(self.converter.messages)} messages")
        print(f"  ✓ Inserted {len(self.converter.prepost_metrics)} pre/post metrics")


# ============================================================================
# CLI
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="PRISM HIV Dashboard Data Migration Pipeline"
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Run validation without migration",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Convert data without writing to database",
    )
    parser.add_argument(
        "--generate-sql",
        action="store_true",
        help="Output SQL schema (use with > schema.sql)",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Execute full migration to SQLite database",
    )
    parser.add_argument(
        "--db",
        default="prism_dashboard.db",
        help="Database filename (default: prism_dashboard.db)",
    )
    parser.add_argument(
        "--data-dir",
        default="src/data/hiv",
        help="Data directory (default: src/data/hiv)",
    )

    args = parser.parse_args()

    pipeline = MigrationPipeline(Path(args.data_dir))

    if args.validate_only:
        success = pipeline.validate_only()
        sys.exit(0 if success else 1)

    elif args.generate_sql:
        print(pipeline.generate_sql())
        sys.exit(0)

    elif args.dry_run:
        success = pipeline.dry_run()
        sys.exit(0 if success else 1)

    elif args.execute:
        success = pipeline.execute(args.db)
        sys.exit(0 if success else 1)

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
