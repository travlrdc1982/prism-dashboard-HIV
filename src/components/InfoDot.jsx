// Small "ⓘ" info dot — hover or focus to reveal a popover tooltip.
//
// Usage:
//   <InfoDot label="Filter">
//     <p>Tooltip content...</p>
//   </InfoDot>
//
// The dot is a 14×14 circle sitting inline with surrounding text. Tooltip
// pops above and to the right by default; pass `placement="below"` or
// `placement="left"` to nudge it.
import { useState, useRef } from "react";

const TOOLTIP_W = 320;

export default function InfoDot({
  label = "info",
  children,
  placement = "below",
  size = 14,
  color = "#94a3b8",
  hoverColor = "#a78bfa",
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const tooltipStyle = {
    position: "absolute",
    zIndex: 50,
    width: TOOLTIP_W,
    background: "#0b1220",
    border: "1px solid #334155",
    borderRadius: 6,
    padding: "10px 12px",
    fontSize: 11,
    color: "#cbd5e1",
    fontFamily: "'Nunito',sans-serif",
    lineHeight: 1.55,
    boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
    pointerEvents: "none",
  };

  // Placement: anchor relative to the dot.
  if (placement === "below") {
    tooltipStyle.top = size + 6;
    tooltipStyle.left = -8;
  } else if (placement === "above") {
    tooltipStyle.bottom = size + 6;
    tooltipStyle.left = -8;
  } else if (placement === "right") {
    tooltipStyle.left = size + 6;
    tooltipStyle.top = -4;
  } else if (placement === "left") {
    tooltipStyle.right = size + 6;
    tooltipStyle.top = -4;
  }

  return (
    <span
      ref={ref}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      aria-label={label}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size, height: size, borderRadius: "50%",
        border: `1px solid ${open ? hoverColor : color}`,
        color: open ? hoverColor : color,
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: Math.round(size * 0.65),
        fontWeight: 700,
        cursor: "help",
        marginLeft: 6,
        verticalAlign: "middle",
        transition: "all 0.12s",
        background: "transparent",
        userSelect: "none",
        outline: "none",
      }}
    >
      i
      {open && (
        <span style={tooltipStyle} role="tooltip">
          {children}
        </span>
      )}
    </span>
  );
}
