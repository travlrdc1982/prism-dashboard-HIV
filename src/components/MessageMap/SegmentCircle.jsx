// Message Map segment header — disc + full name beneath.
//
// Matches the persona-profile circle: thick party-color ring, dark
// slate fill, white bold abbreviation in the dashboard's header font
// sized as big as fits. The full segment name wraps 2-3 lines under-
// neath in small caps (truncated rather than reflowing the grid).
//
// `widened` (focal cube column OR colFocus column) bumps the disc to
// a larger size; the column template change happens at the page, and
// this just keeps the disc proportionate.
import { FONT, partyColor } from "../../data/theme";

export default function SegmentCircle({
  seg, widened = false, dim = false,
}) {
  const pc = partyColor(seg.party);
  const size = widened ? 60 : 40;
  // Abbreviation as big as it can be: longer codes shrink the glyph
  // so 2- and 3-letter codes both fill the disc cleanly.
  const codeFont = Math.round(
    size * (seg.code.length <= 2 ? 0.48 : 0.36)
  );
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: 5, opacity: dim ? 0.35 : 1,
      transition: "opacity 0.15s",
      width: "100%", minWidth: 0,
    }}>
      <div style={{
        width: size, height: size, borderRadius: "50%",
        border: `3px solid ${pc}`,
        background: "#1e293b",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: FONT, fontWeight: 800, color: "#fff",
        fontSize: codeFont, lineHeight: 1, letterSpacing: 0.5,
        transition: "width 0.3s, height 0.3s, font-size 0.3s",
      }}>{seg.code}</div>
      <div style={{
        fontFamily: FONT, fontSize: 8.5, fontWeight: 400,
        textTransform: "uppercase", letterSpacing: 0.4,
        color: "#cbd5e1", textAlign: "center", lineHeight: 1.2,
        display: "-webkit-box", WebkitLineClamp: 3,
        WebkitBoxOrient: "vertical", overflow: "hidden",
        maxWidth: "100%", padding: "0 2px",
      }}>{seg.name}</div>
    </div>
  );
}
