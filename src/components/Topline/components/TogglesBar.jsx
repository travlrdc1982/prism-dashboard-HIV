// Per-section toggle bar — appears at the top of each data-bearing module
// section. The toggles drive global state hoisted in <Topline>: the
// .topline-root container gets `.expanded` and/or `.fullDist` classes that
// reveal the mean/b3 detail row and the 7-bar freq distribution inside
// every .cell. Matches dashboard_template.html getTogglesHTML (713-720).

export default function TogglesBar({
  expanded,
  fullDist,
  onToggleExpanded,
  onToggleFullDist,
  info,
}) {
  return (
    <div className="toggle-bar">
      <label>
        <input
          type="checkbox"
          className="expand-toggle"
          checked={expanded}
          onChange={(e) => onToggleExpanded(e.target.checked)}
        />{" "}
        Show mean in cells
      </label>
      <label>
        <input
          type="checkbox"
          className="dist-toggle"
          checked={fullDist}
          onChange={(e) => onToggleFullDist(e.target.checked)}
        />{" "}
        Show full frequency distribution in cells
      </label>
      {info && <span className="info">{info}</span>}
    </div>
  );
}
