// Message Map building block — shared chrome for the /messages page.
// Lifted from src/pages/MessageMap.jsx (B2 prep) so later studies can
// reuse the Message Map shell without forking the page.
import { C, MONO } from "../../data/theme";
import { rampColor } from "./liftScale";

// 0–100 lift legend chips, colored by the SAME ramp the cells use.
export default function LiftRamp() {
  const stops = [0, 25, 50, 75, 100];
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {stops.map(v => {
        const { bg, text } = rampColor(v);
        return (
          <div key={v} style={{
            width: 28, height: 16, background: bg,
            border: `1px solid ${C.cardBorder}`, borderRadius: 2,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 7, color: text, fontFamily: MONO, fontWeight: 700,
          }}>{v}</div>
        );
      })}
    </div>
  );
}
