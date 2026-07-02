import React, { useState, useMemo } from "react";
import { C } from '../data/theme';

// ─── SEGMENT ORDER ───
const SEGS = [
  { code:"TSP", name:"TRUST THE SCIENCE PRAGMATISTS", party:"GOP" },
  { code:"CEC", name:"CONSUMER EMPOWERMENT CHAMPIONS", party:"GOP" },
  { code:"TC",  name:"TRADITIONAL CONSERVATIVES", party:"GOP" },
  { code:"WE",  name:"WELLNESS EVANGELISTS", party:"GOP" },
  { code:"PP",  name:"PRICE POPULISTS", party:"GOP" },
  { code:"HF",  name:"HEALTH FUTURISTS", party:"GOP" },
  { code:"PFF", name:"PALEO FREEDOM FIGHTERS", party:"GOP" },
  { code:"HHN", name:"HOLISTIC HEALTH NATURALISTS", party:"GOP" },
  { code:"MFL", name:"MEDICAL FREEDOM LIBERTARIANS", party:"GOP" },
  { code:"VS",  name:"VACCINE SKEPTICS", party:"GOP" },
  { code:"UCP", name:"UNIVERSAL CARE PROGRESSIVES", party:"DEM" },
  { code:"FJP", name:"FAITH & JUSTICE PROGRESSIVES", party:"DEM" },
  { code:"HCP", name:"HEALTH CARE PROTECTIONISTS", party:"DEM" },
  { code:"HAD", name:"HEALTH ABUNDANCE DEMOCRATS", party:"DEM" },
  { code:"HCI", name:"HEALTH CARE INCREMENTALISTS", party:"DEM" },
  { code:"GHI", name:"GLOBAL HEALTH INSTITUTIONALISTS", party:"DEM" },
];

// ─── GROUPED DIMENSIONS ───
const GROUPS = [
  {
    label: "MARKETS", color: C.green,
    dims: [
      { key:"regulation", label:"Regulation",   lo:"Necessary",       hi:"Harmful" },
      { key:"sizeofgovt", label:"Size of Govt", lo:"Do more",         hi:"Spends too much" },
      { key:"profit",     label:"Profit",       lo:"Too much profit", hi:"Fair profit" },
    ],
  },
  {
    label: "MFA", color: C.amber,
    dims: [
      { key:"mfa", label:"Health Care", lo:"Right / public system", hi:"Private market" },
    ],
  },
  {
    label: "PLANET", color: C.blue,
    dims: [
      { key:"enviro",  label:"Environment",    lo:"Protect",        hi:"Gone too far" },
      { key:"climate", label:"Climate Change", lo:"Serious threat", hi:"Overblown" },
    ],
  },
  {
    label: "MORALITY", color: "#c084fc",
    dims: [
      { key:"homosexuals", label:"Homosexuality",   lo:"Acceptance",  hi:"Discouragement" },
      { key:"familystruc", label:"Family Structure", lo:"Diversity",   hi:"Traditional" },
      { key:"abortion",    label:"Abortion",         lo:"Pro-choice",  hi:"Pro-life" },
      { key:"religion",    label:"Religion",         lo:"Without God", hi:"Requires God" },
    ],
  },
  {
    label: "POPULISM", color: "#fb7185",
    dims: [
      { key:"immigration", label:"Immigration", lo:"Strengthens",     hi:"Threatens" },
      { key:"trade",       label:"Trade",       lo:"Free trade",      hi:"Protectionism" },
      { key:"globalism",   label:"Globalism",   lo:"Global leader",   hi:"America First" },
      { key:"patriotism",  label:"Patriotism",  lo:"Not proud",       hi:"Proud" },
      { key:"authority",   label:"Authority",   lo:"Strong measures", hi:"Trust system" },
    ],
  },
];

const ALL_DIMS = GROUPS.flatMap(g => g.dims);

const DATA = {
  regulation:  [4.76,4.78,5.28,5.34,4.49,4.08,4.91,4.73,5.26,4.67, 3.49,3.77,4.02,3.93,4.02,3.30],
  sizeofgovt:  [4.17,4.42,5.00,5.01,3.66,3.88,4.53,4.16,4.20,4.09, 2.39,3.17,3.15,3.31,4.02,2.66],
  profit:      [4.31,4.40,4.38,4.15,3.74,4.25,3.65,3.96,4.12,3.80, 3.29,3.62,3.53,3.94,3.84,3.53],
  mfa:         [3.98,4.26,4.42,4.54,3.81,3.40,4.56,4.01,4.06,4.47, 2.26,3.21,3.04,3.29,3.09,2.48],
  enviro:      [4.60,4.71,4.76,5.16,4.24,3.81,4.65,4.52,4.38,4.76, 2.48,3.29,2.85,3.19,2.86,2.28],
  climate:     [5.00,5.29,5.31,5.58,4.69,4.07,4.89,4.56,4.99,4.76, 3.01,3.73,3.97,4.17,3.99,3.49],
  homosexuals: [4.77,4.69,5.33,5.48,4.22,4.27,4.96,4.16,4.23,4.56, 3.00,3.70,3.59,4.35,3.77,2.84],
  familystruc: [4.87,3.43,5.01,5.59,3.75,4.04,4.85,4.54,4.04,4.19, 2.41,3.31,3.12,3.73,3.03,2.23],
  abortion:    [4.42,4.59,4.84,5.05,4.84,4.23,5.14,4.38,4.89,4.69, 2.60,3.07,3.66,3.73,3.39,2.51],
  religion:    [4.59,4.54,4.77,4.31,4.19,3.66,4.26,4.41,4.35,3.73, 3.07,4.17,3.39,3.65,3.14,2.80],
  immigration: [4.95,4.95,5.05,5.30,4.55,4.37,4.88,4.39,5.06,5.22, 2.48,3.14,3.39,3.61,3.43,2.68],
  trade:       [4.71,5.07,4.74,4.94,4.52,4.56,5.05,4.77,4.87,4.97, 3.15,3.86,4.21,4.17,3.53,2.60],
  globalism:   [5.29,5.30,5.45,5.34,4.65,4.35,4.90,5.04,4.92,5.21, 3.24,3.73,4.31,4.17,4.94,3.75],
  patriotism:  [4.48,4.31,4.83,4.62,4.30,3.82,4.45,4.21,4.26,4.35, 3.64,4.10,4.34,4.11,4.31,3.90],
  authority:   [4.75,3.40,4.58,4.95,3.88,3.78,4.82,4.41,3.70,3.83, 2.72,4.11,3.17,3.97,2.93,2.61],
};

// ─── SOFTER COLOR SCALE ───
function getColor(val) {
  const t = Math.max(0, Math.min(1, (val - 1.5) / 5.0));
  if (t < 0.35) {
    const s = t / 0.35;
    return `rgba(59,130,246,${0.50 - s * 0.18})`;
  } else if (t < 0.55) {
    const s = (t - 0.35) / 0.2;
    return `rgba(100,116,139,${0.08 + s * 0.04})`;
  } else {
    const s = (t - 0.55) / 0.45;
    return `rgba(239,68,68,${0.12 + s * 0.42})`;
  }
}

function getTextColor(val) {
  if (!C.isDark) {
    if (val >= 5.3) return "#7f1d1d";
    if (val >= 4.8) return "#374151";
    if (val <= 2.5) return "#1e3a5f";
    if (val <= 3.2) return "#374151";
    return "#374151";
  }
  if (val >= 5.3) return "#fecaca";
  if (val >= 4.8) return "#d1d5db";
  if (val <= 2.5) return "#bfdbfe";
  if (val <= 3.2) return "#c7d2db";
  return "#8a95a5";
}

export default function IdeologyHeatmap() {
  const [hoverRow, setHoverRow] = useState(null);
  const [hoverCol, setHoverCol] = useState(null);
  const [sortCol, setSortCol] = useState(null);

  const means = useMemo(() => {
    const m = {};
    ALL_DIMS.forEach(d => {
      const vals = DATA[d.key];
      m[d.key] = vals.reduce((a, b) => a + b, 0) / vals.length;
    });
    return m;
  }, []);

  const sortedGroups = useMemo(() => {
    if (sortCol === null) return GROUPS;
    return GROUPS.map(g => ({
      ...g,
      dims: [...g.dims].sort((a, b) => DATA[b.key][sortCol] - DATA[a.key][sortCol]),
    }));
  }, [sortCol]);

  return (
    <div style={{
      fontFamily: "'Quicksand',-apple-system,sans-serif",
      color: C.text,
    }}>

      <div style={{ maxWidth: 1500, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: "'Quicksand',sans-serif", fontSize: 9, letterSpacing: 3, color: C.textDim, marginBottom: 3, fontWeight: 600 }}>
            RESERVOIR HEALTH PRISM PULSE
          </div>
          <h1 style={{ fontFamily: "'Poppins',sans-serif", fontSize: 22, fontWeight: 800, color: C.white, margin: 0 }}>
            IDEOLOGY HEATMAP
          </h1>
          <div style={{ fontFamily: "'Poppins',sans-serif", fontSize: 13, fontWeight: 600, color: C.violet, marginTop: 2 }}>
            15 IDEOLOGICAL DIMENSIONS × 16 PRISM SEGMENTS
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, maxWidth: 900, lineHeight: 1.6, marginTop: 6 }}>
            Segment means on 1–7 bipolar scales grouped by factor domain. Deviation from the 16-segment 
            mean shown below each score. Click any segment header to sort within groups.
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 0, borderRadius: 4, overflow: "hidden" }}>
            {[2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0].map(v => (
              <div key={v} style={{
                width: 22, height: 14, background: getColor(v),
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 5.5, color: getTextColor(v), fontFamily: "'Quicksand',sans-serif", fontWeight: 700 }}>
                  {v.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
          <span style={{ fontSize: 8, color: C.blue, fontWeight: 600 }}>← progressive</span>
          <span style={{ fontSize: 8, color: "#f87171", fontWeight: 600 }}>conservative →</span>
          <div style={{ marginLeft: 12, display: "flex", gap: 10 }}>
            {GROUPS.map(g => (
              <div key={g.label} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <div style={{ width: 3, height: 10, borderRadius: 1, background: g.color }} />
                <span style={{ fontSize: 7, color: g.color, fontWeight: 700, letterSpacing: 0.5 }}>{g.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "separate", borderSpacing: "1px 1px", width: "100%" }}>
            <thead>
              <tr>
                <th style={{ background: C.bg, width: 36 }} />
                <th style={{ background: C.bg, width: 86 }} />
                <th style={{ background: C.bg, width: 80 }} />
                <th colSpan={10} style={{
                  background: C.gopSectionBg, color: C.partyGOP,
                  fontFamily: "'Poppins',sans-serif", fontSize: 8, fontWeight: 700,
                  letterSpacing: 2, padding: "4px 0", textAlign: "center",
                  borderBottom: `2px solid ${C.partyGOP}66`,
                }}>REPUBLICAN</th>
                <th colSpan={6} style={{
                  background: C.demSectionBg, color: C.blue,
                  fontFamily: "'Poppins',sans-serif", fontSize: 8, fontWeight: 700,
                  letterSpacing: 2, padding: "4px 0", textAlign: "center",
                  borderBottom: `2px solid ${C.partyDEM}66`,
                }}>DEMOCRAT</th>
              </tr>
              <tr>
                <th style={{ background: C.panelDeep, padding: 2 }} />
                <th style={{ background: C.panelDeep, padding: "3px 4px", textAlign: "left" }}>
                  <span style={{ fontSize: 7, color: C.textDim, fontWeight: 600 }}>dimension</span>
                </th>
                <th style={{ background: C.panelDeep, padding: "3px 4px", textAlign: "left" }}>
                  <span style={{ fontSize: 6, color: C.textDim, fontWeight: 500 }}>polarity</span>
                </th>
                {SEGS.map((seg, si) => (
                  <th key={seg.code}
                    onClick={() => setSortCol(sortCol === si ? null : si)}
                    onMouseEnter={() => setHoverCol(si)}
                    onMouseLeave={() => setHoverCol(null)}
                    style={{
                      background: sortCol === si ? C.card : C.panelDeep,
                      width: 58, minWidth: 58, maxWidth: 58,
                      padding: "4px 1px", cursor: "pointer",
                      verticalAlign: "bottom", textAlign: "center",
                      borderBottom: sortCol === si
                        ? `2px solid ${seg.party === "GOP" ? "#f87171" : C.blue}`
                        : "1px solid transparent",
                      transition: "all 0.15s",
                    }}>
                    <div style={{
                      fontSize: 10, fontWeight: 700,
                      color: seg.party === "GOP" ? C.partyGOP : C.partyDEM,
                      fontFamily: "'Poppins',sans-serif",
                    }}>{seg.code}</div>
                    <div style={{
                      fontSize: 5, fontWeight: 600, color: C.textDim,
                      textTransform: "uppercase", lineHeight: 1.2,
                      marginTop: 1, wordBreak: "break-word",
                      overflowWrap: "break-word",
                    }}>{seg.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedGroups.map((group, gi) => (
                <React.Fragment key={group.label}>
                  {group.dims.map((dim, di) => {
                    const vals = DATA[dim.key];
                    const mean = means[dim.key];
                    const isFirst = di === 0;
                    const isHovRow = hoverRow === dim.key;

                    return (
                      <tr key={dim.key}
                        onMouseEnter={() => setHoverRow(dim.key)}
                        onMouseLeave={() => setHoverRow(null)}
                      >
                        {isFirst && (
                          <td rowSpan={group.dims.length} style={{
                            background: C.panelDeep,
                            borderLeft: `3px solid ${group.color}`,
                            padding: "4px 2px", verticalAlign: "middle",
                            textAlign: "center", width: 36,
                          }}>
                            <div style={{
                              writingMode: "vertical-rl",
                              textOrientation: "mixed",
                              transform: "rotate(180deg)",
                              fontFamily: "'Poppins',sans-serif",
                              fontSize: 7, fontWeight: 700,
                              color: group.color,
                              letterSpacing: 1.5,
                              whiteSpace: "nowrap",
                            }}>{group.label}</div>
                          </td>
                        )}

                        <td style={{
                          background: isHovRow ? C.card : C.panelDeep,
                          padding: "5px 4px", verticalAlign: "middle",
                        }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: C.textMuted,
                            letterSpacing: 0.2,
                          }}>{dim.label}</span>
                        </td>

                        <td style={{
                          background: isHovRow ? C.card : C.panelDeep,
                          padding: "3px 4px", verticalAlign: "middle",
                        }}>
                          <div style={{ fontSize: 6, color: "#6b93c0", fontWeight: 600, lineHeight: 1.3 }}>
                            {dim.lo}
                          </div>
                          <div style={{ fontSize: 6, color: "#c07b7b", fontWeight: 600, lineHeight: 1.3, marginTop: 1 }}>
                            {dim.hi}
                          </div>
                        </td>

                        {vals.map((val, si) => {
                          const dev = val - mean;
                          const isColActive = hoverCol === si || sortCol === si;
                          const isHov = isHovRow && isColActive;

                          return (
                            <td key={si} style={{
                              background: getColor(val),
                              textAlign: "center",
                              padding: "4px 1px",
                              borderRadius: 2,
                              outline: isHov ? "1.5px solid rgba(241,245,249,0.35)" : "none",
                              outlineOffset: -1,
                              transition: "all 0.1s",
                              width: 58, minWidth: 58, maxWidth: 58,
                            }}>
                              <div style={{
                                fontSize: 11, fontWeight: 600,
                                color: getTextColor(val),
                                lineHeight: 1, letterSpacing: -0.2,
                              }}>{val.toFixed(1)}</div>
                              <div style={{
                                fontSize: 6, fontWeight: 600, marginTop: 2,
                                color: Math.abs(dev) >= 0.7
                                  ? (dev > 0 ? "rgba(252,165,165,0.75)" : "rgba(147,197,253,0.75)")
                                  : Math.abs(dev) >= 0.4
                                    ? (dev > 0 ? "rgba(252,165,165,0.45)" : "rgba(147,197,253,0.45)")
                                    : "rgba(148,163,184,0.2)",
                              }}>
                                {dev > 0 ? "+" : ""}{dev.toFixed(1)}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {gi < sortedGroups.length - 1 && (
                    <tr><td colSpan={19} style={{ height: 5, background: C.bg }} /></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{
          marginTop: 16, padding: "8px 0", borderTop: `1px solid ${C.cardBorder}`,
          fontSize: 8, color: C.textDim, fontWeight: 600,
          display: "flex", justifyContent: "space-between",
        }}>
          <span>PRISM V3.1 · RESERVOIR COMMUNICATIONS GROUP · CONFIDENTIAL & PROPRIETARY</span>
          <span>BIPOLAR IDEOLOGY SCALES · 1–7 · N=16 SEGMENTS</span>
        </div>
      </div>
    </div>
  );
}
