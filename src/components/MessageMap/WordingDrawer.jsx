// WordingDrawer — a small panel that slides out from the LEFT of a
// message row when any of that row's cells is hovered. Solid fill;
// sits OUTSIDE the grid (right: calc(100% + 6px) so its right edge
// kisses the row's left edge), so the matrix and the cube are never
// covered.
//
// All wording text comes straight from the variants workbook
// (dashboard.variants — text_core / text_by_persona[seg.code]).
// Captions ("PERSONA-TUNED · TSP · proof 1") are dashboard chrome.
import { useEffect, useState } from "react";
import { MONO } from "../../data/theme";

export default function WordingDrawer({ hover }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const personaSide = hover?.side === "persona";
  const accent = personaSide ? "#7F77DD" : "#94a3b8";
  return (
    <div style={{
      position: "absolute",
      right: "calc(100% + 6px)",
      top: -1, bottom: -1,
      width: 300,
      background: "#0c1322",
      border: `1.5px solid ${accent}`,
      borderRadius: 6,
      padding: "8px 11px",
      zIndex: 25,
      boxShadow: "0 6px 20px rgba(0,0,0,0.55)",
      pointerEvents: "none",
      display: "flex", flexDirection: "column", justifyContent: "center",
      opacity: mounted ? 1 : 0,
      transform: mounted ? "translateX(0)" : "translateX(8px)",
      transition: "opacity 0.14s, transform 0.14s",
    }}>
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
        fontSize: 12, lineHeight: 1.4, fontStyle: "italic",
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
