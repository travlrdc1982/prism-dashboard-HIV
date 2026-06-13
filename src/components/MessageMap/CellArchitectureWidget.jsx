// Message Map building block — the cell-architecture KEY.
//
// A STATIC legend that mirrors EXACTLY what the live table cube renders,
// with a LABEL INSIDE each cell. No props, no state, no data, no
// interactivity — it documents the cube's structure.
//
// Each message × audience intersection in the cube tests up to six
// variants, laid out as two framing columns (CORE | PERSONA-TUNED) ×
// proof-token rows. The key below shows that grammar at a glance:
//
//   CORE MESSAGE        |   PERSONA-TUNED VARIANT
//   ───────────────────────────────────────────
//   NO PROOF POINT - CONTROL   (baseline row)
//   CORE + PROOF POINT 1 |   PERSONA + PROOF POINT 1
//   CORE + PROOF POINT 2 |   PERSONA + PROOF POINT 2
//
// Persona cells carry the violet #7F77DD treatment (gradient skin + a
// 1.5px violet frame) used across the cube; core cells are a neutral
// slate fill. All in-cell labels are white so they stay legible.
import { C, FONT, MONO } from "../../data/theme";

const PERSONA = "#7F77DD";

// The violet gradient skin the cube's persona MiniCell paints on top of
// its value color — re-used here over a violet-tinted base so the cells
// read as the persona arm.
const PERSONA_SKIN =
  "linear-gradient(155deg, rgba(255,255,255,0.28) 0%, rgba(127,119,221,0.10) 38%, rgba(0,0,0,0.30) 100%)";
const PERSONA_BASE = "rgba(127,119,221,0.32)";

const CORE_BASE = "rgba(148,163,184,0.12)";
const CORE_SKIN =
  "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(0,0,0,0.14))";

// One labeled cell of the key.
function Cell({ label, side, fullWidth = false }) {
  const persona = side === "persona";
  return (
    <div
      style={{
        flex: fullWidth ? "1 1 100%" : 1,
        minHeight: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "4px 5px",
        borderRadius: 3,
        backgroundColor: persona ? PERSONA_BASE : CORE_BASE,
        backgroundImage: persona ? PERSONA_SKIN : CORE_SKIN,
        border: persona
          ? `1.5px solid ${PERSONA}`
          : "1px solid rgba(148,163,184,0.4)",
        fontFamily: FONT,
        fontSize: 8,
        fontWeight: 700,
        lineHeight: 1.2,
        letterSpacing: 0.2,
        color: "#ffffff",
        textShadow: "0 1px 2px rgba(0,0,0,0.45)",
      }}
    >
      {label}
    </div>
  );
}

// A row of the key: CORE cell | thin violet divider | PERSONA cell.
function Row({ core, persona }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
      <Cell label={core} side="core" />
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <div style={{ width: 1, background: "rgba(127,119,221,0.45)" }} />
      </div>
      <Cell label={persona} side="persona" />
    </div>
  );
}

export default function CellArchitectureWidget() {
  return (
    <div
      style={{
        flexShrink: 0,
        width: 330,
        padding: "10px 12px 11px",
        background: C.card,
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 6,
      }}
    >
      {/* Title */}
      <div
        style={{
          fontFamily: MONO,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: C.textMuted,
          marginBottom: 8,
        }}
      >
        How to read a cell
      </div>

      {/* Column headers — CORE (slate) | PERSONA-TUNED (violet) */}
      <div style={{ display: "flex", gap: 6, marginBottom: 5 }}>
        <div
          style={{
            flex: 1,
            textAlign: "center",
            fontFamily: MONO,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            color: "#cbd5e1",
          }}
        >
          Core Message
        </div>
        <div style={{ width: 1, flexShrink: 0 }} />
        <div
          style={{
            flex: 1,
            textAlign: "center",
            fontFamily: MONO,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            color: PERSONA,
          }}
        >
          Persona-Tuned Variant
        </div>
      </div>

      {/* The mirrored cube grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {/* Row 1 — baseline / control spans the full width */}
        <div style={{ display: "flex" }}>
          <Cell label="NO PROOF POINT - CONTROL" side="core" fullWidth />
        </div>
        {/* Row 2 — proof point 1 */}
        <Row core="CORE + PROOF POINT 1" persona="PERSONA + PROOF POINT 1" />
        {/* Row 3 — proof point 2 */}
        <Row core="CORE + PROOF POINT 2" persona="PERSONA + PROOF POINT 2" />
      </div>

      {/* Caption */}
      <div
        style={{
          marginTop: 8,
          fontFamily: MONO,
          fontSize: 7,
          letterSpacing: 0.3,
          color: C.textDim,
        }}
      >
        Each message × audience cell tests these variants.
      </div>
    </div>
  );
}
