# What to Learn From Ryan's Branch (Without Merging It)

Bryan Dumont · 2026-06-03
Companion to `docs/RYAN_INTEGRATION_PLAN.md` (the full-merge plan, which
you've declined). This is the slimmed-down alternative: adopt the
durable ideas, leave the substrate alone for now.

## The framing

Ryan's branch contains two kinds of value:

1. **Implementation** (the actual code, files, tables, endpoints). Risky to merge because of schema drift, API uptime dependency, and the cutover surface.
2. **Patterns and discipline** (how he thinks about data, schemas, validation, tokens, study-id, code splitting). Cheap to adopt regardless of whether we ship the implementation.

Your decision (skip the merge) closes off #1. This document focuses on harvesting #2: the architectural learnings that should reshape how we work even on the current JSON-shipped path.

The trade-off is explicit: by not adopting the API+DB substrate, we keep "dozens of studies" on a slower track. We can move toward platform-readiness via schema discipline and tokens without standing up a server. The eventual API+DB migration becomes easier later because we'll have the schemas already.

## Three tiers of adoption

### Tier 1 — Adopt now (code changes, low risk, high value)

These are specific, mergeable to main in days, no API or DB dependency.

| # | Adoption | Effort | Why now |
|---|---|---|---|
| **A** | **Design tokens file** at `src/data/designTokens.js`. Start from Ryan's structure (party colors locked, ROI = attitudes-vs-behavior split, tier traffic light + star variants, brand red). Refactor scattered constants into it as a one-time consolidation. *Don't migrate pages yet.* Just have the file. | 1 day | This is the "color schema as the first task" you flagged. Ryan's tokens already encode the right semantic split (attitudes/behavior, party-locked, tier-by-traffic-light); no need to rebuild from scratch. |
| **B** | **Route-level code splitting** in `App.jsx`. Wrap each route in `React.lazy()` and a `<Suspense>` fallback. Add a `vite.config.js` chunk split for react/react-router/supabase vendors. | 0.5 day | Initial bundle drops ~80%. Zero behavior change. Pure perf. |
| **C** | **Move remaining hardcoded values into `.env.local.example`**. We already env-drove Supabase. Sweep the rest of the dashboards-points (study domain names, branding strings, anything that varies per deployment). | 0.5 day | Cheap. Documents what each deployment needs to configure. |
| **D** | **Pipeline output validator**. Add a final step to `refresh.py` that loads the produced `dashboard.json` and validates it against a Pydantic model. Fail loudly with a precise error if any field is missing or wrong-typed. | 1 day | Catches pipeline regressions at production time rather than at React render time. The Pydantic model I wrote for `study.yaml` (messagemap/src/prism_config.py) gives us the precedent. |
| **E** | **`studyId` as a top-level field everywhere**. Rename the canonical study identifier from "HIV" to "hiv-wave1" throughout data shapes. Even though we only have one study and one wave, encode the discriminator from the start. | 1 day | Forecloses the painful retroactive rename when wave 2 lands or when AL/AHIP migrate in. |

**Total Tier 1**: ~4 days of work, all independently mergeable to main as separate PRs.

### Tier 2 — Adopt as discipline (no immediate code change; informs future decisions)

These are principles to internalize so the next batch of work moves the codebase in the right direction without explicit refactor.

| # | Principle | What it means in practice |
|---|---|---|
| **F** | **Data shapes are API-shaped, even when consumed as JSON imports.** | When defining a new data shape, ask "would this be a sensible API response?" If `data.HIV.segments` reads weird as `GET /api/HIV/segments`, reconsider. The right shape is `GET /api/studies/hiv-wave1/segments` returning a flat list of segment records. Even today the JSON file should be at `src/data/studies/hiv-wave1/segments.json`, not `src/data/studyData.js` keyed by `"HIV"`. |
| **G** | **Schemas before implementations.** | Pydantic models on the Python side, TypeScript types or JSON schemas on the React side, before we write the producers/consumers. The schema is the contract. Implementations conform to it; consumers depend only on it. This is how the messagemap canonical YAML work is structured already; extend the pattern to every data file we touch. |
| **H** | **Validation at pipeline boundaries.** | Two boundaries matter: (a) input (workbook + .sav → check before processing), (b) output (dashboard.json → check before commit). The current pipeline silently produces malformed data when, e.g., a column is missing. Make every boundary loud. |
| **I** | **Phased delivery with each phase independently shippable.** | If a PR can't merge to main and stay merged, the phase is too big. Ryan broke his work into 8 phases. Most of them landed individually on his branch. The discipline is right; the all-at-once-final-merge problem was the scoping failure. |
| **J** | **Layered data model (Study → Segment → per-segment children).** | When we add a new dimension (e.g., a new battery, a new composite, a new persona-profile tab), think about where it sits in the hierarchy. Composites belong to a study, items belong to a segment, etc. This is database thinking applied to JSON files. |
| **K** | **Multi-token / multi-arm built in.** | Ryan's `convert_study.py` already had the concept of message variants with multiple tokens. Our messagemap canonical YAML pushed that further (3-effect MaxDiff with persona-tuning and proof points). Going forward, any data shape involving messages should be multi-token aware by default, with `tokens: [base]` for studies that don't have variants. |

### Tier 3 — Don't adopt

| # | What | Why not |
|---|---|---|
| **L** | The full UI primitive library (`src/components/ui/{Badge, Button, Card, Panel, Table}.jsx`) | Each is small (~50 lines) but adopting all five plus migrating existing pages is weeks of work for marginal value at one-study scale. Build primitives as we need them, scoped to the pages we touch. Reference Ryan's versions as a starting point when we do. |
| **M** | The pytest harness as-is | His 446-line test suite tests his `migrate_to_db.py` code path, which we're not adopting. Building our own test suite against the actual pipeline (`compute_core.py`, `extract_hiv.py`, `derive_hiv_seg_data.py`, `refresh.py`) is a different scope. Worth doing, but not by importing Ryan's tests. |
| **N** | The API server (`api/main.py`) | This is the substrate we're explicitly skipping. The API+DB approach has the uptime / cutover / schema-drift risks you flagged. We may pick it up later (the eventual Phase 3+ of the integration plan); not now. |
| **O** | `migrate_to_db.py` (the 1,242-line schema generator + migration pipeline) | Same as N. The Pydantic schema work I did for messagemap is a lighter-weight expression of the same idea (schemas as contracts) without the DB. |
| **P** | The responsive CSS fixes as-shipped | Ryan targets 480/768/1024 breakpoints (full phone+tablet+desktop). Per your earlier note, the goal is **tablet-only** plus desktop. The fixes are good, but the breakpoints are wrong for your spec. If we do responsive work, tighten to 768/1024 only. |
| **Q** | The full data-migration JSONs (`messages.json`, `prepost_metrics.json` added to `src/data/hiv/`) | Some of these duplicate or conflict with what `extract_hiv.py` produces. We have a working pipeline producing the JSONs we use; don't introduce parallel JSONs that confuse the source of truth. |

## What's lost by not merging

You should know what you're giving up by deciding not to adopt the API+DB:

1. **Multi-study consolidation.** AL, AHIP, HIV stay in separate repos. The "one dashboard, three studies, study selector in nav" pattern is on hold. If the strategic goal is to scale to dozens of studies with shared infrastructure, this delay accumulates.

2. **Wave history.** Without a DB, every refresh overwrites `dashboard.json`. No native way to view "HIV wave 1 vs wave 2" once wave 2 lands. Workarounds exist (git tag the wave-1-final commit; deploy old commit as `hiv-w1.rcghealthprism.app`) but they're clunky.

3. **Cross-study comparison.** Without a DB, no native way to ask "show me MBS by segment across HIV and AHIP." Each comparison is a manual data-export exercise.

4. **Analyst self-service for new studies.** With API+DB, adding a study is "ingest workbook → migrate to DB → study selector picks it up." Without, it's "fork the repo → rebrand → swap data files → deploy." The latter is what we have today, codified in `NEW_STUDY_PLAYBOOK.md`. Works for a few studies, fragile at dozens.

5. **The norms DB pathway.** The PRD's L6 vision (longitudinal normative database that subsequent studies benefit from) requires a DB. Indefinitely postponed by skipping the API+DB.

If those costs are acceptable for the next 6-12 months, the Tier-1+Tier-2 adoption path is the right call. The substrate work waits until either (a) you decide the "dozens of studies" target is real, or (b) something else forces it (e.g., a client requires longitudinal comparison).

## What you'll get

Tier 1 alone, executed cleanly:

- **A real color schema.** The "color schema as first task" item from your earlier feedback, done. Brand-red Reservoir, party-locked red/blue, tier-traffic-light with star-rating alternative, ROI semantic split (attitudes vs behavior). Tokens file + naming convention. Lays the groundwork for the eventual dark/light theme work.
- **Smaller bundles.** Code splitting wins the same -82% Ryan saw. Page load is faster.
- **Cleaner env story.** All deployment-varying values in `.env.local.example`. Easier setup for the next study.
- **Pipeline reliability.** Output validation means broken refreshes fail loudly with a Pydantic error, not silently produce a half-rendered dashboard.
- **Wave-ready naming.** `hiv-wave1` instead of `HIV` everywhere; wave 2 doesn't need a search-replace.

Tier 2 (discipline) compounds: every PR we land going forward is automatically API-shape-aware, schema-first, validation-bracketed.

## Recommended sequence

Five small PRs over ~1 week:

| Day | PR | What |
|---|---|---|
| 1 | `feat(design): add design tokens file` | Tier 1.A. Take Ryan's tokens as starting structure, refactor into our codebase. No page migration. |
| 2 | `perf: route-level code splitting` | Tier 1.B. Lazy imports + vite manualChunks. |
| 2 | `chore(env): consolidate hardcoded deployment values` | Tier 1.C. Run alongside the perf PR. |
| 3 | `feat(pipeline): add output validator to refresh.py` | Tier 1.D. Use Pydantic. |
| 4-5 | `refactor: rename study identifier to studyId="hiv-wave1"` | Tier 1.E. Touches more files; do it last. |

All five PRs land within a week. No API stand-up, no DB migration, no risk to the live HIV dashboard.

After that, Tier 2 isn't a PR — it's the lens we use on every subsequent PR. We don't merge code that violates the discipline (e.g., adding a non-validated JSON, hardcoding a value that should be configurable, introducing a data shape that wouldn't make sense as an API response).

## Open question

The reason the API+DB substrate is the natural conclusion of the "dozens of studies" thesis is that there's no clean alternative for cross-study + multi-wave at scale. We can defer it for now, but at some point you'll need to decide:

- **Path A**: pick it up when the "dozens" target becomes concrete. Build the DB then, with the schema discipline we'll have accumulated by then.
- **Path B**: stay JSON-shipped indefinitely. Accept that scale is limited to "one repo per study, manually managed."
- **Path C**: hybrid. Build a lightweight DB (SQLite + a small read-only API) only when there's a concrete cross-study need. Not the full Render-hosted API server, just a single-process layer.

I'd recommend Path A. Path B has a ceiling. Path C is the most pragmatic middle ground if the future is uncertain. Worth deciding sooner rather than later because the schema work we're about to do (Tier 1 + Tier 2) is shaped by which path we eventually take.

## What I need from you

1. **Sign-off on Tier 1's five PRs** (~1 week of work), or feedback on which to drop/reorder.
2. **Confirm Tier 2 as the operating discipline** for subsequent work (no formal action; just the rule we use).
3. **Confirm Tier 3 stays unbuilt** (we're explicitly not doing the UI library migration, the test harness import, the API server, or the responsive-to-phone work).
4. **Pick a path (A / B / C) on the eventual API+DB question**, even if the decision is "decide next quarter." A direction beats no direction.

Phase A of the messagemap refactor stays paused; the canonical YAML schema work stays committed but inactive. Both wait for whichever path we take.
