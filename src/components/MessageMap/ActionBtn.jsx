// Message Map building block — shared chrome for the /messages page.
// Lifted from src/pages/MessageMap.jsx (B2 prep) so later studies can
// reuse the Message Map shell without forking the page.
import { C, MONO } from "../../data/theme";

export default function ActionBtn({ label, onClick, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: MONO, fontSize: 9, fontWeight: 600,
        letterSpacing: 1, textTransform: "uppercase",
        background: "transparent",
        color: disabled ? C.textDim : C.textMuted,
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 4, padding: "5px 10px",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.15s",
      }}
    >{label}</button>
  );
}
