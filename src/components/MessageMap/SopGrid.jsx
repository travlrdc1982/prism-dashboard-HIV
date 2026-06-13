// SopGrid — Share of Preference view. Simple heatmap (no cube, no
// proofs, no persona arms): one row per message, one column per
// segment plus a TOTAL column showing the basket aggregate. Cells
// colored by the shared 6-bin red→green palette (gradientBinColor),
// scaled to the global SoP range computed from message_topline.
//
// Data sources (all already in dashboard.json):
//   per-(msg × seg) SoP %  ← dashboard.message_topline[].by_segment[code].sop_pct
//   per-basket totals     ← dashboard.sop_simple[basket].messages[].sop_pct
//   core wording          ← dashboard.variants.messages[].tokens[0].text_core
//
// Interactivity (per analyst direction "keep the same design
// foundations / same interactivity"):
//   - segment columns are draggable (drop on another to reorder)
//   - tier-1 column mode dims non-tier-1 columns
//   - click a segment circle → spotlight that column + sort message
//     rows by that column's SoP value (desc); click again to clear
//   - chevron on each row expands to show the core message wording
import { Fragment, useMemo } from "react";
import dashboard from "../../data/topline/dashboard.json";
import { C, FONT, MONO } from "../../data/theme";
import SegmentCircle from "./SegmentCircle";
import { gradientBinColor } from "./liftScale";

const PER_MSG_SEG_LOOKUP = (() => {
  const out = new Map();
  for (const m of (dashboard.message_topline || [])) {
    for (const code in (m.by_segment || {})) {
      out.set(`${m.message}|${code}`, m.by_segment[code]?.sop_pct);
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

// Subtle vertical divider between columns — applied to every body
// cell wrapper and every header slot so they line up across all rows.
const COL_DIVIDER = { borderRight: "1px solid rgba(148,163,184,0.10)" };

function ValueCell({ value, min, max, height = 28, fontSize = 10,
                     opacity = 1, spotlit = false }) {
  const { bg, text } = gradientBinColor(value, min, max);
  return (
    <div title={value != null ? `${value.toFixed(2)}%` : "no data"}
      style={{
        height, borderRadius: 2,
        background: bg, color: text,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: MONO, fontSize, fontWeight: 700,
        border: spotlit
          ? "1.5px solid #7F77DD"
          : "1px solid rgba(15,21,32,0.35)",
        boxShadow: spotlit ? "0 0 0 1px rgba(127,119,221,0.35)" : "none",
        textShadow: value != null
          ? "0 1px 0 rgba(15,21,32,0.45)" : "none",
        opacity, transition: "opacity 0.12s",
      }}>
      {value != null ? value.toFixed(1) : "—"}
    </div>
  );
}

export default function SopGrid({
  messages, segments, basket, range,
  // drag handlers from the page (segment-column reorder)
  dragSegId, onSegDragStart, onSegDragEnd, onSegDragOver, onSegDrop,
  // tier-1 mode dimming closure (segId → opacity)
  tier1Dim,
  // column spotlight state (shared with the cube view)
  colFocus, onSegmentClick,
  // row expansion state (shared with the cube view)
  openRows, onToggleRow,
}) {
  // Total SoP per message for the active basket.
  const totals = useMemo(() => {
    const ms = dashboard.sop_simple?.[basket]?.messages || [];
    return new Map(ms.map(r => [r.message, r.sop_pct]));
  }, [basket]);

  // When a column is spotlit, re-sort the messages by that column's
  // SoP value (desc). Otherwise honor the order the page passed in.
  const orderedMessages = useMemo(() => {
    if (colFocus == null) return messages;
    const code = segments.find(s => s.id === colFocus)?.code;
    if (!code) return messages;
    const sopFor = (mid) => PER_MSG_SEG_LOOKUP.get(`${mid}|${code}`) ?? -Infinity;
    return [...messages].sort((a, b) => sopFor(b.id) - sopFor(a.id));
  }, [messages, segments, colFocus]);

  const { min, max } = range || { min: 0, max: 100 };
  const dim = tier1Dim || (() => 1);

  const gridTemplate =
    `28px 220px 90px ${segments.map(() => "minmax(56px, 1fr)").join(" ")}`;

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
        alignItems: "flex-start",  // top-align per analyst direction
      }}>
        <div /> {/* chevron gutter */}
        <div style={{
          fontFamily: MONO, fontSize: 12, fontWeight: 700,
          letterSpacing: 1.5, textTransform: "uppercase",
          color: C.text, paddingTop: 6,
        }}>Message</div>
        <div style={{
          fontFamily: MONO, fontSize: 8, fontWeight: 700,
          letterSpacing: 1.5, textTransform: "uppercase",
          color: "#22d3ee", textAlign: "center", paddingTop: 8,
        }}>Total SoP</div>
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
              {/* sort indicator — appears on the spotlit column to
                  signal that messages are sorted by this column's SoP */}
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
                {/* Chevron — expands the row to show the core wording */}
                <div
                  onClick={() => onToggleRow?.(m.id)}
                  style={{
                    fontFamily: MONO, fontSize: 10,
                    color: isOpen ? C.violet : C.textDim,
                    textAlign: "center", cursor: "pointer",
                    transform: isOpen ? "rotate(90deg)" : "none",
                    transition: "transform 0.2s",
                  }}>▸</div>

                {/* Message label */}
                <div
                  onClick={() => onToggleRow?.(m.id)}
                  style={{ paddingRight: 10, minWidth: 0, cursor: "pointer" }}>
                  <div style={{
                    fontFamily: MONO, fontSize: 9, color: C.textDim,
                    letterSpacing: 0.5,
                  }}>MSG {String(m.id).padStart(2, "0")}</div>
                  <div title={m.theme_label} style={{
                    fontFamily: FONT, fontSize: 14, fontWeight: 700, color: C.text,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{m.theme_label}</div>
                </div>

                {/* Total SoP — basket aggregate */}
                <div style={COL_DIVIDER}>
                  <ValueCell value={total} min={min} max={max}
                    height={30} fontSize={11} />
                </div>

                {/* Per-segment SoP cells */}
                {segments.map(seg => (
                  <div key={seg.id} style={COL_DIVIDER}>
                    <ValueCell
                      value={PER_MSG_SEG_LOOKUP.get(`${m.id}|${seg.code}`)}
                      min={min} max={max}
                      spotlit={colFocus === seg.id}
                      opacity={dim(seg.id)} />
                  </div>
                ))}
              </div>

              {/* Row expansion — core message wording */}
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
