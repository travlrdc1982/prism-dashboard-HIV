// Significance markers ported from dashboard_template.html sigDots / sigDots3.
// The source returns HTML strings; here we return JSX so React can render them
// without dangerouslySetInnerHTML.

// 2-tier sig: 1 = p<.05 (one dot), 2 = p<.01 (two dots).
export function SigDots({ level }) {
  if (!level) return null;
  return (
    <span className="sig-marker">
      <span className="dot" />
      {level >= 2 && <span className="dot" />}
    </span>
  );
}

// 3-tier delta sig: 1 = p<.10 (single hollow), 2 = p<.05 (one dot), 3 = p<.01 (two dots).
export function SigDots3({ level }) {
  if (!level) return null;
  if (level === 1) {
    return (
      <span className="sig-marker">
        <span className="dot hollow" />
      </span>
    );
  }
  if (level === 2) {
    return (
      <span className="sig-marker">
        <span className="dot" />
      </span>
    );
  }
  return (
    <span className="sig-marker">
      <span className="dot" />
      <span className="dot" />
    </span>
  );
}
