// React-rendered ROI scorecard SVG. Matches the layout of the original
// pre-baked SVG (viewBox 2400×1320, 16 segment columns + labels rail) so
// the export utilities in utils/exportPng.js work without modification —
// they read whatever <svg> sits inside #roi-svg-container.
//
// Data source: src/data/study.js STUDY_METRICS + ASSIGNED_TIERS (workbook).
// Segment names + n come from dashboard.json.segments since the workbook
// stores only codes.

import { STUDY_METRICS, TIER_CONFIG, getAssignedTier } from "../../../data/study";

// Geometry — keep aligned with the original SVG so client deliverables
// look familiar.
const VBW = 2400;
const VBH = 1320;
const LEFT_W = 220;           // left label rail width
const COL_W = (VBW - LEFT_W) / 16;  // 136.25 per segment

// Vertical sections (y baselines)
const Y = {
  badgeCy: 100,        // segment code badge center
  name1: 170,
  name2: 185,
  popLbl: 230,
  pop: 250,
  nLbl: 268,
  n: 282,
  tierLbl: 318,
  tierBadgeTop: 335,
  roiLbl: 410,
  roi: 460,
  coalLblTop: 525,
  coalLblBot: 545,
  coalVal: 595,
  persuasionLbl: 670,
  persuasionTop: 700,
  persuasionBot: 950,
  actLbl: 1010,
  actVal: 1060,
  infLbl: 1110,
  infBarTop: 1130,
  infBarBot: 1200,
  infVal: 1225,
  footer: 1290,
};

// Persuadability bucket colors (workbook's 5-bucket split).
// Strong/lean support → green family. Persuadable → neutral gray.
// Lean/strong oppose → red family.
const PB_COLORS = [
  "#2d8a3e", // strong support
  "#7cc97f", // lean support
  "#c4c4c4", // persuadable
  "#b53838", // lean oppose
  "#923232", // strong oppose
];
const PB_LABELS = [
  "Strong support",
  "Lean support",
  "Persuadable",
  "Lean oppose",
  "Strong oppose",
];

const GOP = { fill: "#b53838", soft: "#fee2e2", text: "#b53838" };
const DEM = { fill: "#264c8b", soft: "#dbeafe", text: "#264c8b" };

function colCenter(idx) {
  return LEFT_W + COL_W * (idx + 0.5);
}

// ─── Per-segment column ─────────────────────────────────────────────────
function SegmentColumn({ seg, m, x, isDivider, study }) {
  const party = seg.party === "GOP" ? GOP : DEM;
  const tier = m?.tier ?? getAssignedTier(seg.code);
  const tierCfg = TIER_CONFIG[tier];

  return (
    <g>
      {isDivider && (
        <line
          x1={x - COL_W / 2}
          y1={70}
          x2={x - COL_W / 2}
          y2={VBH - 70}
          stroke="#e2e8f0"
          strokeWidth="1"
        />
      )}

      {/* Segment badge — circle + party-colored code letters */}
      <circle cx={x} cy={Y.badgeCy} r={42} fill={party.fill} />
      <circle
        cx={x}
        cy={Y.badgeCy}
        r={41}
        fill="none"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1.2"
      />
      <text
        x={x}
        y={Y.badgeCy + 10}
        textAnchor="middle"
        fontSize="26"
        fontWeight="800"
        fill="white"
        fontFamily="DM Sans"
        letterSpacing="0.5"
      >
        {seg.code}
      </text>

      {/* Two-line segment name */}
      <NameLines x={x} name={seg.name?.toUpperCase() || seg.code} fill={party.text} />

      {/* Population + n */}
      <text x={x} y={Y.popLbl} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#94a3b8" letterSpacing="0.6">
        POPULATION
      </text>
      <text x={x} y={Y.pop} textAnchor="middle" fontSize="17" fontWeight="700" fill="#1a1a1a">
        {seg.pct?.toFixed?.(0) ?? seg.pct ?? "—"}%
      </text>
      <text x={x} y={Y.nLbl} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#94a3b8" letterSpacing="0.6">
        n
      </text>
      <text x={x} y={Y.n} textAnchor="middle" fontSize="17" fontWeight="700" fill="#1a1a1a">
        {seg.n ?? "—"}
      </text>

      {/* Tier badge */}
      {tierCfg && (
        <g>
          <rect
            x={x - 36}
            y={Y.tierBadgeTop}
            width="72"
            height="26"
            rx="4"
            fill={tierCfg.bg}
          />
          <text
            x={x}
            y={Y.tierBadgeTop + 18}
            textAnchor="middle"
            fontSize="13"
            fontWeight="800"
            fill={tierCfg.text}
            fontFamily="JetBrains Mono"
            letterSpacing="0.8"
          >
            {tierCfg.label}
          </text>
        </g>
      )}

      {/* ROI value */}
      <text
        x={x}
        y={Y.roi}
        textAnchor="middle"
        fontSize="44"
        fontWeight="800"
        fill={party.text}
        fontFamily="Roboto Mono"
      >
        {m?.roi?.toFixed?.(2) ?? "—"}
      </text>

      {/* Coalition support */}
      <text
        x={x}
        y={Y.coalVal}
        textAnchor="middle"
        fontSize="32"
        fontWeight="700"
        fill="#1a1a1a"
        fontFamily="Roboto Mono"
      >
        {m?.supporters != null ? `${Math.round(m.supporters)}%` : "—"}
      </text>

      {/* Persuasion 5-bucket stacked bar */}
      <PersuasionStack x={x} persuadability={m?.persuadability} />

      {/* Activation */}
      <text
        x={x}
        y={Y.actVal}
        textAnchor="middle"
        fontSize="32"
        fontWeight="700"
        fill="#1a1a1a"
        fontFamily="Roboto Mono"
      >
        {m?.activation != null ? `${Math.round(m.activation)}%` : "—"}
      </text>

      {/* Influence — bar + value */}
      <InfluenceBar x={x} value={m?.influence} />
    </g>
  );
}

function NameLines({ x, name, fill }) {
  // Try to split on whitespace near the midpoint
  const words = name.split(/\s+/);
  let line1 = "", line2 = "";
  if (words.length <= 1) {
    line1 = name;
  } else {
    const half = Math.ceil(words.length / 2);
    line1 = words.slice(0, half).join(" ");
    line2 = words.slice(half).join(" ");
  }
  return (
    <g>
      <text
        x={x}
        y={Y.name1}
        textAnchor="middle"
        fontSize="10.5"
        fontWeight="700"
        fill={fill}
        letterSpacing="0.3"
      >
        {line1}
      </text>
      <text
        x={x}
        y={Y.name2}
        textAnchor="middle"
        fontSize="10.5"
        fontWeight="700"
        fill={fill}
        letterSpacing="0.3"
      >
        {line2}
      </text>
    </g>
  );
}

function PersuasionStack({ x, persuadability }) {
  if (!persuadability || persuadability.length !== 5) {
    return (
      <text x={x} y={Y.persuasionTop + 120} textAnchor="middle" fontSize="12" fill="#94a3b8">
        —
      </text>
    );
  }
  const total = persuadability.reduce((s, v) => s + (v || 0), 0) || 1;
  const trackTop = Y.persuasionTop;
  const trackHeight = Y.persuasionBot - Y.persuasionTop;
  const barW = 60;
  const barX = x - barW / 2;

  let cursor = trackTop;
  const rects = persuadability.map((v, i) => {
    const h = (v / total) * trackHeight;
    const node = (
      <rect
        key={i}
        x={barX}
        y={cursor}
        width={barW}
        height={h}
        fill={PB_COLORS[i]}
      />
    );
    cursor += h;
    return { node, midY: cursor - h / 2, pct: v };
  });

  return (
    <g>
      {rects.map((r) => r.node)}
      {/* In-bar % labels for buckets ≥ 8% (smaller wedges go unlabeled to avoid clutter) */}
      {rects.map((r, i) =>
        r.pct >= 8 ? (
          <text
            key={`lbl-${i}`}
            x={x}
            y={r.midY + 4}
            textAnchor="middle"
            fontSize="11"
            fontWeight="700"
            fill="white"
            fontFamily="Roboto Mono"
          >
            {Math.round(r.pct)}%
          </text>
        ) : null,
      )}
    </g>
  );
}

function InfluenceBar({ x, value }) {
  if (value == null) {
    return (
      <text x={x} y={Y.infVal} textAnchor="middle" fontSize="12" fill="#94a3b8">
        —
      </text>
    );
  }
  const pct = Math.max(0, Math.min(100, value));
  const trackH = Y.infBarBot - Y.infBarTop;
  const barH = (pct / 100) * trackH;
  const barW = 48;
  const barX = x - barW / 2;
  return (
    <g>
      <rect x={barX} y={Y.infBarTop} width={barW} height={trackH} fill="#e2e8f0" rx="2" />
      <rect
        x={barX}
        y={Y.infBarBot - barH}
        width={barW}
        height={barH}
        fill="#27b4d4"
        rx="2"
      />
      <text
        x={x}
        y={Y.infVal}
        textAnchor="middle"
        fontSize="17"
        fontWeight="700"
        fill="#1a1a1a"
        fontFamily="Roboto Mono"
      >
        {Math.round(pct)}%
      </text>
    </g>
  );
}

// ─── Left label rail ────────────────────────────────────────────────────
function LeftRail() {
  const lblColor = "#475569";
  const Big = (props) => (
    <text
      textAnchor="middle"
      fontSize="20"
      fontWeight="800"
      fill="#1a1a1a"
      fontFamily="DM Sans"
      letterSpacing="0.5"
      {...props}
    />
  );
  const Cap = (props) => (
    <text
      textAnchor="middle"
      fontSize="10"
      fontWeight="700"
      fill={lblColor}
      letterSpacing="0.6"
      {...props}
    />
  );
  const cx = LEFT_W / 2;
  return (
    <g>
      <Big x={cx} y={Y.roiLbl + 30}>ROI</Big>
      <Cap x={cx} y={Y.roiLbl + 56}>NORMALIZED INDEX</Cap>

      <Big x={cx} y={Y.coalLblTop + 20}>COALITION</Big>
      <Big x={cx} y={Y.coalLblBot + 20}>SUPPORT</Big>
      <Cap x={cx} y={Y.coalVal + 18}>% supporters</Cap>

      <Big x={cx} y={Y.persuasionLbl + 30}>PERSUASION</Big>
      <Cap x={cx} y={Y.persuasionLbl + 56}>5-bucket support split</Cap>

      <Big x={cx} y={Y.actLbl + 30}>ACTIVATION</Big>
      <Cap x={cx} y={Y.actVal + 18}>mobilization %</Cap>

      <Big x={cx} y={Y.infLbl + 30}>INFLUENCE</Big>
      <Cap x={cx} y={Y.infVal + 18}>top-influencer share</Cap>

      <line
        x1={LEFT_W}
        y1={70}
        x2={LEFT_W}
        y2={VBH - 70}
        stroke="#cbd5e1"
        strokeWidth="2"
      />
    </g>
  );
}

// ─── Top + bottom chrome ────────────────────────────────────────────────
function TopTitle({ study }) {
  return (
    <g>
      <text
        x={LEFT_W / 2}
        y={42}
        textAnchor="middle"
        fontSize="20"
        fontWeight="800"
        fill="#0f172a"
        fontFamily="DM Sans"
        letterSpacing="-0.3"
      >
        PRISM
      </text>
      <text
        x={LEFT_W / 2}
        y={62}
        textAnchor="middle"
        fontSize="9.5"
        fontWeight="600"
        fill="#475569"
        letterSpacing="0.7"
      >
        ROI SCORECARD
      </text>
    </g>
  );
}

function Legend() {
  // 5-bucket persuadability legend, anchored top-right of the SVG.
  const x0 = VBW - 280;
  const y0 = 30;
  return (
    <g>
      <text
        x={x0}
        y={y0}
        fontSize="9.5"
        fontWeight="700"
        fill="#475569"
        letterSpacing="0.6"
      >
        PERSUASION BUCKETS
      </text>
      {PB_LABELS.map((lbl, i) => (
        <g key={i} transform={`translate(${x0}, ${y0 + 14 + i * 13})`}>
          <rect x="0" y="-9" width="14" height="10" fill={PB_COLORS[i]} />
          <text x="20" y="0" fontSize="10" fill="#1a1a1a">
            {lbl}
          </text>
        </g>
      ))}
    </g>
  );
}

function Footer({ study }) {
  return (
    <text
      x={VBW / 2}
      y={Y.footer + 20}
      textAnchor="middle"
      fontSize="10"
      fill="#94a3b8"
      letterSpacing="0.4"
    >
      {study?.id || ""} · {study?.field_dates || ""} · n={study?.n_total ?? "—"} ·
      Source: HIV_Study_Template.xlsx (analyst-configured tiers)
    </text>
  );
}

// ─── Top-level SVG ──────────────────────────────────────────────────────
export default function RoiSvgScorecard({ segments, study }) {
  const byCode = new Map(segments.map((s) => [s.code, s]));
  const SEG_ORDER = [
    "TSP", "CEC", "TC", "HF", "PP", "WE", "PFF", "HHN", "MFL", "VS",
    "UCP", "FJP", "HCP", "HAD", "HCI", "GHI",
  ];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${VBW} ${VBH}`}
      style={{ background: "#ffffff", width: "100%", height: "auto" }}
    >
      <defs>
        <style type="text/css">{`
          text { font-family: 'DM Sans', 'Roboto', system-ui, -apple-system, sans-serif; }
        `}</style>
      </defs>
      <rect x="0" y="0" width={VBW} height={VBH} fill="#ffffff" />

      <TopTitle study={study} />
      <Legend />
      <LeftRail />

      {SEG_ORDER.map((code, idx) => {
        const seg = byCode.get(code) || { code };
        const m = STUDY_METRICS[code];
        return (
          <SegmentColumn
            key={code}
            seg={seg}
            m={m}
            x={colCenter(idx)}
            isDivider={idx > 0}
            study={study}
          />
        );
      })}

      <Footer study={study} />
    </svg>
  );
}
