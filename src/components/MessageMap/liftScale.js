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
