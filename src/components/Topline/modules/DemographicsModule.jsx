// Demographics module — Stage 1 of Phase C.
// Ported from dashboard_template.html lines 1008-1340. Each demographic
// question renders as one .item-block (survey · codebook · banner). The
// binary_set style (Personal Contact) renders a multi-row table; the
// standard styles render one row per option category.
//
// Weighted / unweighted view is module-level state — toggling swaps which
// pct (`pct_wgt` vs `pct`) appears in every cell. Hover popovers (TODO in
// Stage 1.5) will show the other view.

import { useState } from "react";
import { SigDots } from "../components/Sig";

const ALL = (segments) => ["TOTAL", ...segments.map((s) => s.code)];

function PartyBandHeader({ segments, totalN, partyA = "GOP COALITION", partyB = "DEM COALITION" }) {
  const gop = segments.filter((s) => s.party === "GOP");
  const dem = segments.filter((s) => s.party === "DEM");
  return (
    <thead>
      <tr className="party-band">
        <th className="rlbl"></th>
        <th className="total-band">TOTAL</th>
        <th className="gop-band" colSpan={gop.length}>{partyA}</th>
        <th className="dem-band" colSpan={dem.length}>{partyB}</th>
      </tr>
      <tr>
        <th className="rlbl"></th>
        <th className="seg-head total-head">
          TOTAL<span className="seg-n">N={totalN ?? "—"}</span>
        </th>
        {segments.map((s) => (
          <th key={s.code} className="seg-head">
            {s.code}<span className="seg-n">N={s.n}</span>
          </th>
        ))}
      </tr>
    </thead>
  );
}

// ─── Survey-pane option mocks for the standard styles ───────────────────
function DemoOptionsMock({ style, options, modalLabel, q }) {
  if (style === "radio") {
    return (
      <>
        {options.map((lbl, i) => (
          <div key={i} className={"demo-opt radio" + (modalLabel === lbl ? " selected" : "")}>
            <span className="demo-radio" />{lbl}
          </div>
        ))}
      </>
    );
  }
  if (style === "buttonselect") {
    return (
      <div className="demo-button-row">
        {options.map((lbl, i) => (
          <div key={i} className={"demo-button" + (modalLabel === lbl ? " selected" : "")}>{lbl}</div>
        ))}
      </div>
    );
  }
  if (style === "buttongrid") {
    return (
      <div className="demo-button-grid">
        {options.map((lbl, i) => (
          <div key={i} className={"demo-button" + (modalLabel === lbl ? " selected" : "")}>{lbl}</div>
        ))}
      </div>
    );
  }
  if (style === "dropdown") {
    return (
      <div className="demo-dropdown">
        <div className="demo-dropdown-stem">Please select from the dropdown menu</div>
        {options.map((lbl, i) => (
          <div key={i} className={"demo-dropdown-opt" + (modalLabel === lbl ? " selected" : "")}>{lbl}</div>
        ))}
      </div>
    );
  }
  if (style === "numeric") {
    const boxes = q?.pane_extra?.numeric_boxes || 2;
    const m = q?.pane_meta?.mean;
    const med = q?.pane_meta?.median;
    return (
      <>
        <div className="demo-age-row">
          {Array.from({ length: boxes }).map((_, i) => (
            <div key={i} className="demo-age-box" />
          ))}
        </div>
        {m != null && med != null && (
          <div className="demo-numeric-meta">
            Sample mean: <strong>{m}</strong> · median: <strong>{med}</strong>
          </div>
        )}
      </>
    );
  }
  return null;
}

// ─── Survey-pane (left rail) ────────────────────────────────────────────
function DemoSurveyPane({ q }) {
  // Derived variables (region / ruca)
  if (q.style === "derived") {
    return (
      <div className="survey-pane demo-pane">
        <div className="sp-header">
          <div className="sp-logo">PRISM</div>
          <div>DEMO.{q.style.toUpperCase()}</div>
        </div>
        <div className="sp-progress"><div /></div>
        <div className="sp-progress-text">{q.id.toUpperCase()}</div>
        <div className="sp-card">
          <div className="sp-stem">{q.wording.split("(")[0].trim()}</div>
          <div className="demo-derived-note">Derived from QZIP</div>
          <div className="sp-stem-secondary">Please enter your 5-digit Zip Code</div>
          <div className="demo-zip-row">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="demo-zip-box" />
            ))}
          </div>
          {q.pane_extra?.pane_subtitle && (
            <div className="demo-derived-subtitle">{q.pane_extra.pane_subtitle}</div>
          )}
        </div>
      </div>
    );
  }

  // Stacked sub-questions (race_ethnic has two stacked items)
  if (q.pane_extra?.stacked_questions) {
    return (
      <div className="survey-pane demo-pane">
        <div className="sp-header">
          <div className="sp-logo">PRISM</div>
          <div>DEMO.{q.style.toUpperCase()}</div>
        </div>
        <div className="sp-progress"><div /></div>
        <div className="sp-progress-text">{q.id.toUpperCase()}</div>
        <div className="sp-card">
          {q.pane_extra.stacked_questions.map((sq, i) => (
            <div key={i} className={"demo-stacked" + (i > 0 ? " demo-stacked-sep" : "")}>
              <div className="sp-stem">{sq.wording}</div>
              <DemoOptionsMock
                style={sq.style}
                options={sq.options.map((o) => o[1])}
                modalLabel={null}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Standard single-variable
  const paneOptions = q.pane_extra?.options_for_pane || q.options.map((o) => o[1]);
  // Find modal response if highlight_mode is set
  let modalLabel = null;
  if (q.pane_extra?.highlight_mode && q.freq?.TOTAL) {
    let modalPct = -1;
    for (const [v, lbl] of q.options) {
      const cell = q.freq.TOTAL[v];
      if (cell && cell.pct > modalPct) {
        modalPct = cell.pct;
        modalLabel = lbl;
      }
    }
  }

  return (
    <div className="survey-pane demo-pane">
      <div className="sp-header">
        <div className="sp-logo">PRISM</div>
        <div>DEMO.{q.style.toUpperCase()}</div>
      </div>
      <div className="sp-progress"><div /></div>
      <div className="sp-progress-text">{q.id.toUpperCase()}</div>
      <div className="sp-card">
        <div className="sp-stem">{q.wording}</div>
        {q.pane_meta?.pane_subtitle && (
          <div className="sp-stem-secondary">{q.pane_meta.pane_subtitle}</div>
        )}
        <DemoOptionsMock style={q.style} options={paneOptions} modalLabel={modalLabel} q={q} />
      </div>
    </div>
  );
}

// ─── Codebook pane (middle rail) ────────────────────────────────────────
function DemoCodebookPane({ q }) {
  const n = q.freq?.TOTAL?._n_total ?? 0;

  let recodeStr = "—";
  if (q.recode && Object.keys(q.recode).length) {
    if (q.recode.show_only_yes) recodeStr = "Banner shows % Yes only";
    else if (q.recode.ruca_collapse) recodeStr = "10 RUCA codes → 5 levels (Urban 1, Suburban 2-3, Exurban 4-6, Small Town Rural 7-9, Rural 10)";
    else recodeStr = JSON.stringify(q.recode);
  }

  let weightStr = "Not a weight target";
  if (q.weight_relevant && q.weight_overall) {
    const wo = q.weight_overall;
    weightStr = `Range ${wo.min}-${wo.max} · median ${wo.median} · mean ${wo.mean}`;
  } else if (q.weight_relevant) {
    weightStr = "Weight-relevant — stats pending";
  }

  return (
    <div className="codebook-pane demo-cb">
      <div className="cb-row"><div className="cb-key">SOURCE</div><div className="cb-val cb-mono">{q.var}</div></div>
      {q.derived_from && (
        <div className="cb-row"><div className="cb-key">DERIVED</div><div className="cb-val cb-derived">{q.derived_from}</div></div>
      )}
      <div className="cb-row"><div className="cb-key">BLOCK</div><div className="cb-val">{q.block_label || ""}</div></div>
      <div className="cb-row"><div className="cb-key">RECODE</div><div className="cb-val">{recodeStr}</div></div>
      <div className="cb-row"><div className="cb-key">FILTER</div><div className="cb-val">All respondents (n={n})</div></div>
      <div className="cb-row"><div className="cb-key">WEIGHT</div><div className="cb-val cb-weight">{weightStr}</div></div>
      <div className="cb-row"><div className="cb-key">METRIC</div><div className="cb-val">% of segment in each category</div></div>
      {q.pane_meta?.continuous_var && (
        <div className="cb-row"><div className="cb-key">CONTINUOUS</div><div className="cb-val cb-mono">{q.pane_meta.continuous_var} · mean {q.pane_meta.mean} · median {q.pane_meta.median}</div></div>
      )}
    </div>
  );
}

// ─── Banner pane (right rail) ───────────────────────────────────────────
function DemoBannerArea({ q, segments, mode, study }) {
  const blockLabel = (q.block_label || "").replace(/^Demographics\s*[—–-]\s*/i, "");
  const metricTitle = "% IN EACH CATEGORY" + (blockLabel ? " — " + blockLabel.toUpperCase() : "");
  const nVal = q.freq?.TOTAL?._n_total ?? 0;
  const subtitle = `% of segment selecting each option · n=${nVal} respondents${q.weight_relevant ? " · weight-relevant variable" : ""}`;

  return (
    <div className="item-data">
      <div className="metric-header">
        <div className="metric-label">{metricTitle}</div>
        <div className="metric-scale-note">{subtitle}</div>
      </div>
      <DemoBannerTable q={q} segments={segments} mode={mode} study={study} />
    </div>
  );
}

function DemoBannerTable({ q, segments, mode, study }) {
  let displayOptions = q.options;
  if (q.recode?.show_only_yes) {
    displayOptions = q.options.filter((o) => o[0] === 1);
  }
  const totalN = q.freq?.TOTAL?._n_total ?? "—";

  return (
    <table className="banner-table demo-banner-table">
      <PartyBandHeader
        segments={segments}
        totalN={totalN}
        partyA={study?.party_band_a_label}
        partyB={study?.party_band_b_label}
      />
      <tbody>
        {displayOptions.map(([optVal, optLabel]) => (
          <tr key={optVal}>
            <td className="rlbl">{optLabel}</td>
            {ALL(segments).map((cut, idx) => {
              const freqDict = q.freq?.[cut];
              const cell = freqDict ? freqDict[optVal] : null;
              const isTotal = idx === 0;
              const colCls = isTotal ? "total-cell" : "";
              if (!cell) {
                return <td key={cut} className={`cell demo-cell empty ${colCls}`} data-empty="1" />;
              }
              const displayPct = mode === "weighted" ? cell.pct_wgt : cell.pct;
              const sigLevel = cell.sig || 0;
              return (
                <td
                  key={cut}
                  className={`cell demo-cell ${colCls}`}
                  data-cut={cut}
                  data-pct={cell.pct}
                  data-pct-wgt={cell.pct_wgt}
                  data-n={cell.n}
                  data-n-wgt={cell.n_wgt}
                  data-z={cell.z || 0}
                  data-sig={sigLevel}
                  data-opt={optLabel}
                  data-var={q.var}
                >
                  {!isTotal && <SigDots level={sigLevel} />}
                  <div className="cell-val top3">{Math.round(displayPct ?? 0)}%</div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── binary_set block (Personal Contact: 4-item battery) ────────────────
function DemoBinarySetBlock({ q, segments, study }) {
  const varList = (q.items || []).map((it) => it.var);
  const sourceLine = varList.length <= 4
    ? varList.join(", ")
    : `${varList[0]} … ${varList[varList.length - 1]}`;

  const blockTitle = (q.block_label || "").replace(/^Demographics\s*[—–-]\s*/i, "").toUpperCase();
  const metricTitle = `% YES — ${blockTitle}`;
  const subtitle = q.pane_extra?.pane_subtitle
    || "Independent yes/no items; respondents may indicate multiple. Cells show % Yes per item.";

  return (
    <div className="item-block demo-block">
      {/* Survey */}
      <div className="survey-pane demo-pane">
        <div className="sp-header">
          <div className="sp-logo">PRISM</div>
          <div>DEMO.CHECKLIST</div>
        </div>
        <div className="sp-progress"><div /></div>
        <div className="sp-progress-text">{q.id.toUpperCase()}</div>
        <div className="sp-card">
          <div className="sp-stem">{q.wording}</div>
          {q.pane_extra?.pane_subtitle && (
            <div className="sp-stem-secondary">{q.pane_extra.pane_subtitle}</div>
          )}
          <div className="inf-checklist">
            {(q.items || []).map((it, i) => (
              <div
                key={i}
                className={"inf-checklist-item" + (it.category === "control" ? " demo-contact-control" : "")}
              >
                <span className="inf-checkbox" />
                {it.wording}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Codebook */}
      <div className="codebook-pane demo-cb">
        <div className="cb-row"><div className="cb-key">SOURCE</div><div className="cb-val cb-mono">{sourceLine}</div></div>
        <div className="cb-row"><div className="cb-key">BLOCK</div><div className="cb-val">{q.block_label}</div></div>
        <div className="cb-row"><div className="cb-key">KIND</div><div className="cb-val">Independent binary items (% Yes per item)</div></div>
        <div className="cb-row"><div className="cb-key">FILTER</div><div className="cb-val">All respondents</div></div>
        <div className="cb-row"><div className="cb-key">METRIC</div><div className="cb-val">% endorsing each item (rows do not sum to 100%)</div></div>
        <div className="cb-row"><div className="cb-key">WEIGHT</div><div className="cb-val cb-weight">Not a weight target</div></div>
      </div>

      {/* Banner */}
      <div className="item-data">
        <div className="metric-header">
          <div className="metric-label">{metricTitle}</div>
          <div className="metric-scale-note">{subtitle}</div>
        </div>
        <table className="banner-table demo-banner-table">
          <PartyBandHeader
            segments={segments}
            totalN={q.items?.[0]?.cuts?.TOTAL?.n ?? "—"}
            partyA={study?.party_band_a_label}
            partyB={study?.party_band_b_label}
          />
          <tbody>
            {(q.items || []).map((item) => (
              <tr key={item.var}>
                <td className="rlbl">
                  <span className="inf-item-code-inline">{item.code}</span>
                  {item.category === "control" && <span className="inf-tier-inline">CTRL</span>}{" "}
                  {item.wording}
                </td>
                {ALL(segments).map((cut, idx) => {
                  const cell = item.cuts?.[cut];
                  const isTotal = idx === 0;
                  const colCls = isTotal ? "total-cell" : "";
                  if (!cell) {
                    return <td key={cut} className={`cell demo-cell empty ${colCls}`} data-empty="1" />;
                  }
                  const sigLevel = cell.sig || 0;
                  return (
                    <td
                      key={cut}
                      className={`cell demo-cell ${colCls}`}
                      data-cut={cut}
                      data-val={cell.val}
                      data-n={cell.n}
                      data-z={cell.z || 0}
                      data-sig={sigLevel}
                      data-metric="pct_yes"
                      data-code={item.code}
                    >
                      {!isTotal && <SigDots level={sigLevel} />}
                      <div className="cell-val top3">{Math.round(cell.val ?? 0)}%</div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Module shell ───────────────────────────────────────────────────────
export default function DemographicsModule({ demographics, segments, study }) {
  const [mode, setMode] = useState("weighted");

  if (!demographics?.length) {
    return <div className="demos-empty">No demographics data computed.</div>;
  }

  return (
    <>
      <div className="demos-toggle-bar">
        <span className="demos-toggle-label">View:</span>
        <button
          type="button"
          className={"demos-toggle-btn" + (mode === "weighted" ? " active" : "")}
          onClick={() => setMode("weighted")}
        >
          Weighted %
        </button>
        <button
          type="button"
          className={"demos-toggle-btn" + (mode === "unweighted" ? " active" : "")}
          onClick={() => setMode("unweighted")}
        >
          Unweighted %
        </button>
        <span className="demos-toggle-note">
          Banner cells show the selected view. Hover any cell for n and the other view.
        </span>
      </div>

      {demographics.map((q) => {
        if (q.style === "binary_set") {
          return <DemoBinarySetBlock key={q.id} q={q} segments={segments} study={study} />;
        }
        return (
          <div key={q.id} className="item-block demo-block">
            <DemoSurveyPane q={q} />
            <DemoCodebookPane q={q} />
            <DemoBannerArea q={q} segments={segments} mode={mode} study={study} />
          </div>
        );
      })}
    </>
  );
}
