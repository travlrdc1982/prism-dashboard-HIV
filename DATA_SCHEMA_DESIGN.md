# PRISM Dashboard — Data Schema Design
**Date**: May 22, 2026  
**Status**: Design Phase Complete  
**Scope**: HIV Study Wave 1 + Multi-Study Architecture  

---

## Executive Summary

This document defines a normalized, scalable data schema for the PRISM HIV Dashboard and establishes patterns for future multi-study deployments. The schema supports:

- **Study Metadata** — Multi-study framework with metadata, field dates, sample characteristics
- **Segment Profiles** — 16-segment audience segmentation with demographics, psychographics, behavioral indices
- **Message Testing** — MaxDiff results, per-segment message performance, pre/post metrics
- **Knowledge & Trust** — Topic knowledge scores, institutional trust ratings, entity-specific trust mappings
- **Survey Weighting** — Iterative proportional fitting (IPF), design effects, effective sample sizes

---

## Part 1: Current Data Structure Analysis

### 1.1 Existing JSON Files

#### **manifest.json** — Study Metadata
```
├─ study metadata (name, client, field dates, sample info)
├─ weighting parameters (IPF iterations, design effect, weight bounds)
├─ rake dimensions (demographic axes for weighting)
├─ sample characteristics (raw n, effective n, weighted means)
└─ notes (exclusions, data quality flags)
```

**Key Fields:**
- `study`: Study name (e.g., "PRISM HIV Wave 1")
- `n_raw`, `effective_n`: Sample sizes (pre- and post-weighting)
- `design_effect`, `weight_mean`, `weight_min`, `weight_max`: Weighting diagnostics
- `focal_segment`: Default segment for dashboard view (by ID)
- `rake_dimensions`: Demographic targets for IPF raking
- `notes[]`: Data quality, exclusions, transformations applied

---

#### **items.json** — Survey Items & Composite Scores
```
├─ scf (moral values — 13 items: MFQ, moral foundations)
├─ sds (social disgust — 5 items)
├─ eds (expected disgust — 5 items)
├─ scs (stigma cognition — 5 items)
├─ cfs (concern-for-self — 7 items)
├─ pfs (concern-for-society — 7 items)
├─ scf (stigma composite factor)
├─ con_hiv (HIV concern index)
├─ con_lgb (LGB concern index)
├─ hks (HIV knowledge score)
└─ contact_behavior (risk behavior contact)

For each item:
├─ code: Unique identifier (e.g., "MFQ_r1")
├─ stem: Question text / item description
├─ focal: Segment-level mean (focal segment, e.g., FJP)
├─ by_segment: { "1": mean1, "2": mean2, ..., "16": mean16 }
├─ All: Population average
├─ Republicans: Party average
├─ Democrats: Party average
└─ binary: Boolean (true if 0/1 scale; false if Likert)
```

**Structure**: Nested by construct (moral values, disgust, stigma, concern, knowledge).

---

#### **seg_data.json** — Segment-Level Aggregates
```
├─ Demographics: gender, age, race, HHI, education, rurality, region
├─ Political: party affiliation, ideology scores
├─ Health behaviors: supplement use, wellness practices, fitness tracking
├─ Media consumption: news sources, podcast preferences
├─ Insurance: coverage type distribution
├─ Beliefs: top-3-box on key attitudes
└─ Institutional trust: trust ratings by entity type
```

**Key Segments** (16 total):
- **GOP** (10): TSP, CEC, TC, HF, PP, WE, PFF, HHN, MFL, VS
- **DEM** (6): UCP, FJP, HCP, HAD, HCI, GHI

---

#### **bench.json** — Benchmark Aggregates
```
For each benchmark group (All, Republicans, Democrats):
├─ n: Sample size
├─ Composite scores: { raw: value, z: z_score }
│  ├─ MBS (Moral Boundary Setting)
│  ├─ SDS (Social Disgust)
│  ├─ EDS (Expected Disgust)
│  ├─ SCS (Stigma Cognition)
│  ├─ CFS (Concern for Self)
│  ├─ PFS (Concern for Society)
│  ├─ SCF (Stigma Composite Factor)
│  ├─ CON_HIV (HIV Concern Index)
│  ├─ CON_LGB (LGB Concern Index)
│  └─ HKS (HIV Knowledge Score)
```

**Scoring**: Weighted by IPF-raked weights; z-scores standardized against full-sample weighted mean and SD.

---

#### **trust.json** — Institutional Trust & Knowledge
```
For each trust entity:
├─ code: Entity key (e.g., "CDC", "FDA", "PHARMA", "INSURERS")
├─ label: Display name
├─ category: Entity grouping (govt, corporate, NGO, media)
├─ by_segment: { "1": trust1, "2": trust2, ..., "16": trust16 }
├─ All: Population average
├─ Republicans: Party average
└─ Democrats: Party average

Trust scales: 1–7 (1 = No trust; 7 = High trust)
Messengers: 22 entities (FDA, CDC, NIH, insurers, hospitals, pharma, media, etc.)
```

---

#### **zparams.json** — Study Parameters
```
├─ Study ID, name, wave, client
├─ Field dates, wave launch/close
├─ Segment definitions (16 codes + names)
├─ Message definitions (17 core messages + themes)
├─ Prepost metrics definitions (7 items with questions)
└─ Color palettes & visual tokens
```

---

### 1.2 Current Data Duplication Issues

1. **Segment metadata** split across:
   - `zparams.json` (codes, names, party)
   - `seg_data.json` (demographics, behaviors)
   - `study.js` (metrics: ROI, persuadability, pre/post)
   - `SegmentProfile.jsx` (hardcoded persona text, beliefs)

2. **Trust data** duplicated:
   - `bench.json` (benchmark trust means)
   - `trust.json` (per-segment trust ratings)
   - SegmentProfile.jsx (hardcoded entity definitions)

3. **Messages** stored separately:
   - `study.js` (MESSAGES array with 17 items)
   - SegmentProfile.jsx (message metadata, scores)
   - Dashboard components (message selection UI)

4. **Pre/Post metrics** defined in:
   - `study.js` (PREPOST_METRICS with definitions)
   - `study.js` (STUDY_METRICS with pre/post data)
   - SegmentProfile.jsx (rendering logic)

---

## Part 2: Normalized Schema Design

### 2.1 Database Schema Structure

```
STUDIES
├─ id (UUID)
├─ name (string, e.g., "PRISM HIV Wave 1")
├─ client (string)
├─ topic (string)
├─ wave (int)
├─ field_start_date (date)
├─ field_end_date (date)
├─ n_raw (int)
├─ effective_n (float)
├─ design_effect (float)
├─ methodology (string, e.g., "MaxDiff · 16 segments")
├─ created_at (timestamp)
├─ updated_at (timestamp)
└─ metadata (JSON — weighting params, rake dimensions, notes)

SEGMENTS
├─ id (int, 1–16)
├─ study_id (FK → STUDIES)
├─ code (string, e.g., "TSP", "UCP")
├─ name (string)
├─ party (string: GOP | DEM)
├─ population_share (float, 0–1)
├─ tier (int, 1–3)
├─ persona_profile (JSON)
│  ├─ quote
│  ├─ believe
│  ├─ want
│  ├─ doWhat
│  └─ whoAre
└─ created_at (timestamp)

SEGMENT_DEMOGRAPHICS
├─ segment_id (FK → SEGMENTS)
├─ gender_male_pct (float)
├─ median_age (int)
├─ nonwhite_pct (float)
├─ mean_hhi (string, e.g., "$99K")
├─ college_plus_pct (float)
├─ rural_pct (float)
├─ census_division (string)
├─ census_division_pct (float)
├─ military_pct (float)
├─ union_household_pct (float)
└─ religion_breakdown (JSON)

SEGMENT_STUDY_METRICS
├─ segment_id (FK → SEGMENTS)
├─ study_id (FK → STUDIES)
├─ roi (float)
├─ high_roi_pct (int)
├─ supporters_pct (int)
├─ activation_index (int)
├─ influence_score (int)
├─ persuadability (JSON: [5-element array])
└─ created_at (timestamp)

MESSAGES
├─ id (int)
├─ study_id (FK → STUDIES)
├─ code (string, e.g., "MSG_001")
├─ short_name (string)
├─ theme (string, optional)
├─ body_text (string)
├─ created_at (timestamp)
└─ updated_at (timestamp)

MESSAGE_PERFORMANCE
├─ message_id (FK → MESSAGES)
├─ segment_id (FK → SEGMENTS)
├─ score (float, 0–100)
├─ rank (int)
├─ delta_vs_benchmark (float)
└─ created_at (timestamp)

SURVEY_ITEMS
├─ id (UUID)
├─ study_id (FK → STUDIES)
├─ code (string, e.g., "MFQ_r1")
├─ stem (string, question text)
├─ construct (string, e.g., "moral_values", "disgust", "stigma")
├─ scale_min (int)
├─ scale_max (int)
├─ scale_label_lo (string)
├─ scale_label_hi (string)
├─ is_binary (boolean)
└─ created_at (timestamp)

ITEM_RESPONSES
├─ item_id (FK → SURVEY_ITEMS)
├─ segment_id (FK → SEGMENTS)
├─ mean (float)
├─ sd (float)
├─ n (int, unweighted count)
├─ n_weighted (float)
└─ created_at (timestamp)

COMPOSITE_SCORES
├─ id (UUID)
├─ study_id (FK → STUDIES)
├─ code (string, e.g., "MBS", "SDS", "HKS")
├─ label (string)
├─ description (string)
├─ construct (string)
├─ components (JSON: [item_codes])
├─ aggregation_method (string, e.g., "mean", "sum")
├─ scale_min (float)
├─ scale_max (float)
└─ created_at (timestamp)

COMPOSITE_RESPONSES
├─ composite_id (FK → COMPOSITE_SCORES)
├─ segment_id (FK → SEGMENTS)
├─ benchmark_group (string: "All" | "Republicans" | "Democrats")
├─ raw_value (float)
├─ z_score (float)
├─ n_weighted (float)
└─ created_at (timestamp)

TRUST_ENTITIES
├─ id (UUID)
├─ study_id (FK → STUDIES)
├─ code (string, e.g., "CDC", "PHARMA")
├─ label (string)
├─ category (string, e.g., "govt", "corporate", "ngo")
├─ description (string, optional)
└─ created_at (timestamp)

TRUST_RATINGS
├─ entity_id (FK → TRUST_ENTITIES)
├─ segment_id (FK → SEGMENTS)
├─ trust_score (float, 1–7)
├─ benchmark_group (string: "All" | "Republicans" | "Democrats")
├─ n_respondents (int)
└─ created_at (timestamp)

PREPOST_METRICS
├─ id (UUID)
├─ study_id (FK → STUDIES)
├─ code (string, e.g., "QPRE_1")
├─ question (string)
├─ scale_type (string, e.g., "1-7 likert")
├─ measurement_type (string, e.g., "top-2-box", "top-3-box")
├─ order_in_test (int)
└─ created_at (timestamp)

PREPOST_RESPONSES
├─ metric_id (FK → PREPOST_METRICS)
├─ segment_id (FK → SEGMENTS)
├─ timepoint (string: "pre" | "post")
├─ pct_response (float, 0–1)
├─ delta (float, post - pre)
└─ created_at (timestamp)

SURVEY_WEIGHTS
├─ study_id (FK → STUDIES)
├─ respondent_id (int, anonymized)
├─ weight (float)
├─ segment_id (FK → SEGMENTS)
├─ ipf_iteration (int)
├─ rake_targets (JSON)
└─ created_at (timestamp)
```

---

### 2.2 Normalization Benefits

| Issue | Solution |
|-------|----------|
| Segment metadata scattered | All segment info in `SEGMENTS` + `SEGMENT_DEMOGRAPHICS` + `SEGMENT_STUDY_METRICS` |
| Trust data duplicated | Single source: `TRUST_ENTITIES` + `TRUST_RATINGS` |
| Messages hardcoded | Centralized: `MESSAGES` + `MESSAGE_PERFORMANCE` |
| Pre/Post metric definitions split | Unified: `PREPOST_METRICS` + `PREPOST_RESPONSES` |
| Item data split by construct | All items in `SURVEY_ITEMS` + `ITEM_RESPONSES` (tagged by construct) |
| Composite scores fragmented | Centralized: `COMPOSITE_SCORES` + `COMPOSITE_RESPONSES` |

---

## Part 3: API Design & Query Patterns

### 3.1 Core Query Endpoints

#### **GET /api/studies/{studyId}**
Returns full study metadata + related entities.

```json
Response:
{
  "id": "study-001",
  "name": "PRISM HIV Wave 1",
  "client": "Gilead",
  "topic": "HIV Treatment & Prevention",
  "wave": 1,
  "field_start_date": "2026-05-04",
  "field_end_date": "2026-05-15",
  "n_raw": 1044,
  "effective_n": 831.04,
  "design_effect": 1.256,
  "methodology": "MaxDiff · 16 segments",
  "metadata": {
    "ipf_iterations": 50,
    "ipf_final_deviation": 0.000870,
    "weighted": true,
    "has_knowledge": true,
    "rake_dimensions": ["Segment (16)", "Sex × Party", "Age4 × Party", ...],
    "rake_skipped": ["Income — variable not present in raw .sav"],
    "notes": [...]
  }
}
```

---

#### **GET /api/studies/{studyId}/segments**
Returns all 16 segments + demographics + study metrics.

```json
Response:
[
  {
    "id": 1,
    "code": "TSP",
    "name": "TRUST THE SCIENCE PRAGMATISTS",
    "party": "GOP",
    "population_share": 0.02,
    "tier": 1,
    "demographics": {
      "gender_male_pct": 0.53,
      "median_age": 54,
      "nonwhite_pct": 0.12,
      "mean_hhi": "$99K",
      "college_plus_pct": 0.39,
      "rural_pct": 0.31,
      "census_division": "West South Central",
      "military_pct": 12.3,
      "union_household_pct": 6.2,
      "religion_breakdown": { "white_evangelical": 26.0, "catholic": 21.4, ... }
    },
    "study_metrics": {
      "roi": 1.0236,
      "high_roi_pct": 30,
      "supporters_pct": 32,
      "activation_index": 32,
      "influence_score": 31,
      "persuadability": [27, 2, 29, 6, 36]
    },
    "persona_profile": {
      "quote": "Free markets work best, but I defer to FDA and CDC experts...",
      "believe": "They believe America must remain a leader...",
      "want": "They want rural subsidies...",
      "doWhat": "They vaccinate more than most GOP peers...",
      "whoAre": "Median age ~54, predominantly white, male-leaning..."
    }
  },
  ...
]
```

---

#### **GET /api/studies/{studyId}/segments/{segmentId}**
Returns single segment with all related data.

```json
Response:
{
  "segment": { ...segment details... },
  "messages": [
    {
      "id": 1,
      "short_name": "THE ONGOING EPIDEMIC",
      "body_text": "HIV continues to generate new diagnoses...",
      "performance": {
        "score": 78.5,
        "rank": 3,
        "delta_vs_benchmark": 12.3
      }
    },
    ...
  ],
  "survey_items": [
    {
      "code": "MFQ_r1",
      "stem": "Whether someone suffered emotionally",
      "construct": "moral_values",
      "response": { "mean": 5.312, "sd": 1.456, "n": 45 }
    },
    ...
  ],
  "composite_scores": [
    {
      "code": "MBS",
      "label": "Moral Boundary Setting",
      "raw_value": 5.227,
      "z_score": 0.353
    },
    ...
  ],
  "trust_ratings": [
    {
      "entity_code": "CDC",
      "entity_label": "FDA / CDC",
      "trust_score": 4.21,
      "benchmark_all": 3.97,
      "benchmark_republicans": 3.64,
      "benchmark_democrats": 4.85
    },
    ...
  ],
  "prepost_metrics": [
    {
      "code": "QPRE_1",
      "question": "People have different views about which health issues...",
      "pre_pct": 0.204,
      "post_pct": 0.277,
      "delta": 0.073
    },
    ...
  ]
}
```

---

#### **GET /api/studies/{studyId}/trust-entities**
Returns all trust messengers + ratings across segments.

```json
Response:
[
  {
    "id": "trust-cdc",
    "code": "CDC",
    "label": "FDA / CDC",
    "category": "govt",
    "description": "Federal health agencies",
    "by_segment": [
      { "segment_code": "TSP", "trust_score": 4.21 },
      { "segment_code": "CEC", "trust_score": 3.94 },
      ...
    ],
    "benchmark": {
      "All": 3.97,
      "Republicans": 3.64,
      "Democrats": 4.85
    }
  },
  ...
]
```

---

#### **GET /api/studies/{studyId}/survey-items**
Returns all items + responses + composite definitions.

```json
Response:
{
  "items": [
    {
      "id": "item-mfq-r1",
      "code": "MFQ_r1",
      "stem": "Whether someone suffered emotionally",
      "construct": "moral_values",
      "scale": { "min": 1, "max": 7, "label_lo": "Disagree", "label_hi": "Agree" },
      "is_binary": false,
      "by_segment": [
        { "segment_id": 1, "mean": 5.312, "sd": 1.456, "n": 45 },
        ...
      ],
      "benchmark": {
        "All": 5.310,
        "Republicans": 5.120,
        "Democrats": 5.510
      }
    },
    ...
  ],
  "composites": [
    {
      "code": "MBS",
      "label": "Moral Boundary Setting",
      "description": "Propensity to set moral boundaries around HIV...",
      "components": ["MFQ_r1", "MFQ_r2", "MFQ_r3", ...],
      "aggregation": "mean",
      "scale": { "min": 1, "max": 7 },
      "by_segment": [
        { "segment_id": 1, "raw": 5.227, "z": 0.353, "benchmark_group": "All" },
        ...
      ]
    },
    ...
  ]
}
```

---

#### **GET /api/studies/{studyId}/prepost-metrics**
Returns pre/post changes across segments.

```json
Response:
[
  {
    "id": "prepost-001",
    "code": "QPRE_1",
    "question": "People have different views about which health issues should be the top priority...",
    "scale_type": "1-7 likert",
    "measurement_type": "top-3-box",
    "by_segment": [
      {
        "segment_id": 1,
        "segment_code": "TSP",
        "pre_pct": 0.204,
        "post_pct": 0.277,
        "delta": 0.073,
        "significance": "p < 0.05"
      },
      ...
    ]
  },
  ...
]
```

---

#### **GET /api/studies/{studyId}/comparison?segments=1,2,3**
Compare multiple segments across items + composites + trust.

```json
Response:
{
  "segments": ["TSP", "CEC", "TC"],
  "survey_items": [
    {
      "code": "MFQ_r1",
      "stem": "Whether someone suffered emotionally",
      "values": [5.312, 5.122, 5.144],
      "benchmark_all": 5.310,
      "deltas": [0.002, -0.188, -0.166]
    },
    ...
  ],
  "composites": [
    {
      "code": "MBS",
      "label": "Moral Boundary Setting",
      "values": [5.227, 4.901, 4.556],
      "benchmark_all": 5.010,
      "deltas": [0.217, -0.109, -0.454]
    },
    ...
  ],
  "trust_ratings": [
    {
      "entity_code": "CDC",
      "entity_label": "FDA / CDC",
      "values": [4.21, 3.94, 3.92],
      "benchmark_all": 3.97,
      "deltas": [0.24, -0.03, -0.05]
    },
    ...
  ]
}
```

---

### 3.2 Data Transformation Layer

**Purpose**: Convert normalized database schema → dashboard-ready JSON (client-side caching).

```javascript
// Example: Fetch segment profile with all related data
async function fetchSegmentProfile(studyId, segmentId) {
  // 1. Fetch from API
  const response = await fetch(
    `/api/studies/${studyId}/segments/${segmentId}`
  );
  const data = await response.json();

  // 2. Transform to dashboard format
  return {
    segment: data.segment,
    messages: data.messages.map(m => ({
      ...m,
      performanceRank: m.performance.rank,
      isHighPerformer: m.performance.delta_vs_benchmark > 10,
    })),
    surveyResponses: groupByConstruct(data.survey_items),
    compositeScores: data.composite_scores,
    trustRatings: data.trust_ratings,
    prePostChanges: data.prepost_metrics,
  };
}

// 3. Cache in React context / Redux
// 4. Components consume from cache
```

---

## Part 4: Migration Path

### Phase 1: Parallel Database Schema (Weeks 1–2)
- [x] Design normalized schema (complete)
- [ ] Create migration scripts (`extract_hiv.py` → database)
- [ ] Build API layer (FastAPI / Node.js)
- [ ] Deploy read-only shadow database (mirror current JSON)

### Phase 2: Data Integrity Validation (Week 2–3)
- [ ] Validate all original JSON → normalized table mappings
- [ ] Cross-check aggregates (item means, composite scores, benchmarks)
- [ ] Compare trust ratings, prepost metrics
- [ ] Unit tests for each transformation

### Phase 3: API Deployment (Week 3)
- [ ] Deploy API endpoints (shadow read from normalized DB)
- [ ] Update frontend to fetch from API instead of static JSON
- [ ] Enable client-side caching (React Context / Redux)
- [ ] Monitor performance, data freshness

### Phase 4: Decommission JSON (Week 4)
- [ ] Archive original JSON files
- [ ] Optimize queries based on usage patterns
- [ ] Add database indexing
- [ ] Document API for external consumers

---

## Part 5: Additional Considerations

### 5.1 Multi-Study Support

Schema supports multiple studies via `study_id` foreign keys:

```javascript
// Future: Add Wave 2, Wave 3, or different studies
const studies = await fetch('/api/studies');
// Returns: [
//   { id: 'hiv-w1', name: 'PRISM HIV Wave 1', ... },
//   { id: 'hiv-w2', name: 'PRISM HIV Wave 2', ... },
//   { id: 'climate-w1', name: 'PRISM Climate Wave 1', ... },
// ]
```

### 5.2 Extensibility

**New Constructs**: Add to `SURVEY_ITEMS.construct` (tagged queries return all items for a construct).

**New Composites**: Add `COMPOSITE_SCORES` row + compute responses via aggregation function.

**New Trust Entities**: Add `TRUST_ENTITIES` row + import ratings from survey data.

**New Pre/Post Metrics**: Add `PREPOST_METRICS` row + import response percentages.

### 5.3 Weighting & Effective Sample Sizes

- **IPF (Iterative Proportional Fitting)**: Stored in `SURVEY_WEIGHTS` table
- **Design Effect**: Used to calculate effective n (`effective_n = n_raw / design_effect`)
- **Z-scores**: Computed from full-sample weighted mean + SD (stored in `COMPOSITE_RESPONSES`)

### 5.4 Versioning & Audit Trail

Each table includes `created_at`, `updated_at`, `version` fields for audit compliance:

```sql
ALTER TABLE SEGMENTS ADD COLUMN version INT DEFAULT 1;
ALTER TABLE SEGMENTS ADD COLUMN updated_by VARCHAR(255);
ALTER TABLE SEGMENTS ADD COLUMN change_reason VARCHAR(500);
```

---

## Part 6: Deliverables Checklist

- [x] **Schema Design** — Normalized tables + relationships
- [x] **API Specifications** — RESTful endpoints + response formats
- [x] **Query Patterns** — Common analytics queries documented
- [x] **Migration Strategy** — Phased rollout plan (4 weeks)
- [x] **Multi-Study Support** — Foreign keys enable future studies
- [ ] **Database Setup Script** — SQL DDL for all tables (next phase)
- [ ] **API Implementation** — FastAPI / Node.js server (next phase)
- [ ] **Data Migration Validation** — Test scripts (next phase)

---

## Next Steps

**Immediate (Week 1):**
1. Review schema with stakeholders
2. Create SQL DDL scripts
3. Set up test database environment

**Week 2–3:**
4. Build conversion scripts (JSON → normalized tables)
5. Implement API layer
6. Deploy shadow database

**Week 4:**
7. Data validation & reconciliation
8. Migrate frontend to API
9. Archive original JSON files

---

## Appendix A: Key Assumptions

1. **Study ID** uniquely identifies a study (wave + client + topic)
2. **Segments** are study-specific (same 16 codes across waves, different metrics)
3. **Trust entities** are study-specific (different entities for different topics)
4. **Pre/Post metrics** are study-specific (different questions per wave)
5. **Survey items** are study-specific (new constructs per wave)
6. **Benchmarks** are "All", "Republicans", "Democrats" (fixed)
7. **Z-scores** are always computed from full-sample weighted mean + SD
8. **Effective n** is used for all statistical inference (not raw n)

---

## Appendix B: References

- **Current Data Files**: `src/data/hiv/` (manifest.json, items.json, bench.json, trust.json, seg_data.json, zparams.json)
- **Frontend Data Layer**: `src/data/study.js` (STUDY_META, MESSAGES, STUDY_METRICS, PREPOST_METRICS)
- **Component Data Consumption**: `src/pages/SegmentProfile.jsx`, `src/pages/IdeologyHeatmap.jsx`, `src/pages/HIVTab.jsx`
- **Design Tokens**: `src/data/designTokens.js` (typography, colors, spacing)

---

**Document Version**: 1.0  
**Last Updated**: May 22, 2026  
**Status**: Ready for Implementation
