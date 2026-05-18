// Survey-pane card (left rail, 240px). Mimics the survey instrument layout
// with logo / progress / intro / card stack. Module-specific render functions
// pass in `children` (the cards) and the metadata.

export default function SurveyPane({
  extraClass = "",
  logoText = "PRISM",
  progressPct = 35,
  progressText = "Section 3 of 5",
  intro,
  children,
}) {
  const className = extraClass ? `survey-pane ${extraClass}` : "survey-pane";
  return (
    <aside className={className}>
      <div className="sp-header">
        <span className="sp-logo">{logoText}</span>
      </div>
      <div className="sp-progress">
        <div style={{ width: `${progressPct}%` }} />
      </div>
      <div className="sp-progress-text">{progressText}</div>
      {intro && <div className="sp-intro">{intro}</div>}
      {children}
    </aside>
  );
}

// One card inside the survey pane — typically the stem + scale + response.
export function SurveyCard({ stem, secondaryStem, children }) {
  return (
    <div className="sp-card">
      {stem && <div className="sp-stem">{stem}</div>}
      {secondaryStem && (
        <div className="sp-stem-secondary">{secondaryStem}</div>
      )}
      {children}
    </div>
  );
}
