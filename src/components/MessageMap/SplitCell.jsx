// Message Map building block — the split segment cell.
// Every segment cell divides CORE (left) | PERSONA-tuned (right);
// each half shows its 0–100 lift value on the shared red→white→green
// ramp. Halves whose aggregate shrinkage weight falls below the
// configured threshold render faded (the message marginal dominates
// the estimate — treat with caution). Missing halves render "–".
import { MONO } from "../../data/theme";
import { rampColor } from "./liftScale";

function Half({ cell, fadeBelow }) {
  if (!cell) {
    return (
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(148,163,184,0.05)", color: "#334155",
        fontFamily: MONO, fontSize: 8,
      }}>–</div>
    );
  }
  const { bg, text } = rampColor(cell.v);
  const faded = cell.w != null && cell.w < fadeBelow;
  return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      background: bg, color: text,
      fontFamily: MONO, fontSize: 9, fontWeight: 700,
      opacity: faded ? 0.45 : 1,
    }}>{cell.v}</div>
  );
}

export default function SplitCell({ core, tuned, fadeBelow = 0.6, height = 24 }) {
  return (
    <div style={{
      display: "flex", height, margin: "0 1px",
      borderRadius: 2, overflow: "hidden",
      border: "1px solid rgba(30,41,59,0.7)",
    }}>
      <Half cell={core} fadeBelow={fadeBelow} />
      {/* blue seam = the persona fold line from the architecture widget */}
      <div style={{ width: 1, background: "rgba(96,165,250,0.55)", flexShrink: 0 }} />
      <Half cell={tuned} fadeBelow={fadeBelow} />
    </div>
  );
}
