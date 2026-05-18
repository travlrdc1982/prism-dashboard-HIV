// ROI module — renders the pre-computed SVG from dashboard.json verbatim
// via dangerouslySetInnerHTML, plus an export bar with PNG/SVG downloads.
// Ported from dashboard_template.html renderROIModule (759-).

import { exportROIPng, exportROISvg } from "../utils/exportPng";

export default function RoiModule({ roiSvg, roiData }) {
  if (!roiSvg) {
    return (
      <div className="module-placeholder" style={{ padding: "16px 24px", color: "#94a3b8", fontStyle: "italic" }}>
        ROI scorecard not yet computed. Re-run the topline build with ROI
        scoring enabled, then refresh `dashboard.json`.
      </div>
    );
  }
  return (
    <>
      <div className="roi-export-bar">
        <span className="roi-export-label">Export ROI scorecard:</span>
        <button type="button" className="roi-export-btn" onClick={() => exportROIPng(3000, "high-res")}>
          Slide / Print (3000px)
        </button>
        <button type="button" className="roi-export-btn" onClick={() => exportROIPng(1500, "standard")}>
          Standard Web (1500px)
        </button>
        <button type="button" className="roi-export-btn" onClick={() => exportROIPng(800, "thumbnail")}>
          Thumbnail (800px)
        </button>
        <button type="button" className="roi-export-btn" onClick={() => exportROISvg()}>
          SVG (vector)
        </button>
      </div>
      <div
        id="roi-svg-container"
        className="roi-svg-container"
        dangerouslySetInnerHTML={{ __html: roiSvg }}
      />
      {roiData?.notes && (
        <div className="roi-notes" style={{ padding: "12px 24px", fontSize: 12, color: "#475569" }}>
          {roiData.notes}
        </div>
      )}
    </>
  );
}
