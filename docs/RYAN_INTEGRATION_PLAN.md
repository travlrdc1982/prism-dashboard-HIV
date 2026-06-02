# Integration + Refactor Plan: Ryan's Improvements into HIV Main

Bryan Dumont · 2026-06-03
Status: pending review · supersedes prior messagemap-first sequencing

## 1. Why we're switching gears

We had Ryan's `refactor/phase1` work waiting for him to rebase against main. Main has continued moving since (trust battery, ROI restoration, MaxDiff schema, canonical YAML, sortable trust columns, Influencer header simplification, the messagemap verify work). At this point it's cleaner for us to integrate Ryan's solid pieces forward into main than to ask him to rebase 36 commits behind a moving target.

The most consequential of Ryan's contributions is the **API + database substrate**. It's the foundation the rest of the platform vision sits on: multi-study, multi-wave, normative DB, configurable from canonical YAML. Without it, every study stays a fork of a React template. With it, every study is a row in a database.

The HIV dashboard is in active client use. The plan below keeps it running through every phase. No phase requires taking the live dashboard down. The cutover from JSON-shipped to API-served happens behind a feature flag, validated against byte-equality first.

## 2. State of play

| Branch | Position | Latest commit |
|---|---|---|
| `main` | production | (today) Influencer header simplification, sortable trust columns, ROI SVG static template, MaxDiff schema, canonical YAML, messagemap verify |
| `refactor/phase1` (Ryan) | 36 commits behind, 46 commits ahead | `19ea4f2` (May 27) — env-drive API config, archive scaffolding |

The 46 commits on Ryan's side aren't 46 features. They're a build-up of phases (Phase 1 design tokens → Phase 2 UI library → Phase 3 responsive → Phase 4 component integration → Phase 5 data migration design → Phase 6 converter + validation → Phase 7 API + hooks → Phase 8 code splitting + cleanup). When integrated, the substantive output is a smaller set of features.

## 3. Inventory of Ryan's contributions

### Solid (integrate)

| Contribution | Files | Effort to integrate | Risk |
|---|---|---|---|
| **Route-level code splitting** | `src/App.jsx` (React.lazy + Suspense), `vite.config.js` (manualChunks for react/router/supabase vendors) | 1 day | Low. Pure perf win. -82% initial bundle (1125 KB → 202 KB). |
| **Design tokens** | `src/data/designTokens.js` | 0.5 day | Low. Adds a tokens file; doesn't force migration. |
| **UI component library** | `src/components/ui/{Badge,Button,Card,Panel,Table}.jsx` + `index.js` | 1 day to land; weeks of optional migration of existing pages | Low to add; medium if we adopt incrementally. |
| **Responsive CSS fixes** | AudienceROI sticky scroll fix; SegmentProfile grid stacking; HIVTab fluid layout; IdeologyHeatmap clamp() typography (breakpoints at 480/768/1024px) | 1 day | Low. Already proven by Ryan. Note: targets phone-sized screens too; per your earlier feedback, you wanted *tablet-only* responsive. Easy to tighten. |
| **Pytest harness** | `tests/test_data_validation.py` (446 lines, 6 test classes) | 0.5 day to wire | Low. Adds a safety net. Tests need updating after our trust/derive/refresh additions. |
| **Multi-token messages** in convert_study.py | `convert_study.py` | 0.5 day to compare against `extract_hiv.py` | Low. Forward-looking; aligns with the persona-tuning work we just modeled in canonical YAML. |
| **`api/main.py`** FastAPI server | 346 lines, 15 endpoints | 2 days to stand up + adapt schema | Medium. Schema needs to absorb the trust + ROI + MaxDiff additions main has made since. |
| **`scripts/migrate_to_db.py`** | 1,242 lines: DataLoader, DataValidator, DataConverter, SQLSchemaGenerator, MigrationPipeline, CLI | 1-2 days to align with current data | Medium. Same schema reconciliation as above. |
| **React hooks for API** | `src/hooks/useStudyData.js` (12 hooks: useSegments, useSegmentProfile, useMessages, useSurveyItems, useComposites, useTrustRatings, useBenchmarks, useItemsFull, useTrustFull, useSegData, useManifest, useStudy) | 0.5 day to wire | Low. Stand alone; only used when API is online. |
| **Env-driven API config** | `VITE_API_BASE`, `VITE_STUDY_ID` in `.env.local.example` | 0.5 day | Low. |

### Drop (already on main or known dead)

- `compute_core_FIXED.py`, `dashboard_template_FIXED.html`, `prism_hiv_dashboard_FIXED.py`, `PRISM_HIV_Topline (1).html` (PR #34 already deleted these)
- `src/components/Topline/ToplineDashboard/dashboard.json`, `results_long.csv` (PR #34 already gitignored)
- `md_to_docx.py` (utility, no clear callers)
- Most `*_REPORT.md`, `*_SUMMARY.md`, `PHASE_*` docs (archive scaffolding; Ryan moved them to `docs/archive/` himself in `19ea4f2`)

### Reconcile (overlapping changes)

Files where Ryan and main both made substantive changes; need merge work:

| File | Ryan changed | Main changed | Resolution |
|---|---|---|---|
| `src/App.jsx` | React.lazy + Suspense (code splitting) | Invite-link admin route, BYPASS_AUTH=false, SetPassword routing | Both compatible. Apply Ryan's lazy wrapper around our existing routes. |
| `src/components/Shell.jsx` | Design-token migration (Login + Shell + AudienceROI per `d115dc2`) | ADMIN nav link gated on email allowlist | Apply Ryan's tokens to our markup. |
| `src/components/Topline/Topline.jsx` | (unknown, need to diff) | sortable trust columns, ROI render, Banner-full toggle, Data Inspector, mean-shading | Likely small from Ryan; large from main. Take main wholesale, apply Ryan's tokens. |
| `src/pages/AudienceROI.jsx` | Responsive sticky scroll fix + design tokens | (no big changes since Ryan cloned) | Take Ryan's wholesale. |
| `src/pages/HIVTab.jsx` + `.css` | Wired to API hooks, responsive | Faithful port preserved, SCF orientation, bubble sizing, segment nav | Hardest conflict. Take main's data path, layer Ryan's API hooks behind a feature flag, keep main's SVG positioning. |
| `src/pages/SegmentProfile.jsx` | Removed inline PREPOST + STUDY_ROI duplicates, design tokens | (only minor) | Take Ryan's wholesale. |
| `src/pages/MessageMap.jsx` | API hooks | (only minor changes since Ryan cloned) | Take Ryan's wholesale, with feature-flag fallback. |
| `src/pages/IdeologyHeatmap.jsx` | clamp() typography + responsive | (none) | Take Ryan's wholesale. |
| `src/components/Topline/ToplineDashboard/compute_core.py` | (need to diff) | trust battery emission, ROI cleanup, date overflow fix, UTF-8 fixes, MaxDiff cells via messagemap | **Take main wholesale.** Ryan's branch predates the trust + MaxDiff work; his compute_core is missing it. |
| `src/data/hiv/*.json` and `src/data/topline/dashboard.json` | (refreshed against his pipeline state) | (refreshed against current pipeline) | Take main wholesale. These are pipeline outputs. |
| `src/data/studyData.js` | Removed the 970-line HIV nested block (left a 16-segment skeleton) | (matches Ryan's approach) | Already converged. |
| `extract_hiv.py` | (minor) | UTF-8 fixes | Take main's. |

## 4. Decision gates (before we start)

Six questions. Each blocks a phase if unresolved.

| # | Decision | Recommended | Why |
|---|---|---|---|
| **D1** | **Hosting target for the API + DB** | Render or Railway (~$30-80/month) to start, with the option to upgrade to AWS / Fly later | Both have free tiers good enough for HIV traffic. Render is slightly more polished UX, Railway is slightly cheaper. Either works. |
| **D2** | **DB technology** | SQLite for v1, Postgres for v2 (once concurrent writers matter) | SQLite is one file, fits Render's persistent disk model, zero ops. Switch to Postgres when we have multiple analysts writing concurrently or norms DB lands. |
| **D3** | **Schema migration tool** | Alembic | Industry-standard for SQLAlchemy. Versioned migrations, reviewable diffs. Ryan's `migrate_to_db.py` is a one-shot; Alembic generalizes it. |
| **D4** | **Auth model on the API** | API verifies Supabase JWTs from the same project that gates the dashboard | Preserves single source of identity. Don't bifurcate user accounts. |
| **D5** | **Multi-study deployment topology** | (a) Single domain with study selector in nav (cleanest), OR (b) Subdomain per study (`hiv.rcghealthprism.app`, `al.rcghealthprism.app`, `ahip.rcghealthprism.app`) with API serving all three | I lean (a). (b) preserves the current per-study domain pattern but multiplies deployment surface. Need your call. |
| **D6** | **What to do with the messagemap canonical YAML work** | Park it. Resume in Phase 6 once the API + DB substrate is in place; that's where the YAML naturally drives schema | The work isn't lost; the Pydantic models become the contract between YAML and DB. But finishing them before we have a DB to constrain is premature. |

## 5. Integration plan: phases

Each phase is independently shippable and doesn't require the next one to be useful.

### Phase 0 — Discovery + decisions (1-2 days)

- This document, plus your answers to D1-D6.
- Confirm hosting account exists.
- Confirm we're not breaking client commitments (HIV stays live, AHIP stays live, AL stays live).
- Branch off main as `claude/integrate-ryan` for everything that follows.

### Phase 1 — Safe frontend cherry-picks (1 week)

Three independent PRs, each mergeable to main, no API dependency.

1. **PR-1.1: Route-level code splitting.** Apply Ryan's `App.jsx` lazy wrapper + `vite.config.js` manualChunks. Verify build size dropped. Verify all routes still navigate. ~1 day.
2. **PR-1.2: Design tokens import.** Add `src/data/designTokens.js`. Add `src/components/ui/{Badge,Button,Card,Panel,Table}.jsx`. Don't migrate any existing pages yet; this is the substrate. ~0.5 day. Independently, build a 5-minute tokens-and-components Storybook page at `/_design` to preview them.
3. **PR-1.3: Responsive CSS fixes.** Apply Ryan's AudienceROI sticky-scroll + SegmentProfile grid stacking + IdeologyHeatmap clamp() typography + HIVTab fluid layout. *Tighten breakpoints to tablet-only per your earlier note.* ~1-2 days.

### Phase 2 — Test infrastructure (3-5 days)

- Bring in `tests/test_data_validation.py` and `tests/test_convert_messages.py`.
- Update tests against current main's pipeline (Ryan's tests predate trust battery emission).
- Add regression tests for the messagemap verification we did (the 11 scalar anchors at exact equality + 2,302-cell byte-identity).
- Wire a CI hook (`.github/workflows/test.yml`) so PRs run tests automatically.

### Phase 3 — API skeleton stood up alongside (1 week)

- Reconcile Ryan's `api/main.py` against current data shapes (add trust + MaxDiff endpoints where missing).
- Reconcile Ryan's `scripts/migrate_to_db.py` against current data (add tables for trust ratings with the new full-stats shape, MaxDiff cells, message-map cells if we want).
- Replace `migrate_to_db.py` one-shot with Alembic migrations.
- Stand up on Render/Railway behind a private URL.
- Run migration: current `src/data/topline/dashboard.json` + `src/data/hiv/*.json` + `src/data/study.js` → SQLite.
- Verify API responses byte-equal the JSON they replaced.
- Deploy alongside, **do not** wire the dashboard to it yet.

### Phase 4 — API-driven HIV (1-2 weeks)

- Refactor `HIVTab.jsx` to use API hooks (Ryan's pattern). Keep JSON fallback behind a `VITE_USE_API` flag.
- Same for `AudienceROI.jsx`, `SegmentProfile.jsx`, `MessageMap.jsx`.
- Wire Supabase JWT verification into the API (every endpoint checks `Authorization: Bearer <jwt>` against the Supabase project's JWKS).
- Build automated comparison harness: for every endpoint, hit it with API + read the equivalent JSON, diff. Fail the deploy if non-equal.
- Flip `VITE_USE_API=true` in HIV staging, validate.
- Flip in production once stable for 48 hours.
- This is the cutover. After it, the dashboard depends on the API being up. Have a rollback path documented (flip the env var back).

### Phase 5 — Multi-study container (1-2 weeks)

- Ingest AL data into the DB (via `convert_data.py` once you give us the source, or by writing a one-shot ingester from the AL repo's `study.js`).
- Ingest AHIP (ESI + MA as separate study_id rows) into the DB.
- Build study selector UI (probably in `Shell.jsx` — dropdown that updates `VITE_STUDY_ID` in URL state).
- Per D5: single deployment with study selector, or three deployments hitting the same API.
- Auth scoping: per-user `studies_authorized` list; clients see only their study.

### Phase 6 — Canonical YAML drives the DB schema (2 weeks)

- This is where the messagemap work re-enters.
- Expand the Pydantic `StudyConfig` schema per the 3-study inventory I just produced.
- Wire `prism_config.py` as the schema source for Alembic migrations: YAML changes → Alembic autogenerates migration → review → apply.
- New study process: hand-author YAML (Excel sheet → YAML sync still future), run migration, run data ingester.
- This is the moment the platform becomes "add a study by editing one file" rather than "fork the codebase."

### Phase 7 — Pipeline → DB writeback (1-2 weeks)

- Modify `refresh.py` / `compute_core.py` / `extract_hiv.py` / `derive_hiv_seg_data.py` to write directly to the DB instead of to JSON files.
- The Python pipeline becomes a DB writer, not a JSON producer.
- Refresh becomes: analyst drops new `.sav`, runs `refresh.py --commit`, data flows to DB, API serves it, dashboard refreshes.
- No more committing 800-KB `dashboard.json` to git.

### Phase 8 — Decommission JSON files (3 days)

- Delete `src/data/topline/dashboard.json`, `src/data/hiv/*.json`, `studyData.js`, `study.js`.
- Build verifies the front-end works against API only.
- This is the point of no return; once JSON is gone, the API is the only data path.
- Vercel build size drops significantly (JSON files are gone, code-splitting already in place).

### Phase 9 — Multi-wave + history (2-3 weeks, after MVP stabilizes)

- Add `wave_id` / `collected_at` columns to all study-data tables.
- Wave selector in UI.
- Side-by-side wave comparison views (HIV wave 1 vs HIV wave 2).
- Trend visualizations.

### Phase 10 — Norms DB (separate from study DB) (later)

- Implement PRD L6 `prism_norms.db` for cross-study normative comparisons.
- QC gate UI for promoting wave data into norms.
- Item Bank backfill (each fielded item with stable item_id becomes a norms entry).
- This is when the platform crosses from "multi-study dashboard" to "longitudinal research platform."

## 6. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| API server goes down → dashboard breaks | Medium | High | Keep `VITE_USE_API` feature flag through Phase 4. Fallback to JSON-shipped data if API unreachable. Decommission JSON only in Phase 8 after API has proven stable for 30+ days. |
| Schema drift between Ryan's tables and current data shape | High | Medium | Phase 3 is explicitly the schema-reconciliation phase. Don't deploy API to Phase 4 until automated diff confirms API == JSON for every cell. |
| Ryan's PR cherry-picks conflict with our main edits | Medium | Low | Phase 1 PRs are small enough that hand-resolution is fine. The harder conflicts (HIVTab.jsx) get explicit reconcilation effort in Phase 4. |
| Bootstrap reproducibility breaks when moving to DB | Low | Medium | We've verified seed=42 is fully deterministic. Don't change loop order or pandas groupby ordering during the DB writeback refactor (Phase 7). Lock in regression tests before changing pipeline code. |
| Multi-study auth complexity (per-user study scoping) | Medium | Medium | Phase 5 includes the auth-scoping work. Use Supabase user metadata (`studies_authorized: ["hiv-wave1", "al-wave1"]`) as the gating mechanism. Keep simple. |
| Test suite goes stale (Ryan's tests don't know about trust or MaxDiff) | High | Low | Phase 2 is the test-update phase. Budget 2-3 days for adding tests for the post-Ryan additions. |
| Bryan-side decision lag on D1-D6 blocks the whole sequence | High | High | This document is structured to make decisions easy. If D1-D6 stall, Phase 1 can still start (it's API-independent). |
| The canonical YAML expansion drags past Phase 6 | Medium | Medium | The expansion has clear scope from the 3-study inventory. Time-box it. If it slips, decouple from Phase 6 and ship the API+DB without YAML-driven schema first; layer YAML in later. |

## 7. How this interacts with the messagemap refactor

The messagemap canonical YAML and Pydantic models I produced last week aren't lost work. Their natural home is:

- **Phase 6** uses the Pydantic schema as the input to Alembic migrations. The YAML schema and the DB schema converge.
- **Phase 7** uses the schema's `pipeline.workbook_ingest` and `composites[]` blocks to drive the pipeline's DB writes.
- The MaxDiff/persona/proof-point schema additions become the contract for how message-test data is stored.

Practically, this means:
- **Pause** Phase A of the messagemap refactor (the rename function and downstream work).
- **Keep** the Pydantic schema work I've already done.
- **Resume** as part of Phase 6 above, with the expansion from the 3-study inventory applied.

The verify harness (`messagemap/verify/`) stays in place per its lifecycle docstring; it becomes deletable when Phase B step 8 of the messagemap refactor lands, which is now Phase 6+ of this plan.

## 8. Effort summary

Cumulative work for the platform refactor:

| Phase | Effort | Cumulative |
|---|---|---|
| 0. Discovery + decisions | 1-2 days | 2 days |
| 1. Safe frontend cherry-picks | 1 week | 9 days |
| 2. Test infrastructure | 3-5 days | 2.5 weeks |
| 3. API skeleton + data migration | 1 week | 3.5 weeks |
| 4. API-driven HIV with feature flag | 1-2 weeks | 5 weeks |
| 5. Multi-study container | 1-2 weeks | 7 weeks |
| 6. Canonical YAML drives DB schema | 2 weeks | 9 weeks |
| 7. Pipeline → DB writeback | 1-2 weeks | 11 weeks |
| 8. Decommission JSON | 3 days | 11.5 weeks |
| 9. Multi-wave + history | 2-3 weeks | 14 weeks |
| 10. Norms DB | later | — |

Roughly **12 weeks of focused engineering for Phases 1-8** (production-ready multi-study, YAML-driven, API+DB platform). Add 3 weeks for multi-wave. Norms is open-ended.

## 9. Recommended first move

If you sign off on this plan:

**Today**:
- Answer D1-D6 (or flag which need more discussion).
- Create the `claude/integrate-ryan` branch off main.
- Open three placeholder PR titles (Phase 1.1, 1.2, 1.3) so the work surface is visible.

**Tomorrow** (Phase 1.1):
- Cherry-pick Ryan's `d0abc4a` (code splitting). Adapt to current `App.jsx`. Open PR.

After 1.1 lands, 1.2 and 1.3 can run in parallel. Phase 2 (tests) starts as soon as Phase 1 is in.

The first three weeks of this plan ship visible value (smaller bundles, design system, responsive, tests) without committing to the bigger API+DB direction. That's intentional: gives you and Ryan room to validate the direction is right before we're past the rollback horizon.

## 10. What I need from you to start

1. **Sign-off on this plan** (or substantive pushback on the phasing).
2. **Decisions on D1-D6.**
3. **Confirmation that the messagemap work pauses** (Pydantic schema and inventory stay committed; Phase A of the refactor halts).
4. **Confirmation of the cutover gate for Phase 4**: my proposal is "API == JSON byte-equal for 30 consecutive days + automated diff in CI before we flip `VITE_USE_API=true`." If that's too tight or too loose, say.

Once those are in, Phase 1 starts.
