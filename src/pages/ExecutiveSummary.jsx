import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import ItemSurveyPane from "../components/Topline/components/ItemSurveyPane";
import "../components/Topline/Topline.css";
import "../components/Topline/Topline.addendum.css";
import { C, FONT, MONO } from "../data/theme";
import { PREPOST_METRICS, STUDY_METRICS } from "../data/study";
import dashboard from "../data/topline/dashboard.json";
import { SEGMENTS } from "./SegmentProfile";

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
const DEFAULT_MESSAGE_BASKET = dashboard.ui?.default_basket || "priority_d";
const MESSAGE_TOTALS_BY_ID = new Map(
  ((dashboard.sop_simple?.[DEFAULT_MESSAGE_BASKET]?.messages) || []).map((row) => [row.message, row.mean_bw])
);
const PREPOST_TOPLINE_IDS = {
  item1: "PP1",
  item2: "PP2",
  item3: "PP3",
  item4: "PP4",
  item5: "PP5",
  item6: "PP6",
  item7: "PP7",
};
const PREPOST_SURVEY_BY_KEY = Object.fromEntries(
  (dashboard.pre_post || [])
    .map((item) => {
      const key = Object.entries(PREPOST_TOPLINE_IDS).find(([, id]) => id === item.id)?.[0];
      return key ? [key, item.survey] : null;
    })
    .filter(Boolean)
);
const DEFAULT_EXECUTIVE_PREPOST_ITEMS = ["item1", "item6", "item7"];
const DEFAULT_SEGMENT_PREPOST_ITEMS = ["item1", "item6"];
const EXECUTIVE_SURVEY_CAPTURE_HEIGHT = 372;
const SEGMENT_SUMMARY_RULES = dashboard.ui?.segment_summary?.rules || {};
const SCF_COMPOSITE = (dashboard.stigma_extras?.composites?.items || []).find((item) => item.code === "SCF");
const EXECUTIVE_KEY_OUTCOMES =
  "Increased urgency around HIV and policy support for access to HIV prevention/treatment.";
const OVERARCHING_MESSAGES = [
  {
    id: "vigilance",
    messageId: 5,
    eyebrow: "Vigilance",
    message: "HIV can be treated, but for most patients it requires medication every day for life. If treatment is interrupted - because someone loses access, loses insurance, or simply cannot maintain a daily regimen - the virus can develop resistance, become harder to treat, and be passed to others. The progress made is real, but it requires constant vigilance to maintain.",
    detail:
      "Centers the fragility of HIV gains: treatment works, but only when access and adherence hold. It makes the case that prevention of interruption is part of prevention itself.",
    toplineNarrative: "But continued progress requires constant vigilance. If treatment is interrupted patients are at greater risk and virus can be passed on.",
  },
  {
    id: "finish-line",
    messageId: 10,
    eyebrow: "Finish Line",
    message: "A generation ago, an HIV diagnosis was a death sentence. Today, transmission can be stopped, the epidemic is controllable, and a cure is in active development. This could be the generation that ends HIV - the way previous generations ended polio and smallpox.",
    detail:
      "Frames HIV progress as a historic public-health finish line: scientific gains are real, the tools exist, and this generation has a plausible chance to be the one that finally ends the epidemic.",
    toplineNarrative: "HIV is no longer a death sentence: transmission can be stopped, prevention meds work, and a cure is within reach.",
  },
  {
    id: "barriers",
    messageId: 9,
    eyebrow: "Barriers",
    message: "Effective HIV prevention medication exists. Millions of Americans who need it don't have it even if their doctor prescribes it - because of coverage restrictions, cost barriers, and gaps in the healthcare system that could be closed if we treated this as the public health priority it is.",
    detail:
      "Focuses attention on solvable system failures. The obstacle is not whether prevention exists, but whether people can actually get it consistently and affordably.",
    toplineNarrative: "Millions who need prevention medicines can't access them. We have the tools to prevent HIV that can keep us moving forward.",
  },
  {
    id: "innovation-spillover",
    messageId: 11,
    eyebrow: "Innovation Spillover",
    message: "American investment in HIV research produced scientific discoveries that now extend far beyond HIV - advances in how we understand the immune system, develop antiviral treatments, and fight cancer that benefit millions of Americans who have never been affected by HIV.",
    detail:
      "Broadens the value proposition of HIV investment by showing how HIV science has paid dividends across medicine, from immune-system research to antivirals and cancer treatment.",
    toplineNarrative: "Because of America's innovation leadership and investment in HIV research, new discoveries are made that are helping patients who have never been affected by HIV.",
  },
];
const SCF_BY_CODE = Object.fromEntries(
  Object.entries(SCF_COMPOSITE?.cuts || {})
    .filter(([code]) => code !== "TOTAL")
    .map(([code, value]) => [code, value.val])
);
function wordingFor(message, proofVariant, arm, segmentCode) {
  const variant = (dashboard.variants?.messages || []).find((item) => {
    const id = parseInt(String(item.msg_id).split("_").pop(), 10);
    return id === message.id;
  });
  if (!variant) return "";
  const token = variant.tokens?.[Math.max((proofVariant || 0) - 1, 0)] || variant.tokens?.[0];
  if (!token) return "";
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

function normalizePrePostSelection(saved, fallback) {
  if (!Array.isArray(saved)) return fallback;
  return fallback.map((defaultKey, index) => (
    typeof saved[index] === "string" && PREPOST_BY_KEY[saved[index]] ? saved[index] : defaultKey
  ));
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
        quote: wordingFor(message, 0, 1, segmentCode) || coreWordingFor(message, 0),
        coreQuote: coreWordingFor(message, 0),
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
        id: cell.message,
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

function buildSegmentMessageBuckets(segment, dashboardSegment, preferredMessage = null) {
  const utilityByMessageId = new Map(
    (dashboard.message_topline || [])
      .map((entry) => {
        const utility = entry.by_segment?.[segment.code]?.utility_signed;
        return utility == null ? null : [entry.message, utility];
      })
      .filter(Boolean)
  );
  const fullBucketLimit = 8;
  const persuadeCells = dashboardSegment
    ? pickTopMessageCells("persuasion_messaging", dashboardSegment.id, segment.code, new Set(), fullBucketLimit)
    : [];
  const mobilizeCells = dashboardSegment
    ? pickTopMessageCells("base_messaging", dashboardSegment.id, segment.code, new Set(), fullBucketLimit)
    : [];
  const persuadeMessages = persuadeCells.map((item) => ({
    ...item,
    utility: utilityByMessageId.get(item.id) ?? null,
    persuadeLift: item.lift ?? item.lift_shrunk ?? null,
    mobilizeLift: null,
  })).sort((a, b) => (b.persuadeLift ?? -Infinity) - (a.persuadeLift ?? -Infinity));
  const mobilizeMessages = mobilizeCells.map((item) => ({
    ...item,
    utility: utilityByMessageId.get(item.id) ?? null,
    persuadeLift: null,
    mobilizeLift: item.lift ?? item.lift_shrunk ?? null,
  })).sort((a, b) => (b.mobilizeLift ?? -Infinity) - (a.mobilizeLift ?? -Infinity));
  const leadWithMessages = preferredMessage ? [preferredMessage] : [];
  const avoidMessage = pickAvoidMessage(segment.code);
  const avoidMessages = avoidMessage ? [avoidMessage] : [];
  return {
    lead_with: leadWithMessages,
    persuade: persuadeMessages,
    reinforce: mobilizeMessages,
    avoid: avoidMessages,
  };
}

function SegmentMessagePicker({ segmentCode, messageBuckets, initialFilter = "default", onSwap }) {
  const [filter, setFilter] = useState(initialFilter);
  const allOptions = Object.values(messageBuckets || {})
    .flat()
    .filter(Boolean)
    .reduce((acc, option) => {
      if (!acc.some((item) => item.id === option.id)) acc.push(option);
      return acc;
    }, [])
    .sort((a, b) => a.label.localeCompare(b.label));
  const filteredOptions = filter === "default" ? allOptions : (messageBuckets?.[filter] || []);
  const [openIds, setOpenIds] = useState([]);

  return (
    <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <SectionTitle>Messages</SectionTitle>
        <Link
          to={`/messages?segment=${segmentCode}`}
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
          Message Map
        </Link>
      </div>

      <div style={{ display: "grid", gap: 10, padding: "14px 12px", border: `1px solid ${C.cardBorder}`, borderRadius: 6, background: PANEL }}>
        <div style={{ display: "grid", gap: 8 }}>
          <select
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setOpenIds([]);
            }}
            style={{
              width: 112,
              background: PANEL_DEEP,
              color: C.text,
              border: `1px solid ${C.cardBorder}`,
              borderRadius: 4,
              padding: "7px 8px",
              fontFamily: MONO,
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            <option value="default">Default</option>
            <option value="lead_with">Lead With</option>
            <option value="avoid">Avoid</option>
            <option value="persuade">Persuade</option>
            <option value="reinforce">Reinforce</option>
          </select>
          {filteredOptions.length ? (
            <div
              style={{
                display: "grid",
                gap: 6,
                maxHeight: "72vh",
                minHeight: 360,
                overflowY: "auto",
                paddingRight: 4,
                paddingBottom: 10,
              }}
            >
              {filteredOptions.map((option) => {
                const selected = openIds.includes(String(option.id));
                return (
                  <div
                    key={option.id}
                    style={{
                      border: `1px solid ${selected ? C.cyan : C.cardBorder}`,
                      borderRadius: 4,
                      background: selected ? `${C.cyan}12` : PANEL_DEEP,
                      overflow: "hidden",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOpenIds((current) =>
                          selected
                            ? current.filter((id) => id !== String(option.id))
                            : [...current, String(option.id)]
                        )
                      }
                      style={{
                        width: "100%",
                        textAlign: "left",
                        background: "transparent",
                        color: C.text,
                        border: "none",
                        padding: "10px 12px",
                        fontFamily: MONO,
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <span>{option.label}</span>
                      <span
                        style={{
                          color:
                            filter === "persuade" ? C.green
                              : filter === "reinforce" ? C.green
                              : option.utility >= 0 ? C.green : C.red,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {filter === "persuade"
                          ? (option.persuadeLift != null
                            ? `Lift ${option.persuadeLift > 0 ? "+" : ""}${option.persuadeLift.toFixed(2)}`
                            : "Lift --")
                          : filter === "reinforce"
                            ? (option.mobilizeLift != null
                              ? `Lift ${option.mobilizeLift > 0 ? "+" : ""}${option.mobilizeLift.toFixed(2)}`
                              : "Lift --")
                            : option.utility != null
                              ? `Utility ${option.utility >= 0 ? "+" : ""}${option.utility.toFixed(3)}`
                              : "Utility --"}
                      </span>
                    </button>
                    {selected ? (
                      <div style={{ padding: "0 12px 12px", display: "grid", gap: 8 }}>
                        <div style={{ fontSize: 13, lineHeight: 1.6, color: C.white, fontStyle: "italic" }}>
                          "{trimQuote(option.quote, 165)}"
                        </div>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontFamily: MONO, fontSize: 10 }}>
                          {option.persuadeLift != null ? (
                            <span style={{ color: C.green }}>
                              Persuade lift {option.persuadeLift > 0 ? "+" : ""}{option.persuadeLift.toFixed(2)}
                            </span>
                          ) : null}
                          {option.mobilizeLift != null ? (
                            <span style={{ color: C.green }}>
                              Reinforce lift {option.mobilizeLift > 0 ? "+" : ""}{option.mobilizeLift.toFixed(2)}
                            </span>
                          ) : null}
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            onClick={() => onSwap?.(option)}
                            style={{
                              background: "#2563eb",
                              color: C.white,
                              border: "none",
                              borderRadius: 4,
                              padding: "7px 12px",
                              fontFamily: MONO,
                              fontSize: 10,
                              fontWeight: 800,
                              cursor: "pointer",
                              textTransform: "uppercase",
                              letterSpacing: 0.6,
                            }}
                          >
                            Swap
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: C.textDim }}>No messages available for this filter.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function trimQuote(text, maxLength = 140) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  const clipped = normalized.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > 80 ? clipped.slice(0, lastSpace) : clipped).trim()}...`;
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

function getCompressedPrePostScale(pre, post) {
  const safePre = Math.max(0, Math.min(100, pre || 0));
  const safePost = Math.max(0, Math.min(100, post || 0));
  const deltaFromPre = Math.max(-10, Math.min(10, safePost - safePre));
  const center = 50;
  const postPosition = center + (deltaFromPre / 20) * 100;
  const leftEdge = Math.min(center, postPosition);
  const width = Math.abs(postPosition - center);
  const axisMinValue = Math.max(0, safePre - 10);
  const axisMaxValue = Math.min(100, safePre + 10);

  return {
    axisMinLabel: `${Math.round(axisMinValue)}%`,
    axisMaxLabel: `${Math.round(axisMaxValue)}%`,
    preLeft: `${center}%`,
    postLeft: `${postPosition}%`,
    swingLeft: `${leftEdge}%`,
    swingWidth: `${Math.max(0, width)}%`,
  };
}

function PrePostFinding({ title, pair }) {
  if (!pair) {
    return <FindingSlot>[{title}]</FindingSlot>;
  }

  const metric = PREPOST_BY_KEY[title];
  const [pre, post] = pair;
  const delta = +(post - pre).toFixed(1);
  const preDisplay = Math.round(pre);
  const postDisplay = Math.round(post);
  const deltaColor = delta > 0 ? C.green : delta < 0 ? C.red : C.textMuted;
  const { axisMinLabel, axisMaxLabel, preLeft, postLeft, swingLeft, swingWidth } = getCompressedPrePostScale(pre, post);
  const surveyPane = PREPOST_SURVEY_BY_KEY[title];

  const valueCopy = {
    item1: {
      pre: "had HIV/AIDS in their top 3 before exposure.",
      post: "had HIV/AIDS in their top 3 after exposure.",
    },
    item2: {
      pre: "were concerned about HIV/AIDS impact before exposure.",
      post: "were concerned about HIV/AIDS impact after exposure.",
    },
    item3: {
      pre: "were concerned about reduced HIV access before exposure.",
      post: "were concerned about reduced HIV access after exposure.",
    },
    item4: {
      pre: "felt HIV/AIDS was relevant before exposure.",
      post: "felt HIV/AIDS was relevant after exposure.",
    },
    item5: {
      pre: "supported expanding access to PrEP/treatment before exposure.",
      post: "supported expanding access to PrEP/treatment after exposure.",
    },
    item6: {
      pre: "opposed treatment-assistance cuts before exposure.",
      post: "opposed treatment-assistance cuts after exposure.",
    },
    item7: {
      pre: "agreed with continued innovation investment before exposure.",
      post: "agreed with continued innovation investment after exposure.",
    },
  }[title];
  const isPriorityRankCard = title === "item1";

  if (isPriorityRankCard) {
    return (
      <div
        style={{
          minHeight: 132,
          display: "grid",
          gridTemplateRows: "auto auto minmax(0, 1fr) auto",
          gap: 12,
          padding: "18px 20px",
          border: `1px solid ${C.cardBorder}`,
          borderRadius: 8,
          background: PANEL_DEEP,
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, color: C.textMuted, letterSpacing: 0.6, textTransform: "uppercase" }}>
            {metric?.label || title}
          </div>
        </div>
        {surveyPane ? (
          <div
            style={{
              borderRadius: 8,
              overflow: "hidden",
              height: EXECUTIVE_SURVEY_CAPTURE_HEIGHT,
            }}
          >
            <div className="topline-root" style={{ margin: 0, height: "100%" }}>
              <ItemSurveyPane
                survey={surveyPane}
                className="executive-summary-pane"
                style={{ height: "100%" }}
              />
            </div>
          </div>
        ) : null}
        <div style={{ display: "grid", gap: 14 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 140px",
              gap: 14,
              alignItems: "stretch",
            }}
          >
            <div
              style={{
                width: "100%",
                border: `1px solid ${C.cardBorder}`,
                borderRadius: 14,
                padding: "14px 16px 14px 68px",
                position: "relative",
                minHeight: 144,
                background: "linear-gradient(90deg, rgba(34,197,94,0.08) 0%, rgba(255,255,255,0.02) 28%)",
                display: "flex",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 16,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  background: `${C.green}18`,
                  border: `1px solid ${C.green}55`,
                  display: "grid",
                  placeItems: "center",
                  color: C.green,
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >↑</div>
              <div style={{ fontSize: 15, lineHeight: 1.45, color: C.textMuted }}>
                HIV rises <strong style={{ color: C.white }}>two full places</strong> as a top health care issue that policymakers should prioritize.
              </div>
            </div>
            <div
              style={{
                width: "100%",
                border: `1px solid ${C.cardBorder}`,
                borderRadius: 12,
                background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
                display: "grid",
                gridTemplateRows: "1fr auto 1fr",
                alignItems: "center",
                justifyItems: "center",
                padding: "24px 10px",
                minHeight: 144,
                position: "relative",
              }}
            >
              <div style={{ textAlign: "center", display: "grid", gap: 4, alignSelf: "start" }}>
                <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: C.green, letterSpacing: 0.8 }}>
                  POST
                </div>
                <div style={{ fontSize: 34, fontWeight: 800, color: C.white, lineHeight: 1 }}>5</div>
              </div>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: `2px solid ${C.green}`,
                  display: "grid",
                  placeItems: "center",
                  color: C.green,
                  background: `${C.green}10`,
                  boxShadow: `0 0 0 6px ${C.green}10`,
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>↑</div>
              </div>
              <div style={{ textAlign: "center", display: "grid", gap: 4, alignSelf: "end" }}>
                <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: C.textDim, letterSpacing: 0.8 }}>
                  PRE
                </div>
                <div style={{ fontSize: 34, fontWeight: 800, color: "#94a3b8", lineHeight: 1 }}>7</div>
              </div>
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: 62,
                  bottom: 38,
                  width: 2,
                  transform: "translateX(-50%)",
                  background: `linear-gradient(180deg, rgba(148,163,184,0.15) 0%, ${C.green}70 50%, rgba(148,163,184,0.15) 100%)`,
                }}
              />
            </div>
          </div>
        </div>
        <div style={{ display: "grid", justifyItems: "center", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
            <span style={{ fontFamily: MONO, fontSize: 12, color: deltaColor, fontWeight: 800 }}>
              PRE RANK 7 → POST RANK 5
            </span>
            <span style={{ fontFamily: MONO, fontSize: 12, color: C.green, fontWeight: 800 }}>
              SHIFT +2 PLACES
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: 132,
        display: "grid",
        gridTemplateRows: "auto auto minmax(0, 1fr) auto",
        gap: 12,
        padding: "18px 20px",
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 8,
        background: PANEL_DEEP,
      }}
    >
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, color: C.textMuted, letterSpacing: 0.6, textTransform: "uppercase" }}>
          {metric?.label || title}
        </div>
      </div>
      {surveyPane ? (
        <div
          style={{
            borderRadius: 8,
            overflow: "hidden",
            height: EXECUTIVE_SURVEY_CAPTURE_HEIGHT,
          }}
        >
          <div className="topline-root" style={{ margin: 0, height: "100%" }}>
            <ItemSurveyPane
              survey={surveyPane}
              className="executive-summary-pane"
              style={{ height: "100%" }}
            />
          </div>
        </div>
      ) : null}
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div
            style={{
              position: "relative",
              height: 82,
              borderRadius: 8,
              border: `1px solid ${C.cardBorder}`,
              background: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
              overflow: "hidden",
              padding: "10px 12px",
            }}
          >
            <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: 0.4 }}>
              PRE
            </div>
            <div
              style={{
                position: "absolute",
                left: 12,
                right: 12,
                top: "56%",
                height: 2,
                transform: "translateY(-50%)",
                background: `linear-gradient(90deg, ${C.cardBorder} 0%, ${C.textDim}33 100%)`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: preLeft,
                top: "56%",
                transform: "translate(-50%, -50%)",
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: C.textMuted,
                border: `2px solid ${PANEL_DEEP}`,
                boxShadow: `0 0 0 2px ${C.textMuted}33`,
              }}
            />
          </div>
          <div style={{ fontSize: 11, lineHeight: 1.35, color: C.textMuted, textAlign: "center" }}>
            <span style={{ fontFamily: MONO, fontSize: 12, color: C.textMuted }}>PRE {preDisplay}%</span>
            {" "}
            {valueCopy?.pre}
          </div>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <div
            style={{
              position: "relative",
              height: 82,
              borderRadius: 8,
              border: `1px solid ${delta >= 0 ? `${C.green}33` : `${C.red}33`}`,
              background: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
              overflow: "hidden",
              padding: "10px 12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: C.white, letterSpacing: 0.4 }}>
                POST
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: deltaColor, letterSpacing: 0.5 }}>
                {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                left: 12,
                right: 12,
                top: "56%",
                height: 2,
                transform: "translateY(-50%)",
                background: `linear-gradient(90deg, ${C.cardBorder} 0%, ${C.textDim}33 100%)`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 12,
                top: 32,
                fontFamily: MONO,
                fontSize: 9,
                fontWeight: 800,
                color: C.textDim,
                letterSpacing: 0.4,
              }}
            >
              {axisMinLabel}
            </div>
            <div
              style={{
                position: "absolute",
                right: 12,
                top: 32,
                fontFamily: MONO,
                fontSize: 9,
                fontWeight: 800,
                color: C.textDim,
                letterSpacing: 0.4,
              }}
            >
              {axisMaxLabel}
            </div>
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "56%",
                width: 1,
                height: 24,
                transform: "translate(-50%, -50%)",
                background: `${C.textMuted}55`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: swingLeft,
                width: swingWidth,
                top: "56%",
                height: 10,
                transform: "translateY(-50%)",
                background: `${delta >= 0 ? C.green : C.red}33`,
                borderRadius: 999,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: postLeft,
                top: "56%",
                transform: "translate(-50%, -50%)",
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: delta >= 0 ? C.green : C.red,
                border: `2px solid ${PANEL_DEEP}`,
                boxShadow: `0 0 0 3px ${(delta >= 0 ? C.green : C.red)}22`,
              }}
            />
          </div>
          <div style={{ fontSize: 11, lineHeight: 1.35, color: C.text, textAlign: "center" }}>
            <span style={{ fontFamily: MONO, fontSize: 12, color: C.white, fontWeight: 700 }}>POST {postDisplay}%</span>
            {" "}
            {valueCopy?.post}
          </div>
        </div>
      </div>
      <div style={{ display: "grid", justifyItems: "center", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
          <span style={{ fontFamily: MONO, fontSize: 12, color: deltaColor, fontWeight: 800 }}>
            SHIFT {delta > 0 ? "+" : ""}
            {delta.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function TotalPrePostCard({ title, pair }) {
  if (!pair) return null;

  const [pre, post] = pair;
  const delta = +(post - pre).toFixed(1);
  const preDisplay = Math.round(pre);
  const postDisplay = Math.round(post);
  const deltaColor = delta > 0 ? C.green : delta < 0 ? C.red : C.textMuted;
  const { axisMinLabel, axisMaxLabel, preLeft, postLeft, swingLeft, swingWidth } = getCompressedPrePostScale(pre, post);
  const valueCopy = {
    item1: {
      pre: "had HIV/AIDS in their top 3 before exposure.",
      post: "had HIV/AIDS in their top 3 after exposure.",
    },
    item2: {
      pre: "were concerned about HIV/AIDS impact before exposure.",
      post: "were concerned about HIV/AIDS impact after exposure.",
    },
    item3: {
      pre: "were concerned about reduced HIV access before exposure.",
      post: "were concerned about reduced HIV access after exposure.",
    },
    item4: {
      pre: "felt HIV/AIDS was relevant before exposure.",
      post: "felt HIV/AIDS was relevant after exposure.",
    },
    item5: {
      pre: "supported expanding access to PrEP/treatment before exposure.",
      post: "supported expanding access to PrEP/treatment after exposure.",
    },
    item6: {
      pre: "opposed treatment-assistance cuts before exposure.",
      post: "opposed treatment-assistance cuts after exposure.",
    },
    item7: {
      pre: "agreed with continued innovation investment before exposure.",
      post: "agreed with continued innovation investment after exposure.",
    },
  }[title];
  const surveyPane = PREPOST_SURVEY_BY_KEY[title];
  const isPriorityRankCard = title === "item1";
  if (isPriorityRankCard) {
    return (
      <div
        style={{
          minHeight: 132,
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr) auto",
          gap: 12,
          padding: "18px 20px",
          border: `1px solid ${C.cardBorder}`,
          borderRadius: 8,
          background: PANEL_DEEP,
        }}
      >
        {surveyPane ? (
          <div
            style={{
              borderRadius: 8,
              overflow: "hidden",
              height: EXECUTIVE_SURVEY_CAPTURE_HEIGHT,
            }}
          >
            <div className="topline-root" style={{ margin: 0, height: "100%" }}>
              <ItemSurveyPane
                survey={surveyPane}
                className="executive-summary-pane"
                style={{ height: "100%" }}
              />
            </div>
          </div>
        ) : null}
        <div style={{ display: "grid", gap: 14 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 140px",
              gap: 14,
              alignItems: "stretch",
            }}
          >
            <div
              style={{
                width: "100%",
                border: `1px solid ${C.cardBorder}`,
                borderRadius: 14,
                padding: "14px 16px 14px 68px",
                position: "relative",
                minHeight: 180,
                background: "linear-gradient(90deg, rgba(34,197,94,0.08) 0%, rgba(255,255,255,0.02) 28%)",
                display: "flex",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 16,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  background: `${C.green}18`,
                  border: `1px solid ${C.green}55`,
                  display: "grid",
                  placeItems: "center",
                  color: C.green,
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >↑</div>
              <div style={{ fontSize: 15, lineHeight: 1.45, color: C.textMuted }}>
                HIV rises <strong style={{ color: C.white }}>two full places</strong> as a top health care issue that policymakers should prioritize.
              </div>
            </div>
            <div
              style={{
                width: "100%",
                border: `1px solid ${C.cardBorder}`,
                borderRadius: 12,
                background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
                display: "grid",
                gridTemplateRows: "1fr auto 1fr",
                alignItems: "center",
                justifyItems: "center",
                padding: "24px 10px",
                minHeight: 144,
                position: "relative",
              }}
            >
              <div style={{ textAlign: "center", display: "grid", gap: 4, alignSelf: "start" }}>
                <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: C.green, letterSpacing: 0.8 }}>
                  POST
                </div>
                <div style={{ fontSize: 34, fontWeight: 800, color: C.white, lineHeight: 1 }}>5</div>
              </div>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: `2px solid ${C.green}`,
                  display: "grid",
                  placeItems: "center",
                  color: C.green,
                  background: `${C.green}10`,
                  boxShadow: `0 0 0 6px ${C.green}10`,
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>↑</div>
              </div>
              <div style={{ textAlign: "center", display: "grid", gap: 4, alignSelf: "end" }}>
                <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: C.textDim, letterSpacing: 0.8 }}>
                  PRE
                </div>
                <div style={{ fontSize: 34, fontWeight: 800, color: "#94a3b8", lineHeight: 1 }}>7</div>
              </div>
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: 62,
                  bottom: 38,
                  width: 2,
                  transform: "translateX(-50%)",
                  background: `linear-gradient(180deg, rgba(148,163,184,0.15) 0%, ${C.green}70 50%, rgba(148,163,184,0.15) 100%)`,
                }}
              />
            </div>
          </div>
        </div>
        <div style={{ display: "grid", justifyItems: "center", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
            <span style={{ fontFamily: MONO, fontSize: 12, color: deltaColor, fontWeight: 800 }}>
              PRE RANK 7 → POST RANK 5
            </span>
            <span style={{ fontFamily: MONO, fontSize: 12, color: C.green, fontWeight: 800 }}>
              SHIFT +2 PLACES
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: 220,
        display: "grid",
        gridTemplateRows: "minmax(80px, 1fr) auto auto",
        gap: 12,
        padding: "18px 20px",
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 8,
        background: PANEL_DEEP,
      }}
    >
      {surveyPane ? (
        <div
          style={{
            borderRadius: 8,
            overflow: "hidden",
            height: EXECUTIVE_SURVEY_CAPTURE_HEIGHT,
          }}
        >
          <div className="topline-root" style={{ margin: 0, height: "100%" }}>
            <ItemSurveyPane
              survey={surveyPane}
              className="executive-summary-pane"
              style={{ height: "100%" }}
            />
          </div>
        </div>
      ) : null}
      <div style={{ display: "grid", gap: 10 }}>
        <div
          style={{
            display: "grid",
            gap: 6,
          }}
        >
          <div
            style={{
              position: "relative",
              height: 82,
              borderRadius: 8,
              border: `1px solid ${C.cardBorder}`,
              background: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
              overflow: "hidden",
              padding: "10px 12px",
            }}
          >
            <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: 0.4 }}>
              PRE
            </div>
            <div
              style={{
                position: "absolute",
                left: 12,
                right: 12,
                top: "56%",
                height: 2,
                transform: "translateY(-50%)",
                background: `linear-gradient(90deg, ${C.cardBorder} 0%, ${C.textDim}33 100%)`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: preLeft,
                top: "56%",
                transform: "translate(-50%, -50%)",
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: C.textMuted,
                border: `2px solid ${PANEL_DEEP}`,
                boxShadow: `0 0 0 2px ${C.textMuted}33`,
              }}
            />
          </div>
          <div style={{ fontSize: 11, lineHeight: 1.35, color: C.textMuted, textAlign: "center" }}>
            <span style={{ fontFamily: MONO, fontSize: 12, color: C.textMuted }}>PRE {preDisplay}%</span>
            {" "}
            {valueCopy?.pre}
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gap: 6,
          }}
        >
          <div
            style={{
              position: "relative",
              height: 82,
              borderRadius: 8,
              border: `1px solid ${delta >= 0 ? `${C.green}33` : `${C.red}33`}`,
              background: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
              overflow: "hidden",
              padding: "10px 12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: C.white, letterSpacing: 0.4 }}>
                POST
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: deltaColor, letterSpacing: 0.5 }}>
                {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                left: 12,
                right: 12,
                top: "56%",
                height: 2,
                transform: "translateY(-50%)",
                background: `linear-gradient(90deg, ${C.cardBorder} 0%, ${C.textDim}33 100%)`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 12,
                top: 32,
                fontFamily: MONO,
                fontSize: 9,
                fontWeight: 800,
                color: C.textDim,
                letterSpacing: 0.4,
              }}
            >
              {axisMinLabel}
            </div>
            <div
              style={{
                position: "absolute",
                right: 12,
                top: 32,
                fontFamily: MONO,
                fontSize: 9,
                fontWeight: 800,
                color: C.textDim,
                letterSpacing: 0.4,
              }}
            >
              {axisMaxLabel}
            </div>
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "56%",
                width: 1,
                height: 24,
                transform: "translate(-50%, -50%)",
                background: `${C.textMuted}55`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: swingLeft,
                width: swingWidth,
                top: "56%",
                height: 10,
                transform: "translateY(-50%)",
                background: `${delta >= 0 ? C.green : C.red}33`,
                borderRadius: 999,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: postLeft,
                top: "56%",
                transform: "translate(-50%, -50%)",
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: delta >= 0 ? C.green : C.red,
                border: `2px solid ${PANEL_DEEP}`,
                boxShadow: `0 0 0 3px ${(delta >= 0 ? C.green : C.red)}22`,
              }}
            />
          </div>
          <div style={{ fontSize: 11, lineHeight: 1.35, color: C.text, textAlign: "center" }}>
            <span style={{ fontFamily: MONO, fontSize: 12, color: C.white, fontWeight: 700 }}>POST {postDisplay}%</span>
            {" "}
            {valueCopy?.post}
          </div>
        </div>
      </div>
      <div style={{ display: "grid", justifyItems: "center", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
          <span style={{ fontFamily: MONO, fontSize: 12, color: deltaColor, fontWeight: 800 }}>
            SHIFT {delta > 0 ? "+" : ""}
            {delta.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function MessagePreviewBox({ title, message, metricType = "utility", onSwapClick, isActive = false }) {
  return (
    <div
      style={{
        minHeight: 132,
        display: "grid",
        alignContent: "start",
        gap: 8,
        padding: "14px 16px",
        border: `1px solid ${isActive ? C.cyan : C.cardBorder}`,
        borderRadius: 6,
        background: isActive ? `${C.cyan}12` : PANEL_DEEP,
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: 0.8, textTransform: "uppercase" }}>
        {title}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.textMuted }}>
        {message?.label || "No message available"}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.55, color: C.white, fontStyle: "italic" }}>
        {message?.quote ? `"${trimQuote(message.quote, 165)}"` : "No message available"}
      </div>
      {metricType === "utility" && message?.utility != null ? (
        <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: message.utility >= 0 ? C.green : C.red }}>
          Utility {message.utility >= 0 ? "+" : ""}{message.utility.toFixed(3)}
        </div>
      ) : null}
      {metricType === "persuade" && message?.persuadeLift != null ? (
        <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: C.green }}>
          Persuade lift {message.persuadeLift > 0 ? "+" : ""}{message.persuadeLift.toFixed(2)}
        </div>
      ) : null}
      {metricType === "reinforce" && message?.mobilizeLift != null ? (
        <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: C.green }}>
          Reinforce lift {message.mobilizeLift > 0 ? "+" : ""}{message.mobilizeLift.toFixed(2)}
        </div>
      ) : null}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
        <button
          type="button"
          onClick={onSwapClick}
          style={{
            background: isActive ? `${C.white}12` : "transparent",
            color: isActive ? C.white : C.cyan,
            border: `1px solid ${isActive ? C.cyan : C.cardBorder}`,
            borderRadius: 999,
            padding: "6px 10px",
            fontFamily: MONO,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: 0.7,
            textTransform: "uppercase",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {isActive ? "Close Swap" : "Swap"}
        </button>
      </div>
    </div>
  );
}

function OverarchingThemeCard({ item }) {
  const utilityValue = item.messageId != null ? MESSAGE_TOTALS_BY_ID.get(item.messageId) ?? null : null;
  return (
    <div
      style={{
        display: "grid",
        alignContent: "space-between",
        gap: 14,
        padding: "18px 18px 16px",
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 8,
        background: PANEL_DEEP,
        minHeight: 0,
        height: "100%",
      }}
    >
      <div style={{ display: "grid", gap: 8 }}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 10,
            fontWeight: 800,
            color: C.textMuted,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {item.eyebrow}
        </div>
        <div style={{ fontSize: 18, lineHeight: 1.32, color: C.white, fontWeight: 800 }}>
          {item.message}
        </div>
        {item.toplineNarrative && (
          <div style={{ fontSize: 13, lineHeight: 1.55, color: C.textMuted }}>
            <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: C.textDim }}>Topline Narrative: </span>{item.toplineNarrative}
          </div>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <div style={{ display: "grid", justifyItems: "end", gap: 2 }}>
          <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 800, color: C.green, letterSpacing: 0.7, textTransform: "uppercase" }}>
            Utility Score
          </div>
          <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 800, color: C.green, lineHeight: 1 }}>
            {utilityValue != null ? `${utilityValue >= 0 ? "+" : ""}${utilityValue.toFixed(2)}` : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

function SegmentRailButton({ segment, metrics, accent, active = false, onToggle }) {
  return (
    <div
      style={{
        width: "100%",
        textAlign: "left",
        padding: "12px",
        borderRadius: 8,
        border: `1px solid ${active ? accent : C.cardBorder}`,
        background: active ? `${accent}14` : PANEL_DEEP,
        color: C.text,
        display: "grid",
        gap: 10,
        transition: "transform 180ms ease, border-color 180ms ease, background 180ms ease, box-shadow 180ms ease",
        transform: active ? "translateX(4px)" : "translateX(0px)",
        boxShadow: active ? `0 10px 26px ${accent}18` : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: `2px solid ${accent}`,
            display: "grid",
            placeItems: "center",
            fontFamily: MONO,
            fontSize: 11,
            fontWeight: 800,
            color: C.white,
            flex: "0 0 auto",
          }}
        >
          {segment.code}
        </div>
        <div style={{ minWidth: 0, fontSize: 13, fontWeight: 800, color: C.white, lineHeight: 1.2 }}>
          {segment.name}
        </div>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, color: C.green }}>
        ROI {metrics?.roi != null ? metrics.roi.toFixed(2) : "--"}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onToggle}
          style={{
            background: active ? `${C.white}12` : "transparent",
            color: active ? C.white : C.cyan,
            border: `1px solid ${active ? accent : C.cardBorder}`,
            borderRadius: 999,
            padding: "6px 10px",
            fontFamily: MONO,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: 0.7,
            textTransform: "uppercase",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {active ? "Collapse <<" : "Expand >>"}
        </button>
      </div>
    </div>
  );
}

function SegmentRow({
  segment,
  metrics,
  accent,
  engagementCategory,
  engagementColor,
  messageBuckets,
  segmentQuote,
  initialMessages,
  savedMessages,
  onSaveMessages,
}) {
  const panelRef = useRef(null);
  const messageGridRef = useRef(null);
  const saveTimerRef = useRef(null);
  const saveDoneTimerRef = useRef(null);
  const swapTimerRef = useRef(null);
  const resetTimerRef = useRef(null);
  const resetDoneTimerRef = useRef(null);
  const prePostResetTimerRef = useRef(null);
  const prePostResetDoneTimerRef = useRef(null);
  const [activeSwapSlot, setActiveSwapSlot] = useState(null);
  const [boxMessages, setBoxMessages] = useState(savedMessages);
  const [saveState, setSaveState] = useState("idle");
  const [resetState, setResetState] = useState("idle");
  const [prePostResetState, setPrePostResetState] = useState("idle");
  const [recentlySwappedSlot, setRecentlySwappedSlot] = useState(null);
  const [selectedSegmentPrePostItems, setSelectedSegmentPrePostItems] = useState(() => {
    const key = `segmentPrePostSelection_${segment.code}`;
    const saved = localStorage.getItem(key);
    return normalizePrePostSelection(saved ? JSON.parse(saved) : null, DEFAULT_SEGMENT_PREPOST_ITEMS);
  });

  useEffect(() => {
    const key = `segmentPrePostSelection_${segment.code}`;
    localStorage.setItem(key, JSON.stringify(selectedSegmentPrePostItems));
  }, [selectedSegmentPrePostItems, segment.code]);

  const handleResetSegmentPrePost = () => {
    if (prePostResetTimerRef.current) clearTimeout(prePostResetTimerRef.current);
    if (prePostResetDoneTimerRef.current) clearTimeout(prePostResetDoneTimerRef.current);
    setPrePostResetState("resetting");
    prePostResetTimerRef.current = setTimeout(() => {
      setSelectedSegmentPrePostItems(["item1", "item6"]);
      const key = `segmentPrePostSelection_${segment.code}`;
      localStorage.removeItem(key);
      setPrePostResetState("reset");
      prePostResetDoneTimerRef.current = setTimeout(() => {
        setPrePostResetState("idle");
      }, 1300);
    }, 260);
  };

  const handleResetMessages = () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    if (resetDoneTimerRef.current) clearTimeout(resetDoneTimerRef.current);
    setResetState("resetting");
    resetTimerRef.current = setTimeout(() => {
      setBoxMessages(initialMessages);
      onSaveMessages?.(initialMessages);
      setActiveSwapSlot(null);
      setRecentlySwappedSlot(null);
      setResetState("reset");
      resetDoneTimerRef.current = setTimeout(() => {
        setResetState("idle");
      }, 1300);
    }, 260);
  };

  const handleSaveMessages = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (saveDoneTimerRef.current) clearTimeout(saveDoneTimerRef.current);
    setSaveState("saving");
    setActiveSwapSlot(null);
    onSaveMessages?.(boxMessages);
    saveTimerRef.current = setTimeout(() => {
      setSaveState("saved");
      saveDoneTimerRef.current = setTimeout(() => {
        setSaveState("idle");
      }, 1300);
    }, 260);
  };

  const handleSwap = (nextMessage) => {
    if (!nextMessage) {
      setActiveSwapSlot(null);
      return;
    }
    setBoxMessages((current) => {
      const nextMessages = current.map((item) =>
        item.bucketKey === activeSwapSlot ? { ...item, message: nextMessage } : item
      );
      onSaveMessages?.(nextMessages);
      return nextMessages;
    });
    if (swapTimerRef.current) clearTimeout(swapTimerRef.current);
    setRecentlySwappedSlot(activeSwapSlot);
    swapTimerRef.current = setTimeout(() => {
      setRecentlySwappedSlot(null);
    }, 1200);
    setActiveSwapSlot(null);
  };

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (saveDoneTimerRef.current) clearTimeout(saveDoneTimerRef.current);
    if (swapTimerRef.current) clearTimeout(swapTimerRef.current);
  }, []);

  useEffect(() => {
    if (!activeSwapSlot) return;

    const handlePointerDown = (event) => {
      const target = event.target;
      const insidePanel = panelRef.current?.contains(target);
      const insideMessageGrid = messageGridRef.current?.contains(target);
      if (!insidePanel && !insideMessageGrid) {
        setActiveSwapSlot(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [activeSwapSlot]);

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "290px minmax(0, 1fr)",
        gap: 16,
        padding: "16px 18px",
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 8,
        background: PANEL_DEEP,
        alignItems: "start",
        transition: "box-shadow 220ms ease, transform 220ms ease",
        boxShadow: activeSwapSlot ? `0 18px 40px ${C.cyan}12` : "0 8px 24px rgba(0,0,0,0.12)",
        transform: activeSwapSlot ? "translateY(-2px)" : "translateY(0px)",
      }}
    >
      <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 64,
              height: 64,
              minWidth: 64,
              minHeight: 64,
              flex: "0 0 64px",
              aspectRatio: "1 / 1",
              borderRadius: "50%",
              background: PANEL,
              border: `2px solid ${accent}`,
              display: "grid",
              placeItems: "center",
              color: C.white,
              fontFamily: MONO,
              fontSize: 18,
              fontWeight: 800,
              boxShadow: `0 0 0 6px ${accent}18`,
            }}
          >
            {segment.code}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.white }}>{segment.name}</div>
              <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 800, color: C.green }}>
                ROI {metrics?.roi != null ? metrics.roi.toFixed(2) : "--"}
              </span>
            </div>
            <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: engagementColor, letterSpacing: 0.8, textTransform: "uppercase" }}>
                {engagementCategory}
              </span>
            </div>
          </div>
        </div>

        <SectionTitle>Coalition Profile</SectionTitle>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 14,
            padding: "14px 12px",
            border: `1px solid ${C.cardBorder}`,
            borderRadius: 6,
            background: PANEL,
          }}
        >
          <PieChart label="Persuadable" value={metrics?.persuadable != null ? `${metrics.persuadable}%` : "--"} size={68} fillColor={PERSUADE} />
          <PieChart label="Coalition" value={metrics?.supporters != null ? `${metrics.supporters}%` : "--"} size={68} fillColor={SUPPORT} />
          <PieChart label="Activation" value={metrics?.activation != null ? `${metrics.activation}%` : "--"} size={68} fillColor={ACTIVATE} />
          <PieChart label="Influence360" value={metrics?.influence != null ? `${metrics.influence}%` : "--"} size={68} fillColor={INFLUENCE} />
        </div>

        <div style={{ fontSize: 13, lineHeight: 1.5, color: C.textMuted, fontStyle: "italic" }}>
          "{segmentQuote || segment.persona.quote}"
        </div>
      </div>

      <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <SectionTitle>Core Outcomes for {segment.name}</SectionTitle>
          <button
            type="button"
            onClick={handleResetSegmentPrePost}
            style={{
              background: prePostResetState === "reset" ? `${C.green}18` : prePostResetState === "resetting" ? `${C.violet}12` : "transparent",
              color: prePostResetState === "reset" ? C.green : C.cyan,
              border: `1px solid ${prePostResetState === "reset" ? C.green : prePostResetState === "resetting" ? C.violet : C.cardBorder}`,
              borderRadius: 4,
              padding: "6px 10px",
              fontFamily: MONO,
              fontSize: 10,
              fontWeight: 800,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: 0.6,
              transition: "background 180ms ease, color 180ms ease, border-color 180ms ease, transform 180ms ease",
              transform: prePostResetState === "resetting" ? "scale(1.03)" : "scale(1)",
            }}
          >
            {prePostResetState === "resetting" ? "Resetting..." : prePostResetState === "reset" ? "Reset" : "Reset"}
          </button>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginBottom: 8 }}>
      {selectedSegmentPrePostItems.map((itemKey, index) => (
            <div key={index} style={{ display: "grid", gap: 4, minWidth: 0 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Question {index + 1}
              </label>
              <select
                value={itemKey}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setSelectedSegmentPrePostItems((current) =>
                    current.map((item, itemIndex) => (itemIndex === index ? nextValue : item))
                  );
                }}
                style={{
                  width: "100%",
                  minWidth: 0,
                  padding: "8px 10px",
                  background: C.cardBorder,
                  color: C.text,
                  border: `1px solid ${C.cardBorder}`,
                  borderRadius: 4,
                  fontFamily: FONT,
                  fontSize: 13,
                  cursor: "pointer",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {PREPOST_METRICS.map((metric) => (
                  <option key={metric.key} value={metric.key}>
                    {metric.label}: {metric.question}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          {selectedSegmentPrePostItems.map((itemKey, index) => (
            <PrePostFinding key={`${index}-${itemKey}`} title={itemKey} metricLabel={PREPOST_BY_KEY[itemKey]?.label} pair={metrics?.prePost?.[itemKey]} />
          ))}
        </div>
        <div
          style={{
            height: 0,
            borderTop: "2px solid rgba(255,255,255,0.9)",
            margin: "8px 0 2px -324px",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            paddingLeft: 14,
            marginLeft: -310,
            width: "calc(100% + 310px)",
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: C.white,
            }}
          >
            Recommended Messages
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={handleResetMessages}
              style={{
                background: resetState === "reset" ? `${C.green}18` : resetState === "resetting" ? `${C.violet}12` : "transparent",
                color: resetState === "reset" ? C.green : C.cyan,
                border: `1px solid ${resetState === "reset" ? C.green : resetState === "resetting" ? C.violet : C.cardBorder}`,
                borderRadius: 4,
                padding: "6px 10px",
                fontFamily: MONO,
                fontSize: 10,
                fontWeight: 800,
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: 0.6,
                transition: "background 180ms ease, color 180ms ease, border-color 180ms ease, transform 180ms ease",
                transform: resetState === "resetting" ? "scale(1.03)" : "scale(1)",
              }}
            >
              {resetState === "resetting" ? "Resetting..." : resetState === "reset" ? "Reset" : "Reset"}
            </button>
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: activeSwapSlot ? "minmax(0, 1fr) 380px" : "minmax(0, 1fr)",
            gap: activeSwapSlot ? 16 : 0,
            alignItems: "start",
            marginLeft: -310,
            width: "calc(100% + 310px)",
          }}
        >
          <div
            ref={messageGridRef}
            style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, minWidth: 0 }}
          >
            {boxMessages.map((item) => (
              <MessagePreviewBox
                key={item.title}
                title={item.title}
                message={item.message}
                metricType={item.metricType}
                isActive={activeSwapSlot === item.bucketKey || recentlySwappedSlot === item.bucketKey}
                onSwapClick={() => setActiveSwapSlot((current) => (current === item.bucketKey ? null : item.bucketKey))}
              />
            ))}
          </div>
          {activeSwapSlot ? (
            <div ref={panelRef} style={{ minWidth: 0, alignSelf: "start" }}>
              <SegmentMessagePicker
                segmentCode={segment.code}
                messageBuckets={messageBuckets}
                initialFilter="default"
                onSwap={handleSwap}
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default function ExecutiveSummary() {
  const [selectedPrePostItems, setSelectedPrePostItems] = useState(() => {
    const saved = localStorage.getItem("prePostSelection");
    return normalizePrePostSelection(saved ? JSON.parse(saved) : null, DEFAULT_EXECUTIVE_PREPOST_ITEMS);
  });
  const [resetState, setResetState] = useState("default");
  const resetTimerRef = useRef(null);
  const resetDoneTimerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("prePostSelection", JSON.stringify(selectedPrePostItems));
  }, [selectedPrePostItems]);

  const handleResetPrePost = () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    if (resetDoneTimerRef.current) clearTimeout(resetDoneTimerRef.current);
    setResetState("resetting");
    resetTimerRef.current = setTimeout(() => {
      setSelectedPrePostItems(DEFAULT_EXECUTIVE_PREPOST_ITEMS);
      localStorage.removeItem("prePostSelection");
      setResetState("reset");
      resetDoneTimerRef.current = setTimeout(() => {
        setResetState("default");
      }, 1300);
    }, 260);
  };
  const totalPopulation = SEGMENTS.reduce((sum, segment) => sum + (segment.pop || 0), 0);
  const totalPrePost = selectedPrePostItems.map((key) => {
    const weighted = SEGMENTS.reduce((acc, segment) => {
      const pair = STUDY_METRICS[segment.code]?.prePost?.[key];
      const weight = segment.pop || 0;
      if (!pair || !weight) return acc;
      return [acc[0] + (pair[0] * weight), acc[1] + (pair[1] * weight)];
    }, [0, 0]);

    return {
      key,
      pair: totalPopulation ? [weighted[0] / totalPopulation, weighted[1] / totalPopulation] : null,
    };
  });
  const rankedSegments = [...SEGMENTS].sort(
    (a, b) => (STUDY_METRICS[b.code]?.roi ?? -Infinity) - (STUDY_METRICS[a.code]?.roi ?? -Infinity)
  );
  const visibleSegments = rankedSegments.slice(0, 5);
  const visibleSegmentRows = visibleSegments.map((segment) => {
    const metrics = STUDY_METRICS[segment.code];
    const scf = SCF_BY_CODE[segment.code];
    const engagementCategory = scf > -0.25 ? "PERSUADE" : "MOBILIZE";
    const engagementColor = engagementCategory === "PERSUADE" ? C.cyan : C.violet;
    const accent = segmentColor(segment);
    const dashboardSegment = DASHBOARD_SEGMENTS.find((item) => item.code === segment.code);
    const preferredMessage = pickLeadMessage(segment.code);
    const avoidMessage = pickAvoidMessage(segment.code);
    const excludedMessageIds = new Set(avoidMessage?.id != null ? [avoidMessage.id] : []);
    const persuadeMessages = dashboardSegment
      ? pickTopMessageCells("persuasion_messaging", dashboardSegment.id, segment.code, excludedMessageIds)
      : [];
    const mobilizeMessages = dashboardSegment
      ? pickTopMessageCells("base_messaging", dashboardSegment.id, segment.code, excludedMessageIds)
      : [];
    const topPersuadeMessage = persuadeMessages.find((message) => message.sourceMetric === "persuasion_messaging") || null;
    const topReinforceMessage = mobilizeMessages.find((message) => message.sourceMetric === "base_messaging") || null;
    const messageBuckets = buildSegmentMessageBuckets(segment, dashboardSegment, preferredMessage);
    return {
      segment,
      metrics,
      accent,
      engagementCategory,
      engagementColor,
      messageBuckets,
      defaultMessages: [
        { bucketKey: "lead_with", title: "Lead With", metricType: "utility", message: messageBuckets.lead_with?.[0] || preferredMessage || null },
        { bucketKey: "persuade", title: "Persuade", metricType: "persuade", message: messageBuckets.persuade?.[0] || topPersuadeMessage || null },
        { bucketKey: "reinforce", title: "Reinforce", metricType: "reinforce", message: messageBuckets.reinforce?.[0] || topReinforceMessage || null },
      ],
      segmentQuote:
        trimQuote(
          preferredMessage?.quote
          || topPersuadeMessage?.quote
          || topReinforceMessage?.quote
          || ""
        ),
    };
  });
  const [savedMessagesBySegment, setSavedMessagesBySegment] = useState({});
  const [selectedSegmentCode, setSelectedSegmentCode] = useState(null);
  const selectedSegmentRow = visibleSegmentRows.find(({ segment }) => segment.code === selectedSegmentCode) || null;

  return (
    <div style={{ fontFamily: FONT, color: C.text }}>
      <PageHeader title="Executive Summary" accentColor={C.cyan} />
      <section
        style={{
          width: "100%",
          padding: 28,
          background: C.card,
          border: `1px solid ${C.cardBorder}`,
          borderRadius: 8,
          overflow: "visible",
        }}
      >
        <div style={{ display: "grid", gap: 18 }}>
          <div
            style={{
              display: "grid",
              gap: 8,
              padding: "16px 18px",
              border: `1px solid ${C.cardBorder}`,
              borderRadius: 8,
              background: PANEL_DEEP,
            }}
          >
            <SectionTitle>Target Outcomes</SectionTitle>
            <div style={{ fontSize: 16, lineHeight: 1.5, color: C.white, fontWeight: 700 }}>
              {EXECUTIVE_KEY_OUTCOMES}
            </div>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <SectionTitle>Total Pre / Post Results</SectionTitle>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={handleResetPrePost}
                  style={{
                    background: resetState === "reset" ? `${C.green}18` : resetState === "resetting" ? `${C.violet}12` : "transparent",
                    color: resetState === "reset" ? C.green : C.cyan,
                    border: `1px solid ${resetState === "reset" ? C.green : resetState === "resetting" ? C.violet : C.cardBorder}`,
                    borderRadius: 4,
                    padding: "6px 10px",
                    fontFamily: MONO,
                    fontSize: 10,
                    fontWeight: 800,
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                    transition: "background 180ms ease, color 180ms ease, border-color 180ms ease, transform 180ms ease",
                    transform: resetState === "resetting" ? "scale(1.03)" : "scale(1)",
                  }}
                >
                  {resetState === "resetting" ? "Resetting..." : resetState === "reset" ? "Reset" : "Reset"}
                </button>
              </div>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 8 }}>
              {selectedPrePostItems.map((itemKey, index) => (
                <div key={index} style={{ display: "grid", gap: 4, minWidth: 0 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Question {index + 1}
                  </label>
                  <select
                    value={itemKey}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setSelectedPrePostItems((current) =>
                        current.map((item, itemIndex) => (itemIndex === index ? nextValue : item))
                      );
                    }}
                    style={{
                      width: "100%",
                      minWidth: 0,
                      padding: "8px 10px",
                      background: C.cardBorder,
                      color: C.text,
                      border: `1px solid ${C.cardBorder}`,
                      borderRadius: 4,
                      fontFamily: FONT,
                      fontSize: 13,
                      cursor: "pointer",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {PREPOST_METRICS.map((metric) => (
                      <option key={metric.key} value={metric.key}>
                        {metric.label}: {metric.question}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
              {totalPrePost.map(({ key, pair }, index) => (
                <TotalPrePostCard key={`${index}-${key}`} title={key} pair={pair} />
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "240px minmax(0, 1fr)", gap: 18, alignItems: "baseline" }}>
              <SectionTitle>Target Audience</SectionTitle>
              <SectionTitle>{selectedSegmentRow ? "Selected Segment" : "Overarching Messages"}</SectionTitle>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "240px minmax(0, 1fr)", gap: 18, alignItems: "stretch" }}>
            <aside style={{ display: "grid", gap: 10, position: "sticky", top: 20, alignSelf: "start" }}>
              {visibleSegmentRows.map((row) => (
                <SegmentRailButton
                  key={row.segment.code}
                  segment={row.segment}
                  metrics={row.metrics}
                  accent={row.accent}
                  active={row.segment.code === selectedSegmentRow?.segment.code}
                  onToggle={() =>
                    setSelectedSegmentCode((current) => (
                      current === row.segment.code ? null : row.segment.code
                    ))
                  }
                />
              ))}
            </aside>

            <div style={{ minWidth: 0 }}>
              {selectedSegmentRow ? (
                <div style={{ display: "grid", gap: 10, minHeight: 520 }}>
                  <SegmentRow
                    key={selectedSegmentRow.segment.code}
                    segment={selectedSegmentRow.segment}
                    metrics={selectedSegmentRow.metrics}
                    accent={selectedSegmentRow.accent}
                    engagementCategory={selectedSegmentRow.engagementCategory}
                    engagementColor={selectedSegmentRow.engagementColor}
                    messageBuckets={selectedSegmentRow.messageBuckets}
                    segmentQuote={selectedSegmentRow.segmentQuote}
                    initialMessages={selectedSegmentRow.defaultMessages}
                    savedMessages={savedMessagesBySegment[selectedSegmentRow.segment.code] || selectedSegmentRow.defaultMessages}
                    onSaveMessages={(messages) =>
                      setSavedMessagesBySegment((current) => ({
                        ...current,
                        [selectedSegmentRow.segment.code]: messages,
                      }))
                    }
                  />
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12, minHeight: 520, height: "100%" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, minHeight: 0, height: "100%", gridAutoRows: "1fr" }}>
                    {OVERARCHING_MESSAGES.map((item) => (
                      <OverarchingThemeCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      </section>
    </div>
  );
}
