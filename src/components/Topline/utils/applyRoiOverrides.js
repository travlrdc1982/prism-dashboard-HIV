// Patch the pre-baked topline ROI SVG with workbook-derived values at
// render time so /topline ROI shows the same numbers as /roi without
// changing the SVG's visual design.
//
// The pre-baked SVG (dashboard.json.roi_svg) was built by the upstream
// Python pipeline (compute_core.py) and embedded the pipeline's own
// formulaic tier values + a different definition of activation. Until
// the pipeline is patched to ingest the workbook overrides, this
// utility does the swap at React render time.
//
// What it patches per segment column (anchored by the bold segment-code
// text node):
//   y=418   ROI value
//   y=549.3 coalition support %
//   y=1019.3 activation %
//   y=1122   influence %
//
// What it does NOT touch:
//   - Persuasion bar (3-bucket vs workbook's 5-bucket — different math)
//   - Tier star polygons (rendered as 5-point stars; SVG geometry is
//     non-trivial to rewrite without a structured re-render)
//   - Segment names (cosmetic, may differ slightly between sources)
//
// VS/PHS quirk: the older pipeline's SVG labels the segment "PHS"
// (Public Health Skeptics) where the workbook uses "VS" (Vaccine
// Skeptics). We rewrite the badge text PHS → VS so the export matches
// the rest of the dashboard.

import { STUDY_METRICS } from "../../../data/study";

const SEG_CODES = [
  "TSP", "CEC", "TC", "HF", "PP", "WE", "PFF", "HHN", "MFL", "VS",
  "UCP", "FJP", "HCP", "HAD", "HCI", "GHI",
];

// Pre-baked SVG uses "PHS" in the column we treat as VS. Map them.
const SVG_CODE = (code) => (code === "VS" ? "PHS" : code);

// Y-coordinates of the metric text nodes inside each segment column.
const ROW_Y = {
  roi: 418.0,
  coalition: 549.3,
  activation: 1019.3,
  influence: 1122.0,
};

// Tolerance when matching float coordinates (SVG floats may be serialized
// slightly differently across builds).
const Y_TOL = 0.6;
const X_TOL = 1.0;

function findColumnX(svg, svgCode) {
  // Bold 26pt text node containing the segment code → column center.
  const re = new RegExp(
    `<text\\s+[^>]*x="(\\d+\\.?\\d*)"[^>]*font-size="26"[^>]*>${svgCode}</text>`,
  );
  const m = re.exec(svg);
  return m ? parseFloat(m[1]) : null;
}

function replaceTextAt(svg, x, y, newText) {
  // Find <text x="X" y="Y" ...>OLD</text> where X and Y match within tolerance.
  // Build a regex that captures the prefix/suffix and replace just the inner text.
  const re = /<text\s+[^>]*x="(\d+\.?\d*)"\s+y="(\d+\.?\d*)"[^>]*>([^<]*)<\/text>/g;
  let result = svg;
  let m;
  // We have to rebuild as we replace; collect matches and substitute in reverse
  // (so indices stay stable).
  const subs = [];
  while ((m = re.exec(svg)) !== null) {
    const mx = parseFloat(m[1]);
    const my = parseFloat(m[2]);
    if (Math.abs(mx - x) < X_TOL && Math.abs(my - y) < Y_TOL) {
      const start = m.index;
      const end = m.index + m[0].length;
      const innerStart = m[0].lastIndexOf(">", m[0].length - 8) + 1;
      const absInnerStart = start + innerStart;
      const absInnerEnd = end - "</text>".length;
      subs.push({ absInnerStart, absInnerEnd });
    }
  }
  // Apply substitutions in reverse order
  subs.sort((a, b) => b.absInnerStart - a.absInnerStart);
  for (const s of subs) {
    result = result.slice(0, s.absInnerStart) + newText + result.slice(s.absInnerEnd);
  }
  return result;
}

function fmt(value, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (suffix === "%") return Math.round(value) + "%";
  return value.toFixed(2);
}

export default function applyRoiOverrides(svg) {
  if (!svg) return svg;
  let out = svg;

  // 1. Rewrite "PHS" badge → "VS" (single substitution; safe because the
  //    only PHS occurrences are in the segment-code badge and 2-line name).
  out = out.replace(/>PHS</g, ">VS<");
  // Also rewrite the segment-name lines for VS. Pre-baked SVG says e.g.
  // "PUBLIC HEALTH" / "SKEPTICS" — replace with "VACCINE" / "SKEPTICS".
  out = out.replace(/>PUBLIC HEALTH</g, ">VACCINE<");

  // 2. For each segment, replace the four metric text nodes.
  for (const code of SEG_CODES) {
    const svgCode = SVG_CODE(code);
    const x = findColumnX(out, svgCode);
    if (x === null) continue;
    const m = STUDY_METRICS[code];
    if (!m) continue;

    if (m.roi != null) out = replaceTextAt(out, x, ROW_Y.roi, m.roi.toFixed(2));
    if (m.supporters != null) out = replaceTextAt(out, x, ROW_Y.coalition, fmt(m.supporters, "%"));
    if (m.activation != null) out = replaceTextAt(out, x, ROW_Y.activation, fmt(m.activation, "%"));
    if (m.influence != null) out = replaceTextAt(out, x, ROW_Y.influence, fmt(m.influence, "%"));
  }

  return out;
}
