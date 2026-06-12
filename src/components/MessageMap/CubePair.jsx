// CubePair — one token row of the focal cube: CORE | divider | PERSONA
// mini-cells, NO internal labels. The page places one CubePair per
// proof-token row in the focal segment column of the focal row's grid,
// so every cube row aligns with its proof label in the first column and
// the cube stays under its segment circle. The white outline box and
// the violet column bracket are drawn by the page as row-spanning divs
// behind the pairs.
//
// Values use the shared ramp; significance dots and shrinkage fades
// carry over. Hovering a mini-cell shows the exact wording that
// variant's respondents read (title). Clicking anywhere on the pair
// toggles the focal point.
import { useEffect, useState } from "react";
import { MONO } from "../../data/theme";
import { rampColor } from "./liftScale";

const PERSONA_BLUE = "#7db3fa";
const DIVIDER = "rgba(127,119,221,0.45)";

export function MiniCell({ cell, side, fadeBelow, wording, onHover }) {
  if (!cell) {
    return (
      <div style={{
        height: 28, display: "flex", alignItems: "center",
        justifyContent: "center", borderRadius: 3,
        background: "rgba(148,163,184,0.06)",
        border: "1px solid rgba(51,65,85,0.6)",
        color: "#475569", fontFamily: MONO, fontSize: 11,
      }}>–</div>
    );
  }
  const { bg, text } = rampColor(cell.v);
  const faded = cell.w != null && cell.w < fadeBelow;
  // Persona cells render as a ramp-color GRADIENT (bright→deep along
  // the diagonal); core stays a subtle flat. The persona arm is
  // identifiable by gradient signature anywhere it appears.
  const skin = side === "persona"
    ? "linear-gradient(155deg, rgba(255,255,255,0.40) 0%, rgba(255,255,255,0.06) 38%, rgba(0,0,0,0.28) 100%)"
    : "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(0,0,0,0.14))";
  return (
    <div
      title={wording || undefined}
      onMouseEnter={() => onHover?.(cell.lift)}
      onMouseLeave={() => onHover?.(null)}
      style={{
        height: 30, position: "relative",
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: 3,
        backgroundColor: bg,
        backgroundImage: skin,
        border: side === "persona"
          ? `1.5px solid ${PERSONA_BLUE}`
          : "1px solid rgba(148,163,184,0.5)",
        color: text, fontFamily: MONO, fontSize: 14, fontWeight: 700,
        opacity: faded ? 0.5 : 1,
        cursor: "pointer",
      }}
    >
      {cell.v}
      {cell.sig && (
        <span style={{
          position: "absolute", top: 4, right: 4,
          width: 5, height: 5, borderRadius: "50%",
          background: "rgba(255,255,255,0.85)",
        }} />
      )}
    </div>
  );
}

export default function CubePair({
  core, tuned, fadeBelow, coreText, personaText, onClick, onCellHover,
}) {
  // Grow-out-of-the-cell animation (all pairs mount together, so the
  // whole mini-grid grows as one).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      onClick={onClick}
      style={{
        display: "grid", gridTemplateColumns: "1fr 8px 1fr",
        alignItems: "stretch", cursor: "pointer",
        transform: mounted ? "scale(1)" : "scale(0.6)",
        opacity: mounted ? 1 : 0,
        transition: "transform 0.28s cubic-bezier(0.34, 1.3, 0.64, 1), opacity 0.2s",
      }}
    >
      <MiniCell cell={core} side="core" fadeBelow={fadeBelow}
                wording={coreText} onHover={onCellHover} />
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ width: 1, background: DIVIDER }} />
      </div>
      <MiniCell cell={tuned} side="persona" fadeBelow={fadeBelow}
                wording={personaText} onHover={onCellHover} />
    </div>
  );
}
