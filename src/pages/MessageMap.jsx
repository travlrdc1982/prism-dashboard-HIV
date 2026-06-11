// ═══════════════════════════════════════════════════════════════
// MESSAGE MAP — standalone /messages page
//
// Renders the messagemap pipeline output (persuasion_messaging /
// base_messaging) merged into src/data/topline/dashboard.json:
//   - messages[]            17 message themes × proof tokens
//   - message_map_cells{}   per-metric lift cells: msg×seg×arm×proof
//   - baskets[]             total / priority_all / priority_d / gop / dem
//   - variants{}            per-message text by persona token
//   - lift_variants[]       metric metadata (sigma, scale)
//
// COMMIT B1.6 — chrome polish per analyst feedback:
//   • InfoDot switched to "?" + radar-style tooltip palette
//   • Variant Universe column moved to LEFT, beside Message header
//   • Variant Universe icon legend now lives IN the column header
//     (band / ○ CORE / ● OPTIMAL / dashed-zero / live tick)
//   • Cell-architecture graphic replaced by a compact interactive
//     widget — click to fold the PERSONA card open from CORE, click
//     ▸ to drill into proof tokens.
//   • Sub-header counts strip is now data-driven:
//       N PRISM SEGMENTS · N MESSAGES · N PROOF POINT TOKENS · NNNN
//       TOTAL MESSAGE VARIANTS
//
// Live cell rendering, hover-variant text, row drill-down, priority
// basket reorganization, and the variant-universe data still land
// in B2–B6.
// ═══════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import dashboard from "../data/topline/dashboard.json";
import { C, FONT, MONO } from "../data/theme";
import { STUDY_METRICS } from "../data/study";
import PageHeader from "../components/PageHeader";
import InfoDot from "../components/InfoDot";
import {
  CellArchitectureWidget,
  SegmentCircle,
  ControlSelect,
  ActionBtn,
  LiftRamp,
  VariantUniverseLegend,
  SplitCell,
} from "../components/MessageMap";
import { scaleLift } from "../components/MessageMap/liftScale";

// ─── Data wiring (frame only — cells render in B2) ───
const SEGMENTS = dashboard.segments;             // 16 segments
const MESSAGES = dashboard.messages || [];       // 17 message-theme records
const BASKETS  = dashboard.baskets  || [];       // 5 baskets
const METRICS  = dashboard.lift_variants || [];  // persuasion / base
// UI config authored in study/study.yaml (dashboard: section), emitted by
// the messagemap pipeline as dashboard.json's `ui` section. Defaults +
// render rules come from here; hardcoded fallbacks cover old artifacts.
const UI = dashboard.ui || {};
const FADE_BELOW = UI.fade_shrink_weight_below ?? 0.6;

// ─── Derived study counts ───
// PROOF POINT TOKENS = count of tokens with proof_id > 0 across messages
// TOTAL MESSAGE VARIANTS = sum over messages of n_tokens × (CORE + 16 persona)
const N_SEGMENTS = SEGMENTS.length;
const N_MESSAGES = MESSAGES.length;
const N_PROOF_TOKENS = MESSAGES.reduce(
  (sum, m) => sum + (m.proofs?.filter(p => p.proof_id > 0).length || 0),
  0
);
const N_TOTAL_VARIANTS = MESSAGES.reduce(
  (sum, m) => sum + (m.proofs?.length || 0) * (1 + N_SEGMENTS),
  0
);

// Priority basket → segment IDs ordered by ROI desc.
const PRIORITY_BASKET = (BASKETS.find(b => b.id === "priority_all") || { segments: [] }).segments;
const PRIORITY_ORDERED_BY_ROI = [...PRIORITY_BASKET].sort((a, b) => {
  const ca = SEGMENTS.find(s => s.id === a)?.code;
  const cb = SEGMENTS.find(s => s.id === b)?.code;
  return (STUDY_METRICS[cb]?.roi || 0) - (STUDY_METRICS[ca]?.roi || 0);
});

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function MessageMap() {
  const hasData = MESSAGES.length > 0
    && dashboard.message_map_cells
    && Object.keys(dashboard.message_map_cells).length > 0;

  const defaultMetric = UI.default_outcome || METRICS[0]?.name || "persuasion_messaging";
  const [metric, setMetric] = useState(defaultMetric);
  const [basket, setBasket] = useState(UI.default_basket || "total");

  const activeBasket = BASKETS.find(b => b.id === basket) || BASKETS[0];
  const activeMetric = METRICS.find(m => m.name === metric) || METRICS[0];
  const orderedSegments = SEGMENTS;

  // ── Cell aggregation ──────────────────────────────────────────────
  // The artifact carries one cell per (message × segment × arm × proof).
  // The collapsed row shows one value per (message × segment × arm): the
  // n-weighted mean of lift_shrunk across that half's proof tokens
  // (per-proof rows land with the B3 drill-down). Shrink weight is
  // n-weight-averaged the same way and drives the low-confidence fade.
  const cellIndex = useMemo(() => {
    const cells = dashboard.message_map_cells?.[metric] || [];
    const acc = new Map();
    for (const c of cells) {
      const key = `${c.message}|${c.segment}|${c.arm}`;
      let a = acc.get(key);
      if (!a) { a = { sumLift: 0, sumW: 0, n: 0 }; acc.set(key, a); }
      a.sumLift += c.lift_shrunk * c.n;
      a.sumW += c.shrink_weight * c.n;
      a.n += c.n;
    }
    const out = new Map();
    for (const [key, a] of acc) {
      out.set(key, { lift: a.sumLift / a.n, w: a.sumW / a.n, n: a.n });
    }
    return out;
  }, [metric]);

  const colorScale = activeMetric?.color_scale;
  // arm encoding from the survey: 1 = PERSONA-tuned, 2 = CORE
  const getHalf = (msgId, segId, arm) => {
    const a = cellIndex.get(`${msgId}|${segId}|${arm}`);
    if (!a) return null;
    return { v: scaleLift(a.lift, colorScale), lift: a.lift, n: a.n, w: a.w };
  };

  if (!hasData) {
    return (
      <div style={{ maxWidth: 1400, margin: "0 auto", color: C.text, fontFamily: FONT }}>
        <PageHeader title="Message Map" />
        <div style={{
          background: C.card, border: `1px solid ${C.cardBorder}`,
          borderRadius: 6, padding: "20px 24px", fontSize: 12, color: C.textMuted,
        }}>
          <strong style={{ color: C.text }}>Message Map data not yet available.</strong>{" "}
          Run <code style={{ fontFamily: MONO, color: C.violet }}>python scripts/refresh.py</code>{" "}
          to regenerate <code style={{ fontFamily: MONO, color: C.violet }}>src/data/topline/dashboard.json</code>{" "}
          with the messagemap pipeline output.
        </div>
      </div>
    );
  }


  // ─── Tooltip copy (title + body, radar-style) ───
  const OUTCOME_INFO = (
    <>
      Two views of the same cells.{" "}
      <strong style={{ color: "#34d399" }}>PERSUASION</strong> = messages that
      predict opinion movement for the audiences (persuasion messaging to
      strengthen and grow coalition).{" "}
      <strong style={{ color: "#60a5fa" }}>BASE</strong> = messages that
      predict support among the audiences that are already aligned (use for
      galvanizing support and activating base). Toggle to compare.
    </>
  );
  const FILTER_INFO = (
    <>
      Filter a specific group. Baskets are study-specific groupings of segments
      that reflect this study's priorities (typically: priority audiences for
      persuasion, primary or secondary audiences by partisanship or some other
      strategic frame). TOTAL shows the full sample without basket restriction.
    </>
  );
  const COLOR_INFO = (
    <>
      Greener cells indicate stronger positive lift; redder cells indicate the
      message backfires (leads to negative shifts in opinion); white cells
      indicate negligible effect. Cell values depict how much each message
      variant moves attitudinal alignment above baseline, on a 0–100 scale.
    </>
  );
  const SEGMENT_INFO = (
    <>
      The 16 PRISM segments derived from cultural-ideological clustering of
      the US public. Click a segment label to see its full profile in the
      Persona Profile view.
    </>
  );
  const MESSAGE_INFO = (
    <>
      The substantive message themes using PRISM's "message grammar"
      methodology tested using a discrete choice methodology (MaxDiff
      exercise). Click any message label to see the "core message" — the
      precise wording a subset of respondents are exposed to.
    </>
  );
  const PROOF_INFO = (
    <>
      Proof points for the messages were tested with subsets of respondents
      to assess the marginal impact in overall message impact.
    </>
  );
  const VARIANT_UNIVERSE_INFO = (
    <>
      A one-dimensional projection of a four-dimensional cell space (message
      × segment × persona tuning × proof token), reduced to the most
      operationally useful summary of a single message's performance. Each
      row's strip summarizes the range of message impact scores across every
      combination of persona framing × proof token, evaluated against every
      PRISM segment. The gap between ○ and ● is the persuasion{" "}
      <em>headroom</em>: how much lift is unlocked by persona tuning + best
      proof selection, above the untuned baseline.
    </>
  );

  return (
    <div style={{ color: C.text, fontFamily: FONT, maxWidth: 1800, margin: "0 auto" }}>

      {/* ─── HEADER + DESCRIPTION + INTERACTIVE CELL WIDGET ─── */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <PageHeader title="Message Map" />
          <div style={{
            fontSize: 12, color: C.textMuted, maxWidth: 980, lineHeight: 1.6,
            marginBottom: 8,
          }}>
            <strong style={{ color: C.text }}>Message Map shows which message moves which audiences.</strong>{" "}
            Each cell estimates how much a specific message, in a specific
            persona framing, with a specific proof point, has the most impact
            with a specific audience segment, relative to what would have
            happened without that exposure. Message impact is measured as both
            how likely it will persuade/move attitudes{" "}
            <strong style={{ color: "#34d399" }}>(Persuasion Messaging)</strong>{" "}
            or how well it explains existing support{" "}
            <strong style={{ color: "#60a5fa" }}>(Base Messaging)</strong>.
          </div>

          {/* Configurable counts strip */}
          <div style={{
            fontSize: 9, color: C.textDim, fontFamily: MONO,
            letterSpacing: 1, textTransform: "uppercase",
          }}>
            {N_SEGMENTS} PRISM SEGMENTS{" · "}
            {N_MESSAGES} MESSAGES{" · "}
            {N_PROOF_TOKENS} PROOF POINT TOKENS{" · "}
            {N_TOTAL_VARIANTS.toLocaleString()} TOTAL MESSAGE VARIANTS
          </div>
        </div>

        <CellArchitectureWidget />
      </div>

      {/* ─── CONTROLS BAR ─── */}
      <div style={{
        display: "flex", alignItems: "flex-end", gap: 18, flexWrap: "wrap",
        padding: "10px 14px",
        background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 6,
        marginBottom: 12,
      }}>
        <ControlSelect
          label="Outcome"
          infoTitle="Outcome"
          value={metric}
          onChange={setMetric}
          options={METRICS.map(m => ({ value: m.name, label: m.label }))}
          info={OUTCOME_INFO}
        />
        <ControlSelect
          label="Filter (Basket)"
          infoTitle="Filter (basket)"
          value={basket}
          onChange={setBasket}
          options={BASKETS.map(b => ({ value: b.id, label: b.name }))}
          info={FILTER_INFO}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{
            fontFamily: MONO, fontSize: 7, color: C.textDim,
            letterSpacing: 1.5, textTransform: "uppercase",
            display: "flex", alignItems: "center",
          }}>
            Lift Scale (0–100)
            <InfoDot title="Lift scale">{COLOR_INFO}</InfoDot>
          </span>
          <LiftRamp />
        </div>

        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <ActionBtn label="Expand all" disabled />
          <ActionBtn label="Collapse all" disabled />
          <ActionBtn label="Unpin all" disabled />
        </div>
      </div>

      {/* ─── PROOF POINTS ORIENTATION STRIP ─── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        fontSize: 11, color: C.textMuted, fontFamily: FONT,
        padding: "8px 12px", marginBottom: 10,
        background: "rgba(167,139,250,0.05)",
        border: `1px solid rgba(167,139,250,0.18)`,
        borderRadius: 4,
      }}>
        <span style={{
          fontFamily: MONO, fontSize: 9, color: C.violet,
          fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
        }}>Proof Points</span>
        <InfoDot title="Proof points">{PROOF_INFO}</InfoDot>
        <span>
          Each row drills into its proof-token grid via the ▸ chevron.{" "}
          <em style={{ color: C.textDim }}>Themes are listed in the order they appeared
          in the survey design; the order does not reflect importance or ranking.</em>
        </span>
      </div>

      {/* ─── GRID FRAME ─── */}
      {/*
          Column layout (left → right):
              chevron · Message · Variant Universe · 16 segment columns
          Variant Universe moved LEFT per analyst feedback.
      */}
      <div style={{
        background: C.card, border: `1px solid ${C.cardBorder}`,
        borderRadius: 6, overflow: "hidden",
      }}>
        {/* Header row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `36px 220px 150px repeat(${orderedSegments.length}, minmax(56px, 1fr))`,
          gap: 0,
          padding: "10px 12px",
          borderBottom: `1px solid ${C.cardBorder}`,
          background: C.bg,
        }}>
          <div /> {/* chevron gutter */}

          {/* MESSAGE column header (big) + Proof points sub-header (small) */}
          <div style={{
            display: "flex", flexDirection: "column", justifyContent: "flex-end",
            paddingRight: 10, paddingBottom: 4,
          }}>
            <span style={{
              fontFamily: MONO, fontSize: 12, color: C.text,
              fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
              display: "flex", alignItems: "center",
            }}>
              Message
              <InfoDot title="Message" placement="below">{MESSAGE_INFO}</InfoDot>
            </span>
            <span style={{
              fontFamily: MONO, fontSize: 8, color: C.textDim,
              marginTop: 4, letterSpacing: 1.5, textTransform: "uppercase",
              fontWeight: 600,
              display: "flex", alignItems: "center",
            }}>
              Proof points
              <InfoDot title="Proof points" placement="below">{PROOF_INFO}</InfoDot>
            </span>
          </div>

          {/* VARIANT UNIVERSE column header — legend inline */}
          <div style={{
            display: "flex", flexDirection: "column", justifyContent: "flex-end",
            paddingRight: 10, paddingBottom: 2,
            borderRight: `1px dashed ${C.cardBorder}`,
          }}>
            <span style={{
              fontFamily: MONO, fontSize: 8, color: C.violet,
              fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
              display: "flex", alignItems: "center",
            }}>
              Variant Universe
              <InfoDot title="Variant universe" placement="right">{VARIANT_UNIVERSE_INFO}</InfoDot>
            </span>
            <VariantUniverseLegend />
            <div style={{
              display: "flex", justifyContent: "space-between",
              fontFamily: MONO, fontSize: 6, color: C.textDim,
              letterSpacing: 0.5, textTransform: "uppercase",
              marginTop: -2, paddingLeft: 14, paddingRight: 14,
            }}>
              <span>○ core</span>
              <span style={{ color: "#34d399" }}>● optimal</span>
            </div>
          </div>

          {/* 16 PRISM SEGMENTS — group label spans all segment columns,
              circle row sits underneath. Label + InfoDot sit OUTSIDE
              the message column. */}
          <div style={{
            gridColumn: `4 / span ${orderedSegments.length}`,
            display: "grid",
            gridTemplateColumns: `repeat(${orderedSegments.length}, minmax(56px, 1fr))`,
            gridTemplateRows: "auto auto",
            columnGap: 0, rowGap: 4,
          }}>
            <div style={{
              gridColumn: `1 / -1`,
              textAlign: "center",
              fontFamily: MONO, fontSize: 8, fontWeight: 700,
              color: C.text, letterSpacing: 1.5, textTransform: "uppercase",
              display: "flex", justifyContent: "center", alignItems: "center",
            }}>
              {N_SEGMENTS} PRISM Segments
              <InfoDot title="Segments" placement="below">{SEGMENT_INFO}</InfoDot>
            </div>
            {orderedSegments.map(seg => (
              <div key={seg.id} style={{ display: "flex", justifyContent: "center" }}>
                <SegmentCircle seg={seg} />
              </div>
            ))}
          </div>
        </div>

        {/* Body — placeholder rows (live cells land in B2) */}
        <div>
          {MESSAGES.map((m, i) => (
            <div key={m.id} style={{
              display: "grid",
              gridTemplateColumns: `36px 220px 150px repeat(${orderedSegments.length}, minmax(56px, 1fr))`,
              gap: 0,
              padding: "8px 12px",
              borderBottom: i < MESSAGES.length - 1 ? `1px solid ${C.cardBorder}` : "none",
              alignItems: "center",
              minHeight: 38,
            }}>
              <div style={{
                fontFamily: MONO, fontSize: 10, color: C.textDim,
                textAlign: "center", cursor: "default",
              }}>▸</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingRight: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontFamily: MONO, fontSize: 9, color: C.textDim, letterSpacing: 0.5,
                  }}>MSG {String(m.id).padStart(2, "0")}</div>
                  <div style={{
                    fontFamily: FONT, fontSize: 11, fontWeight: 700, color: C.text,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{m.theme_label}</div>
                </div>
              </div>
              {/* Variant Universe strip placeholder */}
              <div style={{
                marginRight: 10, height: 22,
                background: "rgba(167,139,250,0.05)",
                border: `1px dashed rgba(167,139,250,0.3)`,
                borderRadius: 2,
                borderRight: `1px dashed ${C.cardBorder}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: MONO, fontSize: 8, color: C.textDim, letterSpacing: 0.5,
              }}>B6</div>
              {orderedSegments.map(seg => (
                <SplitCell
                  key={seg.id}
                  core={getHalf(m.id, seg.id, 2)}
                  tuned={getHalf(m.id, seg.id, 1)}
                  fadeBelow={FADE_BELOW}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ─── METHODOLOGY FOOTNOTE ─── */}
      <details style={{
        marginTop: 14,
        background: C.card, border: `1px solid ${C.cardBorder}`,
        borderRadius: 6, fontFamily: FONT,
      }}>
        <summary style={{
          padding: "10px 14px", cursor: "pointer",
          fontSize: 11, color: C.textMuted, fontWeight: 600,
          fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase",
        }}>Methodology · how each cell is computed</summary>
        <div style={{
          padding: "0 18px 14px", fontSize: 11, color: C.textMuted, lineHeight: 1.65,
        }}>
          <p>
            The Message Map is a cell-level analytical surface. Each cell
            estimates the persuasion lift produced by a specific combination of
            four dimensions: <strong>message theme</strong> (one of the
            substantive messages tested in this study),{" "}
            <strong>audience segment</strong> (one of the 16 PRISM segments
            derived from cultural-ideological clustering),{" "}
            <strong>persona framing arm</strong> (PERSONA, meaning the message
            was tuned to the segment's worldview; vs. CORE, the untuned baseline
            version), and <strong>proof token</strong> (token 0 = base message;
            tokens 1+ = the same message with one of several specific
            statistical proof points appended). The cell space dimensions vary
            by study (number of messages, number of tokens per message, framing
            arms used); the dashboard displays the cells that the study's
            design populated.
          </p>

          <h4 style={{ color: C.text, fontSize: 12, marginTop: 14, marginBottom: 4 }}>
            The two outcomes (toggle)
          </h4>
          <p>
            <strong style={{ color: "#34d399" }}>PERSUASION MESSAGING.</strong>{" "}
            Cell value = engagement-weighted residualized attitudinal shift.
            This measures how much exposure to a specific (message × framing ×
            proof) combination produced movement in attitudinal alignment,
            above what the respondent's baseline and segment would have
            predicted. Use this view for paid media targeting decisions (where
            will spending budget produce attitudinal movement).
          </p>
          <p>
            <strong style={{ color: "#60a5fa" }}>BASE MESSAGING.</strong>{" "}
            Cell value = engagement-weighted within-segment alignment deviation.
            This measures whether the audience that engages with a specific
            variant is already more aligned than their segment's baseline. Use
            this view for owned-channel content decisions (what to put in
            supporter emails, fundraising appeals, and content that reinforces
            the base without alienating it).
          </p>
          <p style={{ color: C.textDim }}>
            The two outcomes typically correlate weakly across cells, confirming
            they measure operationally distinct phenomena.
          </p>

          <h4 style={{ color: C.text, fontSize: 12, marginTop: 14, marginBottom: 4 }}>
            How each cell value is computed
          </h4>
          <p>
            <strong>Step 1: engagement-weighted mean.</strong> Among
            respondents assigned to <code>(s, a, t)</code> who saw message{" "}
            <code>m</code>:
            {" "}<code style={{ color: C.violet, fontFamily: MONO }}>
              lift_raw = Σ (outcome_i × bw_score_im) / Σ |bw_score_im|
            </code>{" "}where <code>bw_score_im</code> is respondent <code>i</code>'s
            Best-Worst differential for message <code>m</code>. Signed B-W in
            the numerator = engagement direction × outcome direction. Absolute
            B-W in the denominator = engagement intensity regardless of
            direction.
          </p>
          <p>
            <strong>Step 2: empirical Bayes shrinkage.</strong> Cells with
            small <em>n</em> are pulled toward the message's overall marginal:
            {" "}<code style={{ color: C.violet, fontFamily: MONO }}>
              w = (n/σ²<sub>within</sub>) / (n/σ²<sub>within</sub> + 1/σ²<sub>between</sub>)
            </code>{" "}and{" "}<code style={{ color: C.violet, fontFamily: MONO }}>
              lift_shrunk = w·lift_raw + (1−w)·message_marginal
            </code>. Large stable cells retain raw; small/noisy cells move
            toward the message average. The shrinkage weight per cell is in
            tooltips for diagnostic transparency.
          </p>
          <p>
            <strong>Step 3: bootstrap confidence intervals.</strong>{" "}
            Respondent-level resampling with replacement, 500 iterations, fixed
            seed for reproducibility. The reported 95% CI is the 2.5th and
            97.5th percentiles of the cell's bootstrap distribution. A cell is
            statistically significant if its CI strictly excludes zero.
          </p>

          <h4 style={{ color: C.text, fontSize: 12, marginTop: 14, marginBottom: 4 }}>
            Interpretation conventions
          </h4>
          <p>
            <strong>+0.20 under PERSUASION:</strong> respondents in this cell
            shifted +0.20 points on the composite scale above what their
            baseline and segment predicted. Effect sizes in well-designed
            message tests typically range from 0.05 to 0.30. Values above 0.40
            warrant outlier scrutiny; values below 0.05 are within sampling
            noise.
          </p>
          <p>
            <strong>+0.20 under BASE:</strong> respondents who engaged with
            this variant were 0.20 points more aligned at baseline than their
            segment's average. This is a selection signal, not a causal claim.
          </p>

          <h4 style={{ color: C.text, fontSize: 12, marginTop: 14, marginBottom: 4 }}>
            Methodological limitations
          </h4>
          <p>
            <strong>Cell sample sizes vary.</strong> Priority segments are
            typically oversampled to support more reliable cell estimates;
            non-priority segments are smaller. Shrinkage handles this honestly
            but reduces resolution on thin cells.
          </p>
          <p>
            <strong>Multiple testing.</strong> With many cells per outcome,
            raw significance at α=0.05 would produce a non-trivial number of
            false positives. No correction applied — operational decisions
            should rely on patterns across a message-token family, not on
            individual cell p-values. Treat single-cell significance as
            exploratory.
          </p>
          <p>
            <strong>Reverse causality.</strong> Positive lift indicates
            engagement is associated with attitudinal movement. Pre-post timing
            plus residualization on pre-composite mitigates but does not
            eliminate the possibility that movement preceded engagement.
          </p>
          <p>
            <strong>Sample composition.</strong> Results apply to the survey
            panel's representation of the population sampled. Generalization to
            specific subpopulations (registered voters, specific media
            audiences) requires weighting or re-fielding.
          </p>
        </div>
      </details>

      {/* ─── PROVENANCE FOOTER ─── */}
      <div style={{
        marginTop: 12, padding: "10px 14px",
        fontSize: 10, color: C.textDim, fontFamily: MONO, letterSpacing: 0.5,
        background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 6,
      }}>
        <strong style={{ color: C.textMuted }}>{dashboard.study?.id}</strong>{" "}
        · {dashboard.study?.version} · Analyst: {dashboard.study?.analyst} ·
        N={dashboard.study?.n_total || "—"} ·
        Active basket: <span style={{ color: C.text }}>{activeBasket?.name}</span>{" "}
        ({activeBasket?.segments?.length} segments) ·
        Outcome: <span style={{ color: C.text }}>{activeMetric?.label}</span>{" "}
        (σ<sub>within</sub>={activeMetric?.sigma_within?.toFixed(3)})
      </div>
    </div>
  );
}

// Exported for B5 (priority-basket reorganization) — not used here yet.
export { PRIORITY_ORDERED_BY_ROI };
