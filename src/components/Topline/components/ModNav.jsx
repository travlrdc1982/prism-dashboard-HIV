import { Link } from "react-router-dom";

// Module chip navigation — ported from dashboard_template.html renderModNav().
// Most chips jump to in-page anchors; 05 redirects to the Message Map route.

const CHIP_DESTINATIONS = {
  maxdiff: "/messages",
};

export default function ModNav({ modules }) {
  return (
    <div className="modnav">
      {modules.map((m) => {
        const to = CHIP_DESTINATIONS[m.id] || `#mod-${m.id}`;
        const isRoutedChip = Boolean(CHIP_DESTINATIONS[m.id]);
        const isActive = m.active || isRoutedChip;
        const cls = "modnav-chip" + (isActive ? "" : " disabled");
        const handleClick = (e) => {
          if (!isActive) {
            e.preventDefault();
            return;
          }
        };
        return (
          <Link
            key={m.id}
            to={isActive ? to : "#"}
            className={cls}
            onClick={handleClick}
          >
            <span className="chip-num">{m.tile_num}</span>
            <span className="chip-title">{m.nav_label || m.tile_title}</span>
          </Link>
        );
      })}
    </div>
  );
}
