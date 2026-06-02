# Database Path: Build Fresh, Reference Ryan's

Bryan Dumont · 2026-06-03
Supersedes `docs/LEARN_FROM_RYAN.md` Tier 3 items N and O (the API
server and `migrate_to_db.py`). Keep Tiers 1 and 2 from that doc as-is.

## Correction

My last recommendation pushed the database into Tier 3 (don't adopt). That was wrong. The DB is the most consequential thing in Ryan's work and the substrate that unlocks the rest of the platform vision (multi-study, multi-wave, norms, analyst self-service). Skipping it amounts to capping the platform at one-repo-per-study indefinitely.

The risks I flagged were about **merging Ryan's branch as-is**, not about the database itself:

1. **Schema drift** — Ryan's tables predate the trust battery emission, MaxDiff cells, ROI-from-workbook, etc. that landed on main since May 13.
2. **Cutover surface** — flipping HIV from JSON-shipped to API-served while Ryan's API hasn't been validated against current data.
3. **Reconciliation overhead** — Ryan's branch is 36 commits behind / 46 ahead. Merging that diff against a moving main is multi-week conflict resolution.
4. **Test suite drift** — his pytest harness targets his `migrate_to_db.py`; doesn't cover what main does today.

All four risks come from **adopting his specific code**. None of them come from **adopting the DB approach**. If we build the API + DB ourselves on current main, every risk evaporates:

| Risk | Cause | Eliminated by building ourselves? |
|---|---|---|
| Schema drift | Ryan's tables predate current main | Yes. Our schema is designed against current data, by definition. |
| Cutover surface | Validating his code against our data | Largely. We still need byte-equality validation during transition, but no "his vs ours" reconciliation. |
| Reconciliation overhead | His branch diverged 36+46 commits | Yes. No branch to reconcile. |
| Test suite drift | His tests target his data path | Yes. We build tests against our pipeline from the start. |

The remaining work — API + DB substrate — is still real engineering effort. But it's clean engineering effort, not merge-conflict-resolution effort.

## What we adopt from Ryan (as reference, not as code)

| What | Adoption mode | Why |
|---|---|---|
| **DB schema design** (12 tables: Study, Segment, SurveyItem, ItemResponse, CompositeScore, CompositeResponse, Message, MessagePerformance, TrustEntity, TrustRating, PrePostMetric, PrePostResponse) | Reference. Use as starting point; update for current data (add MaxDiff cells, trust full-stats shape, ROI workbook overrides). | His decomposition is sound. We don't need to redesign the layering. |
| **API endpoint shape** (`/api/studies/{study_id}/...` pattern with 15 endpoints) | Reference. Match his shape so any future cross-study tooling targeting his shape works against ours. | Convention. Saves API design time. |
| **React hooks pattern** (`useFetch` wrapper, hooks per endpoint) | Reference. Copy the pattern; write hooks against our endpoints. | His pattern is correct. ~200 lines of React. |
| **`studyId` discriminator everywhere** | Adopt as principle (already in Tier 1.E of `LEARN_FROM_RYAN.md`). | This is the multi-study key. |
| **Validation at pipeline boundaries** | Adopt (already in Tier 1.D). | Pydantic on input and output. |
| **Design tokens** | Adopt (already in Tier 1.A). | Independent of DB. |
| **Code splitting** | Adopt (already in Tier 1.B). | Independent of DB. |

## What we don't take literally

| What | Why |
|---|---|
| `api/main.py` (his 346-line FastAPI server) | Built against his schema, which predates current main. Build our own from scratch in ~1 week. |
| `scripts/migrate_to_db.py` (his 1,242-line one-shot migration) | Same. We use Alembic from day 1 instead. |
| `tests/test_data_validation.py` (his 446-line test suite) | Same. We build tests against our pipeline. |
| The `refactor/phase1` branch itself | We never merge it. It stays as historical reference. |

## Corrected plan

This is the `RYAN_INTEGRATION_PLAN.md` Phases 0-8 with one substitution: where I said "cherry-pick Ryan's `api/main.py` + `migrate_to_db.py`," substitute "build our own using Ryan's as reference."

| Phase | Effort | Substance |
|---|---|---|
| **0. Decisions + setup** | 1-2 days | Six decisions (hosting, DB tech, migration tool, auth, deployment topology, messagemap pause). Branch off main. |
| **1. Safe frontend cherry-picks** | 1 week | Tier 1 from `LEARN_FROM_RYAN.md` (tokens, code splitting, env, output validator, studyId rename). Independent of DB. **Starts the day you sign off.** |
| **2. Test infrastructure** | 3-5 days | Pytest harness against current pipeline. Regression tests on the messagemap verification anchors we locked. |
| **3. Build API + DB** | 1-2 weeks | Write fresh `api/main.py` (FastAPI, study_id-discriminated endpoints, Supabase JWT verification). Define schema with SQLAlchemy + Alembic. Write migration scripts that ingest current `dashboard.json` + `src/data/hiv/*.json` + `study.js` into SQLite. Reference Ryan's schema design. **Output: API server up on Render/Railway, serving current HIV data, validated byte-equal to JSON.** |
| **4. API-driven HIV with feature flag** | 1-2 weeks | Refactor HIV pages to fetch from API. `VITE_USE_API=false` keeps JSON pathway. Run byte-equality CI gate. Flip flag in staging, validate 48-72 hours, flip in production. **Output: HIV dashboard fully API-served.** |
| **5. Multi-study container** | 1-2 weeks | Ingest AHIP + AL data into the DB (need `convert_data.py` source from you, or we write a one-shot from each repo's `study.js` + `studyData.js`). Study selector in nav. Per-user `studies_authorized` for auth scoping. **Output: one deployment serves all three studies.** |
| **6. Canonical YAML drives DB schema** | 2 weeks | Pydantic schema from messagemap work expanded per the 3-study inventory. Wire YAML changes → Alembic autogenerate migration. New study process: edit YAML, run migration, ingest data. **Output: platform becomes "add study by editing YAML."** |
| **7. Pipeline → DB writeback** | 1-2 weeks | `refresh.py` / `compute_core.py` / `extract_hiv.py` / `derive_hiv_seg_data.py` write to DB directly. JSONs become regenerable, not source of truth. **Output: no more committing 800KB dashboard.json to git.** |
| **8. Decommission JSON** | 3 days | Delete shipped JSONs. Frontend works against API only. **Output: point of no return; API is sole data path.** |
| **9. Multi-wave + history** | 2-3 weeks, later | `wave_id` columns, wave selector, side-by-side wave views, trend visualizations. |
| **10. Norms DB** | later | PRD L6: separate `prism_norms.db`, QC gate, Item Bank backfill. |

**Cumulative for Phases 0-8**: ~12 weeks of focused engineering. Same as the full-Ryan-merge plan. Difference: no merge-conflict tax, no schema-drift fix-up, no Ryan-side rebase coordination.

## Sequencing point that matters

Phases 1-2 are independent of the DB build. They can run in parallel, or before Phase 3 starts. They give you visible wins (tokens, smaller bundles, tests, output validator) within 2 weeks while the DB work is being designed.

I'd recommend kicking off both tracks simultaneously:

- **Track A** (immediate, you and I): Phase 1 PRs. Five PRs over ~1 week. You review and merge.
- **Track B** (designed first, built next): Phase 3. I lay out the schema explicitly against current data shapes. You review. We build.

This way Phase 1 is in production within 2 weeks. Phase 3 (API up alongside) lands ~6 weeks in. Phase 4 (cutover) ~8 weeks in.

## What I had wrong in the previous doc

`LEARN_FROM_RYAN.md` Tier 3 had two items I should retract:

- **N. The API server** — I said don't adopt. Correction: don't merge his code, but build our own API. Adopt the architecture.
- **O. `migrate_to_db.py`** — I said don't adopt. Correction: don't merge his 1,242-line one-shot, but use Alembic + our own ingestion scripts. Adopt the migration discipline.

The rest of `LEARN_FROM_RYAN.md` (Tier 1, Tier 2, the other Tier 3 items) stands. Tokens, code splitting, env discipline, output validator, studyId discriminator are still Phase 1 and run on the JSON-shipped path. They make the eventual DB cutover easier, not harder.

## Decisions still needed (D1-D6 from RYAN_INTEGRATION_PLAN.md)

These haven't changed. My recommendations:

| # | Decision | Recommendation |
|---|---|---|
| D1 | Hosting | Render (slightly nicer UX than Railway; ~$30-60/month for HIV-scale load) |
| D2 | DB | SQLite for v1; Postgres when concurrent writes or norms DB land |
| D3 | Migrations | Alembic (industry-standard, versioned, reviewable) |
| D4 | Auth | API verifies Supabase JWTs from the existing project |
| D5 | Deployment topology | Single domain with study selector in nav. (Subdomain-per-study is also defensible if you want to preserve per-client URL branding.) |
| D6 | Messagemap | Pause until Phase 6; canonical YAML schema work re-enters there as the DB schema contract |

## What I need from you

1. **Sign-off on this corrected plan** (or push back on specifics).
2. **Answers on D1-D6.**
3. **Confirmation that Track A (Phase 1) starts immediately** while Track B (Phase 3 design) is being scoped.

I'll start Phase 1 PR #1 (design tokens) the day you confirm. Phase 3 design starts within a week.
