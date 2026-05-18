// ROI module — renders the pre-baked SVG from dashboard.json, but with
// workbook-derived values substituted at render time so /topline ROI
// matches /roi (both sourced from HIV_Study_Template.xlsx). The SVG's
// visual design is unchanged; only the ROI / coalition / activation /
// influence numbers are swapped per segment.
//
// Pipeline note: the pre-baked SVG was produced by compute_core.py from
// the .sav file and carries that pipeline's formulaic tiers + a
// different activation definition. Future pipeline runs should ingest
// the workbook tier column directly so this client-side patch becomes a
// no-op.

import { useMemo } from "react";
import { exportROIPng, exportROISvg } from "../utils/exportPng";
import applyRoiOverrides from "../utils/applyRoiOverrides";

export default function RoiModule({ roiSvg, roiData }) {
  const patchedSvg = useMemo(() => applyRoiOverrides(roiSvg), [roiSvg]);

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
