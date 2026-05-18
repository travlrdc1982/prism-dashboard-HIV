// Influencer360 module — 5 blocks (composites, high-engagement,
// low-engagement, followers, social-media activity). Ported from
// dashboard_template.html renderInfluencerBlock and friends (1351-1553).

import { SigDots } from "../components/Sig";
import { fmtMean } from "../utils/format";

const ALL = (segments) => ["TOTAL", ...segments.map((s) => s.code)];

const KIND_LABEL = {
  binary_set: "Independent binary items (% Yes per item)",
  categorical: "Single categorical (% per bracket, rows sum to 100%)",
  frequency: "5-pt frequency scale (% any activity)",
  composites: "Derived composite scores",
};
const METRIC_LABEL = {
  binary_set: "% endorsing each behavior (independent, rows do not sum to 100%)",
  categorical: "% in each bracket (rows sum to 100%)",
  frequency: '% any activity (excludes "Never")',
  composites: "L1/L2/L3: % indicating tier · BCS: mean score (0-1)",
};

function InfSurveyPane({ blk }) {
  const style = blk.pane_style;
  return (
    <div className="survey-pane demo-pane">
      <div className="sp-header">
        <div className="sp-logo">PRISM</div>
        <div>INF.{style.toUpperCase()}</div>
      </div>
      <div className="sp-progress"><div /></div>
      <div className="sp-progress-text">{blk.id.toUpperCase()}</div>
      <div className="sp-card">
        <div className="sp-stem">{blk.wording}</div>
        {blk.pane_subtitle && (
          <div className="sp-stem-secondary">{blk.pane_subtitle}</div>
        )}
        {style === "derived_note" && (
          <>
            <div className="demo-derived-note">
              Derived composites · not asked of respondents
            </div>
            <div className="inf-composites-list">
              {(blk.items || []).map((it) => (
                <div key={it.code} className="inf-composite-row">
                  <span className="inf-composite-code">{it.code}</span>
                  <span className="inf-composite-label">
                    {it.wording.replace(`${it.code} — `, "")}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        {style === "checklist" && (
          <div className="inf-checklist">
            {(blk.items || []).map((it, i) => (
              <div key={i} className="inf-checklist-item">
                <span className="inf-checkbox" />
                {it.wording}
              </div>
            ))}
            <div className="inf-checklist-none">None of these</div>
          </div>
        )}
        {style === "buttonselect" && (
          <div className="inf-buttongrid">
            {(blk.options || []).map(([v, lbl]) => (
              <div key={v} className="demo-button">{lbl}</div>
            ))}
          </div>
        )}
        {style === "cardshuffle" && (
          <div className="inf-cardshuffle">
            <div className="inf-cs-card">
              <div className="inf-cs-prompt">
                {(blk.items?.[0]?.wording) || ""}
              </div>
            </div>
            <div className="inf-cs-scale">
              {["Never", "Not in past 30 days", "1 time", "2-4 times", "5+ times"].map((lbl) => (
                <div key={lbl} className="inf-cs-scaleopt">{lbl}</div>
              ))}
            </div>
            <div className="inf-cs-rotation">
              + {(blk.items?.length || 1) - 1} more prompts rotate through this scale
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfCodebookPane({ blk }) {
  let sourceVars = "";
  if (blk.kind === "categorical") {
    sourceVars = blk.var || "";
  } else if (blk.items?.length) {
    const varList = blk.items.map((it) => it.var);
    if (varList.length <= 3) {
      sourceVars = varList.join(", ");
    } else {
      sourceVars = `${varList[0]} … ${varList[varList.length - 1]} (${varList.length} variables)`;
    }
  }
  const totalN = blk.kind === "categorical" ? blk.n_total ?? "—" : 975;

  return (
    <div className="codebook-pane demo-cb">
      <div className="cb-row">
        <div className="cb-key">SOURCE</div>
        <div className="cb-val cb-mono">{sourceVars}</div>
      </div>
      <div className="cb-row">
        <div className="cb-key">BLOCK</div>
        <div className="cb-val">{blk.block_label || ""}</div>
      </div>
      <div className="cb-row">
        <div className="cb-key">KIND</div>
        <div className="cb-val">{KIND_LABEL[blk.kind] || blk.kind}</div>
      </div>
      <div className="cb-row">
        <div className="cb-key">METRIC</div>
        <div className="cb-val">{METRIC_LABEL[blk.kind] || "—"}</div>
      </div>
      <div className="cb-row">
        <div className="cb-key">FILTER</div>
        <div className="cb-val">All respondents (n={totalN})</div>
      </div>
      {blk.kind === "composites" &&
        (blk.items || []).map((it) =>
          it.formula ? (
            <div key={it.code} className="cb-row">
              <div className="cb-key">{it.code}</div>
              <div className="cb-val cb-mono cb-formula">{it.formula}</div>
            </div>
          ) : null,
        )}
      <div className="cb-row">
        <div className="cb-key">WEIGHT</div>
        <div className="cb-val cb-weight">Not a weight target</div>
      </div>
    </div>
  );
}

function PartyBandHead({ segments, totalN, partyA, partyB }) {
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
        <th className="seg-head total-head">TOTAL<span className="seg-n">N={totalN}</span></th>
        {segments.map((s) => (
          <th key={s.code} className="seg-head">
            {s.code}<span className="seg-n">N={s.n}</span>
          </th>
        ))}
      </tr>
    </thead>
  );
}

function InfBannerArea({ blk, segments, study }) {
  const metricTitle = (blk.block_label || "")
    .replace(/^Influencer360\s*[—–-]\s*/i, "")
    .toUpperCase();
  let metricHeader;
  if (blk.kind === "binary_set") metricHeader = `% ENDORSING — ${metricTitle}`;
  else if (blk.kind === "categorical") metricHeader = `% IN EACH BRACKET — ${metricTitle}`;
  else if (blk.kind === "frequency") metricHeader = `% ANY ACTIVITY — ${metricTitle}`;
  else if (blk.kind === "composites") metricHeader = `BEHAVIORAL INFLUENCE — ${metricTitle}`;
  else metricHeader = metricTitle;

  const totalN = blk.kind === "categorical" ? blk.n_total ?? "—" : 975;

  return (
    <div className="item-data">
      <div className="metric-header">
        <div className="metric-label">{metricHeader}</div>
        <div className="metric-scale-note">{blk.pane_subtitle || ""}</div>
      </div>
      <table className="banner-table demo-banner-table">
        <PartyBandHead
          segments={segments}
          totalN={totalN}
          partyA={study?.party_band_a_label}
          partyB={study?.party_band_b_label}
        />
        <tbody>
          {blk.kind === "categorical"
            ? renderCategoricalRows(blk, segments)
            : renderItemRows(blk, segments)}
        </tbody>
      </table>
    </div>
  );
}

function renderCategoricalRows(blk, segments) {
  return (blk.options || []).map(([optVal, optLabel]) => (
    <tr key={optVal}>
      <td className="rlbl">{optLabel}</td>
      {ALL(segments).map((cut, idx) => {
        const cell = blk.freq?.[cut]?.[optVal];
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
            data-pct={cell.pct}
            data-pct-wgt={cell.pct_wgt}
            data-n={cell.n}
            data-sig={sigLevel}
            data-opt={optLabel}
            data-var={blk.var}
          >
            {!isTotal && <SigDots level={sigLevel} />}
            <div className="cell-val top3">{Math.round(cell.pct ?? 0)}%</div>
          </td>
        );
      })}
    </tr>
  ));
}

function renderItemRows(blk, segments) {
  return (blk.items || []).map((item) => (
    <tr key={item.var}>
      <td className="rlbl">
        <span className="inf-item-code-inline">{item.code}</span>
        {item.tier && <span className="inf-tier-inline">{item.tier}</span>}{" "}
        {item.wording}
      </td>
      {ALL(segments).map((cut, idx) => {
        const cell = item.cuts?.[cut];
        const isTotal = idx === 0;
        const colCls = isTotal ? "total-cell" : "";
        if (!cell) {
          return <td key={cut} className={`cell demo-cell empty ${colCls}`} data-empty="1" />;
        }
        const isMean = cell.metric === "mean";
        const display = isMean ? fmtMean(cell.val) : `${Math.round(cell.val ?? 0)}%`;
        const sigLevel = cell.sig || 0;
        return (
          <td
            key={cut}
            className={`cell demo-cell ${colCls}`}
            data-cut={cut}
            data-val={cell.val}
            data-n={cell.n}
            data-sig={sigLevel}
            data-metric={cell.metric}
            data-code={item.code}
          >
            {!isTotal && <SigDots level={sigLevel} />}
            <div className="cell-val top3">{display}</div>
          </td>
        );
      })}
    </tr>
  ));
}

export default function InfluencerModule({ influencer, segments, study }) {
  if (!influencer?.length) {
    return <div className="demos-empty">No Influencer360 data computed.</div>;
  }
  return (
    <>
      {influencer.map((blk) => (
        <div key={blk.id} className="item-block demo-block inf-block">
          <InfSurveyPane blk={blk} />
          <InfCodebookPane blk={blk} />
          <InfBannerArea blk={blk} segments={segments} study={study} />
        </div>
      ))}
    </>
  );
}
