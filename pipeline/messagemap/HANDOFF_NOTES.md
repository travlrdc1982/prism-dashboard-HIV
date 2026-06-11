# PRISM Handoff Notes

This document captures everything Claude Code will need to pick up the work and ship it cleanly. It assumes you've read the README and the code; this fills in the **why** behind the **what**.

---

## Part 1 — The architectural picture

### Two sources of truth

PRISM separates content from configuration. Get this right and the platform scales; conflate them and it doesn't.

**The workbook is the content source of truth.** It contains the message library: theme labels, tokens (proof variants), CORE text, 16 persona-tuned variants per (message, token). Analyst authors it in Excel. Every row is self-describing: composite primary key `(msg_id, token)`, no positional inference required.

**The YAML is the analytical configuration source of truth.** It declares estimator settings, lift variants, baskets, output paths, file locations, the legacy-rename map (for ingesting the existing HIV .sav), and the per-study segment bindings (priority tier, oversampling). It does NOT redeclare anything the workbook owns.

**The .sav contains exposure metadata only.** No message text. Per-respondent integer codes for `persona_framing`, `M{NNN}_token`, `XSEG_ASSIGNED`, `design_version`, plus task picks and the persuasion index items. Variant text is joined in at analysis time from the workbook.

### The canonical variable naming convention

Adopted to make the platform work across studies without per-study code edits:

```
persona_framing              1 = PERSONA arm, 2 = CORE arm
XSEG_ASSIGNED                segment id 1..16
design_version               MaxDiff design version assigned
M{NNN}_token                 0 = base shown; 1..K = token variant for message NNN
                             (variable absent → message has no token variants)
task{NN}_best                msg_id of best pick on task NN
task{NN}_worst               msg_id of worst pick
idx{NNN}_pre / idx{NNN}_post pre/post item NNN in the persuasion index
```

For the existing HIV study, the .sav uses legacy names. The `legacy_rename` block in `study.yaml` maps them. New studies get fielded with canonical names from the start.

### The persona derivation rule

Persona is **derived**, not stored. At analysis time:

```python
persona = np.where(df['persona_framing'] == 1, df['XSEG_ASSIGNED'], 0)
# Result: 1..16 in PERSONA arm (the segment-tuned variant shown)
#          0     in CORE arm    (no persona; everyone sees CORE text)
```

This was an explicit cleanup decision — earlier drafts had `M{NNN}_persona` variables per message, but they would have been 17-fold redundant duplications of `persona_framing × XSEG_ASSIGNED`.

---

## Part 2 — The cell estimator, fully specified

This is the math at the core of the dashboard. Every cell in the message map is one number computed this way.

### For each cell (message m, segment s, persona-framing arm a, token t):

**Step 1: raw engagement-weighted shift**

```
sum_signed = Σ (residual_shift_i × bw_score_im)     where i ∈ cell
sum_abs    = Σ |bw_score_im|                        where i ∈ cell

lift_raw = sum_signed / sum_abs                     (if sum_abs > 0; else NaN)
```

`residual_shift_i` is respondent i's residualized post-pre composite shift (from step 2). `bw_score_im` is i's Best-Worst score for message m across their 14 tasks (range -4 to +4 in practice, theoretical max ±14).

Signed B-W in numerator means "engagement direction × movement direction = signal." Absolute B-W in denominator means weight = engagement intensity regardless of direction. The ratio is in residualized-index-point units (same scale as the 1-7 composite).

**Step 2: empirical Bayes shrinkage**

```
sigma_within  = mean(within-cell SD of residual_shift, across cells)
sigma_between = SD(cell_raw_value − message_marginal, across cells)

w = (n / sigma_within²) / (n / sigma_within² + 1 / sigma_between²)
lift_shrunk = w × lift_raw + (1 − w) × message_marginal
```

Thin cells get pulled toward the message's overall mean (the best estimate when cell-specific information is unreliable). Large cells retain their raw value. The shrinkage weight `w` is exposed in the JSON for diagnostics.

**Step 3: bootstrap confidence intervals**

```
For b in 1..500:
    Resample respondent IDs with replacement (n_recs)
    Recompute lift_raw → lift_shrunk on the bootstrap sample
    Record the shrunken value for each cell
CI = [2.5th percentile, 97.5th percentile] across the 500 bootstrap estimates
```

This naturally captures sampling uncertainty plus the contribution of shrinkage uncertainty itself. Significance rule: CI strictly excludes zero.

### Why this estimator over alternatives

Considered and rejected:

- **Simple group difference** (mean lift among likers minus mean lift among dislikers): loses the continuous B-W signal; treats a respondent with bw=+4 the same as bw=+1.
- **Full regression specification** (residual_shift ~ bw × segment × arm × token + FE): more rigorous in theory but requires specification choices that affect interpretability; the engagement-weighted approach is regression-equivalent under simple identifying assumptions.
- **Posterior predictive (full Bayesian model)**: would give exact uncertainty but adds 100× compute cost; bootstrap captures the relevant uncertainty for v1.

The chosen estimator is statistically defensible, computationally tractable, and produces values in interpretable units. It does what an analyst needs without overclaiming precision.

---

## Part 3 — The two outcomes

The dashboard has a toggle: PERSUASION MESSAGING / BASE MESSAGING. Same cell structure, different dependent variable.

### PERSUASION MESSAGING (default)

Outcome: `residual_shift` = post_composite − E[post_composite | pre_composite, segment]

This is "movement above what segment baseline would predict." Already zero-centered by construction (mean residual within each segment ≈ 0 by OLS properties).

Cell value: how much exposure to this variant produces marginal lift in attitudinal alignment.

Operational use: paid media allocation. "Where will spending money produce attitudinal movement."

### BASE MESSAGING

Outcome: `pre_composite − mean(pre_composite | segment)` = pre-composite, centered by segment mean

Cell value: how much MORE aligned the engagers of this variant are than their segment's baseline.

Operational use: owned-channel content. "What your supporters already love, what to put in fundraising email subject lines, what NOT to put in front of skeptics."

### Why the centering matters

If you weight raw `pre_composite` by signed B-W without centering, you get nonsense — the mean of pre_composite is non-zero (≈4.1 on the 1-7 scale), so even with no engagement signal at all, you'd see large positive cell values from the constant. Centering by segment mean strips the constant out so the cell value is meaningful: "alignment deviation among engagers, relative to segment baseline."

This was a design discovery, not an obvious choice. Worth being explicit about in code comments.

---

## Part 4 — The substantive findings from the HIV run

These are real findings from running the pipeline on real data. They serve two purposes: confirm the engine produces sensible results, and demonstrate the kind of insights the dashboard surfaces.

### The polarizing-message paradox

Msg 13 (Southern epidemic) and Msg 16 (Racial disparity) have the most negative full-sample marginal B-W. Aggregated across everyone, people reject these messages on average.

But these same messages produce the strongest priority-segment cells. Msg 16 × UCP × PERSONA × token 2 = +0.21 with CI [+0.05, +0.31] (significant). Msg 13 × FJP × PERSONA × token 1 = +0.17 with CI [+0.01, +0.30] (significant).

**A traditional SoP-only dashboard would have rejected these messages on marginal preference. The cell-level view recovers their segment-specific value.** This is the platform thesis at its sharpest.

### Tuning is selective, not universal

PERSONA-vs-CORE differences at each segment's optimal token:

```
Segment   Mean      75th pctile    Operational read
TSP      -0.018     +0.069         Skip tuning, save creative budget
HF       -0.008     +0.046         Skip tuning; proof matters more
HHN      +0.010     +0.134         Tune carefully — helps best, hurts worst
UCP      +0.006     +0.059         Two-message strategy (disparity + global health)
FJP      +0.014     +0.081         Most "tunable" priority
HCP      +0.019     +0.041         Broad receptivity, small effects
GHI      -0.009     +0.065         Distinct lane (responds where others reject)
```

No segment has a large mean tuning effect. **No segment is a "tuning lifts everything" segment.** Each has 2-3 specific cells that produce defensible lift.

### Statistical persuadability vs cell-level patterns

Step 2 produced segment-level differential persuadability coefficients. UCP/FJP/HCP/GHI all significantly more persuadable than reference; WE (seg 6) significantly less; HHN (seg 8) showed no average differential persuadability.

Cell-level recovers what the aggregate hides: HHN has three significant positive cells AND three significant negative cells — bidirectional response that nets to zero in the average. The dashboard makes this visible; the aggregate hides it.

### Cells with strict significance

Six of seventeen messages have at least one cell where the CI strictly excludes zero in a priority segment: Msg 3, 9, 13, 14, 16, 17. These are the production-priority message-cell combinations. The other 11 messages should not be greenlit for bespoke production without confirmation in wave 2.

### Per-segment data quality

```
Segment   n     Mean cell n   Mean shrink wt    Status
TSP       208   ~30           0.71             OK
HF        171   ~25           0.71             OK
HHN       250   ~40           0.78             Best data
WE         74   ~13           0.40-0.60        Too thin to act on
UCP       221   ~33           0.80             OK
FJP       354   ~55           0.85             Best data on D side
HCP       354   ~55           0.85             Best data on D side
GHI       237   ~37           0.80             OK
```

Segments with shrink_weight < 0.60 should be flagged in the UI as "low confidence."

---

## Part 5 — Open architectural decisions (Claude Code needs to make these)

### 1. How the React component reads segment metadata

The dashboard.json no longer carries segment codes/labels/party (that's platform-level data). The React component needs to look those up somewhere. Three options:

(a) **Static `prism_segments.json`** shipped with the React app, imported at build time. Recommended for v1.
(b) **API endpoint** the component queries on mount. Best long-term but adds infrastructure.
(c) **Hardcoded** as a constant in the component. Quickest but brittle.

Decision needed before the React component update.

### 2. Survey programming generator scope

The platform vision includes generating the Decipher XML from workbook + YAML. The current code does NOT do this. The HIV survey was hand-authored. Two questions:

- Should the next study's Decipher script be generated from the workbook?
- If yes, what is the output target — Decipher XML, Qualtrics, generic survey JSON?

Decision needed before fielding wave 2 or any new study.

### 3. SPSS syntax generator scope

Same question for the SPSS side. Should the .sps that processes the Decipher export be generated? If yes, against what template — Reservoir-internal SPSS conventions, generic SPSS, something else?

Decision needed before integrating with the existing SPSS-side pipeline.

### 4. Workbook as primary or YAML as primary?

Right now both are authored. The relationship between them needs to be one-way:

(a) **Workbook is primary, YAML is generated from it.** Analyst edits Excel, a button emits YAML. Easier for analysts but the YAML is then a build artifact, not a versionable source.
(b) **YAML is primary, workbook is a content-input file referenced by YAML.** Analyst edits YAML for parameters, workbook for content. Clean separation but YAML becomes the discipline target.
(c) **Both authored independently with a validator catching drift.** Most flexible, most error-prone.

I'd recommend (b) but it's a real decision.

### 5. Versioning discipline

The workbook and YAML together specify the study. Once fielded, they cannot change without invalidating analysis. How do you enforce this?

- Git-tracked YAML and workbook in the study's repo, with a "fielded" tag committed at field close
- Or: generated artifacts hash the inputs and refuse to run if the hash doesn't match

This matters for reproducibility, audit trail, and client trust. Decision needed before the platform ships.

---

## Part 6 — Prioritized backlog

In rough order of dependency and value:

### P0 — Blocks v1 ship of this dashboard

1. **Config refactor**: pull constants out of code into `study.yaml`; thread the config object through every function signature. Roughly 1 day of refactoring.

2. **Schema validator**: Pydantic models for `study.yaml`. Cross-validation: YAML references match workbook content; required .sav variables present; segment IDs in YAML exist in .sav. Roughly 4 hours.

3. **Legacy rename function**: read `legacy_rename` block, apply to df at pipeline start, produce canonical-named dataframe. Update all downstream code to use canonical names exclusively. Roughly 4 hours.

4. **Pipeline integration into compute_core.py**: the existing 2,000-line Reservoir pipeline expects new sections in `dashboard.json`. Add the four new functions (or import them from a `prism_message_map` module). Update `build_topline(df)` to call them. About 1 day depending on how clean the compute_core.py codebase is.

5. **React component update**: read the new `dashboard.json` structure (msg_id keys, token-indexed cells, outcome toggle, basket selector). Fix the canonical segment ordering bug. About 1-2 days.

### P1 — Needed before second study

6. **Workbook validator**: schema check on the workbook structure. Confirms required columns exist, msg_ids are unique, every (msg_id, token) is unique, every persona column maps to a known segment code.

7. **Workbook → YAML generator (or reverse)**: depending on the decision in section 5 above.

8. **Survey programming generator**: emit Decipher XML (or chosen survey target) from workbook + YAML.

9. **SPSS syntax generator**: emit .sps from workbook + YAML.

### P2 — Platform polish

10. **Test suite**: unit tests for each step, integration test against the HIV data, regression tests on the substantive findings (alpha, mean shift, top-5 priority cells should be stable across pipeline runs).

11. **Error handling pass**: every function gets input validation and informative error messages.

12. **Documentation**: methodology doc explaining the cell estimator for client-facing methodology appendices; analyst guide explaining how to set up a new study.

### P3 — Future enhancements

13. **Additional outcome variants**: support for single-item outcomes (configurable in YAML's `lift_variants` list).

14. **Multi-study merging**: longitudinal analysis across PRISM studies for the same respondents (now possible because .sav files are pure exposure metadata).

15. **Quantile bootstrap improvements**: bias-corrected and accelerated (BCa) intervals for tighter CIs in skewed cell distributions.

---

## Part 7 — Decisions already made (don't relitigate)

These were settled across many turns of design discussion. Don't reopen unless something concrete changes:

- **Estimator**: engagement-weighted signed B-W, EB shrinkage toward message marginal, 500-iter bootstrap CIs. Settled in extensive comparison against alternatives.

- **CORE handling**: Option B — CORE responses are baseline that PERSONA differences against, full-sample power. (Not Option A — between-arm-only cells.)

- **Thin cells**: shrunk, not hidden. Shrink weight surfaced in JSON for analyst diagnostics.

- **Outcome scope**: PERSUASION MESSAGING + BASE MESSAGING. Not "net movement" (rejected as redundant with persuasion). Not "lift_variants as transformation alternatives within one outcome" (clarified: outcomes are different dependent variables).

- **The two-outcome toggle architecture**: same 4D cell structure, swap outcome variable, color scale per outcome.

- **Workbook column structure**: msg_id (col A), theme_label (col B), token (col C), proof_full_text (col D), proof_short_label (col E), core_msg_text (col F), 16 persona columns (G-V) named `CODE_msg_text`.

- **Persona derivation, not storage**: persona = `persona_framing × XSEG_ASSIGNED` at analysis time. No M{NNN}_persona variables.

- **Workbook for content, YAML for analytical config**: separate sources of truth.

- **Canonical variable naming**: M{NNN}_token, persona_framing, design_version, task{NN}_best/worst, idx{NNN}_pre/post.

---

## Part 8 — Where to verify the math

If anyone questions the analytical methodology, point them at:

- `outputs/prism_cells.csv` — 1,152 cells × 12 columns, every cell with raw lift, shrunk lift, CI bounds, shrink weight, message marginal
- `outputs/prism_exposure_long.csv` — 43,826 respondent × item exposure records with B-W scores, framing arm, token, segment
- `outputs/dashboard.json` — the full assembled output keyed by (message, segment, arm, token)

Spot-check a cell:
1. Identify the cell's respondents in exposure_long.csv (filter on message, segment, arm, token)
2. Compute Σ(residual_shift × bw_score) / Σ|bw_score| manually
3. Compare against cells.csv `lift_raw`
4. Apply shrinkage formula manually to confirm `lift_shrunk`

This is the kind of audit trail that defends the methodology in front of skeptical clients.
