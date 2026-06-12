// Per-message Variant Universe strip — the 1-D projection of a single
// message's full (segment × persona × proof) cell space, summarised in
// one glance. Implements the grammar advertised in
// VariantUniverseLegend.jsx (and the column tooltip):
//
//   ├──── band ────┤      | live tick           dashed zero line
//   ○ CORE          ● OPTIMAL
//
// stats:
//   min, max   raw lift extrema across the message's basket cells
//   core       n-weighted mean of arm=CORE × proof=0 cells (○)
//   optimal    the (arm × proof) combo with the highest basket-mean (●)
//   live       n-weighted mean of every basket cell for this message
//              under the active metric (the moving green tick)
//
// All five lifts are scaled to 0–100 via the metric's color_scale (the
// same scale every cell uses) so the strip and the cells share a
// horizontal coordinate system.
import { scaleLift } from "./liftScale";

export default function VariantUniverseBar({
  stats, colorScale, color = "#34d399", width = 130, height = 22,
}) {
  if (!stats) {
    return (
      <div style={{
        width, height,
        background: "rgba(148,163,184,0.05)",
        border: "1px dashed rgba(148,163,184,0.25)",
        borderRadius: 2,
      }} />
    );
  }
  const { min, max, core, optimal, live } = stats;
  const PAD = 8;
  const W = width - 2 * PAD;
  const x = (lift) => PAD + (scaleLift(lift, colorScale) / 100) * W;
  const fmt = (v) => v == null ? "—" : v.toFixed(2);

  const xMin = x(min);
  const xMax = x(max);
  const xZero = x(0);
  const xCore = core != null ? x(core) : null;
  const xOpt = optimal != null ? x(optimal) : null;
  const xLive = live != null ? x(live) : null;
  const bandFill = `${color}33`;
  const cy = height / 2;

  const tip = [
    `min:    ${fmt(min)}`,
    `max:    ${fmt(max)}`,
    `core ○: ${fmt(core)}`,
    `optimal ●: ${fmt(optimal)}`,
    `live tick: ${fmt(live)}`,
    `headroom (● − ○): ${optimal != null && core != null
      ? (optimal - core).toFixed(2) : "—"}`,
  ].join("\n");

  return (
    <svg width={width} height={height}
         viewBox={`0 0 ${width} ${height}`}
         style={{ display: "block", cursor: "help" }}>
      <title>{tip}</title>
      {/* Range band */}
      <rect x={Math.min(xMin, xMax)} y={cy - 3}
            width={Math.max(2, Math.abs(xMax - xMin))} height={6}
            fill={bandFill} stroke={color} strokeWidth={0.8} rx={2} />
      {/* Dashed real-zero line */}
      <line x1={xZero} y1={2} x2={xZero} y2={height - 2}
            stroke="#64748b" strokeWidth={1} strokeDasharray="2,2" />
      {/* Live tick — moves with metric × basket */}
      {xLive != null && (
        <line x1={xLive} y1={3} x2={xLive} y2={height - 3}
              stroke={color} strokeWidth={1.8} />
      )}
      {/* ○ CORE */}
      {xCore != null && (
        <circle cx={xCore} cy={cy} r={3.2}
                fill="#0f1520" stroke={color} strokeWidth={1.5} />
      )}
      {/* ● OPTIMAL */}
      {xOpt != null && (
        <circle cx={xOpt} cy={cy} r={3.2} fill={color} />
      )}
    </svg>
  );
}
