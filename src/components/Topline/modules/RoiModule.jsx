// ROI module — renders a React-built SVG scorecard from workbook data
// (study.js STUDY_METRICS + ASSIGNED_TIERS) and offers PNG + SVG + CSV
// downloads. Same viewBox (2400×1320) as the previous pre-baked SVG so
// the export utilities work without modification — they read whatever
// <svg> sits inside #roi-svg-container.

import { useMemo } from "react";
import RoiSvgScorecard from "./RoiSvgScorecard";
import { STUDY_METRICS, getAssignedTier } from "../../../data/study";
import { exportROIPng, exportROISvg } from "../utils/exportPng";

const SEG_ORDER = [
  "TSP", "CEC", "TC", "HF", "PP", "WE", "PFF", "HHN", "MFL", "VS",
  "UCP", "FJP", "HCP", "HAD", "HCI", "GHI",
];

function buildCsvRows(segments) {
  const byCode = new Map(segments.map((s) => [s.code, s]));
  return SEG_ORDER.map((code, idx) => {
    const seg = byCode.get(code) || {};
    const m = STUDY_METRICS[code] || {};
    return {
      rank: idx + 1,
      code,
      name: seg.name || code,
      party: seg.party || "",
      n: seg.n,
      pop_pct: seg.pct ?? seg.pop ?? null,
      tier: m.tier ?? getAssignedTier(code),
      roi: m.roi ?? null,
      high_roi_pct: m.highRoi ?? null,
      coalition_pct: m.supporters ?? null,
      activation_pct: m.activation ?? null,
      influence_pct: m.influence ?? null,
      persuad_strong_support: m.persuadability?.[0] ?? null,
      persuad_lean_support: m.persuadability?.[1] ?? null,
      persuad_persuadable: m.persuadability?.[2] ?? null,
      persuad_lean_oppose: m.persuadability?.[3] ?? null,
      persuad_strong_oppose: m.persuadability?.[4] ?? null,
    };
  });
}

function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function downloadCsv(rows, studyId) {
  if (!rows.length) return;
  const header = Object.keys(rows[0]);
  const lines = [header.join(",")];
  rows.forEach((r) => lines.push(header.map((k) => csvEscape(r[k])).join(",")));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${studyId || "PRISM_HIV"}_ROI_scorecard.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RoiModule({ segments, study }) {
  const rows = useMemo(() => buildCsvRows(segments || []), [segments]);

  return (
    <>
      <div className="roi-export-bar">
        <span className="roi-export-label">Export ROI scorecard:</span>
        <button
          type="button"
          className="roi-export-btn"
          onClick={() => exportROIPng(3000, "high-res")}
        >
          Slide / Print (3000px)
        </button>
        <button
          type="button"
          className="roi-export-btn"
          onClick={() => exportROIPng(1500, "standard")}
        >
          Standard Web (1500px)
        </button>
        <button
          type="button"
          className="roi-export-btn"
          onClick={() => exportROIPng(800, "thumbnail")}
        >
          Thumbnail (800px)
        </button>
        <button
          type="button"
          className="roi-export-btn"
          onClick={() => exportROISvg()}
        >
          SVG (vector)
        </button>
        <button
          type="button"
          className="roi-export-btn"
          onClick={() => downloadCsv(rows, study?.id)}
        >
          CSV (data)
        </button>
        <span className="roi-source-note">
          Source: HIV_Study_Template.xlsx · tier values are analyst-configured
        </span>
      </div>

      <div id="roi-svg-container" className="roi-svg-container">
        <RoiSvgScorecard segments={segments} study={study} />
      </div>
    </>
  );
}
