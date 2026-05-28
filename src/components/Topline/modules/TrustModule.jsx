// Trust Sources module (06) — banner table of the 22 deployable trust
// messengers. Each row = one messenger; columns = TOTAL + 16 segments.
// Cells follow the standard 7-point-item layout: top-3 (5-7) % headline,
// full 1-7 frequency distribution (revealed by the "Show full frequency"
// toggle), mean + bot-3 in the detail row. Sig markers = z-test on top-3
// proportion vs. rest of sample. Data comes from dashboard.json['trust']
// (emitted by compute_core's _stats helper, same as every other 7-pt item).

import { DataCell, BannerTableHead } from "../components/Cell";

export default function TrustModule({ trust, segments, study }) {
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
      {/* Survey-pane: messenger checklist mock */}
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
          <div className="sp-stem-secondary">
            22 deployable messengers · 1-7 trust scale (personal physician
            excluded). Cells show <strong>Top-3 (5-7) %</strong>; toggle the
            controls bar to reveal the full 1-7 distribution and mean / bot-3.
          </div>
        </div>
      </div>

      {/* Codebook */}
      <div className="codebook-pane">
        <div className="cb-title">Codebook</div>
        <div className="cb-row"><span className="cb-key">Block</span><span className="cb-val">Trusted Sources battery</span></div>
        <div className="cb-row"><span className="cb-key">Scale</span><span className="cb-val">1-7 (1 = no trust, 7 = complete trust)</span></div>
        <div className="cb-row"><span className="cb-key">Metric</span><span className="cb-val">Top-3 box (5-7), with mean + bot-3 + full 1-7 distribution</span></div>
        <div className="cb-row"><span className="cb-key">Filter</span><span className="cb-val">Split sample · n={totalN}</span></div>
        <div className="cb-row"><span className="cb-key">Sig</span><span className="cb-val">z-test on top-3 proportion vs rest of sample (p&lt;.05 / p&lt;.01)</span></div>
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
        </div>
        <table className="banner-table">
          <BannerTableHead
            segments={segments}
            totalN={totalN}
            partyA={study?.party_band_a_label}
            partyB={study?.party_band_b_label}
          />
          <tbody>
            {trust.map((t) => {
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
