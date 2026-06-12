// Message Map building block — the cell-architecture explainer.
//
// One square = one message × segment intersection. Clicking the square
// unfolds the array of possibilities tested at that intersection:
//
//   state 0   ■            the intersection (one cell)
//   state 1   ■|■           × 2 framings — CORE | PERSONA-TUNED
//   state 2   ■|■           × 6 proof tokens — "no proof" + proofs 1–5
//             ─┼─             expand below as rows inside the SAME square
//             ▦|▦           = up to 12 tested variants per intersection
//
// All labels live OUTSIDE the square (column labels above, token labels
// in a left gutter). Hovering any sub-cell names its exact combination
// in the caption. Click cycles 0 → 1 → 2 → 0.
import { useState } from "react";
import { C, FONT, MONO } from "../../data/theme";
import InfoDot from "../InfoDot";

const N_PROOFS = 5;          // illustrative maximum (platform supports 1–5)
const COL_W = 62;            // each framing column, px
const GUTTER = 58;           // left token-label gutter, px
const BASE_H = 56;           // square height while undivided / two columns
const BASE_H_OPEN = 26;      // "no proof" row height once tokens unfold
const ROW_H = 17;            // each proof-token row height
const EASE = "0.35s cubic-bezier(0.4, 0, 0.2, 1)";

const BLUE = "#60a5fa";
const CORE_BG = "#334155";
const PERSONA_BG = "rgba(96,165,250,0.22)";

export default function CellArchitectureWidget() {
  const [state, setState] = useState(0);          // 0 → 1 → 2 → 0
  const [hover, setHover] = useState(null);       // {col, row} | null

  const split = state >= 1;
  const open = state === 2;

  const captions = [
    "One message × segment intersection. Click the square to unfold what was tested inside it.",
    "× 2 framings — the CORE wording (left) vs the segment-tuned PERSONA variant (right). Click again.",
    `× ${N_PROOFS + 1} proof tokens — the base wording plus up to ${N_PROOFS} appended proof points = up to ${2 * (N_PROOFS + 1)} tested variants in this one cell. Click to fold up.`,
  ];

  const hoverName = hover
    ? `${hover.col === 0 ? "CORE" : "PERSONA-TUNED"}${
        open ? ` · ${hover.row === 0 ? "no proof" : `proof ${hover.row}`}` : ""
      } — one tested variant`
    : null;

  const variantCount = state === 0 ? 1 : state === 1 ? 2 : 2 * (N_PROOFS + 1);

  // One sub-rectangle of the matrix.
  const subCell = (col, row) => {
    const isHover = hover && hover.col === col && hover.row === row;
    return (
      <div
        key={`${col}-${row}`}
        onMouseEnter={() => setHover({ col, row })}
        onMouseLeave={() => setHover(null)}
        style={{
          flex: 1,
          background: col === 0 ? CORE_BG : PERSONA_BG,
          filter: isHover ? "brightness(1.45)" : "none",
          boxShadow: isHover ? "inset 0 0 0 1px rgba(241,245,249,0.8)" : "none",
          transition: "filter 0.1s",
        }}
      />
    );
  };

  // A row of the matrix: CORE half + seam + PERSONA half (PERSONA width
  // animates from 0 so the seam visibly slides out of the CORE square).
  const matrixRow = (row, height, topCut) => (
    <div key={row} style={{
      display: "flex", height, overflow: "hidden",
      borderTop: topCut ? "1px dashed #64748b" : "none",
      transition: `height ${EASE}`,
    }}>
      <div style={{ width: COL_W, display: "flex", flexShrink: 0 }}>
        {subCell(0, row)}
      </div>
      <div style={{
        width: split ? 1 : 0, flexShrink: 0,
        background: BLUE, opacity: split ? 0.8 : 0,
        transition: `all ${EASE}`,
      }} />
      <div style={{
        width: split ? COL_W : 0, display: "flex", flexShrink: 0,
        overflow: "hidden", transition: `width ${EASE}`,
      }}>
        {subCell(1, row)}
      </div>
    </div>
  );

  // Token label in the gutter, vertically matched to its row.
  const gutterLabel = (row, height) => (
    <div key={row} style={{
      height, display: "flex", alignItems: "center", justifyContent: "flex-end",
      paddingRight: 8, overflow: "hidden",
      opacity: open ? 1 : 0,
      transition: `height ${EASE}, opacity 0.25s ${open ? "0.2s" : "0s"}`,
      fontFamily: FONT, fontSize: 9,
      color: row === 0 ? C.textDim : C.textMuted,
      fontStyle: row === 0 ? "italic" : "normal",
      fontWeight: 600, whiteSpace: "nowrap",
    }}>
      {row === 0 ? "no proof" : `proof ${row}`}
    </div>
  );

  const rows = [0, ...Array.from({ length: N_PROOFS }, (_, i) => i + 1)];
  const rowHeight = (row) =>
    row === 0 ? (open ? BASE_H_OPEN : BASE_H) : (open ? ROW_H : 0);

  return (
    <div style={{
      flexShrink: 0, width: 252,
      padding: "10px 14px 12px",
      background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 6,
    }}>
      {/* Title + live variant counter */}
      <div style={{
        display: "flex", alignItems: "center", marginBottom: 8,
      }}>
        <span style={{
          fontFamily: MONO, fontSize: 7, color: C.textDim,
          letterSpacing: 1.5, textTransform: "uppercase",
          display: "flex", alignItems: "center",
        }}>
          Cell Architecture
          <InfoDot title="Cell architecture">
            Every intersection of a message row and a segment column holds an
            array of tested possibilities: 2 framings (CORE vs persona-tuned)
            × up to 6 proof tokens. Click the square to unfold them.
          </InfoDot>
        </span>
        <span style={{
          marginLeft: "auto",
          fontFamily: MONO, fontSize: 8, fontWeight: 700,
          color: state === 0 ? C.textMuted : "#34d399",
          letterSpacing: 0.5,
          transition: "color 0.2s",
        }}>
          {variantCount} variant{variantCount > 1 ? "s" : ""}
        </span>
      </div>

      {/* Column labels — outside the square, above each framing column */}
      <div style={{ display: "flex", marginBottom: 3 }}>
        <div style={{ width: GUTTER, flexShrink: 0 }} />
        <div style={{
          width: COL_W, textAlign: "center", flexShrink: 0,
          fontFamily: MONO, fontSize: 7, fontWeight: 700,
          letterSpacing: 1, textTransform: "uppercase", color: "#cbd5e1",
        }}>Core</div>
        <div style={{
          width: split ? COL_W + 1 : 0, overflow: "hidden", flexShrink: 0,
          textAlign: "center",
          fontFamily: MONO, fontSize: 7, fontWeight: 700,
          letterSpacing: 1, textTransform: "uppercase", color: BLUE,
          opacity: split ? 1 : 0,
          transition: `width ${EASE}, opacity 0.25s`,
          whiteSpace: "nowrap",
        }}>Persona</div>
      </div>

      {/* Gutter + the square (one border around the whole unfolding matrix) */}
      <div style={{ display: "flex", cursor: "pointer" }}
           onClick={() => { setState((state + 1) % 3); setHover(null); }}>
        <div style={{ width: GUTTER, flexShrink: 0 }}>
          {rows.map(r => gutterLabel(r, rowHeight(r)))}
        </div>
        <div style={{
          border: "1.5px solid #94a3b8", borderRadius: 3,
          overflow: "hidden", flexShrink: 0,
          alignSelf: "flex-start",
        }}>
          {rows.map(r => matrixRow(r, rowHeight(r), r > 0 && open))}
        </div>
      </div>

      {/* Caption — fixed height so the card never jumps; hover overrides */}
      <div style={{
        marginTop: 8, minHeight: 56,
        fontFamily: FONT, fontSize: 10, lineHeight: 1.45,
        color: hoverName ? "#34d399" : C.textMuted,
        transition: "color 0.1s",
      }}>
        {hoverName || captions[state]}
      </div>
    </div>
  );
}
