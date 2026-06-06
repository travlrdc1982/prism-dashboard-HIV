// Small "?" info dot — hover (or focus) to reveal a popover tooltip.
//
// Styling matches the radar-axis tooltip in SegmentProfile.jsx:
//   - 280px wide, background #1e293b, border #334155, border-radius 8
//   - Title:  10px / weight 700 / #a78bfa / Nunito / margin-bottom 4
//   - Body:    9px / #cbd5e1 / Nunito / line-height 1.5
//
// Usage:
//   <InfoDot title="OUTCOME">Tooltip body copy…</InfoDot>
//
// `placement` nudges the tooltip relative to the dot:
//   "below" (default) | "above" | "left" | "right"
import { useState, useRef } from "react";

export default function InfoDot({
  title,
  children,
  placement = "below",
  color = "#475569",
  hoverColor = "#a78bfa",
  ariaLabel = "info",
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const tooltipStyle = {
    position: "absolute",
    zIndex: 100,
    width: 280,
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "10px 12px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
    pointerEvents: "none",
  };
  if (placement === "below") { tooltipStyle.top = 18;            tooltipStyle.left = -8;  }
  if (placement === "above") { tooltipStyle.bottom = 18;         tooltipStyle.left = -8;  }
  if (placement === "right") { tooltipStyle.left = 18;           tooltipStyle.top = -4;   }
  if (placement === "left")  { tooltipStyle.right = 18;          tooltipStyle.top = -4;   }

  return (
    <span
      ref={ref}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      aria-label={ariaLabel}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 13, height: 13, borderRadius: "50%",
        border: `1px solid ${open ? hoverColor : color}`,
        color: open ? hoverColor : color,
        fontFamily: "'Nunito',sans-serif",
        fontSize: 9, fontWeight: 600, lineHeight: 1,
        cursor: "help",
        marginLeft: 6,
        verticalAlign: "middle",
        transition: "all 0.12s",
        background: "transparent",
        userSelect: "none",
        outline: "none",
      }}
    >
      ?
      {open && (
        <span style={tooltipStyle} role="tooltip">
          {title && (
            <span style={{
              display: "block",
              fontSize: 10, fontWeight: 700, color: "#a78bfa",
              fontFamily: "'Nunito',sans-serif",
              marginBottom: 4, lineHeight: 1.3,
              letterSpacing: 0.5, textTransform: "uppercase",
            }}>{title}</span>
          )}
          <span style={{
            display: "block",
            fontSize: 9, color: "#cbd5e1",
            fontFamily: "'Nunito',sans-serif", lineHeight: 1.5,
          }}>{children}</span>
        </span>
      )}
    </span>
  );
}
