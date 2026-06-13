// UtilityGrid — Message Utility view (diverging).
//
// Same row/column structure as SopGrid (segment columns × message
// rows + a TOTAL column), but the TOTAL column is a full-size
// horizontal DIVERGING BAR per message (the prominent visual in the
// analyst's sketch), and every cell is colored on the symmetric red
// ↔ green palette centered at 0.
//
// Data sources (already in dashboard.json):
//   per-(msg × seg)  signed score  ← message_topline[].by_segment[code].bw_mean
//   per-basket total signed score  ← sop_simple[basket].messages[].mean_bw
//   core wording     for row expand ← variants.messages[].tokens[0].text_core
//
// bw_mean / mean_bw are the raw signed Best-Worst scores; positive =
// "chosen as best" magnitude, negative = "chosen as worst." Until the
// Bayesian utility pipeline lands (prism_topline_bayes.py), these are
// the correct cross-comparable signed scores. The same view code will
// pick up the bigger Bayesian magnitudes automatically once the
// pipeline emits them.
import { Fragment, useMemo } from "react";
import dashboard from "../../data/topline/dashboard.json";
import { C, FONT, MONO } from "../../data/theme";
import SegmentCircle from "./SegmentCircle";
import { divergingBinColor } from "./liftScale";

const PER_MSG_SEG_LOOKUP = (() => {
  const out = new Map();
  for (const m of (dashboard.message_topline || [])) {
    for (const code in (m.by_segment || {})) {
      out.set(`${m.message}|${code}`, m.by_segment[code]?.bw_mean);
    }
  }
  return out;
})();

const CORE_TEXT_BY_MSG = (() => {
  const out = new Map();
  for (const m of (dashboard.variants?.messages || [])) {
    const id = parseInt(String(m.msg_id).split("_").pop(), 10);
    out.set(id, m.tokens?.[0]?.text_core || "");
  }
  return out;
})();

const COL_DIVIDER = { borderRight: "1px solid rgba(148,163,184,0.10)" };

// ── Per-segment colored value cell ───────────────────────────────
function CellBox({ value, maxAbs, spotlit = false, opacity = 1 }) {
  const { bg, text } = divergingBinColor(value, maxAbs);
  return (
    <div title={value != null ? value.toFixed(3) : "no data"}
      style={{
        height: 28, borderRadius: 2,
        background: bg, color: text,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: MONO, fontSize: 10, fontWeight: 700,
        border: spotlit
          ? "1.5px solid #7F77DD"
          : "1px solid rgba(15,21,32,0.35)",
        boxShadow: spotlit ? "0 0 0 1px rgba(127,119,221,0.35)" : "none",
        textShadow: value != null ? "0 1px 0 rgba(15,21,32,0.45)" : "none",
        opacity, transition: "opacity 0.12s",
      }}>
      {value != null ? value.toFixed(2) : "—"}
    </div>
  );
}

// ── TOTAL column: the horizontal DIVERGING BAR per message ────────
// Width axis from −maxAbs to +maxAbs (data-driven, symmetric about 0).
// The bar extends from the center line to the value, colored by the
// diverging palette. The value label sits at the end of the bar.
function DivergingBar({ value, maxAbs, width = 260, height = 26 }) {
  if (value == null || !isFinite(value) || !(maxAbs > 0)) {
    return (
      <div style={{
        height, width, display: "flex", alignItems: "center",
        justifyContent: "center", color: C.textDim,
        fontFamily: MONO, fontSize: 9,
      }}>—</div>
    );
  }
  const cx = width / 2;
  const halfW = width / 2;
  const frac = Math.max(-1, Math.min(1, value / maxAbs));
  const barW = Math.abs(frac) * halfW;
  const { bg, text } = divergingBinColor(value, maxAbs);
  const positive = value >= 0;
  const x = positive ? cx : cx - barW;
  return (
    <div style={{
      position: "relative", width, height,
      display: "flex", alignItems: "center",
    }}>
      {/* Faint axis grid (−1, −0.5, 0, +0.5, +1 fractions of maxAbs) */}
      <svg width={width} height={height}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {[0, 0.25, 0.5, 0.75, 1.0].map(t => (
          <Fragment key={t}>
            <line x1={cx + t * halfW} y1={2} x2={cx + t * halfW} y2={height - 2}
              stroke={t === 0 ? "rgba(148,163,184,0.4)" : "rgba(148,163,184,0.10)"}
              strokeWidth={t === 0 ? 1 : 0.5} />
            {t !== 0 && (
              <line x1={cx - t * halfW} y1={2} x2={cx - t * halfW} y2={height - 2}
                stroke="rgba(148,163,184,0.10)" strokeWidth={0.5} />
            )}
          </Fragment>
        ))}
      </svg>
      {/* The actual bar */}
      <div style={{
        position: "absolute", left: x, top: 4,
        width: Math.max(2, barW), height: height - 8,
        background: bg, borderRadius: 2,
        border: "1px solid rgba(15,21,32,0.35)",
        boxShadow: "0 1px 0 rgba(0,0,0,0.25)",
      }} />
      {/* Value label, anchored at the end of the bar */}
      <div style={{
        position: "absolute",
        left: positive ? cx + barW + 4 : cx - barW - 4,
        top: 0, bottom: 0,
        display: "flex", alignItems: "center",
        transform: positive ? "none" : "translateX(-100%)",
        fontFamily: MONO, fontSize: 10, fontWeight: 700,
        color: text === "#0f1520" ? "#cbd5e1" : "#f1f5f9",
        pointerEvents: "none",
      }}>{value.toFixed(2)}</div>
    </div>
  );
}

export default function UtilityGrid({
  messages, segments, basket, range,
  dragSegId, onSegDragStart, onSegDragEnd, onSegDragOver, onSegDrop,
  tier1Dim,
  colFocus, onSegmentClick,
  openRows, onToggleRow,
}) {
  // Per-message basket total (signed) for the TOTAL column.
  const totals = useMemo(() => {
    const ms = dashboard.sop_simple?.[basket]?.messages || [];
    return new Map(ms.map(r => [r.message, r.mean_bw]));
  }, [basket]);

  // Symmetric maxAbs from the data range (covers both cell and total
  // magnitudes; totals tend to be smaller but use the same scale).
  const maxAbs = useMemo(() => {
    if (!range) return 0.2;
    const a = Math.max(Math.abs(range.min), Math.abs(range.max));
    return a > 0 ? a : 0.2;
  }, [range]);

  // Default sort: TOTAL utility desc. Column spotlight overrides.
  const orderedMessages = useMemo(() => {
    if (colFocus != null) {
      const code = segments.find(s => s.id === colFocus)?.code;
      if (code) {
        const v = (mid) => PER_MSG_SEG_LOOKUP.get(`${mid}|${code}`) ?? -Infinity;
        return [...messages].sort((a, b) => v(b.id) - v(a.id));
      }
    }
    return [...messages].sort(
      (a, b) => (totals.get(b.id) ?? -Infinity) - (totals.get(a.id) ?? -Infinity)
    );
  }, [messages, segments, colFocus, totals]);

  const dim = tier1Dim || (() => 1);
  const gridTemplate =
    `28px 220px 280px ${segments.map(() => "minmax(56px, 1fr)").join(" ")}`;

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.cardBorder}`,
      borderRadius: 6, overflow: "visible", position: "relative",
      marginBottom: 12,
    }}>
      {/* ─── HEADER ROW ─── */}
      <div style={{
        display: "grid", gridTemplateColumns: gridTemplate, gap: 3,
        padding: "10px 12px",
        borderBottom: `1px solid ${C.cardBorder}`,
        background: C.bg,
        alignItems: "flex-start",
      }}>
        <div />
        <div style={{
          fontFamily: MONO, fontSize: 12, fontWeight: 700,
          letterSpacing: 1.5, textTransform: "uppercase",
          color: C.text, paddingTop: 6,
        }}>Message</div>
        <div style={{
          fontFamily: MONO, fontSize: 8, fontWeight: 700,
          letterSpacing: 1.5, textTransform: "uppercase",
          color: "#a78bfa", textAlign: "center", paddingTop: 8,
        }}>Total Utility · −{maxAbs.toFixed(2)} → +{maxAbs.toFixed(2)}</div>
        {segments.map(seg => {
          const spotlit = colFocus === seg.id;
          return (
            <div key={seg.id}
              draggable
              onDragStart={(e) => onSegDragStart?.(e, seg.id)}
              onDragEnd={onSegDragEnd}
              onDragOver={onSegDragOver}
              onDrop={(e) => onSegDrop?.(e, seg.id)}
              onClick={() => onSegmentClick?.(seg.id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 2,
                opacity: dim(seg.id),
                cursor: dragSegId === seg.id ? "grabbing" : "pointer",
                transition: "opacity 0.12s",
                position: "relative",
              }}>
              {spotlit && (
                <div style={{
                  fontFamily: MONO, fontSize: 8, fontWeight: 700,
                  color: "#7F77DD", letterSpacing: 1, lineHeight: 1,
                  marginBottom: 2,
                }}>↓ SORT</div>
              )}
              <SegmentCircle seg={seg} widened={spotlit} />
            </div>
          );
        })}
      </div>

      {/* ─── BODY ROWS ─── */}
      <div>
        {orderedMessages.map((m, i) => {
          const total = totals.get(m.id);
          const isOpen = openRows?.has(m.id);
          const last = i === orderedMessages.length - 1;
          return (
            <Fragment key={m.id}>
              <div style={{
                display: "grid", gridTemplateColumns: gridTemplate, gap: 3,
                padding: "8px 12px", alignItems: "center", minHeight: 40,
                borderBottom: (last && !isOpen) ? "none" : `1px solid ${C.cardBorder}`,
              }}>
                {/* Chevron */}
                <div onClick={() => onToggleRow?.(m.id)} style={{
                  fontFamily: MONO, fontSize: 10,
                  color: isOpen ? C.violet : C.textDim,
                  textAlign: "center", cursor: "pointer",
                  transform: isOpen ? "rotate(90deg)" : "none",
                  transition: "transform 0.2s",
                }}>▸</div>

                {/* Message label */}
                <div onClick={() => onToggleRow?.(m.id)} style={{
                  paddingRight: 10, minWidth: 0, cursor: "pointer",
                }}>
                  <div style={{
                    fontFamily: MONO, fontSize: 9, color: C.textDim,
                    letterSpacing: 0.5,
                  }}>MSG {String(m.id).padStart(2, "0")}</div>
                  <div title={m.theme_label} style={{
                    fontFamily: FONT, fontSize: 14, fontWeight: 700, color: C.text,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{m.theme_label}</div>
                </div>

                {/* TOTAL column — the horizontal diverging bar */}
                <div style={COL_DIVIDER}>
                  <DivergingBar value={total} maxAbs={maxAbs} />
                </div>

                {/* Per-segment cells */}
                {segments.map(seg => (
                  <div key={seg.id} style={COL_DIVIDER}>
                    <CellBox
                      value={PER_MSG_SEG_LOOKUP.get(`${m.id}|${seg.code}`)}
                      maxAbs={maxAbs}
                      spotlit={colFocus === seg.id}
                      opacity={dim(seg.id)} />
                  </div>
                ))}
              </div>

              {/* Row expansion — core wording */}
              {isOpen && (
                <div style={{
                  padding: "0 12px 10px 56px",
                  borderBottom: last ? "none" : `1px solid ${C.cardBorder}`,
                }}>
                  <div style={{
                    fontFamily: "'Lora', Georgia, serif",
                    fontSize: 14, fontStyle: "italic", lineHeight: 1.55,
                    color: "#e2e8f0",
                    borderLeft: `2px solid ${C.violet}`,
                    paddingLeft: 12, paddingTop: 4, paddingBottom: 4,
                    maxWidth: 980,
                  }}>
                    “{CORE_TEXT_BY_MSG.get(m.id) || "(core wording unavailable)"}”
                    <div style={{
                      marginTop: 4,
                      fontFamily: MONO, fontSize: 7.5, fontStyle: "normal",
                      color: C.textDim, letterSpacing: 1, textTransform: "uppercase",
                    }}>Core message — exact wording shown to respondents</div>
                  </div>
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
