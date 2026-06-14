import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DATA from "../data/studyData";
import { STUDY_METRICS, PREPOST_METRICS, PERSUADABILITY_LABELS, getAssignedTier } from "../data/study";
import PageHeader from "../components/PageHeader";
import SegmentCircle from "../components/MessageMap/SegmentCircle";
import { FONT, MONO } from "../data/theme";

// ─── Build segment data by merging shared 16-segment skeleton with study-specific metrics ───
const HIV_SEGMENTS = DATA.segments.map(seg => {
  const m = STUDY_METRICS[seg.code];
  if (!m) return { ...seg, roi:0, highRoi:0, persuadable:0, persuadability:[0,0,0,0,0], supporters:0, activation:0, influence:0, prePost:{}, tier:3 };
  return {
    ...seg,
    roi: m.roi,
    highRoi: m.highRoi,
    persuadable: m.persuadable ?? 0,
    supporters: m.supporters,
    activation: m.activation,
    influence: m.influence,
    persuadability: m.persuadability,
    prePost: m.prePost,
    tier: m.tier,
  };
});

const SEGMENTS = HIV_SEGMENTS;
const PRE_POST_METRICS = PREPOST_METRICS;

// ─── ROW HEIGHTS (bumped for ≥9px fonts) ───
const H = {
  header: 130,
  roi: 60,
  persuasion: 240,
  prePostRow: 50,
  prePostPad: 32,
  toggle: 32,
  coalition: 90,
  activation: 90,
  influence: 90,
};

// ─── PALETTE (MessageMap-aligned) ───
const C = {
  bg: "#080c16",
  card: "#0f1520",
  border: "#1e293b",
  text1: "#f1f5f9",
  text2: "#94a3b8",
  text3: "#64748b",
  accent: "#5b93c7",
  accentLight: "#7eb3e0",
  accentMuted: "#3a6a94",
  accentDim: "#1a2030",
  tier1: "#34d399", tier1Bg: "#064e3b",
  tier2: "#eab308", tier2Bg: "#854d0e",
  tier3: "#ef4444", tier3Bg: "#991b1b",
  activation: "#a78bfa",
  influence: "#818cf8",
  coalition: "#3b82f6",
  persuasion: "#5b93c7",
};

function tierColor(t) { return t === 1 ? C.tier1 : t === 2 ? C.tier2 : C.tier3; }
function tierBg(t) { return t === 1 ? C.tier1Bg : t === 2 ? C.tier2Bg : C.tier3Bg; }
function tierLabel(t) { return t === 1 ? "TIER 1" : t === 2 ? "TIER 2" : "TIER 3"; }

// ─── MINI DONUT ───
function MiniDonut({ value, size = 44, color = C.accent, strokeW = 4 }) {
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value / 100);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={strokeW} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeW}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central" fill={C.text1}
        fontSize={Math.max(size * 0.28, 11)} fontWeight={700} fontFamily={MONO}
        style={{ transform: "rotate(90deg)", transformOrigin: "center" }}>{value}%</text>
    </svg>
  );
}

// ─── PERSUADABILITY BAR ───
function PBar({ data, h = 140, wide = false }) {
  const colors = [C.persuasion, C.accentLight, "#4a5568", "#2d3748", "#1a202c"];
  return (
    <div style={{
      width: wide ? "78%" : 44, maxWidth: 120,
      height: h, borderRadius: 5, overflow: "hidden",
      display: "flex", flexDirection: "column", border: `1px solid ${C.border}`,
    }}>
      {data.map((v, i) => (
        <div key={i} style={{
          height: `${v}%`, background: colors[i],
          display: "flex", alignItems: "center", justifyContent: "center",
          minHeight: v > 6 ? 14 : 0
        }}>
          {v >= 8 && <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", fontFamily: MONO }}>{v}%</span>}
        </div>
      ))}
    </div>
  );
}

// ─── PRE/POST DELTA DISPLAY ───
function DeltaBar({ pre, post }) {
  const delta = +(post - pre).toFixed(1);
  const isPos = delta > 0;
  const isNeg = delta < 0;
  const deltaColor = isPos ? "#34d399" : isNeg ? "#ef4444" : C.text3;
  const rowStyle = {
    display: "flex", justifyContent: "space-between", alignItems: "baseline",
    width: "100%", padding: "0 6px", fontFamily: MONO,
  };
  return (
    <div style={{
      display: "flex", flexDirection: "column", justifyContent: "center",
      gap: 2, height: H.prePostRow,
      borderBottom: `1px dotted ${C.border}`, padding: "2px 0",
    }}>
      <div style={rowStyle}>
        <span style={{ fontSize: 9, color: C.text3, letterSpacing: 0.5 }}>PRE</span>
        <span style={{ fontSize: 10, color: C.text2, fontWeight: 600 }}>{pre.toFixed(1)}</span>
      </div>
      <div style={rowStyle}>
        <span style={{ fontSize: 9, color: C.accent, letterSpacing: 0.5 }}>POST</span>
        <span style={{ fontSize: 10, color: C.text1, fontWeight: 700 }}>{post.toFixed(1)}</span>
      </div>
      <div style={rowStyle}>
        <span style={{ fontSize: 9, color: C.text3, letterSpacing: 0.5 }}>Δ</span>
        <span style={{ fontSize: 10, color: deltaColor, fontWeight: 800 }}>
          {isPos ? "+" : ""}{delta}
        </span>
      </div>
    </div>
  );
}

// ─── HOVER TOOLTIP for pre/post labels ───
function MetricLabel({ metric }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      style={{
        height: H.prePostRow, display: "flex", alignItems: "center", position: "relative",
        borderBottom: `1px dotted ${C.border}`, padding: "2px 0",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span style={{
        fontSize: 10, color: C.text2, fontFamily: MONO,
        cursor: "help", borderBottom: `1px dotted ${C.text3}`, paddingBottom: 1
      }}>
        {metric.label}
      </span>
      {hover && (
        <div style={{
          position: "absolute", left: 0, top: "100%", zIndex: 50,
          width: 260, padding: "10px 12px",
          background: "#1a2030", border: `1px solid ${C.accent}`,
          borderRadius: 6, boxShadow: "0 4px 16px rgba(0,0,0,0.5)"
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: C.accentLight,
            fontFamily: MONO, marginBottom: 6,
            textTransform: "uppercase", letterSpacing: 0.5
          }}>{metric.label}</div>
          <div style={{
            fontSize: 10, color: C.text1, fontFamily: MONO,
            lineHeight: 1.5, marginBottom: 8
          }}>{metric.question}</div>
          <div style={{
            fontSize: 9, color: C.accent, fontFamily: MONO,
            lineHeight: 1.4, paddingTop: 6, borderTop: `1px solid ${C.border}`
          }}>
            <span style={{ fontWeight: 700 }}>Showing:</span> {metric.scale}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SORTABLE LEFT-LABEL ROW ───
// Click to sort segments (within party) by that field, descending.
function SortableLabel({
  label, hint, accent = C.accentLight, swatchColor,
  active, onClick, height, hintAccent, children,
}) {
  return (
    <div style={{
      height, borderBottom: `1px solid ${C.border}`,
      padding: "8px 12px", display: "flex", flexDirection: "column",
      justifyContent: "center", cursor: onClick ? "pointer" : "default",
      background: active ? "rgba(91,147,199,0.08)" : "transparent",
      transition: "background 0.15s",
    }} onClick={onClick}>
      <div style={{
        fontSize: 10, fontWeight: 800, color: accent, fontFamily: MONO,
        textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        {swatchColor && (
          <span style={{
            width: 8, height: 8, borderRadius: 2, background: swatchColor,
          }} />
        )}
        {label}
        {onClick && (
          <span style={{
            fontSize: 9, color: active ? accent : C.text3,
            marginLeft: "auto",
          }}>{active ? "▼" : "↕"}</span>
        )}
      </div>
      {hint && (
        <div style={{
          fontSize: 9, color: C.text2, fontFamily: MONO,
          lineHeight: 1.45, background: C.accentDim, borderRadius: 4,
          padding: "6px 8px",
          borderLeft: `2px solid ${hintAccent || C.accentMuted}`,
          marginBottom: children ? 8 : 0,
        }}>{hint}</div>
      )}
      {children}
    </div>
  );
}

// ─── SEGMENT COLUMN ───
function SegmentColumn({ seg, expanded, widened, dim, onClick, onNav }) {
  const t = getAssignedTier(seg.code);
  const tc = tierColor(t);
  const prePostH = H.prePostPad + PRE_POST_METRICS.length * H.prePostRow;

  const cellStyle = {
    width: "100%", display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    borderBottom: `1px solid ${C.border}`,
    padding: "8px 4px",
  };
  const valueStyle = {
    fontSize: widened ? 14 : 11, color: C.text2,
    fontFamily: MONO, marginTop: 4, letterSpacing: 0.5,
    textTransform: "uppercase", fontWeight: 700,
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      width: "100%", minWidth: 0,
      opacity: dim ? 0.15 : 1,
      transition: "opacity 0.15s",
    }}>
      {/* HEADER — SegmentCircle (matches MessageMap) */}
      <div onClick={onClick} style={{
        ...cellStyle, height: H.header, cursor: "pointer",
        padding: "10px 4px 8px",
        gap: 4,
      }}>
        <SegmentCircle seg={seg} widened={widened} />
        <span style={{
          fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 3,
          background: tierBg(t), color: tc, fontFamily: MONO,
          letterSpacing: 0.8, marginTop: 4,
        }}>{tierLabel(t)}</span>
        <div style={{
          fontSize: 9, color: C.text3, fontFamily: MONO,
        }}>{seg.pop}% pop</div>
      </div>

      {/* ROI SCORE */}
      <div style={{ ...cellStyle, height: H.roi }} onClick={onNav}>
        <div style={{
          fontSize: widened ? 26 : 20, fontWeight: 800, color: tc,
          fontFamily: MONO, lineHeight: 1, cursor: "pointer",
        }}>{seg.roi.toFixed(2)}</div>
        <div style={valueStyle}>ROI</div>
      </div>

      {/* PERSUASION */}
      <div style={{ ...cellStyle, height: H.persuasion, gap: 8 }}>
        <MiniDonut value={seg.persuadable} size={widened ? 56 : 44} color={C.persuasion} />
        <div style={{
          fontSize: 9, color: C.text3, fontFamily: MONO,
          letterSpacing: 0.5, textTransform: "uppercase",
        }}>% Persuadable</div>
        <PBar data={seg.persuadability} h={widened ? 150 : 130} wide={widened} />
      </div>

      {/* PRE/POST EXPANDED */}
      {expanded && (
        <div style={{
          borderBottom: `1px solid ${C.border}`, width: "100%",
          display: "flex", flexDirection: "column",
          background: "#0d1118", height: prePostH,
          padding: "4px 3px", justifyContent: "center"
        }}>
          <div style={{ height: H.prePostPad - 8 }} />
          {PRE_POST_METRICS.map((m) => {
            const pp = seg.prePost[m.key];
            if (!pp) return null;
            return <DeltaBar key={m.key} pre={pp[0]} post={pp[1]} />;
          })}
        </div>
      )}

      {/* TOGGLE SPACER */}
      <div style={{
        height: H.toggle, borderBottom: `1px solid ${C.border}`, width: "100%"
      }} />

      {/* COALITION */}
      <div style={{ ...cellStyle, height: H.coalition }}>
        <MiniDonut value={seg.supporters} size={widened ? 56 : 46} color={C.coalition} />
        <div style={valueStyle}>Supporters</div>
      </div>

      {/* ACTIVATION */}
      <div style={{ ...cellStyle, height: H.activation }}>
        <MiniDonut value={seg.activation} size={widened ? 56 : 46} color={C.activation} />
        <div style={valueStyle}>Activation</div>
      </div>

      {/* INFLUENCE — now a donut for consistency */}
      <div style={{ ...cellStyle, height: H.influence, borderBottom: "none" }}>
        <MiniDonut value={seg.influence} size={widened ? 56 : 46} color={C.influence} />
        <div style={valueStyle}>Influence360</div>
      </div>
    </div>
  );
}

// ─── MAIN GRID ───
export default function AudienceROI() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [colFocus, setColFocus] = useState(null);    // seg.id
  const [sortMode, setSortMode] = useState("roi");   // default: ROI desc
  const prePostH = H.prePostPad + PRE_POST_METRICS.length * H.prePostRow;

  const segBandRef = useRef(null);

  // Click-outside-to-close column spotlight (mirrors MessageMap)
  useEffect(() => {
    if (colFocus === null) return;
    const onDown = (e) => {
      if (segBandRef.current?.contains(e.target)) return;
      setColFocus(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [colFocus]);

  // Within-party sort by selected metric (descending). Default ROI.
  const { gopSegs, demSegs, orderedSegments } = useMemo(() => {
    const sortFn = (a, b) => (b[sortMode] ?? 0) - (a[sortMode] ?? 0);
    const gop = SEGMENTS.filter(s => s.party === "GOP").slice().sort(sortFn);
    const dem = SEGMENTS.filter(s => s.party === "DEM").slice().sort(sortFn);
    return { gopSegs: gop, demSegs: dem, orderedSegments: [...gop, ...dem] };
  }, [sortMode]);

  // Grid template — segment columns widen when spotlit (matches MessageMap)
  const gridTemplate = orderedSegments.map(seg => (
    colFocus === seg.id ? "minmax(180px, 3fr)" : "minmax(60px, 1fr)"
  )).join(" ");

  const toggleColFocus = (segId) => {
    setColFocus(prev => prev === segId ? null : segId);
  };

  const persuadLabels = PERSUADABILITY_LABELS.map((label, i) => ({
    label, color: [C.persuasion, C.accentLight, "#4a5568", "#2d3748", "#1a202c"][i],
  }));

  return (
    <div style={{ maxWidth: 1800, margin: "0 auto", color: C.text1, fontFamily: FONT }}>
      <PageHeader title="Audience ROI" />
      <div style={{
        fontFamily: MONO, fontSize: 11, color: C.text3,
        marginBottom: 18, letterSpacing: 0.5,
      }}>
        ROI = Population × (Persuasion + Coalition Value + Activation + Influence). Click any segment to spotlight. Click metric labels to sort.
      </div>

      {/* Grid container — same overall shape as MessageMap */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `220px ${gridTemplate}`,
        gap: 0,
        background: C.card, borderRadius: 8,
        border: `1px solid ${C.border}`, overflow: "hidden",
        transition: "grid-template-columns 0.3s",
      }} ref={segBandRef}>

        {/* ═══ LEFT LABELS COLUMN ═══ */}
        <div style={{
          gridRow: "1 / span 8",
          display: "flex", flexDirection: "column",
          borderRight: `1px solid ${C.border}`,
          background: "#0c1118",
        }}>
          {/* Header spacer */}
          <div style={{
            height: H.header, borderBottom: `1px solid ${C.border}`,
            padding: "10px 12px", display: "flex", flexDirection: "column",
            justifyContent: "flex-end",
          }}>
            <div style={{
              fontSize: 10, fontWeight: 800, color: C.text2, fontFamily: MONO,
              textTransform: "uppercase", letterSpacing: 1.5,
            }}>16 PRISM Segments</div>
            <div style={{
              fontSize: 9, color: C.text3, fontFamily: MONO, marginTop: 2,
            }}>sorted by {sortMode.toUpperCase()} desc</div>
          </div>

          {/* ROI label — sortable, active by default */}
          <SortableLabel
            label="ROI Score" height={H.roi}
            active={sortMode === "roi"}
            onClick={() => setSortMode("roi")}
          />

          {/* PERSUASION label */}
          <SortableLabel
            label="Persuasion"
            hint="Did exposure move the audience toward our position?"
            height={H.persuasion}
            active={sortMode === "persuadable"}
            onClick={() => setSortMode("persuadable")}
            hintAccent={C.persuasion}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {persuadLabels.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 9, height: 9, borderRadius: 2, background: p.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 9, color: C.text2, fontFamily: MONO }}>{p.label}</span>
                </div>
              ))}
            </div>
          </SortableLabel>

          {/* Pre/Post expanded labels */}
          {expanded && (
            <div style={{
              height: prePostH, borderBottom: `1px solid ${C.border}`,
              padding: "4px 12px", background: "#0d1118",
              display: "flex", flexDirection: "column", justifyContent: "center"
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: C.accentLight,
                fontFamily: MONO, textTransform: "uppercase",
                letterSpacing: 1, marginBottom: 4, height: H.prePostPad - 8,
                display: "flex", alignItems: "flex-end"
              }}>Pre → Post Δ</div>
              {PRE_POST_METRICS.map((m) => (
                <MetricLabel key={m.key} metric={m} />
              ))}
            </div>
          )}

          {/* Toggle */}
          <div style={{
            height: H.toggle, borderBottom: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", padding: "0 12px"
          }}>
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                background: "none", border: `1px solid ${C.border}`, borderRadius: 4,
                color: C.text2, fontSize: 10, fontFamily: MONO,
                cursor: "pointer", padding: "5px 10px",
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              <span style={{
                display: "inline-block", transition: "transform 0.2s",
                transform: expanded ? "rotate(90deg)" : "rotate(0deg)", fontSize: 10
              }}>▸</span>
              {expanded ? "Hide" : "Show"} Pre/Post
            </button>
          </div>

          {/* COALITION — sortable */}
          <SortableLabel
            label="Coalition"
            hint="How many supporters can we predict will join our coalition?"
            swatchColor={C.coalition} height={H.coalition}
            active={sortMode === "supporters"}
            onClick={() => setSortMode("supporters")}
            hintAccent={C.coalition}
          />

          {/* ACTIVATION — sortable */}
          <SortableLabel
            label="Activation"
            hint="What is the probability of responding to a CTA and being mobilized?"
            swatchColor={C.activation} height={H.activation}
            active={sortMode === "activation"}
            onClick={() => setSortMode("activation")}
            hintAccent={C.activation}
          />

          {/* INFLUENCE — sortable */}
          <SortableLabel
            label="Influence360"
            hint="How likely is this audience to affect outcomes or influence others?"
            swatchColor={C.influence} height={H.influence}
            active={sortMode === "influence"}
            onClick={() => setSortMode("influence")}
            hintAccent={C.influence}
          />
        </div>

        {/* ═══ SEGMENT COLUMNS (grid cells; spotlight widens / fades) ═══ */}
        {orderedSegments.map(seg => {
          const widened = colFocus === seg.id;
          const dim = colFocus !== null && colFocus !== seg.id;
          // Party divider — give GOP/DEM blocks visible separation
          const isLastGop = seg.party === "GOP" && (() => {
            const idx = orderedSegments.findIndex(s => s.id === seg.id);
            return orderedSegments[idx + 1]?.party === "DEM";
          })();
          return (
            <div key={seg.id} style={{
              borderRight: isLastGop ? `2px solid ${C.border}` : `1px solid ${C.border}`,
              minWidth: 0,
            }}>
              <SegmentColumn
                seg={seg}
                expanded={expanded}
                widened={widened}
                dim={dim}
                onClick={() => toggleColFocus(seg.id)}
                onNav={() => navigate('/profile?seg=' + seg.code)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
