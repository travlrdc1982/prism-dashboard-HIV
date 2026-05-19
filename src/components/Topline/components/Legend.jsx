// Topline legend — color shading (heat-map) + sig-dot conventions.
// Ported verbatim from dashboard_template.html getLegendHTML() (lines
// ~690-710). The .legend / .lg-group / .lg-cell / .lg-arrow / .lg-sig
// CSS classes are already in Topline.css.

export default function Legend() {
  return (
    <div className="legend">
      <div className="lg-group">
        <span className="lg-label">Shading (top-3 vs. Total):</span>
        <span className="lg-cell" style={{ background: "var(--below-4)" }}>−25+</span>
        <span className="lg-cell" style={{ background: "var(--below-3)" }}>−15</span>
        <span className="lg-cell" style={{ background: "var(--below-1)" }}>−5</span>
        <span className="lg-cell" style={{ background: "white" }}>±0</span>
        <span className="lg-cell" style={{ background: "var(--above-1)" }}>+5</span>
        <span className="lg-cell" style={{ background: "var(--above-3)" }}>+15</span>
        <span className="lg-cell" style={{ background: "var(--above-4)" }}>+25+</span>
        <span className="lg-arrow">pp below ← Total → pp above</span>
      </div>
      <div className="lg-group">
        <span className="lg-label">Sig — PRE/POST row (vs. rest):</span>
        <span className="lg-sig one" />
        <span style={{ fontSize: 10 }}>p&lt;.05</span>
        <span className="lg-sig two" />
        <span style={{ fontSize: 10 }}>p&lt;.01</span>
      </div>
      <div className="lg-group">
        <span className="lg-label">Sig — Δ row (paired):</span>
        <span className="lg-sig hollow" />
        <span style={{ fontSize: 10 }}>p&lt;.10</span>
        <span className="lg-sig one" />
        <span style={{ fontSize: 10 }}>p&lt;.05</span>
        <span className="lg-sig two" />
        <span style={{ fontSize: 10 }}>p&lt;.01</span>
      </div>
    </div>
  );
}
