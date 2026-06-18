                              import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { C, FONT, MONO } from "../data/theme";
import { PREPOST_METRICS, STUDY_METRICS } from "../data/study";
import bench from "../data/hiv/bench.json";
import dashboard from "../data/topline/dashboard.json";
import { CensusDivisionMap, SEGMENTS } from "./SegmentProfile";

const PANEL = C.card;
const PANEL_DEEP = "#0a0f1a";
const TRACK = C.cardBorder;
const PERSUADE = "#5b93c7";
const SUPPORT = C.partyDEM;
const ACTIVATE = C.violet;
const INFLUENCE = "#818cf8";
const DASHBOARD_SEGMENTS = dashboard.segments || [];
const DASHBOARD_MESSAGES = dashboard.messages || [];
const PREPOST_BY_KEY = Object.fromEntries(PREPOST_METRICS.map((metric) => [metric.key, metric]));
const SEGMENT_SUMMARY_RULES = dashboard.ui?.segment_summary?.rules || {};
const BENCH_GLYPH = { All: "US", Republicans: "R", Democrats: "D" };
const SCF_COMPOSITE = (dashboard.stigma_extras?.composites?.items || []).find((item) => item.code === "SCF");
const HKS_COMPOSITE = (dashboard.stigma_extras?.composites?.items || []).find((item) => item.code === "HKS");
const SCF_BY_CODE = Object.fromEntries(
  Object.entries(SCF_COMPOSITE?.cuts || {})
    .filter(([code]) => code !== "TOTAL")
    .map(([code, value]) => [code, value.val])
);
const HKS_BY_CODE = Object.fromEntries(
  Object.entries(HKS_COMPOSITE?.cuts || {})
    .filter(([code]) => code !== "TOTAL")
    .map(([code, value]) => [code, value.val])
);
const SCF_RANK_BY_CODE = Object.fromEntries(
  Object.entries(SCF_BY_CODE)
    .sort(([, a], [, b]) => b - a)
    .map(([code], index, arr) => [code, index + 1])
);
const HKS_RANK_BY_CODE = Object.fromEntries(
  Object.entries(HKS_BY_CODE)
    .sort(([, a], [, b]) => b - a)
    .map(([code], index) => [code, index + 1])
);
const EXEC_SUMMARY_WIDTH = 1560;

function wordingFor(message, proofVariant, arm, segmentCode) {
  const variant = (dashboard.variants?.messages || []).find((item) => {
    const id = parseInt(String(item.msg_id).split("_").pop(), 10);
    return id === message.id;
  });
  if (!variant) return "";
  const token = variant.tokens?.[Math.max((proofVariant || 0) - 1, 0)] || variant.tokens?.[0];
  if (!token) return "";
  if (arm === 1) return token.text_core || token.text_by_persona?.[segmentCode] || "";
  return token.text_by_persona?.[segmentCode] || token.text_core || "";
}

function coreWordingFor(message, proofVariant) {
  const variant = (dashboard.variants?.messages || []).find((item) => {
    const id = parseInt(String(item.msg_id).split("_").pop(), 10);
    return id === message.id;
  });
  if (!variant) return "";
  const token = variant.tokens?.[Math.max((proofVariant || 0) - 1, 0)] || variant.tokens?.[0];
  return token?.text_core || "";
}

function proofTextFor(message, proofVariant) {
  if (!proofVariant) return "";
  const proof = (message?.proofs || []).find((item) => item.proof_id === proofVariant);
  return String(proof?.full_label || "").replace(/^Token\s+\d+:\s*/i, "").trim();
}

function tokenizeText(text) {
  return String(text || "").match(/\w+|[^\w\s]+|\s+/g) || [];
}

function tokenDiffRanges(coreText, variantText) {
  const safeVariant = String(variantText || "");
  if (!safeVariant) return [];
  const coreTokens = tokenizeText(coreText);
  const variantTokens = tokenizeText(safeVariant);
  const m = coreTokens.length;
  const n = variantTokens.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      dp[i][j] = coreTokens[i] === variantTokens[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const matchedVariantIndexes = new Set();
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (coreTokens[i] === variantTokens[j]) {
      matchedVariantIndexes.add(j);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }

  const ranges = [];
  let cursor = 0;
  variantTokens.forEach((token, index) => {
    const nextCursor = cursor + token.length;
    const isWhitespace = /^\s+$/.test(token);
    if (!isWhitespace && !matchedVariantIndexes.has(index)) {
      ranges.push([cursor, nextCursor]);
    }
    cursor = nextCursor;
  });

  return ranges;
}

function renderQuoteWithDiff(
  coreText,
  variantText,
  hasProof = false,
  isPersonaTuned = false,
  proofBaseText = "",
  personaBaseText = ""
) {
  const safeVariant = String(variantText || "");
  if (!safeVariant) return "";

  const ranges = [];
  if (hasProof) {
    const proofBase = String(proofBaseText || "");
    ranges.push(...tokenDiffRanges(proofBase, safeVariant));
  }

  if (isPersonaTuned) {
    const personaBase = String(personaBaseText || coreText || "");
    ranges.push(...tokenDiffRanges(personaBase, safeVariant));
  }

  if (!ranges.length) return safeVariant;

  const merged = ranges
    .sort((a, b) => a[0] - b[0])
    .reduce((acc, range) => {
      const last = acc[acc.length - 1];
      if (!last || range[0] > last[1]) {
        acc.push([...range]);
      } else {
        last[1] = Math.max(last[1], range[1]);
      }
      return acc;
    }, []);

  const pieces = [];
  let cursor = 0;
  merged.forEach(([start, end], index) => {
    if (start > cursor) pieces.push(<span key={`plain-${index}`}>{safeVariant.slice(cursor, start)}</span>);
    pieces.push(
      <span key={`bold-${index}`} style={{ fontWeight: 800, color: C.white }}>
        {safeVariant.slice(start, end)}
      </span>
    );
    cursor = end;
  });
  if (cursor < safeVariant.length) pieces.push(<span key="plain-end">{safeVariant.slice(cursor)}</span>);
  return pieces;
}

function pickLeadMessage(segmentCode) {
  const toplines = (dashboard.message_topline || [])
    .map((entry) => {
      const segmentData = entry.by_segment?.[segmentCode];
      if (!segmentData) return null;
      const message = DASHBOARD_MESSAGES.find((item) => item.id === entry.message);
      if (!message) return null;
      return {
        id: entry.message,
        label: message.theme_label,
        quote: coreWordingFor(message, 0),
        coreQuote: coreWordingFor(message, 0),
        proof: 0,
        proofText: "",
        proofBaseText: "",
        personaBaseText: coreWordingFor(message, 0),
        isPersonaTuned: false,
        utility: segmentData.utility_signed,
        sop: segmentData.sop_pct,
      };
    })
    .filter(Boolean);

  if (!toplines.length) return null;

  const sopValues = toplines
    .map((item) => item.sop)
    .filter((value) => value != null)
    .sort((a, b) => a - b);
  const sopMedian = sopValues[Math.floor(sopValues.length / 2)] ?? 0;
  const leadMin = SEGMENT_SUMMARY_RULES.lead_util_min ?? 0.03;
  const leadGateSop = SEGMENT_SUMMARY_RULES.lead_require_sop_above_median !== false;

  const pool = toplines
    .filter(
      (item) =>
        item.utility != null &&
        item.utility >= leadMin &&
        (!leadGateSop || item.sop >= sopMedian)
    )
    .sort((a, b) => b.utility - a.utility);

  return pool[0] || toplines
    .slice()
    .sort((a, b) => (b.utility ?? -Infinity) - (a.utility ?? -Infinity))[0];
}

function pickAvoidMessage(segmentCode) {
  const toplines = (dashboard.message_topline || [])
    .map((entry) => {
      const segmentData = entry.by_segment?.[segmentCode];
      const message = DASHBOARD_MESSAGES.find((item) => item.id === entry.message);
      if (!segmentData || !message) return null;
      return {
        id: entry.message,
        label: message.theme_label,
        utility: segmentData.utility_signed,
      };
    })
    .filter(Boolean);

  return toplines
    .filter((item) => item.utility != null && item.utility <= -0.05)
    .sort((a, b) => a.utility - b.utility)[0] || null;
}

function pickTopMessageCells(metric, segmentId, segmentCode, excludeMessageIds = new Set(), limit = 3) {
  const cells = (dashboard.message_map_cells?.[metric] || []).filter(
    (cell) =>
      cell.segment === segmentId &&
      cell.lift_shrunk != null &&
      cell.lift_shrunk > 0 &&
      !excludeMessageIds.has(cell.message)
  );
  const bestByMessage = new Map();

  for (const cell of cells) {
    const existing = bestByMessage.get(cell.message);
    if (!existing || cell.lift_shrunk > existing.lift_shrunk) {
      bestByMessage.set(cell.message, cell);
    }
  }

  return [...bestByMessage.values()]
    .map((cell) => {
      const message = DASHBOARD_MESSAGES.find((item) => item.id === cell.message);
      return {
        ...cell,
        sourceMetric: metric,
        message,
        label: message?.theme_label || "Unknown message",
        quote: message ? wordingFor(message, cell.proof, cell.arm, segmentCode) : "",
        coreQuote: message ? coreWordingFor(message, cell.proof) : "",
        proofText: message ? proofTextFor(message, cell.proof) : "",
        proofBaseText: message ? wordingFor(message, 0, cell.arm, segmentCode) : "",
        personaBaseText: message ? coreWordingFor(message, cell.proof) : "",
        isPersonaTuned: !!(message && cell.arm === 2),
        significant: cell.ci_low > 0,
      };
    })
    .sort((a, b) => b.lift_shrunk - a.lift_shrunk)
    .slice(0, limit);
}

function formatSignedDelta(value) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

function buildSegmentSummary(segment, metrics, guidanceMessages) {
  if (!segment || !metrics) return "";

  const roi = metrics.roi ?? 0;
  const persuadable = metrics.persuadable ?? 0;
  const supporters = metrics.supporters ?? 0;
  const pre1 = metrics.prePost?.item1 || [0, 0];
  const pre5 = metrics.prePost?.item5 || [0, 0];
  const delta1 = pre1[1] - pre1[0];
  const delta5 = pre5[1] - pre5[0];
  const labels = guidanceMessages.map((item) => item.message?.label).filter(Boolean);
  const labelPhrase = labels.length ? labels.slice(0, 3).join(", ") : "the current message mix";

  const intro = `${segment.code} shows ROI ${roi.toFixed(2)} with ${persuadable}% persuadable and ${supporters}% already in the mobilize lane. The strongest key-finding movement is ${formatSignedDelta(delta1)} on HIV priority and ${formatSignedDelta(delta5)} on program support, so the guidance leans on `;
  return { intro, labelPhrase };
}

function renderGuidancePhrase(text) {
  return String(text || "")
    .split(/(\b[A-Z]{2,}\b)/g)
    .filter(Boolean)
    .map((part, index) =>
      /\b[A-Z]{2,}\b/.test(part) ? (
        <strong key={index} style={{ fontWeight: 800, color: C.white }}>
          {part}
        </strong>
      ) : (
        <span key={index}>{part}</span>
      )
    );
}

function segmentColor(segment) {
  return segment.party === "GOP" ? C.partyGOP : C.partyDEM;
}

function PieChart({
  label,
  value,
  subLabel,
  size = 72,
  valueColor = C.white,
  fillColor = PERSUADE,
  remainderColor = TRACK,
}) {
  const numericValue = typeof value === "number" ? value : parseInt(String(value), 10);
  const chartValue = Number.isFinite(numericValue) ? Math.max(0, Math.min(100, numericValue)) : 0;
  const strokeW = Math.max(7, Math.round(size * 0.12));
  const radius = (size - strokeW) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - chartValue / 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={remainderColor}
            strokeWidth={strokeW}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={fillColor}
            strokeWidth={strokeW}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.6s" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <div>
            <div style={{ fontFamily: FONT, fontSize: size < 60 ? 15 : 18, fontWeight: 800, color: valueColor, lineHeight: 1 }}>
              {value}
            </div>
            {subLabel ? (
              <div style={{ marginTop: 2, fontSize: 8, color: C.textDim, fontFamily: FONT, lineHeight: 1.2 }}>
                {subLabel}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 6, textAlign: "center" }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: C.cyan, fontFamily: FONT }}>{label}</div>
        {subLabel ? (
          <div style={{ fontSize: 7, color: C.textDim, fontFamily: FONT, marginTop: 1 }}>{subLabel}</div>
        ) : null}
      </div>
    </div>
  );
}

function Placeholder({ children, size = 18, align = "left", italic = false }) {
  return (
    <div
      style={{
        minHeight: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: align === "center" ? "center" : "flex-start",
        color: C.text,
        fontSize: size,
        fontWeight: 500,
        lineHeight: 1.45,
        fontStyle: italic ? "italic" : "normal",
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2
      style={{
        margin: 0,
        color: C.textMuted,
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 1.7,
        textTransform: "uppercase",
        fontFamily: MONO,
      }}
    >
      {children}
    </h2>
  );
}

function FindingSlot({ children }) {
  return (
    <div
      style={{
        minHeight: 132,
        display: "flex",
        alignItems: "flex-start",
        padding: "18px 20px",
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 6,
        background: PANEL_DEEP,
      }}
    >
      <Placeholder size={16}>{children}</Placeholder>
    </div>
  );
}

function MessageSlot({ children }) {
  return (
    <div
      style={{
        minHeight: 76,
        display: "flex",
        alignItems: "stretch",
        padding: "12px 14px",
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 6,
        background: PANEL_DEEP,
        width: "100%",
      }}
    >
      {children}
    </div>
  );
}

function PrePostFinding({ title, metricLabel, pair }) {
  if (!pair) {
    return <FindingSlot>[{title}]</FindingSlot>;
  }

  const metric = PREPOST_BY_KEY[title];
  const question = metric?.question;
  const [pre, post] = pair;
  const delta = +(post - pre).toFixed(1);
  const deltaColor = delta > 0 ? C.green : delta < 0 ? C.red : C.textMuted;

  return (
    <div
      style={{
        minHeight: 132,
        display: "grid",
        gridTemplateRows: "auto minmax(96px, 1fr) auto",
        alignItems: "start",
        padding: "18px 20px",
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 6,
        background: PANEL_DEEP,
        gap: 10,
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, color: C.textMuted, letterSpacing: 0.8, textTransform: "uppercase" }}>
        {metric?.label || title}
      </div>
      {question ? (
        <div style={{ marginTop: 8, fontSize: 13, color: C.text, lineHeight: 1.45 }}>
          {question}
        </div>
      ) : null}
      <div style={{ display: "grid", justifyItems: "center", gap: 6, marginTop: 2 }}>
        <span style={{ fontFamily: MONO, fontSize: 17, color: deltaColor, fontWeight: 800 }}>
          {delta > 0 ? "+" : ""}
          {delta}
        </span>
        <div style={{ display: "grid", justifyItems: "center", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: MONO, fontSize: 13, color: C.text }}>{pre.toFixed(1)}</span>
            <span style={{ fontFamily: MONO, fontSize: 12, color: C.textDim }}>→</span>
            <span style={{ fontFamily: MONO, fontSize: 13, color: C.white, fontWeight: 400 }}>{post.toFixed(1)}</span>
          </div>
          {metricLabel ? (
            <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: 0.4 }}>
              ({metricLabel})
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function scfLabel(value) {
  if (value > 0.5) return "Sanctity-leaning";
  if (value > -0.5) return "Balanced";
  return "Compassion-leaning";
}

function ScfFinding({ score, rank, focalCode, party }) {
  if (score == null) {
    return <FindingSlot>[Dynamic Field #1]</FindingSlot>;
  }

  const W = 210;
  const H = 280;
  const cx = W / 2;
  const yTop = 30;
  const yBot = H - 30;
  const yMin = -2.0;
  const yMax = 1.0;
  const yScale = (value) => yTop + ((yMax - value) / (yMax - yMin)) * (yBot - yTop);
  const yFocal = yScale(score);
  const benchKey = party === "GOP" ? "Republicans" : "Democrats";
  const benchSCF = bench[benchKey]?.SCF?.raw ?? 0;
  const delta = score - benchSCF;
  const benchValues = {
    R: bench.Republicans.SCF.raw,
    D: bench.Democrats.SCF.raw,
    US: bench.All.SCF.raw,
  };

  return (
    <div
      style={{
        minHeight: 132,
        display: "grid",
        padding: "18px 20px",
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 6,
        background: PANEL_DEEP,
        gap: 10,
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, color: C.textMuted, letterSpacing: 0.8, textTransform: "uppercase" }}>
        SCF
      </div>
      <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0", width: "100%" }}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
            <defs>
              <linearGradient id="exec-scfgrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#DC4040" stopOpacity="0.85" />
                <stop offset="50%" stopColor="#8B98A8" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#6FA0E8" stopOpacity="0.85" />
              </linearGradient>
            </defs>
            <rect x={cx - 6} y={yTop} width="12" height={yBot - yTop} fill="url(#exec-scfgrad)" rx="6" ry="6" />
            <text x={cx} y={yTop - 12} textAnchor="middle" fontSize="10" fontWeight="700" fill="#DC4040" letterSpacing="1.2" fontFamily="Inter">
              SANCTITY
            </text>
            <text x={cx} y={yBot + 18} textAnchor="middle" fontSize="10" fontWeight="700" fill="#6FA0E8" letterSpacing="1.2" fontFamily="Inter">
              COMPASSION
            </text>
            {Object.entries(benchValues).map(([type, value]) => {
              const y = yScale(value);
              const active = BENCH_GLYPH[benchKey] === type;
              return (
                <g key={type}>
                  <line
                    x1={cx + 8}
                    x2={cx + 31}
                    y1={y}
                    y2={y}
                    stroke="#CBD5E1"
                    strokeWidth="1.8"
                    opacity={0.95}
                  />
                  <circle cx={cx + 44} cy={y} r="13" fill="#111827" stroke="#E8EAED" strokeWidth="1.8" />
                  <text x={cx + 44} y={y + 4} textAnchor="middle" fontSize="10" fontWeight="800" fill="#E8EAED" fontFamily="Inter">
                    {type}
                  </text>
                  <text x={cx + 66} y={y + 4} fontSize="11" fontWeight="700" fill="#E8EAED" fontFamily="Inter">
                    {value.toFixed(2)}
                  </text>
                </g>
              );
            })}
            <line
              x1={cx - 7}
              x2={cx - 47}
              y1={yFocal}
              y2={yFocal}
              stroke="#2FE079"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="1"
            />
            <circle cx={cx - 32} cy={yFocal} r="14" fill="#2FE079" stroke="#fff" strokeWidth="2.5" />
            <text x={cx - 32} y={yFocal + 4.5} textAnchor="middle" fontSize="11" fontWeight="800" fill="#06241A" fontFamily="Inter">
              {focalCode}
            </text>
            <text x={cx - 32} y={yFocal + 30} textAnchor="middle" fontSize="11" fontWeight="700" fill="#E8EAED" fontFamily="Inter">
              {score.toFixed(2)}
            </text>
          </svg>
        </div>
        <div
          style={{
            marginTop: 8,
            padding: "10px 12px",
            background: "rgba(111,160,232,0.08)",
            borderLeft: "2px solid #6FA0E8",  
                                borderRadius: "0 4px 4px 0",
            fontSize: 11,
            lineHeight: 1.5,
            color: C.textMuted,
            width: "100%",
          }}
        >
          <span style={{ fontSize: 21, fontWeight: 800, color: "#6FA0E8", letterSpacing: "-0.01em", fontFamily: FONT }}>
            {(score >= 0 ? "+" : "") + score.toFixed(2)}
          </span>
          <span style={{ display: "inline-block", marginLeft: 8 }}>
            <strong style={{ color: C.white, fontWeight: 600 }}>{scfLabel(score)}</strong>
            <span style={{ color: C.textDim }}>
              {` · rank ${rank} of 16 · ${delta > 0 ? "+" : ""}${delta.toFixed(2)} vs ${BENCH_GLYPH[benchKey]}`}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function HksFinding({ score, rank, party }) {
  if (score == null) {
    return <FindingSlot>[Dynamic Field #2]</FindingSlot>;
  }

  const benchKey = party === "GOP" ? "Republicans" : "Democrats";
  const benchHKS = bench[benchKey]?.HKS ?? 0;
  const fillPct = (score / 10) * 100;
  const benchPct = (benchHKS / 10) * 100;
  const visibleFillPct = fillPct;
  const benchFill = benchKey === "Republicans" ? "#DC4040" : benchKey === "Democrats" ? "#4A82E0" : "#07090F";
  const benchStroke = benchKey === "All" ? "#E8EAED" : "#fff";
  const benchTextFill = benchKey === "All" ? "#E8EAED" : "#fff";
  const benchFontSize = benchKey === "All" ? 7 : 8;

  return (
    <div
      style={{
        minHeight: 132,
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        alignItems: "start",
        padding: "18px 20px",
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 6,
        background: PANEL_DEEP,
        gap: 10,
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, color: C.textMuted, letterSpacing: 0.8, textTransform: "uppercase" }}>
        HKS
      </div>
      <div style={{ display: "grid", gap: 14, justifyItems: "center", alignContent: "center", paddingTop: 100 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8, flexWrap: "wrap", width: "100%" }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: C.white, fontFamily: FONT, lineHeight: 1 }}>{score.toFixed(1)}</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: C.textMuted, fontFamily: FONT }}>/ 10</span>
        </div>
        <div style={{ position: "relative", paddingBottom: 16, width: "100%", maxWidth: 220 }}> 
                      <div style={{ height: 10, borderRadius: 999, background: "#1f2937", border: `1px solid ${C.cardBorder}` }} />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: 10,
              width: `${visibleFillPct}%`,
              borderRadius: 999,
              background: "#6FA0E8",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `${fillPct}%`,
              top: -6,
              transform: "translateX(-50%)",
            }}
          >
            <svg width="22" height="22" viewBox="-11 -11 22 22">
              <circle cx="0" cy="0" r="9" fill={benchFill} stroke={benchStroke} strokeWidth="1.5" />
              <text x="0" y="3" textAnchor="middle" fontSize={benchFontSize} fontWeight="800" fill={benchTextFill} fontFamily="Inter">
                {BENCH_GLYPH[benchKey]}
              </text>
            </svg>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, color: C.textDim, fontFamily: MONO }}>
            <span>0</span>
            <span>5</span>
            <span>10</span>
          </div>
        </div>
      </div>
      <div
        style={{
          padding: "10px 12px",
          background: "rgba(111,160,232,0.08)",
          borderLeft: "2px solid #6FA0E8",
          borderRadius: "0 4px 4px 0",
          fontSize: 11,
          lineHeight: 1.5,
          color: C.textMuted,
          width: "100%",
        }}
      >
        <span style={{ fontSize: 21, fontWeight: 800, color: "#6FA0E8", letterSpacing: "-0.01em", fontFamily: FONT }}>
          {score.toFixed(1)}
        </span>
        <span style={{ display: "inline-block", marginLeft: 8 }}>
          <strong style={{ color: C.white, fontWeight: 600 }}>HIV Knowledge</strong>
          <span style={{ color: C.textDim }}>
            {` · rank ${rank} of 16`}
          </span>
        </span>
      </div>
    </div>
  );
}
 
              export default function ExecutiveSummary() {
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
  const [activeCode, setActiveCode] = useState(SEGMENTS[0]?.code);
  const [tierFilter, setTierFilter] = useState("all");
  const [canvasScale, setCanvasScale] = useState(1);
  const [canvasHeight, setCanvasHeight] = useState(0);

  useEffect(() => {
    const updateLayout = () => {
      const viewport = viewportRef.current;
      const canvas = canvasRef.current;
      if (!viewport || !canvas) return;
      const nextScale = Math.min(1, viewport.clientWidth / EXEC_SUMMARY_WIDTH);
      setCanvasScale(nextScale);
      setCanvasHeight(canvas.scrollHeight * nextScale);
    };

    updateLayout();

    const resizeObserver = new ResizeObserver(() => updateLayout());
    if (viewportRef.current) resizeObserver.observe(viewportRef.current);
    if (canvasRef.current) resizeObserver.observe(canvasRef.current);
    window.addEventListener("resize", updateLayout);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateLayout);
    };
  }, [activeCode, tierFilter]);

  const filteredSegments = SEGMENTS.filter((segment) => {
    if (tierFilter === "all") return true;
    return STUDY_METRICS[segment.code]?.tier === Number(tierFilter);
  });
  const visibleSegments = filteredSegments.length ? filteredSegments : SEGMENTS;
  const activeSegment = visibleSegments.find((segment) => segment.code === activeCode) || visibleSegments[0];
  const activeDashboardSegment = DASHBOARD_SEGMENTS.find((segment) => segment.code === activeSegment.code);
  const activeMetrics = STUDY_METRICS[activeSegment.code];
  const activeScf = SCF_BY_CODE[activeSegment.code];
  const engagementCategory = activeScf > -0.25 ? "PERSUADE" : "MOBILIZE";
  const engagementColor = engagementCategory === "PERSUADE" ? C.cyan : C.violet;
  const accent = segmentColor(activeSegment);
  const maleShare = parseInt(activeSegment.demo.male, 10) || 50;
  const nonwhiteShare = parseInt(activeSegment.demo.nonwhite, 10) || 0;
  const whiteShare = 100 - nonwhiteShare;
  const preferredMessage = pickLeadMessage(activeSegment.code);
  const avoidMessage = pickAvoidMessage(activeSegment.code);
  const excludedMessageIds = new Set(avoidMessage?.id != null ? [avoidMessage.id] : []);
  const persuadeMessages = activeDashboardSegment
    ? pickTopMessageCells("persuasion_messaging", activeDashboardSegment.id, activeSegment.code, excludedMessageIds)
    : [];
  const mobilizeMessages = activeDashboardSegment
    ? pickTopMessageCells("base_messaging", activeDashboardSegment.id, activeSegment.code, excludedMessageIds)
    : [];
  const significantPersuadeMessages = persuadeMessages.filter((message) => message.significant);
  const significantReinforceMessages = mobilizeMessages.filter((message) => message.significant);

  const showTwoPersuadeMessages = engagementCategory === "PERSUADE" && significantPersuadeMessages.length >= 2;
  const showTwoReinforceMessages = engagementCategory === "MOBILIZE" && significantReinforceMessages.length >= 2;
  const topPersuadeMessage = persuadeMessages.find((message) => message.sourceMetric === "persuasion_messaging") || null;
  const topReinforceMessage = mobilizeMessages.find((message) => message.sourceMetric === "base_messaging") || null;

  const guidanceMessages = showTwoPersuadeMessages
    ? [
        { title: "Start With Message", message: preferredMessage },
        { title: "Top Persuade Message", message: significantPersuadeMessages[0] },
        { title: "Second Persuade Message", message: significantPersuadeMessages[1] },
      ]
    : showTwoReinforceMessages
      ? [
          { title: "Start With Message", message: preferredMessage },
          { title: "Top Mobilize Message", message: significantReinforceMessages[0] },
          { title: "Second Mobilize Message", message: significantReinforceMessages[1] },
        ]
      : [
          { title: "Start With Message", message: preferredMessage },
          { title: "Top Persuade Message", message: topPersuadeMessage },
          { title: "Top Mobilize Message", message: topReinforceMessage },
        ];
  const segmentSummary = buildSegmentSummary(activeSegment, activeMetrics, guidanceMessages);

  return (
    <div style={{ fontFamily: FONT, color: C.text }}>
      <PageHeader title="Executive Summary" accentColor={C.cyan} />

      <div
        ref={viewportRef}
        style={{
          width: "100%",
          maxWidth: EXEC_SUMMARY_WIDTH,
          margin: "0 auto",
          height: canvasHeight || "auto",
        }}
      >
        <section
          ref={canvasRef}
          style={{
            width: EXEC_SUMMARY_WIDTH,
            padding: 28,
            background: C.card,
            border: `1px solid ${C.cardBorder}`,
            borderRadius: 8,
            overflow: "hidden",
            transform: `scale(${canvasScale})`,
            transformOrigin: "top left",
          }}
        >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "124px minmax(0, 1fr) 270px",
            gap: 18,
            alignItems: "start",
          }}
        >
          <aside
            style={{
              width: 124,
              display: "grid",
              gap: 4,
              padding: "8px",
              border: `1px solid ${C.cardBorder}`,
              borderRadius: 6,
              background: PANEL_DEEP,
            }}
          >
            <div
              style={{
                fontFamily: MONO,
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: C.white,
                padding: "2px 6px 6px",
              }}
            >
              Segments
            </div>
            <div style={{ padding: "0 6px 8px" }}>
              <select
                value={tierFilter}
                onChange={(event) => setTierFilter(event.target.value)}
                style={{
                  width: "100%",
                  background: PANEL,
                  color: C.text,
                  border: `1px solid ${C.cardBorder}`,
                  borderRadius: 4,
                  padding: "7px 8px",
                  fontFamily: MONO,
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                <option value="all">All Tiers</option>
                <option value="1">Tier 1</option>
                <option value="2">Tier 2</option>
                <option value="3">Tier 3</option>
              </select>
            </div>
            {visibleSegments.map((segment) => {
              const selected = segment.code === activeSegment.code;
              const color = segmentColor(segment);
              const tier = STUDY_METRICS[segment.code]?.tier;
              return (
                <button
                  key={segment.code}
                  type="button"
                  onClick={() => setActiveCode(segment.code)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "34px 1fr",
                    alignItems: "center",
                    gap: 7,
                    width: "100%",
                    padding: "7px 8px",
                    borderRadius: 4,
                    border: `1px solid ${selected ? color : "transparent"}`,
                    background: selected ? `${color}18` : "transparent",
                    color: selected ? C.white : C.textMuted,
                    cursor: "pointer",
                    fontFamily: FONT,
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 10,
                      fontWeight: 800,
                      color,
                    }}
                  >
                    {segment.code}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: 10,
                        fontWeight: selected ? 700 : 500,
                      }}
                    >
                      {segment.name}
                    </span>
                    <span
                      style={{
                        display: "block",
                        marginTop: 2,
                        fontFamily: MONO,
                        fontSize: 8,
                        color: C.textDim,
                        letterSpacing: 0.6,
                        textTransform: "uppercase",
                      }}
                    >
                      Tier {tier}
                    </span>
                  </span>
                </button>
              );
            })}
          </aside>

          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
              <div
                style={{
                  width: 86,
                  height: 86,
                  borderRadius: "50%",
                  background: PANEL_DEEP,
                  border: `2px solid ${accent}`,
                  display: "grid",
                  placeItems: "center",
                                  color: C.white,
                  fontFamily: MONO,
                  fontSize: 18,
                  fontWeight: 800,
                  lineHeight: 1.35,
                  textAlign: "center",
                  flex: "0 0 auto",
                  boxShadow: `0 0 0 8px ${accent}18`,
                  zIndex: 1,
                }}
              >
                <span>{activeSegment.code}</span>
              </div>
              <div
                style={{
                  minHeight: 88,
                  flex: "1 1 auto",
                  marginLeft: -2,
                  background: PANEL_DEEP,
                  border: `1px solid ${C.cardBorder}`,
                  borderLeft: `3px solid ${accent}`,
                  display: "grid",
                  placeItems: "center",
                  padding: "14px 20px",
                  color: C.white,
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0 }}>{activeSegment.name}</div>
                  <div style={{ marginTop: 8, fontSize: 14, fontWeight: 600, fontStyle: "italic", color: C.textMuted }}>
                    "{activeSegment.persona.quote}"
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
              <SectionTitle>Short Summary</SectionTitle>
              <div
                style={{
                  width: "100%",
                  color: C.text,
                  fontSize: 13,
                  lineHeight: 1.55,
                  fontWeight: 500,
                  padding: "12px 14px",
                  border: `1px solid ${C.cardBorder}`,
                  borderRadius: 6,
                  background: PANEL_DEEP,
                }}
              >
                {segmentSummary.intro}
                {renderGuidancePhrase(segmentSummary.labelPhrase)}
                .
              </div>
            </div>

            <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "420px 260px minmax(0, 1fr)",
                  gap: 16,
                  alignItems: "stretch",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateRows: "auto 1fr",
                    gap: 10,
                  }}
                >
                  <SectionTitle>About</SectionTitle>
                  <div style={{ minHeight: 190, padding: "16px 18px", border: `1px solid ${C.cardBorder}`, borderRadius: 6, background: PANEL_DEEP }}>
                    <Placeholder size={14} italic>{activeSegment.persona.believe}</Placeholder>
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateRows: "auto 1fr",
                    gap: 10,
                  }}
                >
                  <SectionTitle>Demographics</SectionTitle>
                  <div
                    style={{
                      minHeight: 190,
                      padding: "16px 18px",
                      border: `1px solid ${C.cardBorder}`,
                      borderRadius: 6,
                      background: PANEL_DEEP,
                      display: "grid",
                      alignContent: "center",
                    }}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, justifyItems: "center", alignContent: "center" }}>
                      <PieChart
                        label="Male"
                        value={`${maleShare}%`}
                        size={70}
                        valueColor={C.white}
                        fillColor={PERSUADE}
                        remainderColor={TRACK}
                      />
                      <PieChart
                        label="White"
                        value={`${whiteShare}%`}
                        size={70}
                        valueColor={C.white}
                        fillColor={PERSUADE}
                        remainderColor={TRACK}
                      />
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    minHeight: 168,
                    padding: "12px 14px",
                    borderRadius: 6,
                    border: `1px solid ${C.cardBorder}`,
                    background: PANEL_DEEP,
                  }}
                >
                  <CensusDivisionMap division={activeSegment.demo.cenDiv} pct={activeSegment.demo.cenPct} party={activeSegment.party} maxHeight={220} />
                  <div
                    style={{
                      marginTop: 10,
                      paddingTop: 8,
                      borderTop: `1px solid ${C.cardBorder}`,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 800, color: C.white, minWidth: 44, textAlign: "center" }}>
                      {activeSegment.demo.rural}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: 0.8 }}>
                        Rural
                      </div>
                      <div style={{ fontSize: 8, color: C.textDim, lineHeight: 1.25 }}>
                        Share residing in rural areas
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
              <SectionTitle>Key Findings</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 18 }}>
                <PrePostFinding title="item1" metricLabel="QPRE_1r1 / QPOST_1r1" pair={activeMetrics?.prePost?.item1} />
                <PrePostFinding title="item5" metricLabel="QPRE_5 / QPOST_5" pair={activeMetrics?.prePost?.item5} />
                <ScfFinding score={activeScf} rank={SCF_RANK_BY_CODE[activeSegment.code]} focalCode={activeSegment.code} party={activeSegment.party} />
                <HksFinding score={HKS_BY_CODE[activeSegment.code]} rank={HKS_RANK_BY_CODE[activeSegment.code]} party={activeSegment.party} />
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <SectionTitle>Messaging Guidance</SectionTitle>
                <Link
                  to={`/messages?segment=${activeSegment.code}`}
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.6,
                    color: C.cyan,
                    textDecoration: "none",
                    textTransform: "uppercase",
                  }}
                >
                  View Message Map Board
                </Link>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                {guidanceMessages.map((item) => (
                  <MessageSlot key={item.title}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: 0.8, textTransform: "uppercase" }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted }}>{item.message?.label || "No message available"}</div>
                      <div style={{ fontSize: 14, lineHeight: 1.5, color: C.white, fontStyle: "italic" }}>
                        {item.message?.quote
                          ? <>"{renderQuoteWithDiff(
                              item.message.coreQuote,
                              item.message.quote,
                              (item.message.proof ?? 0) > 0,
                              item.message.isPersonaTuned,
                              item.message.proofBaseText,
                              item.message.personaBaseText
                            )}"</>
                          : "No message available"}
                      </div>
                    </div>
                  </MessageSlot>
                ))}
              </div>
            </div>
          </div>

          <aside
            style={{
              width: 270,
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 18,
              padding: "12px 14px",
              border: `1px solid ${C.cardBorder}`,
              borderRadius: 6,
              background: PANEL_DEEP,
              alignItems: "start",
            }}
          >
            <div>
              <div style={{ color: C.textMuted, fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>ROI</div>
              <div style={{ color: C.green, fontFamily: MONO, fontSize: 28, fontWeight: 800 }}>
                {activeMetrics?.roi != null ? activeMetrics.roi.toFixed(2) : "X.XX"}
              </div>
            </div>

            <div>
              <div style={{ color: C.textMuted, fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Engagement Category</div>
              <div style={{ fontSize: 14, fontWeight: 900, fontFamily: MONO, marginBottom: 18 }}>
                <span style={{ color: engagementColor }}>[{engagementCategory}]</span>
              </div>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 12,
                  alignItems: "start",
                }}
              >
                <PieChart label="Persuadable" value={activeMetrics?.persuadable != null ? `${activeMetrics.persuadable}%` : "--"} size={58} fillColor={PERSUADE} />
                <PieChart label="Supporters" value={activeMetrics?.supporters != null ? `${activeMetrics.supporters}%` : "--"} size={58} fillColor={SUPPORT} />
                <PieChart label="Activation" value={activeMetrics?.activation != null ? `${activeMetrics.activation}%` : "--"} size={58} fillColor={ACTIVATE} />
                <PieChart label="Influence360" value={activeMetrics?.influence != null ? `${activeMetrics.influence}%` : "--"} size={58} fillColor={INFLUENCE} />
              </div>
            </div>
          </aside>
        </div>
      </section>
      </div>
    </div>
  );
}
