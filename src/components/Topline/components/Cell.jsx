// Shared cell builders — ported from dashboard_template.html buildCell /
// buildDeltaCell / buildDist7. Returns JSX (source returns HTML strings).

import { fmtPct, fmtMean, fmtDelta, heatColor } from "../utils/format";
import { SigDots, SigDots3 } from "./Sig";

// ─── 7-point frequency distribution mini-chart ──────────────────────────
function Dist7({ freq, signed = false }) {
  if (!freq) return null;
  const max = signed ? null : Math.max(...freq);
  return (
    <div className="dist7">
      {Array.from({ length: 7 }).map((_, k) => {
        const pct = freq[k];
        let barW;
        if (signed) {
          barW = Math.min(100, Math.abs(pct) * 5);
        } else {
          barW = max > 0 ? Math.round((pct / max) * 100) : 0;
        }
        const sign = signed ? (pct > 0 ? "+" : "") : "";
        const pctText = signed
          ? `${sign}${Math.round(pct * 10) / 10}`
          : pct < 1
          ? "<1%"
          : `${Math.round(pct)}%`;
        return (
          <div key={k} className={`d7-row k${k + 1}`}>
            <span className="d7-k">{k + 1}</span>
            <span
              className="d7-bar"
              style={{
                width: `${barW}%`,
                opacity: signed ? Math.min(1, Math.abs(pct) / 10) : 1,
              }}
            />
            <span className="d7-pct">{pctText}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Standard data cell (top-3, mean, bot-3, freq dist) ────────────────
export function DataCell({ stats, totalTop3 = null, isTotal = false, cut = "", row = "", item = "" }) {
  if (!stats) {
    return <td className="cell" data-empty="1">—</td>;
  }
  const { top3, bot3, mean, n, freq } = stats;
  const dev = totalTop3 == null ? null : top3 - totalTop3;
  const bg = heatColor(dev);
  const cls = "cell" + (isTotal ? " total-cell" : "");
  const sigLevel = isTotal ? 0 : stats.sig_top3 || 0;
  return (
    <td
      className={cls}
      style={{ background: bg }}
      data-top3={top3}
      data-bot3={bot3}
      data-mean={mean}
      data-n={n}
      data-cut={cut}
      data-row={row}
      data-item={item}
      data-sig={sigLevel}
      data-z={stats.z_top3 || 0}
    >
      <SigDots level={sigLevel} />
      <div className="top3">{fmtPct(top3)}</div>
      <Dist7 freq={freq} />
      <div className="detail">
        <span className="lbl">m</span> {fmtMean(mean)}{" "}
        <span className="lbl">b3</span> {fmtPct(bot3)}
      </div>
    </td>
  );
}

// ─── Delta cell (POST − PRE) ────────────────────────────────────────────
export function DeltaCell({ delta, isTotal = false, cut = "", item = "" }) {
  if (!delta) {
    return <td className="cell" data-empty="1">—</td>;
  }
  const { top3: dt3, mean: dm } = delta;
  const cls = "cell" + (isTotal ? " total-cell" : "");
  let signClass = "zero";
  if (dt3 > 0.5) signClass = "pos";
  else if (dt3 < -0.5) signClass = "neg";
  const sigDelta = delta.sig_delta || 0;
  const signedFreq = delta.df1 !== undefined
    ? [delta.df1, delta.df2, delta.df3, delta.df4, delta.df5, delta.df6, delta.df7]
    : null;

  let val;
  if (Math.abs(dt3) < 0.5) {
    val = <div className="delta-val zero">—</div>;
  } else {
    const sign = dt3 > 0 ? "+" : "";
    val = <div className={`delta-val ${signClass}`}>{sign}{Math.round(dt3 * 10) / 10}</div>;
  }

  return (
    <td
      className={cls}
      data-dt3={dt3}
      data-dmean={dm}
      data-cut={cut}
      data-row="delta"
      data-item={item}
      data-npaired={delta.n_paired || 0}
      data-gain={delta.switch_gain || 0}
      data-loss={delta.switch_loss || 0}
      data-mp={delta.mcnemar_p ?? ""}
      data-method={delta.mcnemar_method || ""}
      data-sigd={sigDelta}
    >
      <SigDots3 level={sigDelta} />
      {val}
      {signedFreq && <Dist7 freq={signedFreq} signed />}
      <div className="detail">
        <span className="lbl">Δm</span> {fmtDelta(dm, "")}
      </div>
    </td>
  );
}

// ─── Binary "% yes" cell (knowledge items, etc.) ───────────────────────
export function YesCell({ cell, isTotal = false, cut = "", code = "" }) {
  if (!cell) {
    return <td className="cell empty" data-empty="1" />;
  }
  const sigLevel = cell.sig || 0;
  return (
    <td
      className={"cell" + (isTotal ? " total-cell" : "")}
      data-cut={cut}
      data-val={cell.val}
      data-n={cell.n}
      data-z={cell.z || 0}
      data-sig={sigLevel}
      data-metric="pct_yes"
      data-code={code}
    >
      {!isTotal && <SigDots level={sigLevel} />}
      <div className="cell-val top3">{Math.round(cell.val ?? 0)}%</div>
    </td>
  );
}

// ─── Composite mean cell (no top3/bot3 — just a mean + sig) ────────────
export function MeanCell({ cell, isTotal = false, cut = "", code = "" }) {
  if (!cell) {
    return <td className="cell empty" data-empty="1" />;
  }
  const sigLevel = cell.sig || 0;
  return (
    <td
      className={"cell" + (isTotal ? " total-cell" : "")}
      data-cut={cut}
      data-val={cell.val}
      data-n={cell.n}
      data-t={cell.t}
      data-p={cell.p}
      data-sig={sigLevel}
      data-metric="mean"
      data-code={code}
    >
      {!isTotal && <SigDots level={sigLevel} />}
      <div className="cell-val top3">{fmtMean(cell.val)}</div>
    </td>
  );
}

// ─── Banner-table head: party bands + segment column headers ───────────
export function BannerTableHead({
  segments,
  totalN,
  partyA = "GOP COALITION",
  partyB = "DEM COALITION",
  showTotalLabel = "Total",
  // Sortable header support (opt-in; ignored if onSort not passed):
  sortable = false,
  sortCol = null,
  sortDir = "desc",
  onSort = null,
}) {
  const gop = segments.filter((s) => s.party === "GOP");
  const dem = segments.filter((s) => s.party === "DEM");
  const isSortable = sortable && typeof onSort === "function";
  const arrow = (code) => (sortCol === code ? (sortDir === "asc" ? " ▲" : " ▼") : "");
  const sortableCls = isSortable ? " sortable" : "";
  const activeCls = (code) => (isSortable && sortCol === code ? " sort-active" : "");
  return (
    <thead>
      <tr className="party-band">
        <th></th>
        <th className="total-band">TOTAL</th>
        <th className="gop-band" colSpan={gop.length}>{partyA}</th>
        <th className="dem-band" colSpan={dem.length}>{partyB}</th>
      </tr>
      <tr>
        <th></th>
        <th
          className={"total-head seg-head" + sortableCls + activeCls("TOTAL")}
          onClick={isSortable ? () => onSort("TOTAL") : undefined}
          role={isSortable ? "button" : undefined}
          tabIndex={isSortable ? 0 : undefined}
        >
          {showTotalLabel}{arrow("TOTAL")}<span className="seg-n">n={totalN ?? "—"}</span>
        </th>
        {segments.map((s) => (
          <th
            key={s.code}
            className={"seg-head" + sortableCls + activeCls(s.code)}
            title={s.name}
            onClick={isSortable ? () => onSort(s.code) : undefined}
            role={isSortable ? "button" : undefined}
            tabIndex={isSortable ? 0 : undefined}
          >
            {s.code}{arrow(s.code)}<span className="seg-n">n={s.n}</span>
          </th>
        ))}
      </tr>
    </thead>
  );
}
