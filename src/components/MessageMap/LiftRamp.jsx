// Message Map building block — shared chrome for the /messages page.
// Lifted from src/pages/MessageMap.jsx (B2 prep) so later studies can
// reuse the Message Map shell without forking the page.
import { C, MONO } from "../../data/theme";

// 0–100 lift color ramp (red → white → green) — refined in B2.
export default function LiftRamp() {
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
