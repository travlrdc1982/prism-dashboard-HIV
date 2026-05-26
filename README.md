# PRISM HIV Treatment & Prevention Dashboard

Client-facing dashboard for the HIV Treatment & Prevention study (Gilead, May 2026), built on the PRISM 16-segment audience-intelligence frame.

## Stack

React 19 + Vite, deployed to Vercel. Auth via Supabase.  
API: FastAPI + SQLite (local dev) — see **Running the API server** below.

## Architecture

```
src/data/hiv/*.json  →  scripts/migrate_to_db.py  →  prism_dashboard.db
                                                           ↓
                                                     api/main.py  (FastAPI, port 8000)
                                                           ↓
                                              src/hooks/useStudyData.js
                                                           ↓
                                                   React components
```

**Static data files** (canonical, unchanged across studies):
- `src/data/segments.js`, `ideology.js`, `vectors.js`, `trust.js`, `experiential.js`
- `src/data/studyData.js` — 16-segment skeleton
- `src/data/study.js` — study-specific layer (messages, metrics, tier config)

**HIV study source data** (`src/data/hiv/`):
| File | Contents |
|------|----------|
| `manifest.json` | Study metadata (n, effective n, weighting info) |
| `seg_data.json` | Per-segment composite scores and ranks |
| `items.json` | Survey items with per-segment and benchmark means |
| `bench.json` | Benchmark group means (All / Republicans / Democrats) |
| `trust.json` | Trust entity scores per segment and benchmark |
| `messages.json` | MaxDiff message definitions |
| `prepost_metrics.json` | Pre/post question metadata |
| `zparams.json` | Z-parameter seeds used in segment construction |

**Database** (`prism_dashboard.db`, SQLite):  
14 tables — studies, segments, survey_items, item_responses, composite_scores, composite_responses, messages, message_performance, trust_entities, trust_ratings, prepost_metrics, prepost_responses, segment_demographics, segment_study_metrics.

## Local development

### 1. Install dependencies

```bash
npm install
pip3 install fastapi uvicorn
```

### 2. Start the API server

```bash
python3 -m uvicorn api.main:app --reload --port 8000
```

The API serves at `http://localhost:8000`. Key endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /api/studies/hiv-wave1/segments` | All 16 segments |
| `GET /api/studies/hiv-wave1/segments/{code}` | Full segment profile |
| `GET /api/studies/hiv-wave1/messages` | All 17 MaxDiff messages |
| `GET /api/studies/hiv-wave1/benchmarks` | Composite benchmark means |
| `GET /api/studies/hiv-wave1/seg-data` | All-segment composite scores |
| `GET /api/studies/hiv-wave1/items-full` | Survey items with all segment means |
| `GET /api/studies/hiv-wave1/trust-full` | Trust entities with all segment scores |
| `GET /api/studies/hiv-wave1/manifest` | Study metadata |
| `GET /health` | Health check |

Interactive API docs: `http://localhost:8000/docs`

### 3. Start the React dev server

```bash
npm run dev
```

Dashboard runs at `http://localhost:5173`. **Both servers must be running** for the HIV tab to load data.

## Running tests

```bash
pip3 install pytest
python3 -m pytest tests/ -v
```

40 tests covering DataLoader, DataValidator, DataConverter, data integrity, data quality, and migration completeness.

## Rebuild the database

If source JSON files change:

```bash
# Validate only
python3 scripts/migrate_to_db.py --validate-only

# Dry run (shows entity counts)
python3 scripts/migrate_to_db.py --dry-run

# Execute (overwrites prism_dashboard.db)
python3 scripts/migrate_to_db.py --execute --db prism_dashboard.db
```

## Refresh data from the workbook

```bash
python extract_hiv.py
```

Regenerates `src/data/study.js` and the `HIV` block of `src/data/studyData.js`.

## Routes

| Path | Page |
|------|------|
| `/` | SegmentMap (bubble map) |
| `/roi` | AudienceROI scorecard |
| `/messages` | MessageMap |
| `/profile` | SegmentProfile deep-dive (includes HIV tab) |

## Known gaps / future work

- **Benchmark trust means** not in DB — served from `trust.json` via API bridge endpoint. A future migration pass should store weighted benchmark means in `trust_ratings` with `segment_id = NULL`.
- **Per-segment composite z-scores** not in DB — served from `seg_data.json` bridge endpoint. Future: store in `composite_responses`.
- **`message_performance`** table is empty — MaxDiff ranking scores not yet available in source JSON. Populate when wave-2 scoring is complete.
- **`prepost_responses`** table is empty — pre/post response data not yet available. Populate after fieldwork completion.
