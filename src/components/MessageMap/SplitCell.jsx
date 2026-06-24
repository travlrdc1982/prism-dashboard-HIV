// Message Map building block — the split segment cell (the "cube" face).
//
// Horizontal grammar: CORE (left) | PERSONA-TUNED (right). The persona
// half carries a structural cue INDEPENDENT of value color
// (analyst: "border or shadow, because color stays tied to value"):
// an inset blue frame + corner notch. Background color on both halves
// remains the shared value ramp, rendered as a subtle gradient for
// texture.
//
// CORE is the resting state: the persona half stays folded behind a
// thin blue tab until `personaOpen` slides it open (the cube unfold).
// `coreTitle` / `tunedTitle` carry the exact respondent-facing wording
// for hover, per arm.
//
// Per-proof (expanded) cells add: significance dot when the 95% CI
// excludes zero, and the low-confidence fade when shrinkage dominates.
import { MONO } from "../../data/theme";
import { rampColor } from "./liftScale";

const PERSONA_FRAME = "rgba(125,179,250,0.85)";
const liftBadgeStyle = (textColor, compact) => ({
  position: "absolute",
  left: compact ? 2 : 4,
  bottom: compact ? 1 : 3,
  padding: compact ? "1px 2px" : "1px 3px",
  borderRadius: 2,
  background: textColor === "#0f172a" ? "rgba(255,255,255,0.72)" : "rgba(15,23,42,0.62)",
  color: textColor === "#0f172a" ? "#0f172a" : "#f8fafc",
  fontSize: compact ? 6 : 8,
  fontWeight: 800,
  letterSpacing: 0.15,
  lineHeight: 1,
});

function Half({ cell, side, fadeBelow, compact, title, onHover, showLiftDelta = false }) {
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
  // Texture: CORE renders as a flat ramp color with the subtlest sheen
  // for surface. PERSONA renders the same ramp color AS A GRADIENT —
  // brighter at top-left, deeper at bottom-right — so the persona arm
  // is identifiable by gradient signature alone, even before reading
  // the violet frame. Value color stays tied to lift.
  const skin = side === "persona"
    ? "linear-gradient(155deg, rgba(255,255,255,0.40) 0%, rgba(255,255,255,0.06) 38%, rgba(0,0,0,0.28) 100%)"
    : "linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 45%, rgba(0,0,0,0.14) 100%)";
  const frames = [];
  if (side === "persona") frames.push(`inset 0 0 0 1px ${PERSONA_FRAME}`);
  if (sig) frames.push("inset 0 0 0 1.5px rgba(241,245,249,0.85)");
  return (
    <div onMouseEnter={() => onHover?.({ lift: cell.lift, wording: title, side })}
         onMouseLeave={() => onHover?.(null)}
         style={{
      flex: 1, position: "relative",
      display: "flex", alignItems: "center", justifyContent: "center",
      backgroundImage: skin, backgroundColor: bg,
      color: text,
      fontFamily: MONO, fontSize: compact ? 9 : 14, fontWeight: 700,
      opacity: faded ? 0.45 : 1,
      boxShadow: frames.join(", ") || "none",
      overflow: "hidden",
    }}>
      {cell.v}
      {showLiftDelta && cell.lift != null && (
        <span style={liftBadgeStyle(text, compact)}>
          Δ{cell.lift >= 0 ? "+" : ""}{cell.lift.toFixed(2)}
        </span>
      )}
      {/* Significance dot — bootstrap CI excludes zero */}
      {sig && (
        <span style={{
          position: "absolute", top: 3, right: 3,
          width: 5, height: 5, borderRadius: "50%",
          background: "rgba(255,255,255,0.85)",
        }} />
      )}
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
  onClick, compact = true,
  personaOpen = false, coreTitle, tunedTitle, onCellHover,
  showLiftDelta = false,
}) {
  // CORE is the resting state. The persona half stays folded (width 0)
  // behind a thin blue tab on the right edge; `personaOpen` (the cube
  // unfold) slides it open. Matches the architecture widget.
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", height, margin: "0 1px",
        borderRadius: 2, overflow: "hidden",
        border: "1px solid rgba(30,41,59,0.7)",
        cursor: onClick ? "pointer" : "default",
        transition: "border-color 0.2s, height 0.3s",
      }}
    >
      <Half cell={core} side="core" fadeBelow={fadeBelow} compact={compact}
            title={coreTitle} onHover={onCellHover}
            showLiftDelta={showLiftDelta} />
      {personaOpen ? (
        <>
          {/* 8px divider lane: thin centered violet line marks the
              CORE | PERSONA axis even when both halves carry color */}
          <div style={{
            width: 8, flexShrink: 0,
            display: "flex", justifyContent: "center", alignItems: "stretch",
          }}>
            <div style={{ width: 1, background: "rgba(127,119,221,0.3)" }} />
          </div>
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            <Half cell={tuned} side="persona" fadeBelow={fadeBelow}
                  compact={compact} title={tunedTitle}
                  onHover={onCellHover}
                  showLiftDelta={showLiftDelta} />
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
