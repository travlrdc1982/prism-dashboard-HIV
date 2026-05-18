// Module chip navigation — ported from dashboard_template.html renderModNav().
// Each chip jumps to the module's section via in-page anchor.

export default function ModNav({ modules }) {
  return (
    <div className="modnav">
      {modules.map((m) => {
        const isActive = m.active;
        const cls = "modnav-chip" + (isActive ? "" : " disabled");
        const handleClick = (e) => {
          if (!isActive) {
            e.preventDefault();
            return;
          }
        };
        return (
          <a
            key={m.id}
            href={isActive ? `#mod-${m.id}` : undefined}
            className={cls}
            onClick={handleClick}
          >
            <span className="chip-num">{m.tile_num}</span>
            <span className="chip-title">{m.nav_label || m.tile_title}</span>
          </a>
        );
      })}
    </div>
  );
}
