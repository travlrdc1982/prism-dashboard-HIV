# PRISM HIV Dashboard — Data Migration Guide
**Date**: May 23, 2026  
**Version**: 1.0  
**Status**: Implementation Phase  

---

## Overview

This guide explains how to migrate the PRISM HIV Dashboard from flat JSON files to a normalized relational database schema. The migration maintains full data integrity and includes comprehensive validation at every step.

---

## Prerequisites

### Software Requirements
- Python 3.8+
- SQLite 3.0+ (or PostgreSQL 12+)
- pip (Python package manager)

### Python Packages
```bash
pip install pytest  # For running validation tests
```

### Files Required
- `src/data/hiv/manifest.json` — Study metadata
- `src/data/hiv/items.json` — Survey items and responses
- `src/data/hiv/bench.json` — Benchmark composites
- `src/data/hiv/trust.json` — Trust entity ratings
- `src/data/hiv/seg_data.json` — Segment demographics
- `src/data/hiv/zparams.json` — Study parameters
- `src/data/study.js` — JavaScript study definitions

---

## Phase 1: Validation

### Step 1a: Validate Data Integrity

Run the validation suite to check all JSON files for structural and semantic errors:

```bash
cd /Users/ryanpyles/Desktop/prism-dashboard-HIV
python scripts/migrate_to_db.py --validate-only
```

**Expected Output:**
```
======================================================================
PRISM HIV Dashboard — Data Validation
======================================================================

📂 Loading data from: src/data/hiv

🔍 Validating data structure...

Validation Report
============================================================

✅ All validations passed!
```

**Common Issues:**
- Missing required fields → Fix JSON files
- Invalid data types → Check manifest.json number formats
- Inconsistent segment references → Verify all items have by_segment with keys 1-16

---

### Step 1b: Run Validation Test Suite

For comprehensive validation with detailed error reporting:

```bash
cd /Users/ryanpyles/Desktop/prism-dashboard-HIV
pytest tests/test_data_validation.py -v
```

**Output Should Show:**
- ✅ test_manifest_loaded
- ✅ test_items_loaded
- ✅ test_benchmarks_loaded
- ✅ test_validate_all
- ✅ test_segment_ids_unique
- ✅ test_item_responses_reference_valid_segments
- ✅ All 60+ tests passing

---

## Phase 2: Dry Run Conversion

### Step 2a: Preview Conversion

Test the conversion pipeline without modifying any database:

```bash
python scripts/migrate_to_db.py --dry-run
```

**Expected Output:**
```
======================================================================
PRISM HIV Dashboard — Migration Dry Run
======================================================================

📂 Loading data from: src/data/hiv

🔍 Validating data structure...

✅ Validation passed!

🔄 Converting to normalized entities...

📊 Conversion Summary:
  - Study: 1
  - Segments: 16
  - Survey Items: 68
  - Item Responses: 1088
  - Composite Scores: 10
  - Composite Responses: 30
  - Messages: 17
  - Trust Entities: 22
  - Trust Ratings: 352
  - Pre/Post Metrics: 7
  - Pre/Post Responses: 112
```

**Validation Checklist:**
- [ ] Study count: 1 ✓
- [ ] Segment count: 16 ✓
- [ ] Message count: 17 ✓
- [ ] Pre/Post metrics: 7 ✓
- [ ] Survey items > 0 ✓
- [ ] All item responses present ✓

---

## Phase 3: Generate SQL Schema

### Step 3a: Export Database Schema

Generate the complete SQL schema for your target database:

```bash
# SQLite version (recommended for development)
python scripts/migrate_to_db.py --generate-sql > schema.sql

# PostgreSQL version (for production)
python scripts/migrate_to_db.py --generate-sql --dialect=postgresql > schema_pg.sql
```

**File Created:** `schema.sql` (880+ lines)

**Inspection:**
```bash
# Count tables
grep "^CREATE TABLE" schema.sql | wc -l
# Expected: 14 tables

# View table names
grep "^CREATE TABLE" schema.sql | awk '{print $3}'
```

---

## Phase 4: Execute Migration

### Step 4a: Create Database

Execute the migration and create the database:

```bash
python scripts/migrate_to_db.py --execute --db prism_dashboard.db
```

**Expected Output:**
```
======================================================================
PRISM HIV Dashboard — Full Migration
======================================================================

📂 Loading data from: src/data/hiv

🔍 Validating data structure...

✅ Validation passed!

🔄 Converting to normalized entities...

💾 Creating database: prism_dashboard.db

  ✓ Inserted 1 study
  ✓ Inserted 16 segments
  ✓ Inserted 68 survey items
  ✓ Inserted 1088 item responses
  ✓ Inserted 10 composite scores
  ✓ Inserted 30 composite responses
  ✓ Inserted 22 trust entities
  ✓ Inserted 352 trust ratings
  ✓ Inserted 17 messages
  ✓ Inserted 7 pre/post metrics

✅ Migration complete! Database saved to: prism_dashboard.db
```

**File Created:** `prism_dashboard.db` (SQLite database file)

---

### Step 4b: Verify Database

Inspect the created database:

```bash
# Install SQLite CLI if needed
# On macOS: brew install sqlite

# Connect to database
sqlite3 prism_dashboard.db

# Inside SQLite shell:
.tables  # List all tables
SELECT COUNT(*) FROM segments;  # Should return 16
SELECT COUNT(*) FROM messages;  # Should return 17
SELECT COUNT(*) FROM prepost_metrics;  # Should return 7

.quit  # Exit
```

---

## Phase 5: Data Reconciliation

### Step 5a: Compare Original vs. Migrated Data

Create validation queries to ensure no data loss:

```bash
cat > validate_migration.sql << 'EOF'
-- Study metadata
SELECT 'STUDY' as entity, COUNT(*) as count FROM studies;

-- Segment count
SELECT 'SEGMENTS' as entity, COUNT(*) as count FROM segments;

-- Survey items by construct
SELECT construct, COUNT(*) as count FROM survey_items GROUP BY construct ORDER BY construct;

-- Trust entities by category
SELECT category, COUNT(*) as count FROM trust_entities GROUP BY category ORDER BY category;

-- Pre/Post metrics
SELECT 'PREPOST' as entity, COUNT(*) as count FROM prepost_metrics;

-- Item response coverage (% of segments with data per item)
SELECT 
  code,
  COUNT(DISTINCT segment_id) as segments_with_data,
  CAST(COUNT(DISTINCT segment_id) AS FLOAT) / 16 * 100 as coverage_pct
FROM survey_items si
LEFT JOIN item_responses ir ON si.id = ir.item_id
GROUP BY si.code
ORDER BY coverage_pct DESC;

-- Composite response coverage
SELECT 
  code,
  COUNT(DISTINCT segment_id) as segments_with_data
FROM composite_scores cs
LEFT JOIN composite_responses cr ON cs.id = cr.composite_id
GROUP BY cs.code
ORDER BY code;
EOF

# Execute validation queries
sqlite3 prism_dashboard.db < validate_migration.sql
```

**Expected Output (excerpt):**
```
STUDY|1
SEGMENTS|16
moral_values|13
disgust|10
stigma|5
PREPOST|7
CDC|4.21
... (trust ratings for each segment)
```

---

### Step 5b: Spot Check Critical Data Points

```bash
# Check focal segment (FJP - should be segment 12)
sqlite3 prism_dashboard.db "SELECT id, code, name FROM segments WHERE code = 'FJP';"
# Expected: 12|FJP|...

# Check highest-tier messages (should show top performers)
sqlite3 prism_dashboard.db "
  SELECT m.short_name, mp.score, s.code
  FROM messages m
  JOIN message_performance mp ON m.id = mp.message_id
  JOIN segments s ON mp.segment_id = s.id
  WHERE mp.rank = 1
  LIMIT 5;
"

# Check trust ratings distribution
sqlite3 prism_dashboard.db "
  SELECT 
    AVG(trust_score) as mean_trust,
    MIN(trust_score) as min_trust,
    MAX(trust_score) as max_trust
  FROM trust_ratings;
"
# Expected: mean ~4.0, min ~1.0, max ~7.0
```

---

## Phase 6: Backup & Archive

### Step 6a: Archive Original JSON Files

```bash
# Create timestamped backup
mkdir -p backups/json_$(date +%Y%m%d_%H%M%S)
cp -r src/data/hiv/* backups/json_$(date +%Y%m%d_%H%M%S)/

# Create git-tracked archive reference
git add backups/json_*/
git commit -m "Backup: Pre-migration JSON files"
```

### Step 6b: Document Migration Completion

Create a migration completion report:

```bash
cat > MIGRATION_COMPLETION_REPORT.md << 'EOF'
# PRISM HIV Dashboard — Migration Completion Report

**Date**: $(date)
**Database**: prism_dashboard.db
**Status**: ✅ COMPLETE

## Migration Statistics

| Entity | Count | Status |
|--------|-------|--------|
| Study | 1 | ✅ |
| Segments | 16 | ✅ |
| Survey Items | 68 | ✅ |
| Item Responses | 1088 | ✅ |
| Composite Scores | 10 | ✅ |
| Messages | 17 | ✅ |
| Trust Entities | 22 | ✅ |
| Pre/Post Metrics | 7 | ✅ |

## Data Integrity Checks

- ✅ All 16 segments present
- ✅ All 17 messages present
- ✅ All 7 pre/post metrics present
- ✅ 100% segment coverage for items
- ✅ Trust ratings within valid range (1-7)
- ✅ No null values in required fields
- ✅ All foreign key references valid

## Next Steps

1. Deploy API server (FastAPI / Node.js)
2. Update frontend to use API instead of JSON files
3. Run regression tests on dashboard components
4. Archive original JSON files

EOF
cat MIGRATION_COMPLETION_REPORT.md
```

---

## Troubleshooting

### Issue: "No module named 'migrate_to_db'"

**Solution:**
```bash
cd /Users/ryanpyles/Desktop/prism-dashboard-HIV
export PYTHONPATH="${PYTHONPATH}:./scripts"
python -c "from migrate_to_db import DataValidator; print('OK')"
```

### Issue: "FileNotFoundError: src/data/hiv/manifest.json"

**Solution:**
```bash
# Verify files exist
ls -la src/data/hiv/*.json

# If missing, check if data is in HIV_Persona_Profile_Tab/
ls -la HIV_Persona_Profile_Tab/*.json

# Update data_dir parameter
python scripts/migrate_to_db.py --validate-only --data-dir HIV_Persona_Profile_Tab
```

### Issue: "sqlite3.IntegrityError: NOT NULL constraint failed"

**Cause:** Missing required field in JSON data  
**Solution:**
1. Re-run validation: `python scripts/migrate_to_db.py --validate-only`
2. Fix reported issues in JSON files
3. Re-run migration

### Issue: "Validation warnings about missing segments"

**Cause:** Some items may not have responses for all 16 segments  
**Solution:**
- This is not a fatal error (warnings != errors)
- Proceed with migration
- Verify in final database that sufficient coverage exists

---

## Performance Notes

### Migration Time
- Validation: ~1–2 seconds
- Conversion: ~2–3 seconds
- Database creation: ~5–10 seconds
- **Total**: ~10–15 seconds

### Database Size
- SQLite database: ~2–5 MB (depending on index configuration)
- CSV export (if needed): ~100–200 KB

### Query Performance
- Segment lookup by code: < 1ms (with index)
- Item response by segment: < 10ms
- Trust ratings by entity: < 5ms

---

## API Integration

Once migration is complete, the API layer will query the normalized database:

```javascript
// Example: Fetch segment profile
fetch(`/api/studies/hiv-wave1/segments/12`)
  .then(res => res.json())
  .then(data => {
    // Returns normalized segment data with all relationships
    console.log(data.segment);  // Segment details
    console.log(data.messages);  // Messages for this segment
    console.log(data.survey_responses);  // Item responses
    console.log(data.trust_ratings);  // Trust data
  });
```

---

## Rollback Procedure

If migration encounters issues, rollback is simple:

```bash
# Delete database
rm prism_dashboard.db

# Re-run with fixes
python scripts/migrate_to_db.py --execute --db prism_dashboard_v2.db

# Verify before committing
sqlite3 prism_dashboard_v2.db "SELECT COUNT(*) FROM segments;"

# If successful, swap database
mv prism_dashboard_v2.db prism_dashboard.db
```

---

## Appendix: Manual Database Inspection

### Connect via SQLite CLI
```bash
sqlite3 prism_dashboard.db
```

### Useful Queries

```sql
-- List all tables
.schema

-- Check study metadata
SELECT * FROM studies;

-- List all segments
SELECT id, code, name, party, tier FROM segments ORDER BY id;

-- View item response statistics
SELECT 
  si.construct,
  COUNT(DISTINCT si.id) as item_count,
  COUNT(ir.id) as response_count
FROM survey_items si
LEFT JOIN item_responses ir ON si.id = ir.item_id
GROUP BY si.construct
ORDER BY si.construct;

-- Find items with missing segment data
SELECT 
  si.code,
  COUNT(DISTINCT ir.segment_id) as segment_coverage,
  16 - COUNT(DISTINCT ir.segment_id) as missing_segments
FROM survey_items si
LEFT JOIN item_responses ir ON si.id = ir.item_id
WHERE COUNT(DISTINCT ir.segment_id) < 16
GROUP BY si.code
ORDER BY missing_segments DESC;

-- Export segment metrics to CSV
.mode csv
.output segment_metrics.csv
SELECT * FROM segment_study_metrics;
.output stdout
```

---

## Post-Migration Checklist

- [ ] Validation passed with no errors
- [ ] Dry run showed expected entity counts
- [ ] Database created successfully (prism_dashboard.db exists)
- [ ] Reconciliation queries pass
- [ ] Spot checks confirm data accuracy
- [ ] Original JSON files backed up
- [ ] Completion report documented
- [ ] Frontend API integration planned
- [ ] Regression tests scheduled

---

**Document Version**: 1.0  
**Last Updated**: May 23, 2026  
**Status**: Ready for Implementation
