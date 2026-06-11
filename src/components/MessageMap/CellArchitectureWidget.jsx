// Message Map building block — shared chrome for the /messages page.
// Lifted from src/pages/MessageMap.jsx (B2 prep) so later studies can
// reuse the Message Map shell without forking the page.
import { useState } from "react";
import { C, FONT, MONO } from "../../data/theme";
import InfoDot from "../InfoDot";

// ═══════════════════════════════════════════════════════════════
// CELL-ARCHITECTURE INTERACTIVE WIDGET
// ═══════════════════════════════════════════════════════════════
// One cohesive square that unfolds:
//   • Click "+ persona" — the right half slides out from the CORE left
//     half (transformOrigin: left, scaleX 0→1). The whole shape stays
//     a single bordered square the entire time.
//   • Click "▸ proof tokens" — horizontal dashed cuts slide into the
//     same square, creating base/proof-1/proof-2/proof-3 stripes.
// All labels (CORE, PERSONA, base/proof-N) sit OUTSIDE the square.
export default function CellArchitectureWidget() {
  const [personaOpen, setPersonaOpen] = useState(false);
  const [proofsOpen,  setProofsOpen]  = useState(false);

  const HALF_W   = 60;        // each half-cell width
  const LABEL_W  = 54;        // gutter for left-side row labels
  const H_ROW    = 20;        // every row inside the square
  const PROOFS   = ["Proof 1", "Proof 2", "Proof 3"];

  const tokenCut    = "1.5px dashed #64748b";
  const personaCut  = "1.5px dashed #60a5fa";
  const borderColor = "#94a3b8";

  return (
    <div style={{
      flexShrink: 0,
      padding: "10px 12px 12px",
      background: C.card,
      border: `1px solid ${C.cardBorder}`,
      borderRadius: 6,
      width: 240,
    }}>
      {/* Title */}
      <div style={{
        fontFamily: MONO, fontSize: 7, color: C.textDim,
        letterSpacing: 1.5, textTransform: "uppercase",
        marginBottom: 10, display: "flex", alignItems: "center",
      }}>
        Cell Architecture
        <InfoDot title="Cell architecture">
          Each cell is one (message × segment × persona × proof token)
          combination. Click below to unfold the persona half and the
          proof-token rows.
        </InfoDot>
      </div>

      {/* ─── Diagram ─── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `${LABEL_W}px auto`,
        rowGap: 0, columnGap: 0, marginBottom: 12,
      }}>
        {/* Top-left empty corner */}
        <div />
        {/* Top labels: CORE | PERSONA (outside the square) */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `${HALF_W}px ${personaOpen ? HALF_W : 0}px`,
          transition: "grid-template-columns 0.28s ease",
          paddingBottom: 4,
        }}>
          <div style={{
            textAlign: "center",
            fontFamily: MONO, fontSize: 8, fontWeight: 700,
            color: "#cbd5e1", letterSpacing: 1, textTransform: "uppercase",
          }}>Core</div>
          <div style={{
            textAlign: "center", overflow: "hidden",
            fontFamily: MONO, fontSize: 8, fontWeight: 700,
            color: "#60a5fa", letterSpacing: 1, textTransform: "uppercase",
            opacity: personaOpen ? 1 : 0,
            transition: "opacity 0.2s 0.1s",
          }}>Persona</div>
        </div>

        {/* Left labels column — base + (optional) proof rows */}
        <div style={{ display: "flex", flexDirection: "column", paddingRight: 6 }}>
          <div style={{
            height: H_ROW, display: "flex", alignItems: "center", justifyContent: "flex-end",
            fontFamily: FONT, fontSize: 9, fontWeight: 600,
            color: proofsOpen ? C.textMuted : "transparent",
            fontStyle: "italic", transition: "color 0.2s",
          }}>base</div>
          {proofsOpen && PROOFS.map(label => (
            <div key={label} style={{
              height: H_ROW, display: "flex", alignItems: "center", justifyContent: "flex-end",
              fontFamily: FONT, fontSize: 9, fontWeight: 600, color: C.text,
            }}>{label}</div>
          ))}
        </div>

        {/* The unified square — single border, internal dashed cuts */}
        <div style={{
          border: `1.5px solid ${borderColor}`,
          borderRadius: 3,
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: `${HALF_W}px ${personaOpen ? HALF_W : 0}px`,
          transition: "grid-template-columns 0.28s ease",
        }}>
          {/* CORE column */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ height: H_ROW, background: "#334155" }} />
            {proofsOpen && PROOFS.map((_, i) => (
              <div key={i} style={{
                height: H_ROW, background: "#1e293b",
                borderTop: tokenCut,
              }} />
            ))}
          </div>
          {/* PERSONA column — unfolds from left edge */}
          <div style={{
            display: "flex", flexDirection: "column",
            borderLeft: personaOpen ? personaCut : "none",
            transformOrigin: "left center",
            transform: personaOpen ? "scaleX(1)" : "scaleX(0)",
            transition: "transform 0.28s ease",
            overflow: "hidden",
          }}>
            <div style={{ height: H_ROW, background: "rgba(96,165,250,0.22)" }} />
            {proofsOpen && PROOFS.map((_, i) => (
              <div key={i} style={{
                height: H_ROW, background: "rgba(96,165,250,0.12)",
                borderTop: tokenCut,
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* Controls below the diagram */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <button
          type="button"
          onClick={() => setPersonaOpen(s => !s)}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "4px 6px",
            background: "transparent", border: "none", cursor: "pointer",
            fontFamily: MONO, fontSize: 9, color: "#60a5fa", fontWeight: 700,
            letterSpacing: 0.5, outline: "none",
          }}
        >
          <span style={{ width: 10, color: "#60a5fa" }}>{personaOpen ? "−" : "+"}</span>
          {personaOpen ? "fold persona" : "unfold persona half"}
        </button>
        <button
          type="button"
          onClick={() => setProofsOpen(s => !s)}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "4px 6px",
            background: "transparent", border: "none", cursor: "pointer",
            fontFamily: MONO, fontSize: 9, color: C.violet, fontWeight: 700,
            letterSpacing: 0.5, outline: "none",
          }}
        >
          <span style={{
            transform: proofsOpen ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.18s", display: "inline-block",
            width: 10,
          }}>▸</span>
          {proofsOpen ? "hide proof tokens" : "cut into proof tokens"}
        </button>
      </div>
    </div>
  );
}
