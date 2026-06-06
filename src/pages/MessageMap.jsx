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
// COMMIT B1 — skeleton only. Header / controls / legend / hint /
// empty grid frame. No data wiring, no interactivity. Subsequent
// commits B2–B6 add cell rendering, drill-down, hover, priority
// reorganization, and the variant-universe strip.
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import dashboard from "../data/topline/dashboard.json";
import { C, FONT, MONO, partyColor } from "../data/theme";
import { STUDY_METRICS } from "../data/study";

// ─── Data wiring (frame only — cells render in B2) ───
const SEGMENTS = dashboard.segments;          // 16 segments, ordered TSP…GHI
const MESSAGES = dashboard.messages || [];    // 17 message-theme records
const BASKETS  = dashboard.baskets  || [];    // 5 basket definitions
const METRICS  = dashboard.lift_variants || []; // [persuasion_messaging, base_messaging]

// Theme colour swatches for the message-theme dots / legend row.
// Keys match the THEMES emitted by messagemap; extend as new themes appear.
const THEME_COLORS = {
  "THE ONGOING EPIDEMIC":          "#f87171",
  "PREVENTION":                    "#34d399",
  "TREATMENT":                     "#60a5fa",
  "ACCESS & EQUITY":               "#a78bfa",
  "ECONOMIC CASE":                 "#fbbf24",
  "PUBLIC HEALTH INFRASTRUCTURE":  "#22d3ee",
  "INNOVATION":                    "#2dd4bf",
  "PATIENT EXPERIENCE":            "#fb7185",
  "STIGMA & SOCIAL NORMS":         "#f59e0b",
};
function themeColor(label) {
  return THEME_COLORS[label] || C.steel;
}

// Priority basket → segment IDs ordered by ROI desc (from STUDY_METRICS).
// Used by B5 to cluster priority segments left-to-right.
const PRIORITY_BASKET = (BASKETS.find(b => b.id === "priority_all") || { segments: [] }).segments;
const PRIORITY_ORDERED_BY_ROI = [...PRIORITY_BASKET].sort((a, b) => {
  const ca = SEGMENTS.find(s => s.id === a)?.code;
  const cb = SEGMENTS.find(s => s.id === b)?.code;
  return (STUDY_METRICS[cb]?.roi || 0) - (STUDY_METRICS[ca]?.roi || 0);
});

// ─── small UI building-blocks ───

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
        fontFamily: MONO,
        background: "transparent",
      }}>{seg.code}</div>
      <div style={{
        fontSize: 7, color: pc, fontFamily: MONO, fontWeight: 700,
        letterSpacing: 0.5,
      }}>{seg.pct}%</div>
    </div>
  );
}

function ControlSelect({ label, value, options, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{
        fontFamily: MONO, fontSize: 7, color: C.textDim,
        letterSpacing: 1.5, textTransform: "uppercase",
      }}>{label}</span>
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
        background: "transparent", color: disabled ? C.textDim : C.textMuted,
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 4, padding: "5px 10px",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.15s",
      }}
    >{label}</button>
  );
}

// ─── Legend: 0-100 lift scale + theme dots ───
function LiftLegend() {
  // 0-100 scale stops (low → high) — final palette refined in B2.
  const stops = [
    { v: 0,   bg: "#7f1d1d", t: "#fecaca" },
    { v: 25,  bg: "#3f1d1d", t: "#fda4af" },
    { v: 50,  bg: "#1f2937", t: "#94a3b8" },
    { v: 75,  bg: "#14532d", t: "#a7f3d0" },
    { v: 100, bg: "#14532d", t: "#34d399" },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <span style={{ fontFamily: MONO, fontSize: 7, color: C.textDim, letterSpacing: 1.5 }}>
        LIFT (0–100):
      </span>
      <div style={{ display: "flex", gap: 2 }}>
        {stops.map(s => (
          <div key={s.v} style={{
            width: 26, height: 14, background: s.bg,
            border: `1px solid ${C.cardBorder}`, borderRadius: 2,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 7, color: s.t, fontFamily: MONO, fontWeight: 700,
          }}>{s.v}</div>
        ))}
      </div>
      <span style={{ fontFamily: MONO, fontSize: 7, color: C.textDim, letterSpacing: 1.5, marginLeft: 8 }}>
        THEME:
      </span>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {Object.entries(THEME_COLORS).map(([t, col]) => (
          <div key={t} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: col }} />
            <span style={{ fontSize: 8, color: C.textMuted, fontFamily: MONO, letterSpacing: 0.5 }}>
              {t}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function MessageMap() {
  // Wave-1 fallback — render a "not yet scored" placeholder if the
  // messagemap pipeline hasn't merged into dashboard.json yet.
  const hasData = MESSAGES.length > 0
    && dashboard.message_map_cells
    && Object.keys(dashboard.message_map_cells).length > 0;

  const defaultMetric = METRICS[0]?.name || "persuasion_messaging";
  const [metric, setMetric] = useState(defaultMetric);
  const [basket, setBasket] = useState("total");

  if (!hasData) {
    return (
      <div style={{ maxWidth: 800, margin: "40px auto", color: C.textMuted, fontFamily: FONT }}>
        <div style={{
          background: C.card, border: `1px solid ${C.cardBorder}`,
          borderRadius: 6, padding: "20px 24px", fontSize: 12,
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

  // Segment ordering — B5 will re-order priority basket by ROI desc and
  // fade non-priority. For B1 we render the canonical 16 in default order.
  const orderedSegments = SEGMENTS;

  return (
    <div style={{ color: C.text, fontFamily: FONT, maxWidth: 1800, margin: "0 auto" }}>

      {/* ─── TITLE BLOCK ─── */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{
          margin: 0, fontFamily: FONT, fontSize: 22, fontWeight: 800,
          color: C.white, letterSpacing: 0.2,
        }}>Message Map</h1>
        <div style={{ marginTop: 6, fontSize: 12, color: C.textMuted, maxWidth: 1100, lineHeight: 1.55 }}>
          <strong style={{ color: C.text }}>Persuasion × persona × proof.</strong>{" "}
          Cells show <em>lift</em> — how much each message variant moves attitudinal
          alignment above baseline, on a 0–100 scale.
          Each segment cell is split <span style={{ color: C.text }}>CORE&nbsp;|&nbsp;PERSONA-tuned</span>.
          Click a row chevron to drill into the full message wording and proof points.
        </div>
        <div style={{
          marginTop: 8, fontSize: 9, color: C.textDim,
          fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase",
        }}>
          {MESSAGES.length} MESSAGES · {orderedSegments.length} PRISM SEGMENTS ·
          MaxDiff · Shrunk lift, 500-iter respondent bootstrap CIs
        </div>
      </div>

      {/* ─── CONTROLS BAR ─── */}
      <div style={{
        display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap",
        padding: "10px 14px",
        background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 6,
        marginBottom: 12,
      }}>
        <ControlSelect
          label="Metric"
          value={metric}
          onChange={setMetric}
          options={METRICS.map(m => ({ value: m.name, label: m.label }))}
        />
        <ControlSelect
          label="Basket"
          value={basket}
          onChange={setBasket}
          options={BASKETS.map(b => ({ value: b.id, label: b.name }))}
        />

        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <ActionBtn label="Expand all" disabled />
          <ActionBtn label="Collapse all" disabled />
          <ActionBtn label="Unpin all" disabled />
        </div>
      </div>

      {/* ─── LEGEND ─── */}
      <div style={{ marginBottom: 10 }}>
        <LiftLegend />
      </div>

      {/* ─── HINT BAR ─── */}
      <div style={{
        fontSize: 10, color: C.textMuted, fontFamily: MONO, letterSpacing: 0.5,
        marginBottom: 12, padding: "6px 10px",
        background: "rgba(167,139,250,0.06)",
        border: `1px solid rgba(167,139,250,0.18)`,
        borderRadius: 4,
      }}>
        <span style={{ color: C.violet, fontWeight: 700 }}>HINT · </span>
        Each cell splits <em>CORE</em>&nbsp;(left) | <em>PERSONA-tuned</em>&nbsp;(right) ·
        hover to see the variant text · click ▸ to drill into proof points ·
        click any cell to pin its detail
      </div>

      {/* ─── GRID FRAME ─── */}
      <div style={{
        background: C.card, border: `1px solid ${C.cardBorder}`,
        borderRadius: 6, overflow: "hidden",
      }}>
        {/* Segment-circle header row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `36px 220px repeat(${orderedSegments.length}, minmax(56px, 1fr))`,
          gap: 0,
          padding: "10px 12px",
          borderBottom: `1px solid ${C.cardBorder}`,
          background: C.bg,
        }}>
          <div /> {/* chevron gutter */}
          <div style={{
            display: "flex", flexDirection: "column", justifyContent: "flex-end",
            paddingRight: 10, paddingBottom: 4,
          }}>
            <span style={{
              fontFamily: MONO, fontSize: 8, color: C.textDim,
              letterSpacing: 1.5, textTransform: "uppercase",
            }}>Message · Theme</span>
            <span style={{
              fontFamily: MONO, fontSize: 9, color: C.text,
              marginTop: 4, letterSpacing: 0.5,
            }}>{activeMetric?.label || ""}</span>
          </div>
          {orderedSegments.map(seg => (
            <div key={seg.id} style={{ display: "flex", justifyContent: "center" }}>
              <SegmentCircle seg={seg} />
            </div>
          ))}
        </div>

        {/* Body — placeholder rows for the 17 message themes.
            B2 replaces each row with the live split-cell grid. */}
        <div>
          {MESSAGES.map((m, i) => (
            <div key={m.id} style={{
              display: "grid",
              gridTemplateColumns: `36px 220px repeat(${orderedSegments.length}, minmax(56px, 1fr))`,
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
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: themeColor(m.theme_label), flexShrink: 0,
                }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontFamily: MONO, fontSize: 9, color: C.textDim,
                    letterSpacing: 0.5,
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
            </div>
          ))}
        </div>
      </div>

      {/* ─── FOOTER ─── */}
      <div style={{
        marginTop: 14, padding: "12px 14px",
        fontSize: 10, color: C.textDim, fontFamily: MONO, letterSpacing: 0.5,
        background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 6,
      }}>
        <strong style={{ color: C.textMuted }}>{dashboard.study?.id}</strong>{" "}
        · {dashboard.study?.version} · Analyst: {dashboard.study?.analyst} ·
        N={dashboard.study?.n_total || "—"} ·
        Active basket: <span style={{ color: C.text }}>{activeBasket?.name}</span>{" "}
        ({activeBasket?.segments?.length} segments) ·
        Metric: <span style={{ color: C.text }}>{activeMetric?.label}</span>{" "}
        (σ<sub>within</sub>={activeMetric?.sigma_within?.toFixed(3)})
      </div>
    </div>
  );
}

// Exported for B5 (priority-basket reorganization) — not used in B1.
export { PRIORITY_ORDERED_BY_ROI };
