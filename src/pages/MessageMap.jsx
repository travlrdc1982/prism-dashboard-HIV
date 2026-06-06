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
import { useState } from "react";
import dashboard from "../data/topline/dashboard.json";
import { C, FONT, MONO, partyColor } from "../data/theme";
import { STUDY_METRICS } from "../data/study";
import PageHeader from "../components/PageHeader";
import InfoDot from "../components/InfoDot";

// ─── Data wiring (frame only — cells render in B2) ───
const SEGMENTS = dashboard.segments;             // 16 segments
const MESSAGES = dashboard.messages || [];       // 17 message-theme records
const BASKETS  = dashboard.baskets  || [];       // 5 baskets
const METRICS  = dashboard.lift_variants || [];  // persuasion / base

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
// CELL-ARCHITECTURE INTERACTIVE WIDGET
// ═══════════════════════════════════════════════════════════════
// One cohesive square that unfolds:
//   • Click "+ persona" — the right half slides out from the CORE left
//     half (transformOrigin: left, scaleX 0→1). The whole shape stays
//     a single bordered square the entire time.
//   • Click "▸ proof tokens" — horizontal dashed cuts slide into the
//     same square, creating base/proof-1/proof-2/proof-3 stripes.
// All labels (CORE, PERSONA, base/proof-N) sit OUTSIDE the square.
function CellArchitectureWidget() {
  const [personaOpen, setPersonaOpen] = useState(false);
  const [proofsOpen,  setProofsOpen]  = useState(false);

  const HALF_W   = 60;        // each half-cell width
  const LABEL_W  = 54;        // gutter for left-side row labels
  const H_ROW    = 20;        // every row inside the square
  const PROOFS   = ["Proof 1", "Proof 2", "Proof 3"];

  const tokenCut    = "1.5px dashed #64748b";
  const personaCut  = "1.5px dashed #60a5fa";
  const borderColor = "#94a3b8";

  return (
    <div style={{
      flexShrink: 0,
      padding: "10px 12px 12px",
      background: C.card,
      border: `1px solid ${C.cardBorder}`,
      borderRadius: 6,
      width: 240,
    }}>
      {/* Title */}
      <div style={{
        fontFamily: MONO, fontSize: 7, color: C.textDim,
        letterSpacing: 1.5, textTransform: "uppercase",
        marginBottom: 10, display: "flex", alignItems: "center",
      }}>
        Cell Architecture
        <InfoDot title="Cell architecture">
          Each cell is one (message × segment × persona × proof token)
          combination. Click below to unfold the persona half and the
          proof-token rows.
        </InfoDot>
      </div>

      {/* ─── Diagram ─── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `${LABEL_W}px auto`,
        rowGap: 0, columnGap: 0, marginBottom: 12,
      }}>
        {/* Top-left empty corner */}
        <div />
        {/* Top labels: CORE | PERSONA (outside the square) */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `${HALF_W}px ${personaOpen ? HALF_W : 0}px`,
          transition: "grid-template-columns 0.28s ease",
          paddingBottom: 4,
        }}>
          <div style={{
            textAlign: "center",
            fontFamily: MONO, fontSize: 8, fontWeight: 700,
            color: "#cbd5e1", letterSpacing: 1, textTransform: "uppercase",
          }}>Core</div>
          <div style={{
            textAlign: "center", overflow: "hidden",
            fontFamily: MONO, fontSize: 8, fontWeight: 700,
            color: "#60a5fa", letterSpacing: 1, textTransform: "uppercase",
            opacity: personaOpen ? 1 : 0,
            transition: "opacity 0.2s 0.1s",
          }}>Persona</div>
        </div>

        {/* Left labels column — base + (optional) proof rows */}
        <div style={{ display: "flex", flexDirection: "column", paddingRight: 6 }}>
          <div style={{
            height: H_ROW, display: "flex", alignItems: "center", justifyContent: "flex-end",
            fontFamily: FONT, fontSize: 9, fontWeight: 600,
            color: proofsOpen ? C.textMuted : "transparent",
            fontStyle: "italic", transition: "color 0.2s",
          }}>base</div>
          {proofsOpen && PROOFS.map(label => (
            <div key={label} style={{
              height: H_ROW, display: "flex", alignItems: "center", justifyContent: "flex-end",
              fontFamily: FONT, fontSize: 9, fontWeight: 600, color: C.text,
            }}>{label}</div>
          ))}
        </div>

        {/* The unified square — single border, internal dashed cuts */}
        <div style={{
          border: `1.5px solid ${borderColor}`,
          borderRadius: 3,
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: `${HALF_W}px ${personaOpen ? HALF_W : 0}px`,
          transition: "grid-template-columns 0.28s ease",
        }}>
          {/* CORE column */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ height: H_ROW, background: "#334155" }} />
            {proofsOpen && PROOFS.map((_, i) => (
              <div key={i} style={{
                height: H_ROW, background: "#1e293b",
                borderTop: tokenCut,
              }} />
            ))}
          </div>
          {/* PERSONA column — unfolds from left edge */}
          <div style={{
            display: "flex", flexDirection: "column",
            borderLeft: personaOpen ? personaCut : "none",
            transformOrigin: "left center",
            transform: personaOpen ? "scaleX(1)" : "scaleX(0)",
            transition: "transform 0.28s ease",
            overflow: "hidden",
          }}>
            <div style={{ height: H_ROW, background: "rgba(96,165,250,0.22)" }} />
            {proofsOpen && PROOFS.map((_, i) => (
              <div key={i} style={{
                height: H_ROW, background: "rgba(96,165,250,0.12)",
                borderTop: tokenCut,
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* Controls below the diagram */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <button
          type="button"
          onClick={() => setPersonaOpen(s => !s)}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "4px 6px",
            background: "transparent", border: "none", cursor: "pointer",
            fontFamily: MONO, fontSize: 9, color: "#60a5fa", fontWeight: 700,
            letterSpacing: 0.5, outline: "none",
          }}
        >
          <span style={{ width: 10, color: "#60a5fa" }}>{personaOpen ? "−" : "+"}</span>
          {personaOpen ? "fold persona" : "unfold persona half"}
        </button>
        <button
          type="button"
          onClick={() => setProofsOpen(s => !s)}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "4px 6px",
            background: "transparent", border: "none", cursor: "pointer",
            fontFamily: MONO, fontSize: 9, color: C.violet, fontWeight: 700,
            letterSpacing: 0.5, outline: "none",
          }}
        >
          <span style={{
            transform: proofsOpen ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.18s", display: "inline-block",
            width: 10,
          }}>▸</span>
          {proofsOpen ? "hide proof tokens" : "cut into proof tokens"}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SMALL UI HELPERS
// ═══════════════════════════════════════════════════════════════

function SegmentCircle({ seg, dim = false }) {
  const pc = partyColor(seg.party);
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      opacity: dim ? 0.35 : 1, transition: "opacity 0.15s",
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: "50%",
        border: `2px solid ${pc}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 8, fontWeight: 800, color: pc,
        fontFamily: MONO, background: "transparent",
      }}>{seg.code}</div>
      <div style={{
        fontSize: 7, color: pc, fontFamily: MONO, fontWeight: 700, letterSpacing: 0.5,
      }}>{seg.pct}%</div>
    </div>
  );
}

function ControlSelect({ label, value, options, onChange, info, infoTitle }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{
        fontFamily: MONO, fontSize: 7, color: C.textDim,
        letterSpacing: 1.5, textTransform: "uppercase",
        display: "flex", alignItems: "center",
      }}>
        {label}
        {info && <InfoDot title={infoTitle} placement="below">{info}</InfoDot>}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          fontFamily: FONT, fontSize: 11, fontWeight: 600,
          background: C.card, color: C.white,
          border: `1px solid ${C.cardBorder}`,
          borderRadius: 4, padding: "5px 24px 5px 10px",
          cursor: "pointer", appearance: "none",
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 5'><path fill='%2394a3b8' d='M0 0l4 5 4-5z'/></svg>")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 8px center",
          backgroundSize: "8px 5px",
          outline: "none",
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function ActionBtn({ label, onClick, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: MONO, fontSize: 9, fontWeight: 600,
        letterSpacing: 1, textTransform: "uppercase",
        background: "transparent",
        color: disabled ? C.textDim : C.textMuted,
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 4, padding: "5px 10px",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.15s",
      }}
    >{label}</button>
  );
}

// 0–100 lift color ramp (red → white → green) — refined in B2.
function LiftRamp() {
  const stops = [
    { v: 0,   bg: "#7f1d1d", t: "#fecaca" },
    { v: 25,  bg: "#b1574c", t: "#fde2dd" },
    { v: 50,  bg: "#f1f5f9", t: "#0f172a" },
    { v: 75,  bg: "#3f8a5c", t: "#dcfce7" },
    { v: 100, bg: "#14532d", t: "#bbf7d0" },
  ];
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {stops.map(s => (
        <div key={s.v} style={{
          width: 28, height: 16, background: s.bg,
          border: `1px solid ${C.cardBorder}`, borderRadius: 2,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 7, color: s.t, fontFamily: MONO, fontWeight: 700,
        }}>{s.v}</div>
      ))}
    </div>
  );
}

// Variant-Universe column header — visual legend lives HERE, not in popup.
// Mini SVG demo: band + open circle (CORE) + filled dot (optimal) +
// dashed zero line + live green tick.
function VariantUniverseLegend() {
  const W = 130, H = 22;
  const cx = W / 2;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* Band */}
      <rect x="14" y="8" width={W - 28} height="6"
            fill="rgba(52,211,153,0.25)" stroke="#34d399" strokeWidth="0.8" rx="2" />
      {/* Dashed zero */}
      <line x1={cx} y1="2" x2={cx} y2={H - 2}
            stroke="#64748b" strokeWidth="1" strokeDasharray="2,2" />
      {/* Open circle = CORE */}
      <circle cx="34" cy="11" r="3.2" fill="none" stroke="#34d399" strokeWidth="1.5" />
      {/* Filled dot = OPTIMAL */}
      <circle cx={W - 30} cy="11" r="3.2" fill="#34d399" />
      {/* Live tick */}
      <line x1={W - 50} y1="3" x2={W - 50} y2={H - 3}
            stroke="#34d399" strokeWidth="1.8" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function MessageMap() {
  const hasData = MESSAGES.length > 0
    && dashboard.message_map_cells
    && Object.keys(dashboard.message_map_cells).length > 0;

  const defaultMetric = METRICS[0]?.name || "persuasion_messaging";
  const [metric, setMetric] = useState(defaultMetric);
  const [basket, setBasket] = useState("total");

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

  const activeBasket = BASKETS.find(b => b.id === basket) || BASKETS[0];
  const activeMetric = METRICS.find(m => m.name === metric) || METRICS[0];
  const orderedSegments = SEGMENTS;

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
                <div key={seg.id} style={{
                  height: 24, margin: "0 1px", borderRadius: 2,
                  background: "rgba(148,163,184,0.06)",
                  border: `1px dashed ${C.cardBorder}`,
                }} />
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
