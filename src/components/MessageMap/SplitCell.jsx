// Message Map building block — the split segment cell (the "cube" face).
//
// Horizontal grammar (always on): CORE (left) | PERSONA-TUNED (right).
// The persona half carries a structural cue INDEPENDENT of value color
// (analyst: "border or shadow, because color stays tied to value"):
// an inset blue frame + corner notch. Background color on both halves
// remains the shared value ramp, now rendered as a subtle gradient for
// texture.
//
// Per-proof (expanded) cells add: significance outline when the 95% CI
// excludes zero, and the low-confidence fade when shrinkage dominates.
import { MONO } from "../../data/theme";
import { rampColor } from "./liftScale";

const PERSONA_FRAME = "rgba(125,179,250,0.85)";

function Half({ cell, side, fadeBelow, compact }) {
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
  const sig = !!cell.sig;
  // Texture: a soft diagonal sheen over the ramp color so large fields
  // of similar values read as surfaces, not flat paint.
  const sheen = side === "persona"
    ? "linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 45%, rgba(0,0,0,0.10) 100%)"
    : "linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 45%, rgba(0,0,0,0.14) 100%)";
  const frames = [];
  if (side === "persona") frames.push(`inset 0 0 0 1px ${PERSONA_FRAME}`);
  if (sig) frames.push("inset 0 0 0 1.5px rgba(241,245,249,0.85)");
  return (
    <div style={{
      flex: 1, position: "relative",
      display: "flex", alignItems: "center", justifyContent: "center",
      backgroundImage: sheen, backgroundColor: bg,
      color: text,
      fontFamily: MONO, fontSize: compact ? 9 : 10, fontWeight: 700,
      opacity: faded ? 0.45 : 1,
      boxShadow: frames.join(", ") || "none",
    }}>
      {cell.v}
      {side === "persona" && (
        <span style={{
          position: "absolute", top: 0, right: 0,
          width: 0, height: 0,
          borderTop: `5px solid ${PERSONA_FRAME}`,
          borderLeft: "5px solid transparent",
        }} />
      )}
    </div>
  );
}

export default function SplitCell({
  core, tuned, fadeBelow = 0.6, height = 24,
  onClick, dim = false, compact = true,
  personaOpen = false, group = false,
}) {
  // CORE is the resting state. The persona half stays folded (width 0)
  // behind a thin blue tab on the right edge; clicking the cell (the
  // cube unfold) slides it open. Matches the architecture widget.
  //
  // `group`: the focal set (main cell + its proof sub-cells) each wrap
  // in a light-grey border so the stack reads as one grouped set
  // (analyst reference screenshot).
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", height, margin: "0 1px",
        borderRadius: group ? 3 : 2, overflow: "hidden",
        border: group
          ? "1.5px solid rgba(203,213,225,0.85)"
          : "1px solid rgba(30,41,59,0.7)",
        cursor: onClick ? "pointer" : "default",
        opacity: dim ? 0.15 : 1,
        transition: "opacity 0.25s, border-color 0.2s, height 0.3s",
      }}
    >
      <Half cell={core} side="core" fadeBelow={fadeBelow} compact={compact} />
      {personaOpen ? (
        <>
          <div style={{ width: 1, background: "rgba(96,165,250,0.55)", flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            <Half cell={tuned} side="persona" fadeBelow={fadeBelow} compact={compact} />
          </div>
        </>
      ) : (
        // Folded persona: a slim blue tab hinting the cell unfolds.
        <div style={{
          width: 5, flexShrink: 0,
          background: "linear-gradient(180deg, rgba(125,179,250,0.75), rgba(96,165,250,0.35))",
        }} />
      )}
    </div>
  );
}
