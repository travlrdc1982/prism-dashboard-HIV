import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DATA from "../data/studyData";
import { STUDY_METRICS, PREPOST_METRICS, PERSUADABILITY_LABELS, getAssignedTier } from "../data/study";
import PageHeader from "../components/PageHeader";
import SegmentCircle from "../components/MessageMap/SegmentCircle";
import { FONT, MONO } from "../data/theme";

// ─── Build segment data ───
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

// ─── ROW HEIGHTS ───
const H = {
  header: 140,
  roi: 70,
  persuasion: 260,
  prePostRow: 50,
  prePostPad: 32,
  toggle: 32,
  coalition: 105,
  activation: 105,
  influence: 105,
};

// ─── PALETTE ───
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
  violet: "#a78bfa",
};

function tierColor(t) { return t === 1 ? C.tier1 : t === 2 ? C.tier2 : C.tier3; }
function tierBg(t) { return t === 1 ? C.tier1Bg : t === 2 ? C.tier2Bg : C.tier3Bg; }
function tierLabel(t) { return t === 1 ? "TIER 1" : t === 2 ? "TIER 2" : "TIER 3"; }

// ─── MINI DONUT ───
function MiniDonut({ value, size = 53, color = C.accent, strokeW = 5 }) {
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value / 100);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", overflow: "visible" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={strokeW} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeW}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central" fill={C.text1}
        fontSize={Math.max(size * 0.30, 12)} fontWeight={700} fontFamily={MONO}
        style={{ transform: "rotate(90deg)", transformOrigin: "center" }}>{value}%</text>
    </svg>
  );
}

// ─── PERSUADABILITY BAR ───
function PBar({ data, h = 156, wide = false }) {
  const colors = [C.persuasion, C.accentLight, "#4a5568", "#2d3748", "#1a202c"];
  return (
    <div style={{
      width: wide ? "78%" : 52, maxWidth: 140,
      height: h, borderRadius: 5, overflow: "hidden",
      display: "flex", flexDirection: "column", border: `1px solid ${C.border}`,
    }}>
      {data.map((v, i) => (
        <div key={i} style={{
          height: `${v}%`, background: colors[i],
          display: "flex", alignItems: "center", justifyContent: "center",
          minHeight: v > 6 ? 16 : 0
        }}>
          {v >= 8 && <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", fontFamily: MONO }}>{v}%</span>}
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
        <span style={{ fontSize: 10, color: C.text3, letterSpacing: 0.5 }}>PRE</span>
        <span style={{ fontSize: 11, color: C.text2, fontWeight: 600 }}>{pre.toFixed(1)}</span>
      </div>
      <div style={rowStyle}>
        <span style={{ fontSize: 10, color: C.accent, letterSpacing: 0.5 }}>POST</span>
        <span style={{ fontSize: 11, color: C.text1, fontWeight: 700 }}>{post.toFixed(1)}</span>
      </div>
      <div style={rowStyle}>
        <span style={{ fontSize: 10, color: C.text3, letterSpacing: 0.5 }}>Δ</span>
        <span style={{ fontSize: 11, color: deltaColor, fontWeight: 800 }}>
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
        fontSize: 13, color: C.text2, fontFamily: MONO,
        cursor: "help", borderBottom: `1px dotted ${C.text3}`, paddingBottom: 1,
        fontWeight: 600,
      }}>
        {metric.label}
      </span>
      {hover && (
        <div style={{
          position: "absolute", left: 0, top: "100%", zIndex: 50,
          width: 280, padding: "10px 12px",
          background: "#1a2030", border: `1px solid ${C.accent}`,
          borderRadius: 6, boxShadow: "0 4px 16px rgba(0,0,0,0.5)"
        }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: C.accentLight,
            fontFamily: MONO, marginBottom: 6,
            textTransform: "uppercase", letterSpacing: 0.5
          }}>{metric.label}</div>
          <div style={{
            fontSize: 11, color: C.text1, fontFamily: FONT,
            lineHeight: 1.5, marginBottom: 8
          }}>{metric.question}</div>
          <div style={{
            fontSize: 11, color: C.accent, fontFamily: MONO,
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
// First-column labels — 1.5× bigger fonts so the row headers read as clearly
// as the segment data they label. Click to sort within party desc.
function SortableLabel({
  label, hint, accent = C.accentLight, swatchColor,
  active, onClick, height, hintAccent, children,
}) {
  return (
    <div style={{
      height, borderBottom: `1px solid ${C.border}`,
      padding: "10px 14px", display: "flex", flexDirection: "column",
      justifyContent: "center", cursor: onClick ? "pointer" : "default",
      background: active ? "rgba(91,147,199,0.10)" : "transparent",
      transition: "background 0.15s",
    }} onClick={onClick}>
      <div style={{
        fontSize: 15, fontWeight: 800, color: accent, fontFamily: FONT,
        textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6,
        display: "flex", alignItems: "center", gap: 7,
      }}>
        {swatchColor && (
          <span style={{
            width: 12, height: 12, borderRadius: 3, background: swatchColor,
            flexShrink: 0,
          }} />
        )}
        {label}
        {onClick && (
          <span style={{
            fontSize: 14, color: active ? accent : C.text3,
            marginLeft: "auto",
          }}>{active ? "▼" : "↕"}</span>
        )}
      </div>
      {hint && (
        <div style={{
          fontSize: 13, color: C.text2, fontFamily: FONT,
          lineHeight: 1.45, background: C.accentDim, borderRadius: 4,
          padding: "8px 10px",
          borderLeft: `3px solid ${hintAccent || C.accentMuted}`,
          marginBottom: children ? 8 : 0,
        }}>{hint}</div>
      )}
      {children}
    </div>
  );
}

// ─── SEGMENTED TOGGLE (matches MessageMap ViewOptions) ───
function Segmented({ options, value, onChange }) {
  return (
    <div style={{
      display: "inline-flex", borderRadius: 4, overflow: "hidden",
      border: `1px solid ${C.border}`,
    }}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button key={o.value}
            onClick={() => onChange(o.value)}
            title={o.title}
            style={{
              fontFamily: MONO, fontSize: 11, fontWeight: 700,
              letterSpacing: 0.8, textTransform: "uppercase",
              padding: "7px 12px",
              cursor: "pointer",
              border: "none",
              borderLeft: i === 0 ? "none" : `1px solid ${C.border}`,
              background: active ? C.violet : "transparent",
              color: active ? "#0f1520" : C.text2,
              transition: "background 0.12s, color 0.12s",
            }}>{o.label}</button>
        );
      })}
    </div>
  );
}

// ─── SEGMENT COLUMN ───
function SegmentColumn({ seg, expanded, widened, dim, onClick, onNav }) {
  const t = getAssignedTier(seg.code);
  const tc = tierColor(t);
  const prePostH = H.prePostPad + PRE_POST_METRICS.length * H.prePostRow;

  // Cell base — keeps content centered horizontally, vertically.
  const cellStyle = {
    width: "100%", display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    borderBottom: `1px solid ${C.border}`,
    padding: "10px 6px",
    overflow: "visible",
  };

  // Donut sizes (1.2× the previous values; widened scales up to fill the
  // wider column so the donut isn't visually trimmed inside its cell).
  const donutNormal = 53;
  const donutWidened = 88;
  const donutSize = widened ? donutWidened : donutNormal;
  const persuadDonut = widened ? donutWidened : 53;

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      width: "100%", minWidth: 0,
      opacity: dim ? 0.15 : 1,
      transition: "opacity 0.15s",
    }}>
      {/* HEADER — SegmentCircle top, TIER label bottom */}
      <div onClick={onClick} style={{
        width: "100%",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "space-between",
        borderBottom: `1px solid ${C.border}`,
        height: H.header, padding: "10px 4px 8px",
        cursor: "pointer", overflow: "visible",
      }}>
        <SegmentCircle seg={seg} widened={widened} />
        <span style={{
          fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 3,
          background: tierBg(t), color: tc, fontFamily: MONO,
          letterSpacing: 1,
        }}>{tierLabel(t)}</span>
      </div>

      {/* ROI SCORE — value only, no in-cell label */}
      <div style={{ ...cellStyle, height: H.roi }} onClick={onNav}>
        <div style={{
          fontSize: widened ? 30 : 24, fontWeight: 800, color: tc,
          fontFamily: MONO, lineHeight: 1, cursor: "pointer",
        }}>{seg.roi.toFixed(2)}</div>
      </div>

      {/* PERSUASION — donut + bar, no in-cell label */}
      <div style={{ ...cellStyle, height: H.persuasion, gap: 10 }}>
        <MiniDonut value={seg.persuadable} size={persuadDonut} color={C.persuasion} />
        <PBar data={seg.persuadability} h={widened ? 170 : 156} wide={widened} />
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

      {/* COALITION — supporters donut */}
      <div style={{ ...cellStyle, height: H.coalition }}>
        <MiniDonut value={seg.supporters} size={donutSize} color={C.coalition} />
      </div>

      {/* ACTIVATION */}
      <div style={{ ...cellStyle, height: H.activation }}>
        <MiniDonut value={seg.activation} size={donutSize} color={C.activation} />
      </div>

      {/* INFLUENCE360 */}
      <div style={{ ...cellStyle, height: H.influence, borderBottom: "none" }}>
        <MiniDonut value={seg.influence} size={donutSize} color={C.influence} />
      </div>
    </div>
  );
}

// ─── MAIN GRID ───
export default function AudienceROI() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [colFocus, setColFocus] = useState(null);
  const [sortMode, setSortMode] = useState("roi");
  const [columnMode, setColumnMode] = useState("all");   // "all" | "tier1"
  const prePostH = H.prePostPad + PRE_POST_METRICS.length * H.prePostRow;

  const segBandRef = useRef(null);

  // Tier-1 set (segments configured to Tier 1 via getAssignedTier)
  const tier1Set = useMemo(
    () => new Set(SEGMENTS.filter(s => getAssignedTier(s.code) === 1).map(s => s.id)),
    []
  );

  useEffect(() => {
    if (colFocus === null) return;
    const onDown = (e) => {
      if (segBandRef.current?.contains(e.target)) return;
      setColFocus(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [colFocus]);

  // Sort: within party, by chosen metric (desc).
  // columnMode "tier1": Tier-1 first by ROI; rest stay in order but dim to 0.4.
  const { orderedSegments } = useMemo(() => {
    const sortFn = (a, b) => (b[sortMode] ?? 0) - (a[sortMode] ?? 0);
    const gop = SEGMENTS.filter(s => s.party === "GOP").slice().sort(sortFn);
    const dem = SEGMENTS.filter(s => s.party === "DEM").slice().sort(sortFn);
    let order = [...gop, ...dem];
    if (columnMode === "tier1") {
      const roiSort = (a, b) => (b.roi ?? 0) - (a.roi ?? 0);
      const t1 = order.filter(s => tier1Set.has(s.id)).sort(roiSort);
      const rest = order.filter(s => !tier1Set.has(s.id));
      order = [...t1, ...rest];
    }
    return { orderedSegments: order };
  }, [sortMode, columnMode, tier1Set]);

  const tier1Dim = (segId) =>
    (columnMode === "tier1" && colFocus === null && !tier1Set.has(segId)) ? 0.4 : 1;

  // Grid template — columns widen on spotlight
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
        fontFamily: FONT, fontSize: 13, color: C.text2,
        marginBottom: 14, lineHeight: 1.5,
      }}>
        ROI = Population × (Persuasion + Coalition Value + Activation + Influence). Click any segment column to spotlight; click a metric label in the first column to re-sort.
      </div>

      {/* COLUMN-MODE TOGGLE — same widget as MessageMap ViewOptions */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14, marginBottom: 14,
      }}>
        <span style={{
          fontFamily: MONO, fontSize: 11, color: C.text3,
          letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700,
        }}>Columns</span>
        <Segmented
          value={columnMode}
          onChange={setColumnMode}
          options={[
            { value: "all", label: "All Audiences",
              title: "All 16 segments, sorted within party by chosen metric" },
            { value: "tier1", label: "Tier 1",
              title: "Tier-1 audiences first, sorted by ROI; others stay but dim" },
          ]}
        />
      </div>

      {/* Grid container */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `260px ${gridTemplate}`,
        gap: 0,
        background: C.card, borderRadius: 8,
        border: `1px solid ${C.border}`, overflow: "hidden",
        transition: "grid-template-columns 0.3s",
      }} ref={segBandRef}>

        {/* ═══ LEFT LABELS COLUMN (1.5× row-header fonts) ═══ */}
        <div style={{
          display: "flex", flexDirection: "column",
          borderRight: `1px solid ${C.border}`,
          background: "#0c1118",
        }}>
          {/* Header spacer */}
          <div style={{
            height: H.header, borderBottom: `1px solid ${C.border}`,
            padding: "12px 14px", display: "flex", flexDirection: "column",
            justifyContent: "flex-end",
          }}>
            <div style={{
              fontSize: 15, fontWeight: 800, color: C.text2, fontFamily: FONT,
              textTransform: "uppercase", letterSpacing: 1.5,
            }}>16 PRISM Segments</div>
            <div style={{
              fontSize: 12, color: C.text3, fontFamily: MONO, marginTop: 4,
            }}>sorted by {sortMode.toUpperCase()} desc{columnMode === "tier1" ? " (Tier-1 first)" : ""}</div>
          </div>

          {/* ROI label */}
          <SortableLabel
            label="ROI Score" height={H.roi}
            active={sortMode === "roi"}
            onClick={() => setSortMode("roi")}
          />

          {/* PERSUASION */}
          <SortableLabel
            label="Persuasion"
            hint="Did exposure move the audience toward our position?"
            height={H.persuasion}
            active={sortMode === "persuadable"}
            onClick={() => setSortMode("persuadable")}
            hintAccent={C.persuasion}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 4 }}>
              {persuadLabels.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 11, height: 11, borderRadius: 2, background: p.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: C.text2, fontFamily: FONT }}>{p.label}</span>
                </div>
              ))}
            </div>
          </SortableLabel>

          {/* Pre/Post expanded labels */}
          {expanded && (
            <div style={{
              height: prePostH, borderBottom: `1px solid ${C.border}`,
              padding: "4px 14px", background: "#0d1118",
              display: "flex", flexDirection: "column", justifyContent: "center"
            }}>
              <div style={{
                fontSize: 14, fontWeight: 800, color: C.accentLight,
                fontFamily: FONT, textTransform: "uppercase",
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
            display: "flex", alignItems: "center", padding: "0 14px"
          }}>
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                background: "none", border: `1px solid ${C.border}`, borderRadius: 4,
                color: C.text2, fontSize: 12, fontFamily: MONO,
                cursor: "pointer", padding: "6px 12px",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <span style={{
                display: "inline-block", transition: "transform 0.2s",
                transform: expanded ? "rotate(90deg)" : "rotate(0deg)", fontSize: 12
              }}>▸</span>
              {expanded ? "Hide" : "Show"} Pre/Post
            </button>
          </div>

          {/* COALITION */}
          <SortableLabel
            label="Coalition"
            hint="How many supporters can we predict will join our coalition?"
            swatchColor={C.coalition} height={H.coalition}
            active={sortMode === "supporters"}
            onClick={() => setSortMode("supporters")}
            hintAccent={C.coalition}
          />

          {/* ACTIVATION */}
          <SortableLabel
            label="Activation"
            hint="What is the probability of responding to a CTA and being mobilized?"
            swatchColor={C.activation} height={H.activation}
            active={sortMode === "activation"}
            onClick={() => setSortMode("activation")}
            hintAccent={C.activation}
          />

          {/* INFLUENCE */}
          <SortableLabel
            label="Influence360"
            hint="How likely is this audience to affect outcomes or influence others?"
            swatchColor={C.influence} height={H.influence}
            active={sortMode === "influence"}
            onClick={() => setSortMode("influence")}
            hintAccent={C.influence}
          />
        </div>

        {/* ═══ SEGMENT COLUMNS ═══ */}
        {orderedSegments.map(seg => {
          const widened = colFocus === seg.id;
          const dim = (colFocus !== null && colFocus !== seg.id);
          const t1d = tier1Dim(seg.id);
          const isLastGop = seg.party === "GOP" && (() => {
            const idx = orderedSegments.findIndex(s => s.id === seg.id);
            return orderedSegments[idx + 1]?.party === "DEM";
          })();
          return (
            <div key={seg.id} style={{
              borderRight: isLastGop ? `2px solid ${C.border}` : `1px solid ${C.border}`,
              minWidth: 0,
              opacity: t1d,
              transition: "opacity 0.15s",
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
