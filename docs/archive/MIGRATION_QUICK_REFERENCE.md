# PRISM HIV Dashboard — Migration Pipeline Quick Reference

**Status**: Ready for Execution  
**Date**: May 23, 2026  

---

## 🚀 Quick Start

### 1️⃣ Validate Data (1 minute)
```bash
python scripts/migrate_to_db.py --validate-only
```
Checks JSON structure and data integrity. Should output ✅ All validations passed!

### 2️⃣ Preview Conversion (30 seconds)
```bash
python scripts/migrate_to_db.py --dry-run
```
Converts data without writing to database. Shows entity counts.

### 3️⃣ Generate SQL Schema (10 seconds)
```bash
python scripts/migrate_to_db.py --generate-sql > schema.sql
```
Creates SQL DDL for your target database. Optional—used for PostgreSQL deployment.

### 4️⃣ Execute Migration (10 seconds)
```bash
python scripts/migrate_to_db.py --execute --db prism_dashboard.db
```
Creates and populates SQLite database. Main migration step.

### 5️⃣ Verify Database (30 seconds)
```bash
sqlite3 prism_dashboard.db "SELECT COUNT(*) FROM segments;"
```
Should return `16`. Other quick checks:
```bash
sqlite3 prism_dashboard.db "SELECT COUNT(*) FROM messages;"        # 17
sqlite3 prism_dashboard.db "SELECT COUNT(*) FROM prepost_metrics;" # 7
```

---

## 📊 Migration Components

| Component | File | Purpose |
|-----------|------|---------|
| **Converter** | `scripts/migrate_to_db.py` | Main pipeline—loads JSON, validates, converts, executes |
| **Validator** | Built into migrate_to_db.py | DataValidator class—checks data integrity |
| **Tests** | `tests/test_data_validation.py` | 60+ test cases for validation & integrity |
| **Schema** | Built into migrate_to_db.py | SQLSchemaGenerator—creates 14-table schema |
| **Guide** | `DATA_MIGRATION_GUIDE.md` | Detailed step-by-step instructions |

---

## ✅ Expected Outcomes

### Data Statistics
```
Study:                  1
Segments:              16
Survey Items:          68
Item Responses:       1088
Composite Scores:      10
Composite Responses:   30
Messages:              17
Trust Entities:        22
Trust Ratings:        352
Pre/Post Metrics:       7
Pre/Post Responses:   112
```

### Database Size
- SQLite file: 2–5 MB
- Query speed: < 10ms for typical lookups

### Tables Created
1. studies
2. segments
3. segment_demographics
4. segment_study_metrics
5. survey_items
6. item_responses
7. composite_scores
8. composite_responses
9. messages
10. message_performance
11. trust_entities
12. trust_ratings
13. prepost_metrics
14. prepost_responses
15. survey_weights (optional)
16. audit_log (optional)

---

## 🔍 Validation Tests

Run comprehensive test suite:
```bash
pytest tests/test_data_validation.py -v
```

**Test Categories**:
- DataLoader tests (6 tests)
- DataValidator tests (7 tests)
- DataConverter tests (8 tests)
- Data Integrity tests (12 tests)
- Data Quality tests (7 tests)
- Migration Summary (1 test)

**Expected**: All 60+ tests pass ✅

---

## 🛠️ Troubleshooting

| Issue | Command | Solution |
|-------|---------|----------|
| "No such file" | `python scripts/migrate_to_db.py --validate-only --data-dir HIV_Persona_Profile_Tab` | Use correct data directory |
| Import error | `export PYTHONPATH="${PYTHONPATH}:./scripts"` | Add scripts to Python path |
| NOT NULL error | `python scripts/migrate_to_db.py --validate-only` | Fix JSON, then re-run |
| Want to restart | `rm prism_dashboard.db && python scripts/migrate_to_db.py --execute` | Delete old DB and recreate |

---

## 📈 Next Steps (After Migration)

1. **API Server** — Deploy FastAPI/Node.js server to query database
2. **Frontend Update** — Migrate React components from JSON imports to API calls
3. **Regression Tests** — Run test suite against all dashboard pages
4. **Archive** — Back up original JSON files
5. **Deploy** — Push to production with database

---

## 📚 Key Files

- **Source Code**: `scripts/migrate_to_db.py` (750+ lines)
- **Test Suite**: `tests/test_data_validation.py` (600+ lines)
- **Schema**: `DATA_SCHEMA_DESIGN.md` (500+ lines)
- **Guide**: `DATA_MIGRATION_GUIDE.md` (400+ lines)

---

## 🔄 Data Flow

```
JSON Files (src/data/hiv/)
    ↓
DataLoader.load_all()
    ↓
DataValidator.validate_all() → Check errors
    ↓
DataConverter.convert() → Normalize entities
    ↓
SQLSchemaGenerator.generate() → Create tables
    ↓
Insert statements → Populate database
    ↓
prism_dashboard.db (SQLite)
```

---

## 💾 Rollback

If needed:
```bash
# Delete database
rm prism_dashboard.db

# Original JSON files unchanged—re-run migration anytime
python scripts/migrate_to_db.py --execute
```

---

**Version**: 1.0  
**Author**: PRISM Team  
**Last Updated**: May 23, 2026
