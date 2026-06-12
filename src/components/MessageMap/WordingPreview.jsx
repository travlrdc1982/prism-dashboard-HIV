// WordingPreview — a fixed strip ABOVE the grid that shows the exact
// respondent-facing wording for the variant under the cursor.
//
// All wording text comes directly from dashboard.variants (the
// variants.xlsx workbook) — text_core for the CORE arm, and
// text_by_persona[seg.code] for the PERSONA-tuned arm. Captions
// (segment name, proof label) are dashboard chrome.
//
// SOLID fill (no opacity dance) so it never melts into the grid.
// Lives OUTSIDE the cube so it never hides the matrix.
import { C, FONT, MONO } from "../../data/theme";

export default function WordingPreview({ hover }) {
  // hover: { wording, side, messageLabel, segName, segCode, proofLabel } | null
  const active = !!hover?.wording;
  const personaSide = hover?.side === "persona";
  const accent = personaSide ? "#7F77DD" : "#94a3b8";
  return (
    <div style={{
      marginBottom: 10,
      padding: "12px 16px",
      background: "#0c1322",
      border: `1.5px solid ${active ? accent : C.cardBorder}`,
      borderRadius: 6,
      minHeight: 68,
      display: "flex", alignItems: "center", gap: 16,
      transition: "border-color 0.12s",
    }}>
      {/* Arm chip */}
      <div style={{
        width: 90, flexShrink: 0,
        fontFamily: MONO, fontSize: 9, fontWeight: 700,
        letterSpacing: 1.5, textTransform: "uppercase",
        textAlign: "center",
        padding: "8px 6px", borderRadius: 4,
        color: active ? "#fff" : C.textDim,
        background: active
          ? (personaSide ? "#7F77DD" : "#475569")
          : "transparent",
        border: `1px solid ${active
          ? (personaSide ? "#7F77DD" : "#475569")
          : C.cardBorder}`,
      }}>
        {active
          ? (personaSide ? "Persona-tuned" : "Core")
          : "Wording"}
      </div>

      {/* Body: wording in Lora italic + caption */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {active ? (
          <>
            <div style={{
              fontFamily: "'Lora', Georgia, serif",
              fontSize: 14, lineHeight: 1.45,
              fontStyle: "italic", color: "#f1f5f9",
              overflow: "hidden",
              display: "-webkit-box", WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
            }}>“{hover.wording}”</div>
            <div style={{
              marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap",
              fontFamily: FONT, fontSize: 9, color: C.textMuted,
            }}>
              {hover.messageLabel && (
                <span>
                  <span style={{ color: C.textDim }}>MSG </span>
                  <span style={{ color: "#cbd5e1" }}>
                    {hover.messageLabel}
                  </span>
                </span>
              )}
              {hover.segName && (
                <span>
                  <span style={{ color: C.textDim }}>FOR </span>
                  <span style={{ color: accent, fontWeight: 700 }}>
                    {hover.segName}
                    {hover.segCode ? ` (${hover.segCode})` : ""}
                  </span>
                </span>
              )}
              {hover.proofLabel && (
                <span>
                  <span style={{ color: C.textDim }}>PROOF </span>
                  <span style={{ color: "#cbd5e1" }}>
                    {hover.proofLabel}
                  </span>
                </span>
              )}
            </div>
          </>
        ) : (
          <div style={{
            fontFamily: FONT, fontSize: 11, color: C.textDim,
          }}>
            Hover any cell to read the exact wording shown to that
            respondent group (from the variants workbook).
          </div>
        )}
      </div>
    </div>
  );
}
