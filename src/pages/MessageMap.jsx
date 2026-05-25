import { useState, useMemo } from "react";
import DATA from "../data/studyData";
import { MESSAGES as STUDY_MESSAGES, CONTROL_SOP, VARIANT_SOP, STUDY_META } from "../data/study";
import { getTheme, TYPOGRAPHY, SPACING, BORDER_RADIUS } from "../data/designTokens";

const isDark = true;
const theme = getTheme(isDark);
const C = theme.colors;

// ─── SEGMENTS from shared data ───
const SEGMENTS = DATA.segments;

// ─── Wave-1 vs wave-2 detection ───
// If the SoP matrix is empty, this study hasn't been scored yet — render a placeholder list.
const HAS_SOP = Array.isArray(CONTROL_SOP) && CONTROL_SOP.length > 0;

// ─── Build message objects from study.js (wave-2 only) ───
const SEG_POPS = SEGMENTS.map(s => s.pop);
const POP_TOTAL = SEG_POPS.reduce((a, b) => a + b, 0);

function buildMessages(sopMatrix, useVariants) {
  return STUDY_MESSAGES.map((m, i) => {
    const segSops = sopMatrix[i];
    const wtTotal = segSops.reduce((sum, v, si) => sum + v * (SEG_POPS[si] / POP_TOTAL), 0);
    const text = useVariants
      ? (Object.values(m.variants || {})[0] || m.control || m.text)
      : (m.control || m.text);
    return {
      id: m.id,
      shortName: m.shortName,
      text,
      theme: m.theme,
      sop: [Math.round(wtTotal * 10) / 10, ...segSops],
      variants: m.variants,
      control: m.control,
    };
  });
}

// ─── Theme colors (from design tokens) ───
const THEME_COLORS = {
  Leadership: "#a78bfa",
  Security: "#f87171",
  Economy: "#34d399",
  Innovation: "#60a5fa",
  Patient: "#fbbf24",
  Other: "#94a3b8"
};

// ─── Party colors (from design tokens) ───
const PARTY_COLOR = { GOP: C.party.gop, DEM: C.party.dem };

function getSopC(v) {
  if (v >= 13) return { bg: C.tier.tier1Dark, t: C.tier.tier1Light };
  if (v >= 10) return { bg: C.tier.tier1Bg, t: C.tier.tier1Light };
  if (v >= 7)  return { bg: "#1a3a2a", t: "#a7f3d0" };
  if (v >= 6)  return { bg: C.bg.tertiary, t: C.text.secondary };
  if (v >= 5)  return { bg: "#1a1f2e", t: C.text.secondary };
  if (v >= 4)  return { bg: "#1a1520", t: C.text.secondary };
  if (v >= 3)  return { bg: "#1f1318", t: "#f9a8a8" };
  return { bg: "#2d1215", t: "#fca5a5" };
}

// Variant keys in study.js use spreadsheet column numbers, not segment IDs.
// This maps segment ID → variant key for the mismatched segments.
const SEG_TO_VARIANT = { 1:10, 2:1, 4:7, 7:4, 8:2, 10:8 };

function Tooltip({ msg, x, y, segIdx, isVariant }) {
  let displayText = msg.text;
  let variantLabel = null;
  if (isVariant && segIdx != null && msg.variants) {
    const segId = SEGMENTS[segIdx]?.id;
    const variantKey = SEG_TO_VARIANT[segId] || segId;
    if (variantKey && msg.variants[variantKey]) {
      displayText = msg.variants[variantKey];
      variantLabel = `Segment ${SEGMENTS[segIdx].code} variant`;
    } else {
      displayText = msg.control || msg.text;
      variantLabel = "Control (no segment variant)";
    }
  }
  return (
    <div style={{ position:"fixed", left:Math.min(x + 12, window.innerWidth - 420), top:Math.max(y - 80, 8), width:400, background: C.bg.secondary, border: `1px solid ${C.border.default}`, borderRadius: BORDER_RADIUS.md, padding: SPACING[3], zIndex:9999, pointerEvents:"none", boxShadow:"0 8px 32px rgba(0,0,0,0.6)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: SPACING[2] }}>
        <span style={{ fontFamily: TYPOGRAPHY.fontFamily.serif, fontSize: TYPOGRAPHY.fontSize.md, fontWeight: 700, color: C.text.primary, textTransform:"uppercase" }}>{msg.shortName}</span>
        {variantLabel && <span style={{ fontFamily: TYPOGRAPHY.fontFamily.mono, fontSize: TYPOGRAPHY.fontSize.xs, color: C.activation, background: "#2d1b69", padding: `${SPACING[1]} ${SPACING[2]}`, borderRadius: BORDER_RADIUS.sm }}>{variantLabel}</span>}
      </div>
      <div style={{ fontSize: TYPOGRAPHY.fontSize.sm, color: C.text.secondary, lineHeight: 1.6, fontStyle:"italic" }}>"{displayText}"</div>
    </div>
  );
}

// ─── Wave-1 placeholder: list-only view, no heatmap ───
function WavePlaceholder() {
  return (
    <div style={{ maxWidth:1100, margin:"0 auto", color: C.text.primary }}>
      <div style={{ marginBottom: SPACING[4] }}>
        <div style={{ fontSize: TYPOGRAPHY.fontSize.sm, color: C.text.secondary, lineHeight:1.5 }}>
          <strong style={{ color: C.text.primary }}>Message testing results available in Wave 2.</strong>{" "}
          Messages and stimulus text shown below for reference.
        </div>
        <div style={{ fontSize: TYPOGRAPHY.fontSize.xs, color: C.text.muted, marginTop: SPACING[2], fontFamily: TYPOGRAPHY.fontFamily.mono, letterSpacing: 0.5 }}>
          {STUDY_META?.nMessages || STUDY_MESSAGES.length} MESSAGES · {STUDY_META?.methodology || ""}
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap: SPACING[2] }}>
        {STUDY_MESSAGES.map(m => (
          <div key={m.id} style={{
            background: C.bg.secondary, border: `1px solid ${C.border.default}`, borderRadius: BORDER_RADIUS.md,
            padding: `${SPACING[2]} ${SPACING[3]}`, display:"flex", gap: SPACING[3], alignItems:"flex-start"
          }}>
            <div style={{
              minWidth:28, fontFamily: TYPOGRAPHY.fontFamily.mono, fontSize: TYPOGRAPHY.fontSize.xs, fontWeight:700,
              color: C.text.muted, padding:"2px 0"
            }}>{String(m.id).padStart(2,"0")}</div>

            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap: SPACING[2], marginBottom: SPACING[1] }}>
                <span style={{
                  fontFamily: TYPOGRAPHY.fontFamily.serif, fontSize: TYPOGRAPHY.fontSize.base, fontWeight:700, color: C.text.primary,
                  textTransform:"uppercase", letterSpacing: 0.5
                }}>{m.shortName}</span>
                {m.theme && (
                  <span style={{
                    fontFamily: TYPOGRAPHY.fontFamily.mono, fontSize: TYPOGRAPHY.fontSize.xs, color: C.text.muted,
                    background: `rgba(0,0,0,0.3)`, padding: `1px ${SPACING[2]}`, borderRadius: BORDER_RADIUS.sm,
                    textTransform:"uppercase", letterSpacing: 0.5
                  }}>{m.theme}</span>
                )}
              </div>
              <div style={{ fontSize: TYPOGRAPHY.fontSize.sm, color: C.text.secondary, lineHeight:1.55, fontStyle:"italic" }}>
                "{m.text}"
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MessageMap() {
  return HAS_SOP ? <Heatmap /> : <WavePlaceholder />;
}

function Heatmap() {
  const [sortCol, setSortCol] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [variantMode, setVariantMode] = useState("control");
  const [hoverRow, setHoverRow] = useState(null);
  const [hoverCol, setHoverCol] = useState(null);

  const isVariant = variantMode === "persona";
  const MESSAGES = buildMessages(isVariant ? VARIANT_SOP : CONTROL_SOP, isVariant);

  const sorted = useMemo(() => {
    const ix = MESSAGES.map((m, i) => ({ ...m, idx: i }));
    if (sortCol === null) return ix;
    return [...ix].sort((a, b) => MESSAGES[b.idx].sop[sortCol] - MESSAGES[a.idx].sop[sortCol]);
  }, [sortCol, variantMode, MESSAGES]);

  const totalIdx = 0;
  const segStartIdx = 1;

  const isColActive = (colIdx) => hoverCol === colIdx;
  const isRowActive = (rowKey) => hoverRow === rowKey;

  return (
    <div style={{ maxWidth:1650, margin:"0 auto", color: C.text.primary }}>
      {/* Description */}
      <div style={{ marginBottom: SPACING[3] }}>
        <div style={{ fontSize: TYPOGRAPHY.fontSize.sm, color: C.text.secondary, maxWidth:1100, lineHeight:1.5 }}>
          <strong style={{ color: C.text.primary }}>Share of Preference</strong> heatmap <span style={{ color: C.text.muted }}>(a measure from a discrete choice model depicting how likely a message is chosen as the most compelling relative to other messages)</span> · {STUDY_META?.nMessages || STUDY_MESSAGES.length}-item {STUDY_META?.methodology || "MaxDiff · 16 PRISM segments"}.
        </div>
      </div>

      {/* Persona variant toggle */}
      <div style={{ display:"flex", gap: SPACING[1], marginBottom: SPACING[2], alignItems:"center" }}>
        {[{ k:"control", l:"CONTROL" }, { k:"persona", l:"PERSONA VARIANTS" }].map(v => (
          <button key={v.k} onClick={() => { setVariantMode(v.k); setSortCol(null); }} style={{
            fontFamily: TYPOGRAPHY.fontFamily.mono, fontSize: TYPOGRAPHY.fontSize.xs, letterSpacing: 0.5,
            padding: `${SPACING[1]} ${SPACING[3]}`, border:"1px solid", borderRadius: BORDER_RADIUS.sm, cursor:"pointer",
            borderColor: variantMode === v.k ? C.activation : C.border.default,
            background: variantMode === v.k ? "#2d1b69" : C.bg.secondary,
            color: variantMode === v.k ? "#c4b5fd" : C.text.muted,
            transition:"all 0.15s"
          }}>{v.l}</button>
        ))}
        {isVariant && (
          <span style={{ fontSize: TYPOGRAPHY.fontSize.xs, color: C.activation, fontFamily: TYPOGRAPHY.fontFamily.mono, marginLeft: SPACING[2] }}>
            Hover a segment column to see its tailored variant text
          </span>
        )}
      </div>

      {/* Legend */}
      <div style={{ display:"flex", gap: SPACING[3], alignItems:"center", marginBottom: SPACING[2], flexWrap:"wrap" }}>
        <span style={{ fontFamily: TYPOGRAPHY.fontFamily.mono, fontSize: TYPOGRAPHY.fontSize.xs, color: C.text.muted, letterSpacing: 1 }}>SoP:</span>
        {[{ l:"≤6", bg:"#2d1215" }, { l:"7-8", bg:"#1a1520" }, { l:"9-10", bg:"#1e293b" }, { l:"11-12", bg: C.tier.tier1Bg }, { l:"≥13", bg: C.tier.tier1Dark }].map((h, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap: SPACING[1] }}>
            <div style={{ width:10, height:10, borderRadius: BORDER_RADIUS.sm, background:h.bg, border: `1px solid ${C.border.default}` }} />
            <span style={{ fontSize: TYPOGRAPHY.fontSize.xs, color: C.text.secondary }}>{h.l}</span>
          </div>
        ))}
        <span style={{ marginLeft: SPACING[2], fontFamily: TYPOGRAPHY.fontFamily.mono, fontSize: TYPOGRAPHY.fontSize.xs, color: C.text.muted, letterSpacing: 1 }}>THEME:</span>
        {Object.entries(THEME_COLORS).filter(([t]) => t !== "Other").map(([t, c]) => (
          <div key={t} style={{ display:"flex", alignItems:"center", gap: SPACING[1] }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:c }} />
            <span style={{ fontSize: TYPOGRAPHY.fontSize.xs, color: C.text.secondary }}>{t}</span>
          </div>
        ))}
      </div>

      {/* Heatmap table */}
      <div style={{ overflowX:"auto", marginBottom: SPACING[1] }}>
        <table style={{ width:"100%", borderCollapse:"separate", borderSpacing:1, fontSize: TYPOGRAPHY.fontSize.sm }}>
          <thead>
            {/* ─── ROW 1: Party group headers ─── */}
            <tr>
              <th colSpan={3} style={{ background: C.bg.secondary, padding: SPACING[1] }} />
              <th style={{ background: C.tier.tier1Bg, color: C.tier.tier1, fontFamily: TYPOGRAPHY.fontFamily.mono, fontSize: TYPOGRAPHY.fontSize.xs, letterSpacing: 2, padding:"3px 0", textAlign:"center", borderBottom: `2px solid ${C.tier.tier1}` }}>TOTAL</th>
              <th colSpan={10} style={{ background: "#1a0a0a", color: C.party.gop, fontFamily: TYPOGRAPHY.fontFamily.mono, fontSize: TYPOGRAPHY.fontSize.xs, letterSpacing: 2, padding:"3px 0", textAlign:"center", borderBottom: `2px solid ${C.party.gop}` }}>REPUBLICAN</th>
              <th colSpan={6} style={{ background: "#0a0a1a", color: C.party.dem, fontFamily: TYPOGRAPHY.fontFamily.mono, fontSize: TYPOGRAPHY.fontSize.xs, letterSpacing: 2, padding:"3px 0", textAlign:"center", borderBottom: `2px solid ${C.party.dem}` }}>DEMOCRAT</th>
            </tr>

            {/* ─── ROW 2: Segment headers ─── */}
            <tr>
              <th style={{ background: C.bg.secondary, width:24, padding: SPACING[1] }} />
              <th style={{ background: C.bg.secondary, textAlign:"left", width:140, fontFamily: TYPOGRAPHY.fontFamily.mono, fontSize: TYPOGRAPHY.fontSize.xs, color: C.text.muted, padding: `2px ${SPACING[1]}`, verticalAlign:"bottom" }}>MESSAGE</th>
              <th style={{ background: C.bg.secondary, width:40, fontFamily: TYPOGRAPHY.fontFamily.mono, fontSize: TYPOGRAPHY.fontSize.xs, color: C.text.muted, padding: SPACING[1], verticalAlign:"bottom" }}>THEME</th>

              {/* ── TOTAL column header ── */}
              <th
                onClick={() => setSortCol(sortCol === totalIdx ? null : totalIdx)}
                onMouseEnter={() => setHoverCol(totalIdx)}
                onMouseLeave={() => setHoverCol(null)}
                style={{
                  background: sortCol === totalIdx ? "#1a2332" : C.tier.tier1Bg,
                  minWidth:62, padding: `${SPACING[2]} ${SPACING[1]} ${SPACING[1.5]}`, cursor:"pointer",
                  verticalAlign:"bottom", textAlign:"center",
                  borderBottom: sortCol === totalIdx ? `2px solid ${C.interactive.active}` : "2px solid transparent",
                  transition:"all 0.15s",
                }}
              >
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap: SPACING[1] }}>
                  <div style={{
                    width:30, height:30, borderRadius:"50%", border: `2px solid ${C.tier.tier1}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize: TYPOGRAPHY.fontSize.xs, fontWeight:800, color: C.tier.tier1,
                    fontFamily: TYPOGRAPHY.fontFamily.mono,
                    background: sortCol === totalIdx ? `rgba(52,211,153,0.12)` : "transparent"
                  }}>ALL</div>
                  <div style={{
                    fontSize: TYPOGRAPHY.fontSize.xs, fontWeight:700, color: C.tier.tier1,
                    fontFamily: TYPOGRAPHY.fontFamily.mono, textAlign:"center",
                    lineHeight:1.2
                  }}>TOTAL</div>
                  {sortCol === totalIdx && <div style={{ fontSize: TYPOGRAPHY.fontSize.xs, color: C.interactive.active }}>▼</div>}
                </div>
              </th>

              {/* ── SEGMENT column headers ── */}
              {SEGMENTS.map((seg, si) => {
                const colIdx = si + segStartIdx;
                const isSorted = sortCol === colIdx;
                const pc = PARTY_COLOR[seg.party] || C.text.secondary;
                return (
                  <th
                    key={seg.id}
                    onClick={() => setSortCol(isSorted ? null : colIdx)}
                    onMouseEnter={() => setHoverCol(colIdx)}
                    onMouseLeave={() => setHoverCol(null)}
                    style={{
                      background: isSorted ? "#1a2332" : "#000",
                      minWidth:68, padding: `${SPACING[2]} ${SPACING[1]} ${SPACING[1.5]}`, cursor:"pointer",
                      verticalAlign:"bottom", textAlign:"center",
                      borderBottom: isSorted ? `2px solid ${C.interactive.active}` : "2px solid transparent",
                      transition:"all 0.15s",
                    }}
                  >
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap: SPACING[1] }}>
                      <div style={{
                        width:30, height:30, borderRadius:"50%", border: `2px solid ${pc}`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize: TYPOGRAPHY.fontSize.xs, fontWeight:800, color: pc,
                        fontFamily: TYPOGRAPHY.fontFamily.mono,
                        background: isSorted ? `${pc}18` : "transparent"
                      }}>{seg.code || seg.id}</div>
                      <div style={{
                        fontSize: TYPOGRAPHY.fontSize.xs, fontWeight:700, color: pc,
                        fontFamily: TYPOGRAPHY.fontFamily.mono, textAlign:"center",
                        lineHeight:1.2, minHeight:22, display:"flex", alignItems:"center",
                        justifyContent:"center", padding:"0 1px"
                      }}>{seg.name.toUpperCase()}</div>
                      <div style={{
                        fontSize: TYPOGRAPHY.fontSize.xs, color: C.text.muted,
                        fontFamily: TYPOGRAPHY.fontFamily.mono
                      }}>{seg.pop}%</div>
                      {isSorted && <div style={{ fontSize: TYPOGRAPHY.fontSize.xs, color: C.interactive.active }}>▼</div>}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {sorted.map((msg) => {
              const sop = MESSAGES[msg.idx].sop;
              const rowActive = isRowActive(msg.id);
              const rowBrightness = rowActive ? "brightness(1.18)" : "brightness(1)";

              return (
              <tr
                key={msg.id}
                onMouseEnter={() => setHoverRow(msg.id)}
                onMouseLeave={() => setHoverRow(null)}
                style={{ filter:rowBrightness, transition:"filter 0.1s" }}
              >
                {/* Row # */}
                <td style={{ background: C.bg.secondary, textAlign:"center", fontFamily: TYPOGRAPHY.fontFamily.mono, fontSize: TYPOGRAPHY.fontSize.xs, color: C.text.muted, fontWeight:700, padding: SPACING[1] }}>{msg.id}</td>

                {/* Message name — TOOLTIP */}
                <td
                  onMouseEnter={e => setTooltip({ msg, x:e.clientX, y:e.clientY, segIdx:null })}
                  onMouseMove={e => setTooltip(t2 => t2 ? { ...t2, x:e.clientX, y:e.clientY } : null)}
                  onMouseLeave={() => setTooltip(null)}
                  style={{
                    background: rowActive ? "#1a2030" : C.bg.secondary,
                    fontFamily: TYPOGRAPHY.fontFamily.serif, fontSize: TYPOGRAPHY.fontSize.sm, color: C.text.secondary,
                    fontWeight:600, padding: `${SPACING[1]} ${SPACING[1]}`, whiteSpace:"nowrap", cursor:"help",
                    borderLeft: rowActive ? `2px solid ${C.interactive.active}` : "2px solid transparent",
                    transition:"all 0.1s"
                  }}
                >{msg.shortName}</td>

                {/* Theme badge */}
                <td style={{ background: rowActive ? "#1a2030" : C.bg.secondary, textAlign:"center", padding: SPACING[1] }}>
                  <span style={{ fontSize: TYPOGRAPHY.fontSize.xs, fontFamily: TYPOGRAPHY.fontFamily.mono, padding: `1px ${SPACING[1]}`, borderRadius: BORDER_RADIUS.sm, background:`rgba(0,0,0,0.3)`, color:THEME_COLORS[msg.theme] || C.text.secondary, fontWeight:600 }}>{(msg.theme || "").toUpperCase()}</span>
                </td>

                {/* ── Total cell ── */}
                {(() => { const val = sop[totalIdx], { bg, t: tx } = getSopC(val), isSel = sortCol === totalIdx, isHovC = isColActive(totalIdx); return (
                  <td
                    onMouseEnter={() => setHoverCol(totalIdx)}
                    onMouseLeave={() => setHoverCol(null)}
                    style={{
                      textAlign:"center", borderRadius: BORDER_RADIUS.sm,
                      background: isHovC || isSel ? `${bg}` : bg,
                      fontFamily: TYPOGRAPHY.fontFamily.mono, fontWeight:700, fontSize: TYPOGRAPHY.fontSize.base, color:tx,
                      padding: `${SPACING[1]} ${SPACING[1]}`, minWidth:62,
                      opacity: (isSel || isHovC || rowActive) ? 1 : 0.85,
                      transition:"all 0.1s",
                      borderLeft: `2px solid ${C.tier.tier1}`, borderRight: `2px solid ${C.border.default}`,
                      boxShadow: (isHovC && rowActive) ? `inset 0 0 0 1px rgba(96,165,250,0.5)` : "none"
                    }}>{val.toFixed(1)}</td>
                ); })()}

                {/* ── Segment cells ── */}
                {SEGMENTS.map((seg, si) => { const colIdx = si + segStartIdx; const val = sop[colIdx], { bg, t: tx } = getSopC(val), isSel = sortCol === colIdx, isHovC = isColActive(colIdx); return (
                  <td key={seg.id}
                    onMouseEnter={e => { setHoverCol(colIdx); setTooltip({ msg, x:e.clientX, y:e.clientY, segIdx:si }); }}
                    onMouseMove={e => setTooltip(t2 => t2 ? { ...t2, x:e.clientX, y:e.clientY } : null)}
                    onMouseLeave={() => { setHoverCol(null); setTooltip(null); }}
                    style={{
                      textAlign:"center", borderRadius: BORDER_RADIUS.sm,
                      background: isHovC || isSel ? `${bg}` : bg,
                      fontFamily: TYPOGRAPHY.fontFamily.mono, fontWeight:700, fontSize: TYPOGRAPHY.fontSize.base, color:tx,
                      padding: `${SPACING[1]} ${SPACING[1]}`, minWidth:68,
                      opacity: (isSel || isHovC || rowActive) ? 1 : 0.85,
                      transition:"all 0.1s",
                      boxShadow: (isHovC && rowActive) ? `inset 0 0 0 1px rgba(96,165,250,0.5)` : "none",
                      cursor: isVariant ? "help" : "default"
                    }}>{val.toFixed(1)}</td>
                ); })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {tooltip && <Tooltip msg={tooltip.msg} x={tooltip.x} y={tooltip.y} segIdx={tooltip.segIdx} isVariant={isVariant} />}
    </div>
  );
}
