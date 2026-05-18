// Title page — first section of the topline. Three-pane layout (survey
// intro | study metadata | sample composition). Ported from
// dashboard_template.html renderTitlePage (618-).

export default function TitlePage({ study, segments }) {
  const gop = segments.filter((s) => s.party === "GOP");
  const dem = segments.filter((s) => s.party === "DEM");
  const maxPct = Math.max(...segments.map((s) => s.pct));

  const surveyIntro =
    study.survey_intro ||
    "Thanks for taking part. This survey helps us understand how people think about health care and public policy today. There are no right or wrong answers — we're interested in your point of view. Let's begin.";

  const meta = [
    ["Study ID", study.id, true],
    ["Total N", study.n_total?.toLocaleString?.() ?? study.n_total, true],
    ["Field Dates", study.field_dates || "TBD", false],
    ["Version", study.version, false],
    ["Analyst", study.analyst, false],
    ["Rendered", study.rendered, false],
    ["Weighted by", study.weighted ? (study.weight_target || "Yes") : "No (preliminary)", false],
    ["Avg LOI", study.loi_minutes ? `${study.loi_minutes} min (median)` : "Pending", true],
  ];

  return (
    <div className="title-page">
      <header className="title-page-header">
        <h1 className="study-title">{study.title}</h1>
        <p className="study-subtitle">{study.subtitle}</p>
      </header>

      <div className="item-block demo-block title-page-block">
        {/* Survey pane: intro */}
        <div className="survey-pane">
          <div className="sp-header">
            <div className="sp-logo">PRISM</div>
            <div>SURVEY INTRO</div>
          </div>
          <div className="sp-progress"><div /></div>
          <div className="sp-progress-text">WELCOME</div>
          <div className="sp-card title-pane-survey-intro">
            <span className="intro-section-label">Section header — section intro</span>
            <p>{surveyIntro}</p>
          </div>
        </div>

        {/* Codebook pane: study metadata */}
        <div className="codebook-pane title-pane-codebook">
          {meta.map(([k, v, mono]) => (
            <div key={k} className="cb-row">
              <div className="cb-key">{k}</div>
              <div className={"cb-val" + (mono ? " cb-mono" : "")}>{v}</div>
            </div>
          ))}
        </div>

        {/* Banner pane: sample composition table */}
        <div className="item-data title-pane-banner">
          <table className="sample-table" id="sample-table">
            <thead>
              <tr>
                <th></th>
                <th></th>
                <th style={{ textAlign: "left" }}>Segment</th>
                <th>n</th>
                <th>n (wgt)</th>
                <th>%</th>
                <th>% (wgt)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="party-head gop">
                <td colSpan={7}>
                  {study.coalition_a_label || "GOP Coalition"} — {gop.length} segments
                </td>
              </tr>
              {gop.map((s) => (
                <SampleRow key={s.code} seg={s} maxPct={maxPct} cls="gop" />
              ))}
              <tr className="party-head dem">
                <td colSpan={7}>
                  {study.coalition_b_label || "DEM Coalition"} — {dem.length} segments
                </td>
              </tr>
              {dem.map((s) => (
                <SampleRow key={s.code} seg={s} maxPct={maxPct} cls="dem" />
              ))}
              <tr className="total">
                <td colSpan={3}>TOTAL</td>
                <td>{study.n_total}</td>
                <td>{study.n_total_wgt?.toFixed?.(1) ?? study.n_total_wgt}</td>
                <td>100.0%</td>
                <td>100.0%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Validity / weighting advisory banner */}
      <div
        className={"preliminary-notice" + (study.weighted ? " production-data" : "")}
        id="advisory"
      >
        <strong>{study.weighted ? "Production data." : "Preliminary data."}</strong>{" "}
        {study.weight_note || ""} {study.validity_note || ""}
      </div>
    </div>
  );
}

function SampleRow({ seg, maxPct, cls }) {
  const barW = Math.round((seg.pct / maxPct) * 50);
  return (
    <tr className={cls}>
      <td className="code">{seg.id}</td>
      <td className="code">{seg.code}</td>
      <td className="name">{seg.name}</td>
      <td>{seg.n}</td>
      <td>{seg.n_wgt?.toFixed?.(1) ?? seg.n_wgt}</td>
      <td>
        <span className="bar" style={{ width: barW + "px" }} />
        {seg.pct?.toFixed?.(1) ?? seg.pct}%
      </td>
      <td>{seg.pct_wgt?.toFixed?.(1) ?? seg.pct_wgt}%</td>
    </tr>
  );
}
