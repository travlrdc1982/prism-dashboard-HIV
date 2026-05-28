// ROI module — renders a static pre-baked SVG template with workbook-derived
// values substituted at render time so /topline ROI matches /roi. The SVG
// template lives as a checked-in static file (not in dashboard.json) so
// pipeline refreshes don't blow it away.

import { useMemo } from "react";
import { exportROIPng, exportROISvg } from "../utils/exportPng";
import applyRoiOverrides from "../utils/applyRoiOverrides";
import roiTemplate from "../utils/roi-template.svg?raw";

export default function RoiModule({ roiData }) {
  const patchedSvg = useMemo(() => applyRoiOverrides(roiTemplate), []);
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
        dangerouslySetInnerHTML={{ __html: patchedSvg }}
      />
      {roiData?.notes && (
        <div className="roi-notes" style={{ padding: "12px 24px", fontSize: 12, color: "#475569" }}>
          {roiData.notes}
        </div>
      )}
    </>
  );
}
