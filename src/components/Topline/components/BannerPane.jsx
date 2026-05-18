// Banner-pane (right rail, variable width). Holds the 18-column banner table:
// TOTAL · 10 GOP segments · 6 DEM segments (with GOP/DEM band headers).
// Module-specific render functions pass in the table itself; this is a
// passthrough wrapper to keep JSX symmetric across modules.

export default function BannerPane({ extraClass = "", children }) {
  const className = extraClass ? `banner-pane ${extraClass}` : "banner-pane";
  return <div className={className}>{children}</div>;
}

// Banner table header row — TOTAL band + GOP band (colspan 10) + DEM band (colspan 6).
// Renders the two-row party-band header used by every banner table.
export function BannerTableHead({ segments }) {
  const gopSegs = segments.filter((s) => s.party === "GOP");
  const demSegs = segments.filter((s) => s.party === "DEM");

  return (
    <thead>
      <tr className="party-band">
        <th className="rlbl-head"></th>
        <th className="total-band">TOTAL</th>
        <th className="gop-band" colSpan={gopSegs.length}>
          REPUBLICANS ({gopSegs.length})
        </th>
        <th className="dem-band" colSpan={demSegs.length}>
          DEMOCRATS ({demSegs.length})
        </th>
      </tr>
      <tr className="seg-head-row">
        <th className="rlbl-head"></th>
        <th className="seg-head total-head">All</th>
        {gopSegs.map((s) => (
          <th key={s.code} className="seg-head gop-head">
            <div className="seg-code">{s.code}</div>
            <div className="seg-n">n={s.n}</div>
          </th>
        ))}
        {demSegs.map((s) => (
          <th key={s.code} className="seg-head dem-head">
            <div className="seg-code">{s.code}</div>
            <div className="seg-n">n={s.n}</div>
          </th>
        ))}
      </tr>
    </thead>
  );
}
