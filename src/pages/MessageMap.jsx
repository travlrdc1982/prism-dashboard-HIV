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
// COMMIT B1.5 — frame + chrome:
//   • Standardized PageHeader (RESERVOIR HEALTH PRISM · MESSAGE MAP)
//   • Updated description copy (persuasion vs base framing)
//   • Cell-architecture legend graphic on the right
//   • InfoDot popovers on every control + column header
//   • PROOF POINTS sub-orientation note
//   • VARIANT UNIVERSE STRIP column placeholder w/ tooltip
//   • Methodology footnote at bottom
//   • Theme color key removed (per "eliminate message categories")
//
// Live cell rendering, hover-variant text, drill-down, priority basket
// reorganization, and the variant-universe data still land in B2–B6.
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import dashboard from "../data/topline/dashboard.json";
import { C, FONT, MONO, partyColor } from "../data/theme";
import { STUDY_METRICS } from "../data/study";
import PageHeader from "../components/PageHeader";
import InfoDot from "../components/InfoDot";

// ─── Data wiring (frame only — cells render in B2) ───
const SEGMENTS = dashboard.segments;          // 16 segments, ordered TSP…GHI
const MESSAGES = dashboard.messages || [];    // 17 message-theme records
const BASKETS  = dashboard.baskets  || [];    // 5 basket definitions
const METRICS  = dashboard.lift_variants || []; // [persuasion_messaging, base_messaging]

// Priority basket → segment IDs ordered by ROI desc (from STUDY_METRICS).
// Used by B5 to cluster priority segments left-to-right.
const PRIORITY_BASKET = (BASKETS.find(b => b.id === "priority_all") || { segments: [] }).segments;
const PRIORITY_ORDERED_BY_ROI = [...PRIORITY_BASKET].sort((a, b) => {
  const ca = SEGMENTS.find(s => s.id === a)?.code;
  const cb = SEGMENTS.find(s => s.id === b)?.code;
  return (STUDY_METRICS[cb]?.roi || 0) - (STUDY_METRICS[ca]?.roi || 0);
});

// ═══════════════════════════════════════════════════════════════
// CELL-ARCHITECTURE LEGEND (top-right of header)
// ═══════════════════════════════════════════════════════════════
// SVG diagram explaining how each row's cell space decomposes:
//   - CORE message vs PERSONA-tuned message variant (vertical split)
//   - Base row + proof-token rows (horizontal stack)
function ArchitectureLegend() {
  const W = 320;
  const H = 230;
  const colCoreX = 90;
  const colPersonaX = 198;
  const cellW = 96;
  const divX = 174;            // vertical dashed divider
  const labelY = 32;
  const headerTop = 50;
  const headerH = 56;
  const sepY = headerTop + headerH + 14;
  const tokenStartY = sepY + 12;
  const tokenH = 28;
  const tokenGap = 4;

  const coreFill = "#1f2937";
  const coreFillDark = "#0f172a";
  const personaFill = "rgba(96,165,250,0.18)";
  const personaStroke = "#60a5fa";
  const coreStroke = "#94a3b8";
  const accent = "#60a5fa";

  return (
    <div style={{
      flexShrink: 0,
      background: C.card,
      border: `1px solid ${C.cardBorder}`,
      borderRadius: 8,
      padding: "10px 12px",
      width: W + 24,
    }}>
      <div style={{
        fontFamily: MONO, fontSize: 8, color: C.textDim,
        letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4,
      }}>Cell Architecture</div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Column labels */}
        <text x={colCoreX} y={labelY - 4} textAnchor="middle"
              fontFamily="'Nunito',sans-serif" fontSize="10" fontWeight="800"
              fill="#94a3b8" letterSpacing="0.5">CORE</text>
        <text x={colCoreX} y={labelY + 8} textAnchor="middle"
              fontFamily="'Nunito',sans-serif" fontSize="10" fontWeight="800"
              fill="#94a3b8" letterSpacing="0.5">MESSAGE</text>

        {/* Persona avatar */}
        <circle cx={colPersonaX} cy={labelY - 8} r="9" fill="rgba(96,165,250,0.18)" stroke={accent} strokeWidth="1.5" />
        <circle cx={colPersonaX} cy={labelY - 11} r="3" fill={accent} />
        <path d={`M${colPersonaX - 5} ${labelY - 3} Q${colPersonaX} ${labelY - 7} ${colPersonaX + 5} ${labelY - 3}`}
              fill={accent} />

        <text x={colPersonaX} y={labelY + 10} textAnchor="middle"
              fontFamily="'Nunito',sans-serif" fontSize="10" fontWeight="800"
              fill={accent} letterSpacing="0.5">PERSONA-TUNED</text>
        <text x={colPersonaX} y={labelY + 22} textAnchor="middle"
              fontFamily="'Nunito',sans-serif" fontSize="10" fontWeight="800"
              fill={accent} letterSpacing="0.5">MESSAGE VARIANT</text>

        {/* Header (base) row — two boxes */}
        <rect x={colCoreX - cellW / 2} y={headerTop} width={cellW} height={headerH}
              fill={coreFill} stroke={coreStroke} strokeWidth="1.5" rx="2" />
        <rect x={colPersonaX - cellW / 2} y={headerTop} width={cellW} height={headerH}
              fill={personaFill} stroke={personaStroke} strokeWidth="2" rx="2" />

        {/* Dashed vertical divider down the middle */}
        <line x1={divX} y1={headerTop - 2} x2={divX} y2={H - 8}
              stroke={personaStroke} strokeWidth="1.5" strokeDasharray="4,3" />

        {/* Dashed horizontal divider between header and tokens */}
        <line x1="8" y1={sepY} x2={W - 8} y2={sepY}
              stroke="#475569" strokeWidth="1.5" strokeDasharray="5,3" />

        {/* Three token rows */}
        {[
          { label: "{no proof point}", coreColor: coreFill },
          { label: "Proof Point 1",    coreColor: coreFillDark },
          { label: "Proof Point 2",    coreColor: coreFillDark },
        ].map((row, i) => {
          const y = tokenStartY + i * (tokenH + tokenGap);
          return (
            <g key={i}>
              {/* Row label on far left */}
              <text x="4" y={y + tokenH / 2 + 3} textAnchor="start"
                    fontFamily="'Nunito',sans-serif" fontSize="9"
                    fill={i === 0 ? "#64748b" : "#cbd5e1"}>
                {row.label}
              </text>
              <rect x={colCoreX - cellW / 2 + 14} y={y} width={cellW - 14} height={tokenH}
                    fill={row.coreColor} stroke={coreStroke} strokeWidth="1" rx="2" />
              <rect x={colPersonaX - cellW / 2} y={y} width={cellW} height={tokenH}
                    fill={personaFill} stroke={personaStroke} strokeWidth="1.2" rx="2" />
            </g>
          );
        })}
      </svg>
      <div style={{
        fontFamily: "'Nunito',sans-serif", fontSize: 10, color: C.textMuted,
        marginTop: 4, lineHeight: 1.4,
      }}>
        Each row in the table is a message theme; each segment column splits
        into a <strong style={{ color: C.text }}>CORE</strong> half and a{" "}
        <strong style={{ color: accent }}>PERSONA-tuned</strong> half. Expand a
        row to see its proof-token grid.
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

function ControlSelect({ label, value, options, onChange, info }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{
        fontFamily: MONO, fontSize: 7, color: C.textDim,
        letterSpacing: 1.5, textTransform: "uppercase",
        display: "flex", alignItems: "center",
      }}>
        {label}
        {info && <InfoDot label={`${label} info`} placement="below">{info}</InfoDot>}
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

  // Segment ordering — B5 reorders priority basket by ROI desc and fades
  // non-priority. For B1.5 we render the canonical 16 in default order.
  const orderedSegments = SEGMENTS;

  // ─── tooltip copy (kept inline so reviewers can edit in one place) ───
  const OUTCOME_INFO = (
    <>
      <strong>Two views of the same cells.</strong>{" "}
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
      Filter a specific group. <strong>Baskets</strong> are study-specific
      groupings of segments that reflect this study's priorities (typically:
      priority audiences for persuasion, primary or secondary audiences by
      partisanship or some other strategic frame).{" "}
      <strong>TOTAL</strong> shows the full sample without basket restriction.
    </>
  );

  const COLOR_INFO = (
    <>
      <strong>Greener</strong> cells indicate stronger positive lift;{" "}
      <strong>redder</strong> cells indicate the message backfires (leads to
      negative shifts in opinion); <strong>white</strong> cells indicate
      negligible effect.{" "}
      <em>Note: cell values depict how much each message variant moves
      attitudinal alignment above baseline, on a 0–100 scale.</em>
    </>
  );

  const SEGMENT_INFO = (
    <>
      The 16 PRISM segments derived from cultural-ideological clustering of
      the US public. <em>Click a segment label to see its full profile in the
      Persona Profile view.</em>
    </>
  );

  const MESSAGE_INFO = (
    <>
      The substantive message themes using PRISM's "message grammar"
      methodology, tested using a discrete choice methodology (MaxDiff
      exercise). <em>Click any message label to see the "core message" — the
      precise wording a subset of respondents are exposed to.</em>
    </>
  );

  const PROOF_INFO = (
    <>
      <strong>Proof points</strong> for the messages were tested with subsets
      of respondents to assess the marginal impact in overall message impact.
      Expand a row's proof-token grid via the ▸ chevron.
    </>
  );

  const VARIANT_UNIVERSE_INFO = (
    <>
      <strong>A one-dimensional projection of a four-dimensional cell
      space</strong> (message × segment × persona tuning × proof token),
      reduced to the most operationally useful summary of a single message's
      performance. Each row's strip summarizes the range of message impact
      scores across every combination of persona framing × proof token,
      evaluated against every PRISM segment.
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #334155", fontSize: 10 }}>
        <div style={{ marginBottom: 4 }}>
          <span style={{
            display: "inline-block", width: 14, height: 6, background: "rgba(52,211,153,0.4)",
            border: "1px solid #34d399", borderRadius: 2, marginRight: 6, verticalAlign: "middle",
          }} />
          <strong>Green band:</strong> range from worst- to best-performing variant.
        </div>
        <div style={{ marginBottom: 4 }}>
          <span style={{
            display: "inline-block", width: 10, height: 10, borderRadius: "50%",
            border: "1.5px solid #34d399", background: "transparent",
            marginRight: 6, verticalAlign: "middle",
          }} />
          <strong>Open circle:</strong> CORE (untuned baseline), basket-weighted.
        </div>
        <div style={{ marginBottom: 4 }}>
          <span style={{
            display: "inline-block", width: 10, height: 10, borderRadius: "50%",
            background: "#34d399", marginRight: 6, verticalAlign: "middle",
          }} />
          <strong>Filled dot:</strong> Optimal variant for the selected basket.
        </div>
        <div style={{ marginBottom: 4 }}>
          <span style={{
            display: "inline-block", width: 14, height: 0, borderTop: "1.5px dashed #64748b",
            marginRight: 6, verticalAlign: "middle",
          }} />
          <strong>Dashed line:</strong> zero reference (no lift vs. control).
        </div>
        <div>
          <span style={{
            display: "inline-block", width: 2, height: 10, background: "#34d399",
            marginRight: 8, verticalAlign: "middle",
          }} />
          <strong>Green tick:</strong> tracks whichever variant you're focused
          on (hover/click any cell).
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: C.textMuted }}>
        The gap between <strong>○</strong> and <strong>●</strong> is the
        persuasion <em>headroom</em>: how much lift is unlocked by persona
        tuning + best proof selection, above the untuned baseline.
      </div>
    </>
  );

  return (
    <div style={{ color: C.text, fontFamily: FONT, maxWidth: 1800, margin: "0 auto" }}>

      {/* ─── HEADER + DESCRIPTION + ARCHITECTURE LEGEND ─── */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <PageHeader title="Message Map" />
          <div style={{
            fontSize: 12, color: C.textMuted, maxWidth: 980, lineHeight: 1.6,
            marginBottom: 6,
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
          <div style={{
            fontSize: 9, color: C.textDim, fontFamily: MONO,
            letterSpacing: 1, textTransform: "uppercase", marginTop: 8,
          }}>
            {MESSAGES.length} MESSAGES · {orderedSegments.length} PRISM SEGMENTS ·
            MaxDiff · Shrunk lift, 500-iter respondent bootstrap CIs
          </div>
        </div>
        <ArchitectureLegend />
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
          value={metric}
          onChange={setMetric}
          options={METRICS.map(m => ({ value: m.name, label: m.label }))}
          info={OUTCOME_INFO}
        />
        <ControlSelect
          label="Filter (Basket)"
          value={basket}
          onChange={setBasket}
          options={BASKETS.map(b => ({ value: b.id, label: b.name }))}
          info={FILTER_INFO}
        />

        {/* Inline lift color ramp + info dot */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{
            fontFamily: MONO, fontSize: 7, color: C.textDim,
            letterSpacing: 1.5, textTransform: "uppercase",
            display: "flex", alignItems: "center",
          }}>
            Lift Scale (0–100)
            <InfoDot label="Color scale info" placement="below">{COLOR_INFO}</InfoDot>
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
        <InfoDot label="Proof points info" placement="below">{PROOF_INFO}</InfoDot>
        <span>
          Each row drills into its proof-token grid via the ▸ chevron.{" "}
          <em style={{ color: C.textDim }}>Themes are listed in the order they appeared
          in the survey design; the order does not reflect importance or ranking.</em>
        </span>
      </div>

      {/* ─── GRID FRAME ─── */}
      <div style={{
        background: C.card, border: `1px solid ${C.cardBorder}`,
        borderRadius: 6, overflow: "hidden",
      }}>
        {/* Header row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `36px 240px repeat(${orderedSegments.length}, minmax(56px, 1fr)) 140px`,
          gap: 0,
          padding: "10px 12px",
          borderBottom: `1px solid ${C.cardBorder}`,
          background: C.bg,
        }}>
          <div /> {/* chevron gutter */}

          {/* MESSAGE column header (with info dot) */}
          <div style={{
            display: "flex", flexDirection: "column", justifyContent: "flex-end",
            paddingRight: 10, paddingBottom: 4,
          }}>
            <span style={{
              fontFamily: MONO, fontSize: 8, color: C.textDim,
              letterSpacing: 1.5, textTransform: "uppercase",
              display: "flex", alignItems: "center",
            }}>
              Message
              <InfoDot label="Message column info" placement="below">{MESSAGE_INFO}</InfoDot>
            </span>
            <span style={{
              fontFamily: MONO, fontSize: 9, color: C.text,
              marginTop: 4, letterSpacing: 0.5,
              display: "flex", alignItems: "center",
            }}>
              Segment
              <InfoDot label="Segment column info" placement="below">{SEGMENT_INFO}</InfoDot>
            </span>
          </div>

          {/* Segment-circle column headers */}
          {orderedSegments.map(seg => (
            <div key={seg.id} style={{ display: "flex", justifyContent: "center" }}>
              <SegmentCircle seg={seg} />
            </div>
          ))}

          {/* VARIANT UNIVERSE column header */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "flex-end", borderLeft: `1px dashed ${C.cardBorder}`,
            paddingLeft: 8,
          }}>
            <span style={{
              fontFamily: MONO, fontSize: 8, color: C.violet,
              fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
              display: "flex", alignItems: "center",
            }}>
              Variant Universe
              <InfoDot label="Variant universe info" placement="left">{VARIANT_UNIVERSE_INFO}</InfoDot>
            </span>
            <span style={{
              fontFamily: MONO, fontSize: 7, color: C.textDim,
              marginTop: 4, letterSpacing: 0.5,
            }}>core ○  ●  optimal</span>
          </div>
        </div>

        {/* Body — placeholder rows (live cells land in B2) */}
        <div>
          {MESSAGES.map((m, i) => (
            <div key={m.id} style={{
              display: "grid",
              gridTemplateColumns: `36px 240px repeat(${orderedSegments.length}, minmax(56px, 1fr)) 140px`,
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
              {orderedSegments.map(seg => (
                <div key={seg.id} style={{
                  height: 24, margin: "0 1px", borderRadius: 2,
                  background: "rgba(148,163,184,0.06)",
                  border: `1px dashed ${C.cardBorder}`,
                }} />
              ))}
              {/* Variant Universe strip placeholder */}
              <div style={{
                marginLeft: 8, height: 24,
                background: "rgba(167,139,250,0.05)",
                border: `1px dashed rgba(167,139,250,0.3)`,
                borderRadius: 2,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: MONO, fontSize: 8, color: C.textDim, letterSpacing: 0.5,
              }}>B6</div>
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
            The same cell structure supports two distinct dependent variables,
            accessible via the top toggle:
          </p>
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

// Exported for B5 (priority-basket reorganization) — not used in B1.5.
export { PRIORITY_ORDERED_BY_ROI };
