// Survey-pane renderer for items — ported from dashboard_template.html
// renderSurveyPane / renderScaleCircles. Handles CARDSHUFFLE (Likert),
// SEMANTIC (bipolar), RANKSORT (drag-to-rank), and the K5 visual flag.

function ScaleCircles({ selected = 4 }) {
  return (
    <div className="sp-scale">
      {Array.from({ length: 7 }).map((_, i) => {
        const idx = i + 1;
        const isSelected = idx === selected;
        return (
          <span key={idx}>
            <div className={"dot" + (isSelected ? ` filled pos-${idx}` : "")} />
            {i < 6 && <div className="conn" />}
          </span>
        );
      })}
    </div>
  );
}

export default function ItemSurveyPane({ survey, falseFlag = false }) {
  if (!survey) {
    return (
      <div className="survey-pane">
        <div className="sp-card">—</div>
      </div>
    );
  }
  const style = survey.style || "CARDSHUFFLE";
  const selected = survey.selected_pos || 4;
  const cls =
    "survey-pane" +
    (style === "SEMANTIC" ? " semantic" : style === "RANKSORT" ? " ranksort" : "");

  return (
    <div className={cls}>
      <div className="sp-header">
        <div className="sp-logo">PRISM</div>
        <div>STYLE.{style}</div>
      </div>
      <div className="sp-progress"><div /></div>
      <div className="sp-progress-text">{survey.progress || ""}</div>
      {survey.intro && <div className="sp-intro">{survey.intro}</div>}
      <div className="sp-card">
        <div className="sp-stem">{survey.stem || ""}</div>

        {style === "SEMANTIC" && (
          <>
            <div className="sp-poles">
              <div className="sp-pole left">{survey.pole_left || ""}</div>
              <div className="sp-pole right">{survey.pole_right || ""}</div>
            </div>
            <ScaleCircles selected={selected} />
          </>
        )}

        {style === "RANKSORT" && (
          <div className="sp-rank-list">
            {(survey.items || []).map((it, i) => {
              const focal = it === survey.focal;
              return (
                <div key={i} className={"sp-rank-item" + (focal ? " focal" : "")}>
                  <span className="sp-rank-pos">{i + 1}</span>
                  {it}
                </div>
              );
            })}
          </div>
        )}

        {style !== "SEMANTIC" && style !== "RANKSORT" && (
          <>
            {survey.text && (
              <div className="sp-statement">
                {falseFlag && <span className="sp-false-badge">FALSE</span>}
                {survey.text}
              </div>
            )}
            <ScaleCircles selected={selected} />
            <div className="sp-anchors">
              <div>{(survey.anchor_left || "Strongly Disagree").split("\n").map((s, i, arr) => (
                <span key={i}>{s}{i < arr.length - 1 && <br />}</span>
              ))}</div>
              <div>{(survey.anchor_center || "Neutral").split("\n").map((s, i, arr) => (
                <span key={i}>{s}{i < arr.length - 1 && <br />}</span>
              ))}</div>
              <div>{(survey.anchor_right || "Strongly Agree").split("\n").map((s, i, arr) => (
                <span key={i}>{s}{i < arr.length - 1 && <br />}</span>
              ))}</div>
            </div>
          </>
        )}
      </div>
      <div className="sp-continue">CONTINUE ›</div>
      <div className="sp-footer">Responses held confidential</div>
    </div>
  );
}

// Codebook pane for standard items.
export function ItemCodebookPane({ cb }) {
  if (!cb) return <div className="codebook-pane">—</div>;
  const fields = [
    ["Var (PRE)", cb.var_pre, true],
    ["Var (POST)", cb.var_post, true],
    ["Var", cb.var, true],
    ["Scale", cb.scale_type, false],
    ["Recode", cb.recode, false],
    ["Filter", cb.filter, false],
    ["Block", cb.block, false],
    ["Composite", cb.composite, true],
  ];
  return (
    <div className="codebook-pane">
      <div className="cb-title">Codebook</div>
      {fields.map(([k, v, mono]) => {
        if (!v) return null;
        return (
          <div key={k} className="cb-row">
            <span className="cb-key">{k}</span>
            <span className={"cb-val" + (mono ? " mono" : "")}>{v}</span>
          </div>
        );
      })}
      {cb.design_note && (
        <div className="cb-note" style={{ marginTop: 8 }}>{cb.design_note}</div>
      )}
      {cb.citation && <div className="cb-cite">{cb.citation}</div>}
    </div>
  );
}

// Metric header — title + scale note above each banner table.
export function MetricHeader({ item }) {
  if (!item.metric_label) return null;
  return (
    <div className="metric-header">
      <div className="metric-label">{item.metric_label}</div>
      {item.metric_label_scale && (
        <div className="metric-scale-note">{item.metric_label_scale}</div>
      )}
    </div>
  );
}
