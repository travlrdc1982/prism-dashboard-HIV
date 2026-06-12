// CubeCard — THE focal object of the Message Map, rendered IN PLACE.
//
// No popup. Clicking a message × segment intersection swaps that cell
// for this mini-grid: the segment column widens, the row grows taller,
// and the full possibility space of the spec unfolds inside the cell —
//
//          CORE          |  ⊙ PERSONA
//   core message only  [v]|[v]   ← just the core / translated to persona
//   + proof point A    [v]|[v]   ← proof variants stack downward
//   + proof point B    [v]|[v]
//
// Values use the shared ramp; significance dots and shrinkage fades
// carry over. Hovering any mini-cell shows the exact wording that
// variant's respondents read (title). Clicking the cube folds it back.
import { useEffect, useState } from "react";
import { C, MONO } from "../../data/theme";
import { rampColor } from "./liftScale";

const PERSONA_BLUE = "#7db3fa";
const DIVIDER = "rgba(127,119,221,0.45)";
const COLS = "110px 1fr 8px 1fr";

function MiniCell({ cell, side, fadeBelow, wording }) {
  if (!cell) {
    return (
      <div style={{
        height: 40, display: "flex", alignItems: "center",
        justifyContent: "center", borderRadius: 3,
        background: "rgba(148,163,184,0.06)",
        border: "1px solid rgba(51,65,85,0.6)",
        color: "#475569", fontFamily: MONO, fontSize: 11,
      }}>–</div>
    );
  }
  const { bg, text } = rampColor(cell.v);
  const faded = cell.w != null && cell.w < fadeBelow;
  return (
    <div
      title={wording || undefined}
      style={{
        height: 40, position: "relative",
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: 3,
        backgroundColor: bg,
        backgroundImage: side === "persona"
          ? "linear-gradient(135deg, rgba(255,255,255,0.16), rgba(0,0,0,0.10))"
          : "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(0,0,0,0.14))",
        border: side === "persona"
          ? `1.5px solid ${PERSONA_BLUE}`
          : "1px solid rgba(148,163,184,0.5)",
        color: text, fontFamily: MONO, fontSize: 16, fontWeight: 700,
        opacity: faded ? 0.5 : 1,
        cursor: wording ? "help" : "default",
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

export default function CubeCard({ rows, fadeBelow, onClose }) {
  // Grow-out-of-the-cell animation
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      onClick={onClose}
      style={{
        position: "relative", zIndex: 6,
        background: "#0c1322",
        border: "1.5px solid rgba(203,213,225,0.9)",
        borderRadius: 6,
        boxShadow: "0 0 0 1px rgba(241,245,249,0.25), 0 0 22px rgba(203,213,225,0.25), 0 14px 36px rgba(0,0,0,0.7)",
        padding: "8px 10px 9px",
        cursor: "pointer",
        transform: mounted ? "scale(1)" : "scale(0.4)",
        opacity: mounted ? 1 : 0,
        transformOrigin: "center",
        transition: "transform 0.28s cubic-bezier(0.34, 1.3, 0.64, 1), opacity 0.2s",
      }}
    >
      {/* Column headers: CORE | persona icon + PERSONA */}
      <div style={{
        display: "grid", gridTemplateColumns: COLS,
        gap: 3, marginBottom: 4, alignItems: "end",
      }}>
        <div />
        <div style={{
          textAlign: "center", fontFamily: MONO, fontSize: 9,
          fontWeight: 700, letterSpacing: 1.5, color: "#cbd5e1",
        }}>CORE</div>
        <div />
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 5, fontFamily: MONO, fontSize: 9, fontWeight: 700,
          letterSpacing: 1.5, color: PERSONA_BLUE,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="11" fill="none" stroke={PERSONA_BLUE} strokeWidth="2" />
            <circle cx="12" cy="9.5" r="2.6" fill="none" stroke={PERSONA_BLUE} strokeWidth="2" />
            <path d="M5.5 19 Q12 14 18.5 19" fill="none" stroke={PERSONA_BLUE}
                  strokeWidth="2" strokeLinecap="round" />
          </svg>
          PERSONA
        </div>
      </div>

      {/* The matrix: one row per token, divider lane between the arms */}
      {rows.map((r, i) => (
        <div key={i} style={{
          display: "grid", gridTemplateColumns: COLS,
          gap: 3, marginBottom: 3, alignItems: "center",
        }}>
          <div style={{
            fontFamily: "'Lora', Georgia, serif",
            fontSize: r.isBase ? 12.5 : 13, lineHeight: 1.25,
            fontStyle: r.isBase ? "italic" : "normal",
            color: r.isBase ? C.textDim : "#e2e8f0",
            paddingRight: 6,
            display: "-webkit-box", WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical", overflow: "hidden",
          }} title={r.label}>
            {r.isBase ? "core message only" : `+ ${r.label}`}
          </div>
          <MiniCell cell={r.core} side="core" fadeBelow={fadeBelow}
                    wording={r.coreText} />
          <div style={{
            display: "flex", justifyContent: "center", alignSelf: "stretch",
          }}>
            <div style={{ width: 1, background: DIVIDER }} />
          </div>
          <MiniCell cell={r.tuned} side="persona" fadeBelow={fadeBelow}
                    wording={r.personaText} />
        </div>
      ))}

      <div style={{
        marginTop: 6, fontFamily: MONO, fontSize: 7.5, color: C.textDim,
        letterSpacing: 0.8, textTransform: "uppercase", textAlign: "center",
      }}>
        hover for exact wording · ● significant · click to fold
      </div>
    </div>
  );
}
