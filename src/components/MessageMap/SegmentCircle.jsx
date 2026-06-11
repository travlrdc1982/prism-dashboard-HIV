// Message Map building block — shared chrome for the /messages page.
// Lifted from src/pages/MessageMap.jsx (B2 prep) so later studies can
// reuse the Message Map shell without forking the page.
import { MONO, partyColor } from "../../data/theme";

export default function SegmentCircle({ seg, dim = false }) {
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
