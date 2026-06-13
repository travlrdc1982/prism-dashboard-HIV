// SopGrid — Share of Preference view. Simple heatmap (no cube, no
// proofs, no persona arms): one row per message, one column per
// segment plus a TOTAL column showing the basket aggregate. Cells
// are colored by the 6-bin red→green gradient (gradientBinColor),
// the exact same map the scale legend uses, scaled to the global
// SoP range computed from message_topline.
//
// Data sources (all already in dashboard.json):
//   per-(msg × seg) SoP %  ← dashboard.message_topline[].by_segment[code].sop_pct
//   per-basket totals     ← dashboard.sop_simple[basket].messages[].sop_pct
//
// Interactivity carried over from the cube grid (so the SoP view
// "keeps the same design foundations"):
//   - segment columns are draggable (drop on another to reorder)
//   - tier-1 column mode dims non-tier-1 columns ("remain but
//     always unspotlighted")
//   - sort = survey order OR by Total SoP descending (driven by the
//     page's sortMode + sorted messages)
//
// No cube, no chevron, no wording drawer — SoP is a single number per
// audience per message, the way the AL/Pharma study showed it.
import { useMemo } from "react";
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

function ValueCell({ value, min, max, height = 28, fontSize = 10, opacity = 1 }) {
  const { bg, text } = gradientBinColor(value, min, max);
  return (
    <div title={value != null ? `${value.toFixed(2)}%` : "no data"}
      style={{
        height, borderRadius: 2,
        background: bg, color: text,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: MONO, fontSize, fontWeight: 700,
        border: "1px solid rgba(15,21,32,0.35)",
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
  // optional click on segment header (parity with cube view)
  onSegmentClick,
}) {
  // Total SoP per message for the active basket.
  const totals = useMemo(() => {
    const ms = dashboard.sop_simple?.[basket]?.messages || [];
    return new Map(ms.map(r => [r.message, r.sop_pct]));
  }, [basket]);

  const { min, max } = range || { min: 0, max: 100 };
  const dim = tier1Dim || (() => 1);

  const gridTemplate =
    `220px 90px ${segments.map(() => "minmax(56px, 1fr)").join(" ")}`;

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
        alignItems: "end",
      }}>
        <div style={{
          fontFamily: MONO, fontSize: 12, fontWeight: 700,
          letterSpacing: 1.5, textTransform: "uppercase",
          color: C.text, paddingBottom: 4,
        }}>Message</div>
        <div style={{
          fontFamily: MONO, fontSize: 8, fontWeight: 700,
          letterSpacing: 1.5, textTransform: "uppercase",
          color: "#22d3ee", textAlign: "center",
          paddingBottom: 6,
        }}>Total SoP</div>
        {segments.map(seg => (
          <div key={seg.id}
            draggable
            onDragStart={(e) => onSegDragStart?.(e, seg.id)}
            onDragEnd={onSegDragEnd}
            onDragOver={onSegDragOver}
            onDrop={(e) => onSegDrop?.(e, seg.id)}
            onClick={() => onSegmentClick?.(seg.id)}
            style={{
              display: "flex", justifyContent: "center",
              opacity: dim(seg.id),
              cursor: dragSegId === seg.id ? "grabbing" : "grab",
              transition: "opacity 0.12s",
            }}>
            <SegmentCircle seg={seg} />
          </div>
        ))}
      </div>

      {/* ─── BODY ROWS ─── */}
      <div>
        {messages.map((m, i) => {
          const total = totals.get(m.id);
          const last = i === messages.length - 1;
          return (
            <div key={m.id} style={{
              display: "grid", gridTemplateColumns: gridTemplate, gap: 3,
              padding: "8px 12px", alignItems: "center", minHeight: 40,
              borderBottom: last ? "none" : `1px solid ${C.cardBorder}`,
            }}>
              {/* Message label */}
              <div style={{ paddingRight: 10, minWidth: 0 }}>
                <div style={{
                  fontFamily: MONO, fontSize: 9, color: C.textDim,
                  letterSpacing: 0.5,
                }}>MSG {String(m.id).padStart(2, "0")}</div>
                <div title={m.theme_label} style={{
                  fontFamily: FONT, fontSize: 14, fontWeight: 700, color: C.text,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{m.theme_label}</div>
              </div>

              {/* Total SoP — the basket aggregate (sop_simple) */}
              <ValueCell value={total} min={min} max={max}
                height={30} fontSize={11} />

              {/* Per-segment SoP cells */}
              {segments.map(seg => (
                <ValueCell key={seg.id}
                  value={PER_MSG_SEG_LOOKUP.get(`${m.id}|${seg.code}`)}
                  min={min} max={max}
                  opacity={dim(seg.id)} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
