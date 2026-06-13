// MethodologyFootnote — outcome-aware methodology block + provenance
// line. One <details> block that swaps its middle section per active
// measurement (SoP / Utility / Persuasion / Base) while keeping the
// universal preamble and the limitations tail constant. Provenance
// line at the bottom updates its Outcome token + the matching scale
// parameter per active card.
//
// Copy is the analyst's. The four BY_OUTCOME blocks document the
// math each card uses — SoP and Utility describe the Bayesian
// pipeline (Dirichlet posterior and hierarchical Normal–Normal
// shrinkage respectively); Persuasion and Base reuse the original
// engagement-weighted-mean → EB-shrinkage → bootstrap-CI chain.
import { C, FONT, MONO } from "../../data/theme";

const ACCENT = {
  sop: "#22d3ee",
  utility: "#a78bfa",
  persuasion_messaging: "#34d399",
  base_messaging: "#60a5fa",
};
const TITLE = {
  sop: "Share of Preference (SoP)",
  utility: "Message Utility",
  persuasion_messaging: "Persuasion Messaging Lift",
  base_messaging: "Base Messaging Lift",
};

function H4({ children }) {
  return (
    <h4 style={{
      color: C.text, fontSize: 12, marginTop: 14, marginBottom: 4,
    }}>{children}</h4>
  );
}
const codeStyle = { color: C.violet, fontFamily: MONO };

// ───────────────────────────────────────────────────────────────────
// UNIVERSAL preamble — describes the platform, not the outcome.
// ───────────────────────────────────────────────────────────────────
function Universal() {
  return (
    <p>
      The Message Map is a cell-level analytical surface. Each cell
      reports an estimate for a specific combination of four
      dimensions: <strong>message theme</strong> (one of the
      substantive messages tested in this study),{" "}
      <strong>audience segment</strong> (one of the 16 PRISM segments
      derived from cultural-ideological clustering),{" "}
      <strong>persona framing arm</strong> (PERSONA, meaning the
      message was tuned to the segment's worldview; vs. CORE, the
      untuned baseline version), and <strong>proof token</strong>{" "}
      (token 0 = base message; tokens 1+ = the same message with one
      of several specific statistical proof points appended). The
      cell space dimensions vary by study (number of messages,
      number of tokens per message, framing arms used); the dashboard
      displays the cells that the study's design populated. What
      each cell <em>means</em> depends on the active measurement —
      detailed below.
    </p>
  );
}

// ───────────────────────────────────────────────────────────────────
// BY_OUTCOME — the swappable middle. Same headings per outcome so
// the rhythm stays consistent: Definition → Computation → Inter-
// pretation → Significance.
// ───────────────────────────────────────────────────────────────────
const BY_OUTCOME = {
  // ────────── SHARE OF PREFERENCE ──────────
  sop: (
    <>
      <H4>SoP definition</H4>
      <p>
        Cell value = the <strong>posterior expected share</strong> of
        overall MaxDiff preference one would have toward this message
        vs. every other message tested, expressed as a percent. All
        messages within an audience sum to 100% by construction.
      </p>

      <H4>How each cell is computed</H4>
      <p>
        <strong>Step 1 — engagement counts.</strong> For each
        respondent's MaxDiff task, count each message's signed
        Best-Worst differential. Aggregate per (basket, message) — or
        per (segment, message) — into win/loss totals.
      </p>
      <p>
        <strong>Step 2 — Bayesian Dirichlet posterior.</strong> The
        K-message share vector is modeled as a Dirichlet. Prior is
        hierarchical:{" "}
        <code style={codeStyle}>
          α_m = α₀ + K · global_share_m
        </code>{" "}
        where <code>global_share_m</code> is the total-sample
        posterior mean. This borrows strength toward the population
        for small audience cells without distorting their own data.
        Reported value = posterior mean × 100%. Sum-to-100 holds by
        construction (Dirichlet expectation).
      </p>
      <p>
        <strong>Step 3 — credible intervals + rank
        distribution.</strong> 4,000 Dirichlet draws give the 95%
        central credible interval, plus a Monte-Carlo rank
        distribution (<code>p_top1</code>, <code>p_top3</code>) used
        to break ties and surface "which message is most likely to
        be #1 for this audience."
      </p>

      <H4>Interpretation</H4>
      <p>
        Higher SoP = more receptive audience. SoP is a{" "}
        <strong>preference</strong> signal — broad appeal, not causal
        lift. Comparing SoP across audiences within a message is the
        headline read; comparing SoP across messages within an
        audience is the rank read.
      </p>

      <H4>Significance</H4>
      <p>
        A cell is "credibly above the basket mean" when the lower
        bound of its 95% credible interval exceeds the basket's mean
        share. We avoid frequentist p-values for SoP — the posterior
        already quantifies uncertainty directly.
      </p>
    </>
  ),

  // ────────── MESSAGE UTILITY ──────────
  utility: (
    <>
      <H4>Utility definition</H4>
      <p>
        Cell value = the <strong>posterior signed Best-Worst
        score</strong>: how much more (or less) compelling than the
        average message a respondent finds this message. Negative
        values = the message is more likely to be picked as{" "}
        <em>least</em> compelling; positive = more likely to be picked
        as <em>most</em> compelling. Symmetric around 0.
      </p>

      <H4>How each cell is computed</H4>
      <p>
        <strong>Step 1 — respondent-level normalization.</strong> For
        each respondent's MaxDiff task, compute{" "}
        <code style={codeStyle}>bw_norm = bw_score / n_shown</code>{" "}
        so respondents who saw more sets aren't over-weighted.
      </p>
      <p>
        <strong>Step 2 — hierarchical Normal–Normal shrinkage.</strong>{" "}
        Per (segment × message):{" "}
        <code style={codeStyle}>
          μ_{"{seg,msg}"} ~ N(0, τ²)
        </code>,{" "}
        <code style={codeStyle}>
          x_i ~ N(μ, σ_w²)
        </code>. B-W is zero-sum within a respondent's exercise, so
        the prior mean is 0. Closed-form posterior:{" "}
        <code style={codeStyle}>
          μ̂ = w · x̄, &nbsp; w = n·τ² / (n·τ² + σ_w²), &nbsp;
          var_post = σ_w²·τ² / (n·τ² + σ_w²)
        </code>. <code>σ_w²</code> = pooled residual variance;{" "}
        <code>τ²</code> = cross-message variance within a segment,
        empirical-Bayes-fit. Small / noisy cells pull toward 0;
        stable cells retain their sample mean.
      </p>
      <p>
        <strong>Step 3 — symmetric scale.</strong> Displayed signed
        values are the posterior means; the visual scale is
        symmetric (±max|μ̂|) so positive and negative magnitudes are
        visually comparable. The 0–100 secondary scale (when shown)
        uses a fixed study-wide endpoint pair so cross-segment
        comparisons are valid — unlike the legacy per-segment min-max
        rescale.
      </p>

      <H4>Interpretation</H4>
      <p>
        Positive = "more compelling than average"; negative = "more
        likely to be seen as least compelling." Use this view to
        answer <strong>is the message polarizing?</strong> — a cell
        near 0 means "neither chosen as best nor worst"; cells far
        from 0 in either direction mean the audience holds a strong
        view.
      </p>

      <H4>Significance</H4>
      <p>
        95% posterior credible interval (closed-form from the
        shrinkage variance above). A cell is "credibly non-neutral"
        when the CI excludes 0.
      </p>
    </>
  ),

  // ────────── PERSUASION MESSAGING LIFT ──────────
  persuasion_messaging: (
    <>
      <H4>Persuasion definition</H4>
      <p>
        Cell value = engagement-weighted <strong>residualized
        attitudinal shift</strong> produced by exposure to a specific
        (message × framing × proof) combination, above what the
        respondent's baseline + segment would have predicted. Use
        this view for paid-media targeting decisions:{" "}
        <strong>where will spending budget produce attitudinal
        movement?</strong>
      </p>

      <H4>How each cell is computed</H4>
      <p>
        <strong>Step 1 — engagement-weighted mean.</strong> Among
        respondents assigned to <code>(s, a, t)</code> who saw
        message <code>m</code>:{" "}
        <code style={codeStyle}>
          lift_raw = Σ (outcome_i × bw_score_im) / Σ |bw_score_im|
        </code>{" "}
        where <code>bw_score_im</code> is respondent <code>i</code>'s
        Best-Worst differential for message <code>m</code>. Signed
        B-W in the numerator = engagement direction × outcome
        direction. Absolute B-W in the denominator = engagement
        intensity regardless of direction.
      </p>
      <p>
        <strong>Step 2 — empirical Bayes shrinkage.</strong> Cells
        with small <em>n</em> are pulled toward the message's overall
        marginal:{" "}
        <code style={codeStyle}>
          w = (n/σ²<sub>within</sub>) / (n/σ²<sub>within</sub> +
          1/σ²<sub>between</sub>)
        </code>{" "}and{" "}
        <code style={codeStyle}>
          lift_shrunk = w·lift_raw + (1−w)·message_marginal
        </code>. Large stable cells retain raw; small / noisy cells
        move toward the message average. The shrinkage weight per
        cell is in tooltips for diagnostic transparency.
      </p>
      <p>
        <strong>Step 3 — bootstrap confidence intervals.</strong>{" "}
        Respondent-level resampling with replacement, 500 iterations,
        fixed seed for reproducibility. The reported 95% CI is the
        2.5th and 97.5th percentiles of the cell's bootstrap
        distribution. A cell is statistically significant if its CI
        strictly excludes zero.
      </p>

      <H4>Interpretation</H4>
      <p>
        <strong>+0.20 under PERSUASION:</strong> respondents in this
        cell shifted +0.20 points on the composite scale above what
        their baseline and segment predicted. Effect sizes in
        well-designed message tests typically range from 0.05 to
        0.30. Values above 0.40 warrant outlier scrutiny; values
        below 0.05 are within sampling noise.
      </p>
    </>
  ),

  // ────────── BASE MESSAGING LIFT ──────────
  base_messaging: (
    <>
      <H4>Base definition</H4>
      <p>
        Cell value = engagement-weighted <strong>within-segment
        alignment deviation</strong>. Measures whether the audience
        that engages with a specific variant is already more aligned
        than their segment's baseline. Use this view for owned-channel
        decisions: <strong>what reinforces base support</strong> in
        supporter emails, fundraising appeals, and content that
        reinforces the base without alienating it.
      </p>

      <H4>How each cell is computed</H4>
      <p>
        <strong>Step 1 — engagement-weighted mean.</strong> Same
        engagement-weighted estimator the Persuasion view uses, but
        with the outcome variable swapped to the respondent's{" "}
        <em>segment-centered pre-composite alignment</em> instead of
        residualized shift. The B-W weights capture engagement;
        the segment-centered alignment captures who's already aligned.
      </p>
      <p>
        <strong>Step 2 — empirical Bayes shrinkage.</strong> Identical
        EB shrinkage formula to Persuasion — small cells pull toward
        the message marginal.{" "}
        <code style={codeStyle}>
          w = (n/σ²<sub>within</sub>) / (n/σ²<sub>within</sub> +
          1/σ²<sub>between</sub>)
        </code>. σ values are fit per outcome (Base typically has
        higher σ<sub>within</sub> than Persuasion).
      </p>
      <p>
        <strong>Step 3 — bootstrap confidence intervals.</strong>{" "}
        Same 500-iteration respondent-level resample, 95% percentile
        CI, same significance rule (CI excludes 0).
      </p>

      <H4>Interpretation</H4>
      <p>
        <strong>+0.20 under BASE:</strong> respondents who engaged
        with this variant were 0.20 points more aligned at baseline
        than their segment's average. This is a{" "}
        <strong>selection signal</strong>, not a causal claim — the
        engaged audience self-selected, and the message describes who
        showed up, not what moved them.
      </p>
    </>
  ),
};

// ───────────────────────────────────────────────────────────────────
// LIMITATIONS — always shown. SoP / Utility get a Bayesian-CI note
// inserted (their CIs aren't subject to the same multiple-testing
// caveat as the frequentist bootstrap CIs).
// ───────────────────────────────────────────────────────────────────
function Limitations({ outcome }) {
  const isLift = outcome === "persuasion_messaging" || outcome === "base_messaging";
  return (
    <>
      <H4>Methodological limitations</H4>
      <p>
        <strong>Cell sample sizes vary.</strong> Priority segments
        are typically oversampled to support more reliable cell
        estimates; non-priority segments are smaller. Shrinkage
        (EB or hierarchical Bayes, depending on the outcome) handles
        this honestly but reduces resolution on thin cells.
      </p>
      <p>
        <strong>Multiple testing.</strong> With many cells per
        outcome, raw frequentist significance at α=0.05 would produce
        a non-trivial number of false positives. No correction
        applied — operational decisions should rely on patterns
        across a message-token family, not on individual cell
        p-values. Treat single-cell significance as exploratory.
        {!isLift && (
          <em style={{ color: C.textDim }}>
            {" "}SoP and Utility use Bayesian credible intervals
            derived from the posterior; the multiple-testing caveat
            applies to the frequentist Persuasion / Base CIs only.
          </em>
        )}
      </p>
      {isLift ? (
        <p>
          <strong>Reverse causality.</strong> Positive lift indicates
          engagement is associated with attitudinal movement. Pre-post
          timing plus residualization on pre-composite mitigates but
          does not eliminate the possibility that movement preceded
          engagement.
        </p>
      ) : (
        <p>
          <strong>Preference signal, not causal claim.</strong> SoP
          and Utility describe what respondents prefer or find
          compelling; they do not estimate what changes opinion.
          Persuasion Lift is the outcome that estimates causal
          attitudinal movement.
        </p>
      )}
      <p>
        <strong>Sample composition.</strong> Results apply to the
        survey panel's representation of the population sampled.
        Generalization to specific subpopulations requires weighting
        or re-fielding.
      </p>
    </>
  );
}

// ───────────────────────────────────────────────────────────────────
// Outcome-aware provenance one-liner.
// ───────────────────────────────────────────────────────────────────
function provenanceTail(outcome, activeMetric) {
  if (outcome === "sop") {
    return "(Bayesian Dirichlet · n_draws=4000 · hierarchical prior anchored on total-sample posterior)";
  }
  if (outcome === "utility") {
    return "(Bayesian hierarchical N–N shrinkage · μ_seg,msg ~ N(0, τ²) · τ² empirical-Bayes-fit)";
  }
  return activeMetric?.sigma_within != null
    ? `(σ_within=${activeMetric.sigma_within.toFixed(3)})`
    : "";
}

// ═══════════════════════════════════════════════════════════════════
// Exported component.
// ═══════════════════════════════════════════════════════════════════
export default function MethodologyFootnote({
  outcome, study, activeBasket, activeMetric,
}) {
  const accent = ACCENT[outcome] || C.violet;
  const title  = TITLE[outcome] || "Active outcome";
  return (
    <>
      {/* ─── METHODOLOGY DETAILS ─── */}
      <details style={{
        marginTop: 14,
        background: C.card, border: `1px solid ${C.cardBorder}`,
        borderRadius: 6, fontFamily: FONT,
      }}>
        <summary style={{
          padding: "10px 14px", cursor: "pointer",
          fontSize: 11, color: C.textMuted, fontWeight: 600,
          fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase",
        }}>
          Methodology · how each cell is computed —{" "}
          <span style={{ color: accent }}>{title}</span>
        </summary>
        <div style={{
          padding: "0 18px 14px", fontSize: 11, color: C.textMuted,
          lineHeight: 1.65,
        }}>
          <Universal />
          <div style={{
            marginTop: 14, paddingTop: 6,
            borderTop: `1px dashed ${C.cardBorder}`,
          }}>
            {BY_OUTCOME[outcome] || BY_OUTCOME.persuasion_messaging}
          </div>
          <div style={{
            marginTop: 14, paddingTop: 6,
            borderTop: `1px dashed ${C.cardBorder}`,
          }}>
            <Limitations outcome={outcome} />
          </div>
        </div>
      </details>

      {/* ─── PROVENANCE LINE ─── */}
      <div style={{
        marginTop: 12, padding: "10px 14px",
        fontSize: 10, color: C.textDim, fontFamily: MONO,
        letterSpacing: 0.5,
        background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 6,
      }}>
        <strong style={{ color: C.textMuted }}>{study?.id}</strong>{" "}
        · {study?.version} · Analyst: {study?.analyst} ·
        N={study?.n_total || "—"} ·
        Active basket:{" "}
        <span style={{ color: C.text }}>{activeBasket?.name}</span>{" "}
        ({activeBasket?.segments?.length} segments) ·
        Outcome:{" "}
        <span style={{ color: accent }}>{title}</span>{" "}
        {provenanceTail(outcome, activeMetric)}
      </div>
    </>
  );
}
