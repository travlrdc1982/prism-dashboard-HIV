// ROI scorecard — sourced from src/data/study.js STUDY_METRICS (which
// flows from HIV_Study_Template.xlsx via extract_hiv.py). Same numbers as
// the /roi AudienceROI page; both views derive from the workbook so the
// analyst-assigned tier values are authoritative for the topline too.
//
// The pre-baked SVG in dashboard.json.roi_svg is no longer rendered —
// it carried formulaic tiers and a different definition of "activation"
// that diverged from the workbook (see git history for the comparison).
//
// Export bar: CSV download. The previous PNG/SVG export is on hold until
// the visual scorecard is re-laid-out in React.

import { useMemo, useState } from "react";
import {
  STUDY_METRICS,
  ASSIGNED_TIERS,
  getAssignedTier,
  TIER_CONFIG,
} from "../../../data/study";

const SEG_ORDER = [
  "TSP", "CEC", "TC", "HF", "PP", "WE", "PFF", "HHN", "MFL", "VS",
  "UCP", "FJP", "HCP", "HAD", "HCI", "GHI",
];

function buildRows(segments) {
  // Merge dashboard.json segment metadata (name, n) with workbook
  // STUDY_METRICS keyed by code. Falls back to SEG_ORDER if segments
  // doesn't include all 16.
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
      pop: seg.pct ?? seg.pop ?? null,
      tier: m.tier ?? getAssignedTier(code),
      roi: m.roi ?? null,
      highRoi: m.highRoi ?? null,
      supporters: m.supporters ?? null,
      activation: m.activation ?? null,
      influence: m.influence ?? null,
    };
  });
}

function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function downloadCsv(rows, studyId) {
  const header = [
    "rank", "code", "name", "party", "n", "pop_pct",
    "tier", "roi", "high_roi_pct", "supporters_pct",
    "activation_pct", "influence_pct",
  ];
  const lines = [header.join(",")];
  rows.forEach((r) => {
    lines.push([
      r.rank, r.code, r.name, r.party, r.n, r.pop,
      r.tier, r.roi, r.highRoi, r.supporters,
      r.activation, r.influence,
    ].map(csvEscape).join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${studyId || "PRISM_HIV"}_ROI_scorecard.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function TierBadge({ tier }) {
  const cfg = TIER_CONFIG?.[tier];
  if (!cfg) return <span className="tier-badge tier-na">—</span>;
  return (
    <span
      className="tier-badge"
      style={{ background: cfg.bg, color: cfg.text }}
    >
      {cfg.label}
    </span>
  );
}

function NumCell({ value, suffix = "" }) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <td className="roi-num">—</td>;
  }
  const display = Number.isInteger(value) ? value : value.toFixed(typeof value === "number" && value < 10 ? 2 : 0);
  return <td className="roi-num">{display}{suffix}</td>;
}

export default function RoiModule({ segments, study }) {
  const [sortKey, setSortKey] = useState("roi");
  const [sortDir, setSortDir] = useState("desc");

  const rows = useMemo(() => buildRows(segments || []), [segments]);
  const sorted = useMemo(() => {
    const arr = [...rows];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const setSort = (key) => {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "code" || key === "name" ? "asc" : "desc");
    }
  };

  const SortHeader = ({ k, children, align = "left" }) => (
    <th
      className={"roi-th sortable" + (sortKey === k ? " active " + sortDir : "")}
      style={{ textAlign: align }}
      onClick={() => setSort(k)}
    >
      {children}
      {sortKey === k && (
        <span className="sort-arrow">{sortDir === "asc" ? " ▲" : " ▼"}</span>
      )}
    </th>
  );

  return (
    <>
      <div className="roi-export-bar">
        <span className="roi-export-label">
          Export ROI scorecard:
        </span>
        <button
          type="button"
          className="roi-export-btn"
          onClick={() => downloadCsv(sorted, study?.id)}
        >
          CSV
        </button>
        <span className="roi-source-note">
          Source: HIV_Study_Template.xlsx · tier values are analyst-configured
        </span>
      </div>

      <div className="roi-scorecard">
        <table className="roi-table">
          <thead>
            <tr>
              <SortHeader k="rank" align="right">#</SortHeader>
              <SortHeader k="code">Code</SortHeader>
              <SortHeader k="name">Segment</SortHeader>
              <SortHeader k="party">Party</SortHeader>
              <SortHeader k="n" align="right">n</SortHeader>
              <SortHeader k="pop" align="right">Pop %</SortHeader>
              <SortHeader k="tier">Tier</SortHeader>
              <SortHeader k="roi" align="right">ROI</SortHeader>
              <SortHeader k="highRoi" align="right">High ROI %</SortHeader>
              <SortHeader k="supporters" align="right">Coalition %</SortHeader>
              <SortHeader k="activation" align="right">Activation %</SortHeader>
              <SortHeader k="influence" align="right">Influence %</SortHeader>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.code} className={"roi-row " + (r.party === "GOP" ? "gop" : "dem")}>
                <td className="roi-rank">{r.rank}</td>
                <td className={"roi-code " + (r.party === "GOP" ? "gop" : "dem")}>
                  {r.code}
                </td>
                <td className="roi-name">{r.name}</td>
                <td className="roi-party">{r.party}</td>
                <td className="roi-num">{r.n ?? "—"}</td>
                <NumCell value={r.pop} suffix="%" />
                <td><TierBadge tier={r.tier} /></td>
                <td className="roi-num roi-strong">
                  {r.roi !== null ? r.roi.toFixed(3) : "—"}
                </td>
                <NumCell value={r.highRoi} suffix="%" />
                <NumCell value={r.supporters} suffix="%" />
                <NumCell value={r.activation} suffix="%" />
                <NumCell value={r.influence} suffix="%" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
