// CubeCard — THE focal object of the Message Map.
//
// Clicking a message × segment intersection grows this card out of the
// cell: one cohesive expanded square showing every possibility tested
// within that spec —
//
//          CORE          |  ⊙ PERSONA
//   core message       [v]|[v]   ← just the core / translated to persona
//   + proof point A    [v]|[v]   ← proof variants stack downward
//   + proof point B    [v]|[v]
//
// Values use the shared ramp; significance dots and shrinkage fades
// carry over. Hovering any mini-cell shows the exact wording that
// variant's respondents read (core or persona-translated, via title).
import { useEffect, useState } from "react";
import { C, FONT, MONO } from "../../data/theme";
import { rampColor } from "./liftScale";

const PERSONA_BLUE = "#7db3fa";
const DIVIDER = "rgba(127,119,221,0.45)";

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

export default function CubeCard({
  message, seg, segColor, rows, fadeBelow, anchor, onClose,
}) {
  // Grow-out-of-the-cell animation
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div style={{
      position: "absolute",
      left: anchor.left, top: anchor.top,
      width: 430, zIndex: 40,
      background: "#0c1322",
      border: "1.5px solid rgba(203,213,225,0.9)",
      borderRadius: 8,
      boxShadow: "0 0 0 1px rgba(241,245,249,0.25), 0 0 22px rgba(203,213,225,0.25), 0 18px 48px rgba(0,0,0,0.75)",
      padding: "12px 14px 14px",
      transform: mounted ? "scale(1)" : "scale(0.55)",
      opacity: mounted ? 1 : 0,
      transformOrigin: "top left",
      transition: "transform 0.28s cubic-bezier(0.34, 1.3, 0.64, 1), opacity 0.2s",
    }}>
      {/* Header: the spec — segment circle + message label + close */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
          background: segColor, display: "flex",
          alignItems: "center", justifyContent: "center",
          fontFamily: MONO, fontSize: 9, fontWeight: 800, color: "#fff",
        }}>{seg.code}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontFamily: FONT, fontSize: 13, fontWeight: 800, color: C.white,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{message.theme_label}</div>
          <div style={{
            fontFamily: MONO, fontSize: 8, color: C.textDim, letterSpacing: 1,
          }}>MSG {String(message.id).padStart(2, "0")} × {seg.name?.toUpperCase?.() || seg.code}</div>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: `1px solid ${C.cardBorder}`,
          borderRadius: 4, color: C.textMuted, cursor: "pointer",
          fontFamily: MONO, fontSize: 11, lineHeight: 1, padding: "4px 7px",
        }}>×</button>
      </div>

      {/* Column headers: CORE | persona icon + PERSONA */}
      <div style={{
        display: "grid", gridTemplateColumns: "150px 1fr 8px 1fr",
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
          display: "grid", gridTemplateColumns: "150px 1fr 8px 1fr",
          gap: 3, marginBottom: 3, alignItems: "center",
        }}>
          <div style={{
            fontFamily: "'Lora', Georgia, serif",
            fontSize: r.isBase ? 12.5 : 13, lineHeight: 1.25,
            fontStyle: r.isBase ? "italic" : "normal",
            color: r.isBase ? C.textDim : "#e2e8f0",
            paddingRight: 8,
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
        marginTop: 8, fontFamily: FONT, fontSize: 9.5, color: C.textDim,
        lineHeight: 1.4,
      }}>
        Hover any cell for the exact wording shown to that group ·
        ● = significant (95% CI excludes zero) · faded = low-confidence cell
      </div>
    </div>
  );
}
