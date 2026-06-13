// Message Map lift scaling + color ramp — shared by the cell grid and
// the LiftRamp legend so they can never disagree.
//
// Raw lift (lift_shrunk, residual-index units) maps onto 0–100 via the
// metric's color_scale from dashboard.json (lift_variants[i].color_scale,
// authored in study/study.yaml): min → 0, neutral → 50, max → 100,
// clamped. Greener = stronger positive lift; redder = backfire;
// white = negligible.

export function scaleLift(lift, colorScale) {
  if (lift == null || !isFinite(lift)) return null;
  const min = colorScale?.min ?? -0.3;
  const max = colorScale?.max ?? 0.3;
  const t = (lift - min) / (max - min);
  return Math.round(Math.max(0, Math.min(1, t)) * 100);
}

// Piecewise-linear ramp: backfire red → neutral white → lift green.
const STOPS = [
  { t: 0.0, rgb: [127, 29, 29] },    // #7f1d1d
  { t: 0.5, rgb: [241, 245, 249] },  // #f1f5f9
  { t: 1.0, rgb: [20, 83, 45] },     // #14532d
];

// SoP / Utility 6-bin red→green palette — curated to match the
// AL/Pharma study look (no lemon-lime middle). Same map used by the
// SCALE block's gradient chips, so the legend and the heatmap cells
// always agree.
export const GRADIENT_BINS_6 = [
  { bg: "#6b1a1a", text: "#fde6e6" },  // 0  very dark red
  { bg: "#b91c1c", text: "#fff5f5" },  // 1  red
  { bg: "#92400e", text: "#fff7ed" },  // 2  burnt amber / dark
  { bg: "#166534", text: "#ecfdf5" },  // 3  dark green
  { bg: "#15803d", text: "#ecfdf5" },  // 4  medium green
  { bg: "#22c55e", text: "#0f1520" },  // 5  bright green
];

// 7-bin diverging palette for the Utility view — centered at 0, red
// for negative magnitudes, green for positive, neutral grey at zero.
// Same idiom the SCALE block legend shows so legend chips and cell
// colors agree. Used by UtilityGrid + the Utility leg of ScaleBlock.
export const DIVERGING_BINS_7 = [
  { bg: "#7f1d1d", text: "#fff5f5" },             // -3  strongest negative
  { bg: "#dc2626", text: "#fff5f5" },             // -2  negative
  { bg: "#f59e0b", text: "#0f1520" },             // -1  mild negative (amber)
  { bg: "rgba(148,163,184,0.18)", text: "#cbd5e1" }, // 0   neutral
  { bg: "#84cc16", text: "#0f1520" },             // +1  mild positive (lime)
  { bg: "#16a34a", text: "#ecfdf5" },             // +2  positive
  { bg: "#22c55e", text: "#0f1520" },             // +3  strongest positive
];

// Diverging color for a signed value relative to its data range. Use
// maxAbs = max(|x|) across all cells so the scale is symmetric about
// zero and comparable across cells.
//   t = value / maxAbs, clamped to [-1, 1]
//   bin = round((t + 1) / 2 * (bins - 1)) — t = -1 → bin 0, t = 0 →
//   center, t = +1 → last bin.
export function divergingBinColor(value, maxAbs, bins = 7) {
  if (value == null || !isFinite(value)) {
    return { bg: "rgba(148,163,184,0.06)", text: "#475569" };
  }
  const limit = Math.max(Math.abs(maxAbs) || 0, 1e-9);
  const t = Math.max(-1, Math.min(1, value / limit));
  const idx = Math.max(0, Math.min(bins - 1,
    Math.round(((t + 1) / 2) * (bins - 1))));
  if (bins === 7) return DIVERGING_BINS_7[idx];
  // Fallback (no current consumer).
  return DIVERGING_BINS_7[Math.min(6, idx)];
}

export function gradientBinColor(value, min, max, bins = 6) {
  if (value == null || !isFinite(value)) {
    return { bg: "rgba(148,163,184,0.06)", text: "#475569" };
  }
  const span = (max - min) || 1;
  const t = Math.max(0, Math.min(1, (value - min) / span));
  const idx = Math.min(bins - 1, Math.floor(t * bins));
  if (bins === 6) return GRADIENT_BINS_6[idx];
  // Other bin counts still get a hue sweep (no current consumer).
  const hue = Math.round((idx / (bins - 1)) * 120);
  return { bg: `hsl(${hue}, 60%, 46%)`, text: "#f8fafc" };
}

export function rampColor(v100) {
  if (v100 == null) {
    return { bg: "rgba(148,163,184,0.06)", text: "#475569" };
  }
  const t = Math.max(0, Math.min(1, v100 / 100));
  let lo = STOPS[0], hi = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (t >= STOPS[i].t && t <= STOPS[i + 1].t) {
      lo = STOPS[i]; hi = STOPS[i + 1];
      break;
    }
  }
  const f = (t - lo.t) / (hi.t - lo.t || 1);
  const rgb = lo.rgb.map((c, i) => Math.round(c + (hi.rgb[i] - c) * f));
  const bg = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  // Perceived luminance picks the text color for contrast.
  const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  const text = lum > 0.55 ? "#0f172a" : "#f8fafc";
  return { bg, text };
}
