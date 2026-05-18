// Pure formatters ported verbatim from dashboard_template.html lines 562-573.
// These return display strings; sig markers (which return DOM nodes in the
// source) live in ../components/Sig.jsx as JSX.

export function fmtPct(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Math.round(v) + "%";
}

export function fmtMean(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toFixed(2);
}

export function fmtDelta(v, unit = "") {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return sign + (Math.round(v * 10) / 10) + unit;
}

// Heat-map background color from deviation vs total.
// Returns a CSS color (either 'white' or a `var(--above-N)` / `var(--below-N)` token
// that resolves to a value in Topline.css).
export function heatColor(dev) {
  if (dev === null || dev === undefined || Number.isNaN(dev)) return "white";
  const abs = Math.abs(dev);
  if (abs < 3) return "white";
  if (abs < 8) return dev > 0 ? "var(--above-1)" : "var(--below-1)";
  if (abs < 15) return dev > 0 ? "var(--above-2)" : "var(--below-2)";
  if (abs < 25) return dev > 0 ? "var(--above-3)" : "var(--below-3)";
  return dev > 0 ? "var(--above-4)" : "var(--below-4)";
}
