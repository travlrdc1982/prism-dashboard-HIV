// Message Map building block — shared chrome for the /messages page.
// Lifted from src/pages/MessageMap.jsx (B2 prep) so later studies can
// reuse the Message Map shell without forking the page.
// Variant-Universe column header — visual legend lives HERE, not in popup.
// Mini SVG demo: band + open circle (CORE) + filled dot (optimal) +
// dashed zero line + live green tick.
export default function VariantUniverseLegend() {
  const W = 130, H = 22;
  const cx = W / 2;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* Band */}
      <rect x="14" y="8" width={W - 28} height="6"
            fill="rgba(52,211,153,0.25)" stroke="#34d399" strokeWidth="0.8" rx="2" />
      {/* Dashed zero */}
      <line x1={cx} y1="2" x2={cx} y2={H - 2}
            stroke="#64748b" strokeWidth="1" strokeDasharray="2,2" />
      {/* Open circle = CORE */}
      <circle cx="34" cy="11" r="3.2" fill="none" stroke="#34d399" strokeWidth="1.5" />
      {/* Filled dot = OPTIMAL */}
      <circle cx={W - 30} cy="11" r="3.2" fill="#34d399" />
      {/* Live tick */}
      <line x1={W - 50} y1="3" x2={W - 50} y2={H - 3}
            stroke="#34d399" strokeWidth="1.8" />
    </svg>
  );
}
