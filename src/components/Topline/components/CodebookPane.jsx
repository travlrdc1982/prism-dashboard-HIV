// Codebook-pane (middle rail, 240px). Renders a stack of key/value rows
// describing the question's coding, scale, base, filter, etc. Each module
// passes in its rows; this component just lays them out.

export default function CodebookPane({ extraClass = "", rows = [] }) {
  const className = extraClass ? `codebook-pane ${extraClass}` : "codebook-pane";
  return (
    <div className={className}>
      {rows.map((r, i) => (
        <CodebookRow key={i} {...r} />
      ))}
    </div>
  );
}

export function CodebookRow({ keyLabel, value, mono = false, weight = false }) {
  const valClass =
    "cb-val" + (mono ? " cb-mono" : "") + (weight ? " cb-weight" : "");
  return (
    <div className="cb-row">
      <div className="cb-key">{keyLabel}</div>
      <div className={valClass}>{value}</div>
    </div>
  );
}
