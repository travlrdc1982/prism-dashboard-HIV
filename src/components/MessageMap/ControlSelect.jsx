// Message Map building block — shared chrome for the /messages page.
// Lifted from src/pages/MessageMap.jsx (B2 prep) so later studies can
// reuse the Message Map shell without forking the page.
import { C, FONT, MONO } from "../../data/theme";
import InfoDot from "../InfoDot";

export default function ControlSelect({ label, value, options, onChange, info, infoTitle }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{
        fontFamily: MONO, fontSize: 7, color: C.textDim,
        letterSpacing: 1.5, textTransform: "uppercase",
        display: "flex", alignItems: "center",
      }}>
        {label}
        {info && <InfoDot title={infoTitle} placement="below">{info}</InfoDot>}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          fontFamily: FONT, fontSize: 11, fontWeight: 600,
          background: C.card, color: C.white,
          border: `1px solid ${C.cardBorder}`,
          borderRadius: 4, padding: "5px 24px 5px 10px",
          cursor: "pointer", appearance: "none",
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 5'><path fill='%2394a3b8' d='M0 0l4 5 4-5z'/></svg>")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 8px center",
          backgroundSize: "8px 5px",
          outline: "none",
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
