// WordingDrawer — a panel that slides in from the LEFT edge of the
// hovered message row, overlaying the chevron + message-label area
// of THAT row only. Stays INSIDE the viewport (anchored at left: 0
// of the row, not outside it), so it can never go off-screen.
// The cells the analyst is actually reading — the segment columns
// to the right — remain fully visible underneath the drawer.
//
// All wording text comes straight from the variants workbook
// (dashboard.variants — text_core / text_by_persona[seg.code]).
// Captions ("PERSONA-TUNED · TSP · proof 1") and the small message
// label at the top are dashboard chrome.
import { useEffect, useState } from "react";
import { C, FONT, MONO } from "../../data/theme";

// `placement`:
//   'left-overlay'  — legacy: slides in from the left edge of the row,
//                     overlaying the chevron + message column.
//   'below-cube'    — NEW: renders FLAT (no absolute positioning) so
//                     the caller can drop it INTO the focal grid as a
//                     row that sits at the bottom of the cube. Slides
//                     down with a translateY animation.
export default function WordingDrawer({ hover, placement = "left-overlay" }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const personaSide = hover?.side === "persona";
  const accent = personaSide ? "#7F77DD" : "#94a3b8";

  const isBelow = placement === "below-cube";
  const positionStyles = isBelow
    ? {
        // Flat — the caller's grid item provides the slot. Slides
        // down from the cube above.
        background: "#0c1322",
        border: `1.5px solid ${accent}`,
        borderRadius: 6,
        padding: "10px 14px",
        boxShadow: "0 8px 22px rgba(0,0,0,0.55)",
        pointerEvents: "none",
        display: "flex", flexDirection: "column", justifyContent: "center",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(-8px)",
        transition: "opacity 0.16s, transform 0.16s",
      }
    : {
        position: "absolute",
        left: 6, top: 2, bottom: 2,
        width: 360,
        background: "#0c1322",
        border: `1.5px solid ${accent}`,
        borderRadius: 6,
        padding: "8px 12px",
        zIndex: 25,
        boxShadow: "0 6px 22px rgba(0,0,0,0.6)",
        pointerEvents: "none",
        display: "flex", flexDirection: "column", justifyContent: "center",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateX(0)" : "translateX(-10px)",
        transition: "opacity 0.14s, transform 0.14s",
      };

  return (
    <div style={positionStyles}>
      {/* Tiny message label so context isn't lost when the
          drawer overlays the message column. */}
      {hover?.messageLabel && (
        <div style={{
          fontFamily: FONT, fontSize: 9, fontWeight: 700,
          color: C.textMuted, marginBottom: 4,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{hover.messageLabel}</div>
      )}
      <div style={{
        fontFamily: MONO, fontSize: 8, fontWeight: 700,
        letterSpacing: 1.4, color: accent, marginBottom: 4,
        textTransform: "uppercase",
      }}>
        {personaSide ? "Persona-tuned" : "Core"}
        {hover?.segCode ? ` · ${hover.segCode}` : ""}
        {hover?.proofLabel ? ` · ${hover.proofLabel}` : ""}
      </div>
      <div style={{
        fontFamily: "'Lora', Georgia, serif",
        fontSize: 14, lineHeight: 1.45, fontStyle: "italic",
        color: "#e2e8f0",
        overflow: "hidden",
        display: "-webkit-box", WebkitLineClamp: 4,
        WebkitBoxOrient: "vertical",
      }}>
        “{hover?.wording || ""}”
      </div>
    </div>
  );
}
