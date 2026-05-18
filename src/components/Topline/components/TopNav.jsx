// Top navigation bar — ported from dashboard_template.html renderTopNav().
// PRISM brand + study label on the left, tools on the right.

export default function TopNav({ study }) {
  const brand = study?.nav_brand || "PRISM";
  const label = study?.title || study?.nav_study_label || "";

  return (
    <div className="topnav">
      <div className="brand">
        <span className="prism-logo">{brand}</span>
        <span className="study">{label}</span>
      </div>
      <div className="nav-spacer" />
      <div className="tools">
        <button type="button" onClick={() => window.print()}>
          🖨 PDF
        </button>
      </div>
    </div>
  );
}
