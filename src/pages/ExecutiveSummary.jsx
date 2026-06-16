import { useState } from "react";
import PageHeader from "../components/PageHeader";
import { C, FONT, MONO } from "../data/theme";
import { STUDY_METRICS } from "../data/study";
import hivSegData from "../data/hiv/seg_data.json";
import { CensusDivisionMap, SEGMENTS } from "./SegmentProfile";

const PANEL = C.card;
const PANEL_DEEP = "#0a0f1a";
const TRACK = C.cardBorder;
const PERSUADE = "#5b93c7";
const SUPPORT = C.partyDEM;
const ACTIVATE = C.violet;
const INFLUENCE = "#818cf8";
const SCF_BY_CODE = Object.fromEntries(
  Object.values(hivSegData).map((segment) => [segment.name, segment.SCF_raw])
);

function segmentColor(segment) {
  return segment.party === "GOP" ? C.partyGOP : C.partyDEM;
}

function Donut({ label, value, subLabel, size = 72, valueColor = C.white }) {
  const ring = Math.max(7, Math.round(size * 0.11));
  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 7, minWidth: size + 12 }}>
      <div
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: `conic-gradient(${PERSUADE} 0 58%, ${TRACK} 58% 61%, ${SUPPORT} 61% 81%, ${TRACK} 81% 85%, ${ACTIVATE} 85% 94%, ${INFLUENCE} 94% 100%)`,
          position: "relative",
          boxShadow: "0 0 0 1px rgba(148,163,184,0.18)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: ring,
            borderRadius: "50%",
            background: PANEL_DEEP,
            boxShadow: "inset 0 0 0 1px rgba(148,163,184,0.08)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            textAlign: "center",
          }}
        >
          <div>
            <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 800, color: valueColor, lineHeight: 1 }}>
              {value}
            </div>
            {subLabel ? (
              <div style={{ marginTop: 2, fontSize: 8, color: valueColor, fontWeight: 700, lineHeight: 1.2 }}>
                {subLabel}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div style={{
        fontFamily: MONO,
        fontSize: 10,
        color: C.textMuted,
        fontWeight: 700,
        letterSpacing: 0.8,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}>{label}</div>
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
        minHeight: 76,
        display: "flex",
        alignItems: "center",
        padding: "12px 14px",
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 6,
        background: PANEL_DEEP,
      }}
    >
      <Placeholder size={14}>{children}</Placeholder>
    </div>
  );
}

function MessageSlot({ children }) {
  return (
    <div
      style={{
        minHeight: 76,
        display: "flex",
        alignItems: "center",
        padding: "12px 14px",
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 6,
        background: PANEL_DEEP,
      }}
    >
      <Placeholder size={14}>{children}</Placeholder>
    </div>
  );
}

function PrePostFinding({ title, metricLabel, pair }) {
  if (!pair) {
    return <FindingSlot>[{title}]</FindingSlot>;
  }

  const [pre, post] = pair;
  const delta = +(post - pre).toFixed(1);
  const deltaColor = delta > 0 ? C.green : delta < 0 ? C.red : C.textMuted;

  return (
    <div
      style={{
        minHeight: 76,
        display: "grid",
        alignItems: "center",
        padding: "12px 14px",
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 6,
        background: PANEL_DEEP,
        gap: 8,
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: 0.8, textTransform: "uppercase" }}>
        {title}
      </div>
      {metricLabel ? (
        <div style={{ marginTop: -2, fontFamily: MONO, fontSize: 9, fontWeight: 700, color: C.textDim, letterSpacing: 0.4 }}>
          {metricLabel}
        </div>
      ) : null}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.text }}>{pre.toFixed(1)}</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: C.textDim }}>→</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.white, fontWeight: 700 }}>{post.toFixed(1)}</span>
        <span style={{ fontFamily: MONO, fontSize: 13, color: deltaColor, fontWeight: 800, marginLeft: "auto" }}>
          {delta > 0 ? "+" : ""}
          {delta}
        </span>
      </div>
    </div>
  );
}

export default function ExecutiveSummary() {
  const [activeCode, setActiveCode] = useState(SEGMENTS[0]?.code);
  const activeSegment = SEGMENTS.find((segment) => segment.code === activeCode) || SEGMENTS[0];
  const activeMetrics = STUDY_METRICS[activeSegment.code];
  const activeScf = SCF_BY_CODE[activeSegment.code];
  const engagementCategory = activeScf > -0.25 ? "PERSUADE" : "MOBILIZE";
  const engagementColor = engagementCategory === "PERSUADE" ? C.cyan : C.violet;
  const accent = segmentColor(activeSegment);
  const maleShare = parseInt(activeSegment.demo.male, 10) || 50;
  const nonwhiteShare = parseInt(activeSegment.demo.nonwhite, 10) || 0;
  const whiteShare = 100 - nonwhiteShare;

  return (
    <div style={{ fontFamily: FONT, color: C.text }}>
      <PageHeader title="Executive Summary" accentColor={C.cyan} />

      <section
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "24px 28px 30px",
          background: C.card,
          border: `1px solid ${C.cardBorder}`,
          borderRadius: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 18,
            alignItems: "flex-start",
          }}
        >
          <aside
            style={{
              width: 158,
              flex: "0 0 158px",
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
                color: C.textDim,
                padding: "2px 6px 6px",
              }}
            >
              Segments
            </div>
            {SEGMENTS.map((segment) => {
              const selected = segment.code === activeSegment.code;
              const color = segmentColor(segment);
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
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: 10,
                      fontWeight: selected ? 700 : 500,
                    }}
                  >
                    {segment.name}
                  </span>
                </button>
              );
            })}
          </aside>

          <div style={{ flex: "1 1 640px", minWidth: 0 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
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
                  flex: "1 1 320px",
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

            <div
              style={{
                maxWidth: 820,
                color: C.text,
                fontSize: 13,
                lineHeight: 1.55,
                fontWeight: 500,
                marginBottom: 24,
                padding: "12px 14px",
                border: `1px solid ${C.cardBorder}`,
                borderRadius: 6,
                background: PANEL_DEEP,
              }}
            >
              [Two sentence AI generated synthesis, bound by the information in the “Key Findings,” “ROI,” and Messaging Guidance” sections]
            </div>

            <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
              <SectionTitle>About</SectionTitle>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(320px, 1.45fr) repeat(2, minmax(84px, 0.4fr)) minmax(300px, 1.5fr)",
                  gap: 16,
                  alignItems: "center",
                }}
              >
                <div style={{ padding: "10px 12px", border: `1px solid ${C.cardBorder}`, borderRadius: 6, background: PANEL_DEEP }}>
                  <Placeholder size={13} italic>{activeSegment.persona.believe}</Placeholder>
                </div>
                <Donut label="Male" value={activeSegment.demo.male} size={54} valueColor={C.cyan} />
                <Donut label="White" value={`${whiteShare}%`} size={54} valueColor={C.cyan} />
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 12 }}>
                <PrePostFinding title="Pre-Post 1" metricLabel="QPRE_1r1 / QPOST_1r1" pair={activeMetrics?.prePost?.item1} />
                <PrePostFinding title="Pre-Post 2" metricLabel="QPRE_5 / QPOST_5" pair={activeMetrics?.prePost?.item5} />
                <FindingSlot>[Dynamic Field #1]</FindingSlot>
                <FindingSlot>[Dynamic Field #2]</FindingSlot>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <SectionTitle>Messaging Guidance</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))", gap: 12 }}>
                <MessageSlot>[Top Preferred Message]</MessageSlot>
                <MessageSlot>[Top Persuade Message]</MessageSlot>
                <MessageSlot>[Top Mobilize Message]</MessageSlot>
              </div>
            </div>
          </div>

          <aside
            style={{
              flex: "1 1 380px",
              maxWidth: 460,
              minWidth: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 130px), 1fr))",
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
                  gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))",
                  gap: 12,
                  alignItems: "start",
                }}
              >
                <Donut label="Persuadable" value={activeMetrics?.persuadable != null ? `${activeMetrics.persuadable}%` : "--"} size={58} />
                <Donut label="Supporters" value={activeMetrics?.supporters != null ? `${activeMetrics.supporters}%` : "--"} size={58} />
                <Donut label="Activation" value={activeMetrics?.activation != null ? `${activeMetrics.activation}%` : "--"} size={58} />
                <Donut label="Influence360" value={activeMetrics?.influence != null ? `${activeMetrics.influence}%` : "--"} size={58} />
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
