import { useState } from "react";
import PageHeader from "../components/PageHeader";
import { C, FONT, MONO } from "../data/theme";
import { SEGMENTS } from "./SegmentProfile";

const PANEL = C.card;
const PANEL_DEEP = "#0a0f1a";
const TRACK = C.cardBorder;
const PERSUADE = "#5b93c7";
const SUPPORT = C.partyDEM;
const ACTIVATE = C.violet;
const INFLUENCE = "#818cf8";

function segmentColor(segment) {
  return segment.party === "GOP" ? C.partyGOP : C.partyDEM;
}

function Donut({ label, size = 72 }) {
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

export default function ExecutiveSummary() {
  const [activeCode, setActiveCode] = useState(SEGMENTS[0]?.code);
  const activeSegment = SEGMENTS.find((segment) => segment.code === activeCode) || SEGMENTS[0];
  const accent = segmentColor(activeSegment);

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
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
                  gap: 16,
                  alignItems: "center",
                }}
              >
                <div style={{ padding: "10px 12px", border: `1px solid ${C.cardBorder}`, borderRadius: 6, background: PANEL_DEEP }}>
                  <Placeholder size={13} italic>{activeSegment.persona.believe}</Placeholder>
                </div>
                <Donut label="Age" size={54} />
                <Donut label="Sex" size={54} />
                <div
                  style={{
                    minHeight: 96,
                    display: "grid",
                    placeItems: "center",
                    color: C.text,
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 6,
                    border: `1px dashed ${C.cardBorder}`,
                    background:
                      "linear-gradient(90deg, rgba(96,165,250,0.08) 1px, transparent 1px), linear-gradient(0deg, rgba(167,139,250,0.06) 1px, transparent 1px)",
                    backgroundSize: "22px 22px",
                  }}
                >
                  [Primary Geography w/ map]
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
              <SectionTitle>Key Findings</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 12 }}>
                <FindingSlot>[Pre-Post #1]</FindingSlot>
                <FindingSlot>[Pre-Post #2]</FindingSlot>
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
              <div style={{ color: C.green, fontFamily: MONO, fontSize: 28, fontWeight: 800 }}>X.XX</div>
            </div>

            <div>
              <div style={{ color: C.textMuted, fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Engagement Category</div>
              <div style={{ fontSize: 14, fontWeight: 900, fontFamily: MONO, marginBottom: 18 }}>
                <span style={{ color: C.cyan }}>[PERSUADE</span>
                <span style={{ color: C.violet }}>/MOBILIZE]</span>
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
                <Donut label="Persuadable" size={58} />
                <Donut label="Supporters" size={58} />
                <Donut label="Activation" size={58} />
                <Donut label="Influence360" size={58} />
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
