# PRISM Message Map — Methodology

## Overview

The Message Map is a cell-level analysis surface that estimates the persuasion lift of each (message, segment, persona-framing arm, proof token) combination tested in a PRISM study. It produces 1,000+ cells per outcome, each with a point estimate, 95% confidence interval, and shrinkage diagnostic.

## Data inputs

1. **Persuasion index**: a composite of K matched pre/post items on a common scale (this study: 7 items on a 7-point Likert scale). Internal consistency confirmed via Cronbach's α (≥ 0.70 soft threshold, ≥ 0.60 hard threshold).

2. **MaxDiff design**: each respondent completes T tasks of K items per task (this study: 14 tasks × 4 items). Item exposure is balanced across respondents.

3. **Persona-framing arm**: between-subject random assignment to CORE (untuned message text) or PERSONA (segment-tuned variant).

4. **Proof token**: within-subject random assignment to a token variant (base or one of up to K proof points) per message.

## Per-respondent processing

**Composite index**: `pre_composite = mean(pre items)`; `post_composite = mean(post items)`. Items are direction-aligned (reverse-coded where needed) so higher = aligned with client position.

**Residualized shift**: regress `post_composite` on `pre_composite + segment dummies`. The residual is each respondent's persuasion shift above what their baseline and segment would predict.

**Best-Worst score per message**: across T tasks, count times message m was picked best minus times picked worst. Range = -4 to +4 typically.

## Cell estimator

For each cell (message m, segment s, arm a, token t):

```
lift_raw = Σ (residual_shift_i × bw_score_im) / Σ |bw_score_im|
              over respondents i in the cell
```

Signed B-W in numerator (so engagement direction × movement direction = signal). Absolute B-W in denominator (so weight is engagement intensity, sign-agnostic).

Output is in residualized-index-point units (same scale as the composite, here 1-7).

## Shrinkage

Cells vary in respondent count (large segments produce cells with n in the 50-100 range; small segments produce cells with n in the 10-30 range). Empirical Bayes shrinkage stabilizes thin cells without hiding them:

```
σ_within   = pooled within-cell SD of residual_shift
σ_between  = SD of raw cell values around their message marginal
w          = (n / σ_within²) / (n / σ_within² + 1 / σ_between²)
lift_shrunk = w × lift_raw + (1 − w) × message_marginal
```

A cell with high `n` and stable internal variance has `w` close to 1 and stays near `lift_raw`. A cell with low `n` or high internal variance has `w` closer to 0 and gets pulled toward the message's overall mean. Shrinkage weight is exposed per cell for diagnostic transparency.

## Confidence intervals

Bootstrap by respondent resample (500 iterations). For each bootstrap sample:

1. Resample respondent IDs with replacement
2. Recompute all 1,000+ cells using the resampled dataset
3. Record the shrunken value per cell

The 95% CI is the 2.5th and 97.5th percentiles of each cell's bootstrap distribution. This captures both within-cell sampling uncertainty and the shrinkage's contribution to total uncertainty.

A cell is statistically significant if its CI strictly excludes zero.

## Two outcome variants

The same cell architecture supports multiple dependent variables:

**PERSUASION MESSAGING**: outcome = `residual_shift`. Cell value = movement above segment baseline attributable to engagement with this variant. Use for paid media allocation (what produces attitudinal movement).

**BASE MESSAGING**: outcome = `pre_composite − mean(pre_composite | segment)`. Cell value = how much more aligned the engagers of this variant are than their segment baseline. Use for owned-channel content (what your supporters already love).

Both outcomes use the identical estimation pipeline. Users toggle between them in the dashboard.

## Interpretation guide

A cell value of +0.20 under PERSUASION MESSAGING means: respondents in this segment who engaged with this (message, arm, token) variant shifted +0.20 points on the 1-7 composite, beyond what their baseline and segment would have predicted.

A cell value of +0.20 under BASE MESSAGING means: respondents in this segment who engaged with this variant were +0.20 points more aligned at baseline than their segment's average — i.e., this variant disproportionately attracts already-aligned supporters.

Effect sizes in well-designed message tests typically range from 0.05 to 0.30 on a 7-point composite. Larger effects (>0.40) warrant scrutiny for outliers; smaller effects (<0.05) are within sampling noise and should be ignored even if "significant" by raw p-value.

## Limitations

1. **Cell sample sizes**: at total n=2,578 with 16 segments × 4 cells per message average, mean cell n is ~40, with thin cells in the 10-20 range. Shrinkage handles this but reduces effective resolution. Studies prioritizing precise cell estimates should field with priority-segment quotas (n ≥ 300 per priority segment).

2. **Reverse causality**: cells with positive lift indicate engagement with the variant is associated with attitudinal movement; the engagement could in principle be downstream of movement rather than upstream. The pre-post timing of measurement plus the residualization on pre_composite mitigates but does not eliminate this concern.

3. **Persona-framing arm balance**: the between-subject CORE vs PERSONA split assumes the two arms are exchangeable on baseline characteristics. Verified empirically by checking that pre_composite distributions are equivalent across arms within each segment.

4. **Multiple testing**: with 1,000+ cells per outcome, raw significance rates would produce ~50 false positives at α=0.05. The dashboard does not adjust for multiple comparisons because operational decisions are made on the joint pattern of significant cells across a message family, not on individual cell p-values. Analysts should treat single-cell significance as exploratory, not confirmatory.

5. **Sample composition**: results apply to the survey panel's representation of the US public. Generalization to other populations (registered voters, specific media audiences, specific geographies) requires either weighting or re-fielding.
