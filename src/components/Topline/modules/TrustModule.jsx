// Trust Sources module (06) — banner table of the 22 deployable trust
// messengers. Each row = one messenger; columns = TOTAL + 16 segments.
// Cells follow the standard 7-point-item layout: top-3 (5-7) % headline,
// full 1-7 frequency distribution (revealed by the "Show full frequency"
// toggle), mean + bot-3 in the detail row. Sig markers = z-test on top-3
// proportion vs. rest of sample. Data comes from dashboard.json['trust']
// (emitted by compute_core's _stats helper, same as every other 7-pt item).
//
// Optional "Enable column sort" toggle (off by default) makes the column
// headers click-to-sort by that column's top-3 %. First click → desc, second
// → asc, third → clear.

import { useMemo, useState } from "react";
import { DataCell, BannerTableHead } from "../components/Cell";

export default function TrustModule({ trust, segments, study }) {
  const [sortEnabled, setSortEnabled] = useState(false);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("desc");

  function handleSort(code) {
    if (sortCol !== code) {
      setSortCol(code);
      setSortDir("desc");
    } else if (sortDir === "desc") {
      setSortDir("asc");
    } else {
      setSortCol(null);
      setSortDir("desc");
    }
  }

  const sortedTrust = useMemo(() => {
    if (!sortEnabled || !sortCol || !trust?.length) return trust;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...trust].sort((a, b) => {
      const av = a.cuts?.[sortCol]?.top3;
      const bv = b.cuts?.[sortCol]?.top3;
      // Push null/missing values to the bottom regardless of sort direction.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * dir;
    });
  }, [trust, sortEnabled, sortCol, sortDir]);

  if (!trust?.length) {
    return (
      <div
        className="module-placeholder"
        style={{ padding: "20px 24px", fontSize: 13, color: "#94a3b8", fontStyle: "italic", background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}
      >
        Trusted Sources data not yet computed. Re-run compute_core.py against
        the .sav (it now emits a `trust` block), then refresh dashboard.json.
      </div>
    );
  }

  const totalN = trust[0]?.cuts?.TOTAL?.n ?? study?.n_total ?? "—";

  return (
    <div className="item-block">
      {/* Survey pane — the question as the respondent saw it: stem + 1-7
          trust scale with anchors + the 22 messengers they rated. */}
      <div className="survey-pane">
        <div className="sp-header">
          <div className="sp-logo">PRISM</div>
          <div>STYLE.TRUST</div>
        </div>
        <div className="sp-progress"><div /></div>
        <div className="sp-progress-text">TRUSTED SOURCES</div>
        <div className="sp-card">
          <div className="sp-stem">
            How much would you trust each of the following as a source of
            information about HIV?
          </div>

          {/* Grid: each messenger rated on its own 7-pt scale, the way the
              respondent actually saw it. Label sits in a shaded card above
              its scale (single line, small font). The dot at this messenger's
              TOTAL weighted mean (rounded) is filled with the same heat-color
              palette as the rest of the topline (pos-1 = cool, pos-7 = warm).
              Anchor labels appear once below the last row. */}
          <div className="trust-likert-grid">
            {trust.map((t) => {
              const mean = t.cuts?.TOTAL?.mean;
              const selected = mean != null ? Math.max(1, Math.min(7, Math.round(mean))) : null;
              return (
                <div key={t.code} className="trust-likert-row">
                  <div className="trust-likert-label" title={t.label}>{t.label}</div>
                  <div className="trust-likert-scale">
                    {Array.from({ length: 7 }).map((_, i) => {
                      const idx = i + 1;
                      const filled = idx === selected;
                      return (
                        <span key={idx}>
                          <div className={"dot" + (filled ? ` filled pos-${idx}` : "")} />
                          {i < 6 && <div className="conn" />}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div className="sp-anchors trust-likert-anchors">
              <div>No trust<br />at all</div>
              <div>Neutral</div>
              <div>Complete<br />trust</div>
            </div>
          </div>
        </div>
      </div>

      {/* Codebook */}
      <div className="codebook-pane">
        <div className="cb-title">Codebook</div>
        <div className="cb-row"><span className="cb-key">Block</span><span className="cb-val">Trusted Sources battery (k={trust.length} messengers)</span></div>
        <div className="cb-row"><span className="cb-key">Scale</span><span className="cb-val">1-7 (1 = no trust at all, 7 = complete trust)</span></div>
        <div className="cb-row"><span className="cb-key">Metric</span><span className="cb-val">Top-3 box (5-7), with mean + bot-3 + full 1-7 distribution on toggle</span></div>
        <div className="cb-row"><span className="cb-key">Filter</span><span className="cb-val">Split sample · n={totalN}</span></div>
        <div className="cb-row"><span className="cb-key">Sig</span><span className="cb-val">z-test on top-3 proportion vs rest of sample (p&lt;.05 / p&lt;.01)</span></div>
        <div className="cb-note" style={{ marginTop: 8 }}>
          Personal physician (QTRUSTr3) excluded from the deployable list.
        </div>
      </div>

      {/* Banner */}
      <div className="item-data">
        <div className="metric-header">
          <div className="metric-label">% TOP-3 TRUST — DEPLOYABLE MESSENGERS</div>
          <div className="metric-scale-note">
            % trusting each messenger 5-7 on a 1-7 scale. Sig markers = z-test
            on top-3 proportion vs the rest of the sample. Mean and 1-7
            frequency distribution available via the cell toggles.
          </div>
          <label className="trust-sort-toggle">
            <input
              type="checkbox"
              checked={sortEnabled}
              onChange={(e) => {
                setSortEnabled(e.target.checked);
                if (!e.target.checked) setSortCol(null);
              }}
            />
            <span>Enable column sort</span>
            {sortEnabled && sortCol && (
              <span className="trust-sort-hint">
                sorted by <strong>{sortCol}</strong> {sortDir === "asc" ? "▲" : "▼"} · click header again to {sortDir === "desc" ? "flip" : "clear"}
              </span>
            )}
          </label>
        </div>
        <table className="banner-table">
          <BannerTableHead
            segments={segments}
            totalN={totalN}
            partyA={study?.party_band_a_label}
            partyB={study?.party_band_b_label}
            sortable={sortEnabled}
            sortCol={sortCol}
            sortDir={sortDir}
            onSort={handleSort}
          />
          <tbody>
            {sortedTrust.map((t) => {
              const totalTop3 = t.cuts?.TOTAL?.top3 ?? null;
              return (
                <tr key={t.code}>
                  <td className="rlbl">
                    <span className="inf-item-code-inline">{t.code}</span> {t.label}
                  </td>
                  <DataCell
                    stats={t.cuts?.TOTAL}
                    isTotal
                    cut="TOTAL"
                    item={t.code}
                  />
                  {segments.map((s) => (
                    <DataCell
                      key={s.code}
                      stats={t.cuts?.[s.code]}
                      totalTop3={totalTop3}
                      cut={s.code}
                      item={t.code}
                    />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
