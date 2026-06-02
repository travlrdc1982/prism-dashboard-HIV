import { useState, useMemo } from "react";
import DATA from "../data/studyData";
import { MESSAGES as STUDY_MESSAGES, CONTROL_SOP, VARIANT_SOP, STUDY_META } from "../data/study";

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

// ─── Theme colors ───
const THEME_COLORS = {
  Leadership:"#a78bfa", Security:"#f87171", Economy:"#34d399",
  Innovation:"#60a5fa", Patient:"#fbbf24", Other:"#94a3b8"
};

// ─── Party colors ───
const PARTY_COLOR = { GOP: "#e57373", DEM: "#64b5f6" };

function getSopC(v) {
  if (v >= 13) return { bg:"#065f46", t:"#6ee7b7" };
  if (v >= 10) return { bg:"#064e3b", t:"#6ee7b7" };
  if (v >= 7)  return { bg:"#1a3a2a", t:"#a7f3d0" };
  if (v >= 6)  return { bg:"#1e293b", t:"#cbd5e1" };
  if (v >= 5)  return { bg:"#1a1f2e", t:"#94a3b8" };
  if (v >= 4)  return { bg:"#1a1520", t:"#94a3b8" };
  if (v >= 3)  return { bg:"#1f1318", t:"#f9a8a8" };
  return { bg:"#2d1215", t:"#fca5a5" };
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
    <div style={{ position:"fixed", left:Math.min(x + 12, window.innerWidth - 420), top:Math.max(y - 80, 8), width:400, background:"#111827", border:"1px solid #334155", borderRadius:6, padding:12, zIndex:9999, pointerEvents:"none", boxShadow:"0 8px 32px rgba(0,0,0,0.6)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <span style={{ fontFamily:"'Poppins',sans-serif", fontSize:13, fontWeight:700, color:"#e2e8f0", textTransform:"uppercase" }}>{msg.shortName}</span>
        {variantLabel && <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:8, color:"#a78bfa", background:"#2d1b69", padding:"2px 6px", borderRadius:3 }}>{variantLabel}</span>}
      </div>
      <div style={{ fontSize:11, color:"#cbd5e1", lineHeight:1.6, fontStyle:"italic" }}>"{displayText}"</div>
    </div>
  );
}

// ─── Wave-1 placeholder: list-only view, no heatmap ───
function WavePlaceholder() {
  return (
    <div style={{ maxWidth:1100, margin:"0 auto", color:"#e2e8f0" }}>
      <div style={{
        display:"flex", justifyContent:"space-between", alignItems:"flex-end",
        marginBottom:20, paddingBottom:16, borderBottom:"1px solid #1e293b",
      }}>
        <div>
          <h1 style={{
            fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:700,
            color:"#f1f5f9", letterSpacing:2.5, textTransform:"uppercase", margin:0,
          }}>MESSAGE MAP</h1>
          <div style={{ fontSize:9, color:"#64748b", marginTop:4, fontFamily:"'JetBrains Mono',monospace", letterSpacing:0.5 }}>
            Message testing results available in Wave 2 · {STUDY_META?.nMessages || STUDY_MESSAGES.length} messages shown for reference
          </div>
        </div>
        <div style={{
          fontFamily:"'JetBrains Mono',monospace", fontSize:8, color:"#475569",
          letterSpacing:1, textTransform:"uppercase",
        }}>
          {STUDY_META?.methodology || ""}
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {STUDY_MESSAGES.map(m => (
          <div key={m.id} style={{
            background:"#111827", border:"1px solid #1e293b", borderRadius:6,
            padding:"10px 14px", display:"flex", gap:14, alignItems:"flex-start"
          }}>
            <div style={{
              minWidth:28, fontFamily:"'JetBrains Mono',monospace", fontSize:10, fontWeight:700,
              color:"#64748b", padding:"2px 0"
            }}>{String(m.id).padStart(2,"0")}</div>

            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
                <span style={{
                  fontFamily:"'Poppins',sans-serif", fontSize:12, fontWeight:700, color:"#e2e8f0",
                  textTransform:"uppercase", letterSpacing:0.5
                }}>{m.shortName}</span>
                {m.theme && (
                  <span style={{
                    fontFamily:"'JetBrains Mono',monospace", fontSize:8, color:"#94a3b8",
                    background:"rgba(0,0,0,0.3)", padding:"1px 6px", borderRadius:3,
                    textTransform:"uppercase", letterSpacing:0.5
                  }}>{m.theme}</span>
                )}
              </div>
              <div style={{ fontSize:11, color:"#cbd5e1", lineHeight:1.55, fontStyle:"italic" }}>
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
    <div style={{ maxWidth:1650, margin:"0 auto", color:"#e2e8f0" }}>
      {/* Page header */}
      <div style={{
        display:"flex", justifyContent:"space-between", alignItems:"flex-end",
        marginBottom:16, paddingBottom:16, borderBottom:"1px solid #1e293b",
      }}>
        <div>
          <h1 style={{
            fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:700,
            color:"#f1f5f9", letterSpacing:2.5, textTransform:"uppercase", margin:0,
          }}>MESSAGE MAP</h1>
          <div style={{ fontSize:9, color:"#64748b", marginTop:4, fontFamily:"'JetBrains Mono',monospace", letterSpacing:0.5 }}>
            Share of Preference — discrete choice model · {STUDY_META?.nMessages || STUDY_MESSAGES.length} messages · {STUDY_META?.methodology || "MaxDiff · 16 PRISM segments"}
          </div>
        </div>

        {/* Mode toggle — prominent in header */}
        <div style={{ display:"flex", gap:0, background:"#0d1118", borderRadius:6, border:"1px solid #1e293b", overflow:"hidden" }}>
          {[{ k:"control", l:"CONTROL" }, { k:"persona", l:"PERSONA VARIANTS" }].map((v, i) => (
            <button key={v.k} onClick={() => { setVariantMode(v.k); setSortCol(null); }} style={{
              fontFamily:"'JetBrains Mono',monospace", fontSize:9, letterSpacing:1,
              padding:"7px 16px",
              border:"none",
              borderRight: i === 0 ? "1px solid #1e293b" : "none",
              cursor:"pointer",
              background: variantMode === v.k ? "#2d1b69" : "transparent",
              color: variantMode === v.k ? "#c4b5fd" : "#475569",
              fontWeight: variantMode === v.k ? 700 : 400,
              transition:"all 0.15s",
            }}>{v.l}</button>
          ))}
        </div>
      </div>

      {isVariant && (
        <div style={{ fontSize:8, color:"#a78bfa", fontFamily:"'JetBrains Mono',monospace", marginBottom:8, letterSpacing:0.5 }}>
          Hover a segment column to see its tailored variant text
        </div>
      )}

      {/* Legend */}
      <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:6, flexWrap:"wrap" }}>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:7, color:"#475569", letterSpacing:1 }}>SoP:</span>
        {[{ l:"≤6", bg:"#2d1215" }, { l:"7-8", bg:"#1a1520" }, { l:"9-10", bg:"#1e293b" }, { l:"11-12", bg:"#064e3b" }, { l:"≥13", bg:"#065f46" }].map((h, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:2 }}>
            <div style={{ width:10, height:10, borderRadius:2, background:h.bg, border:"1px solid #1e293b" }} />
            <span style={{ fontSize:7, color:"#94a3b8" }}>{h.l}</span>
          </div>
        ))}
        <span style={{ marginLeft:10, fontFamily:"'JetBrains Mono',monospace", fontSize:7, color:"#475569", letterSpacing:1 }}>THEME:</span>
        {Object.entries(THEME_COLORS).filter(([t]) => t !== "Other").map(([t, c]) => (
          <div key={t} style={{ display:"flex", alignItems:"center", gap:2 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:c }} />
            <span style={{ fontSize:7, color:"#94a3b8" }}>{t}</span>
          </div>
        ))}
      </div>

      {/* Heatmap table */}
      <div style={{ overflowX:"auto", marginBottom:2 }}>
        <table style={{ width:"100%", borderCollapse:"separate", borderSpacing:1, fontSize:11 }}>
          <thead>
            {/* ─── ROW 1: Party group headers ─── */}
            <tr>
              <th colSpan={3} style={{ background:"#111827", padding:2 }} />
              <th style={{ background:"#0a1a0a", color:"#34d399", fontFamily:"'JetBrains Mono',monospace", fontSize:8, letterSpacing:2, padding:"3px 0", textAlign:"center", borderBottom:"2px solid #34d399" }}>TOTAL</th>
              <th colSpan={10} style={{ background:"#1a0a0a", color:"#f87171", fontFamily:"'JetBrains Mono',monospace", fontSize:8, letterSpacing:2, padding:"3px 0", textAlign:"center", borderBottom:"2px solid #f87171" }}>REPUBLICAN</th>
              <th colSpan={6} style={{ background:"#0a0a1a", color:"#60a5fa", fontFamily:"'JetBrains Mono',monospace", fontSize:8, letterSpacing:2, padding:"3px 0", textAlign:"center", borderBottom:"2px solid #60a5fa" }}>DEMOCRAT</th>
            </tr>

            {/* ─── ROW 2: Segment headers ─── */}
            <tr>
              <th style={{ background:"#111827", width:24, padding:2 }} />
              <th style={{ background:"#111827", textAlign:"left", width:140, fontFamily:"'JetBrains Mono',monospace", fontSize:7, color:"#64748b", padding:"2px 4px", verticalAlign:"bottom" }}>MESSAGE</th>
              <th style={{ background:"#111827", width:40, fontFamily:"'JetBrains Mono',monospace", fontSize:7, color:"#64748b", padding:2, verticalAlign:"bottom" }}>THEME</th>

              {/* ── TOTAL column header ── */}
              <th
                onClick={() => setSortCol(sortCol === totalIdx ? null : totalIdx)}
                onMouseEnter={() => setHoverCol(totalIdx)}
                onMouseLeave={() => setHoverCol(null)}
                style={{
                  background: sortCol === totalIdx ? "#1a2332" : "#0a1208",
                  minWidth:62, padding:"8px 2px 6px", cursor:"pointer",
                  verticalAlign:"bottom", textAlign:"center",
                  borderBottom: sortCol === totalIdx ? "2px solid #60a5fa" : "2px solid transparent",
                  transition:"all 0.15s",
                }}
              >
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                  <div style={{
                    width:30, height:30, borderRadius:"50%", border:"2px solid #34d399",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:7, fontWeight:800, color:"#34d399",
                    fontFamily:"'JetBrains Mono',monospace",
                    background: sortCol === totalIdx ? "rgba(52,211,153,0.12)" : "transparent"
                  }}>ALL</div>
                  <div style={{
                    fontSize:6, fontWeight:700, color:"#34d399",
                    fontFamily:"'JetBrains Mono',monospace", textAlign:"center",
                    lineHeight:1.2
                  }}>TOTAL</div>
                  {sortCol === totalIdx && <div style={{ fontSize:7, color:"#60a5fa" }}>▼</div>}
                </div>
              </th>

              {/* ── SEGMENT column headers ── */}
              {SEGMENTS.map((seg, si) => {
                const colIdx = si + segStartIdx;
                const isSorted = sortCol === colIdx;
                const pc = PARTY_COLOR[seg.party] || "#cbd5e1";
                return (
                  <th
                    key={seg.id}
                    onClick={() => setSortCol(isSorted ? null : colIdx)}
                    onMouseEnter={() => setHoverCol(colIdx)}
                    onMouseLeave={() => setHoverCol(null)}
                    style={{
                      background: isSorted ? "#1a2332" : "#000",
                      minWidth:68, padding:"8px 2px 6px", cursor:"pointer",
                      verticalAlign:"bottom", textAlign:"center",
                      borderBottom: isSorted ? "2px solid #60a5fa" : "2px solid transparent",
                      transition:"all 0.15s",
                    }}
                  >
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                      <div style={{
                        width:30, height:30, borderRadius:"50%", border:`2px solid ${pc}`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:7, fontWeight:800, color:pc,
                        fontFamily:"'JetBrains Mono',monospace",
                        background: isSorted ? `${pc}18` : "transparent"
                      }}>{seg.code || seg.id}</div>
                      <div style={{
                        fontSize:6, fontWeight:700, color:pc,
                        fontFamily:"'JetBrains Mono',monospace", textAlign:"center",
                        lineHeight:1.2, minHeight:22, display:"flex", alignItems:"center",
                        justifyContent:"center", padding:"0 1px"
                      }}>{seg.name.toUpperCase()}</div>
                      <div style={{
                        fontSize:7, color:"#64748b",
                        fontFamily:"'JetBrains Mono',monospace"
                      }}>{seg.pop}%</div>
                      {isSorted && <div style={{ fontSize:7, color:"#60a5fa" }}>▼</div>}
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
                <td style={{ background:"#111827", textAlign:"center", fontFamily:"'JetBrains Mono',monospace", fontSize:7, color:"#64748b", fontWeight:700, padding:2 }}>{msg.id}</td>

                {/* Message name — TOOLTIP */}
                <td
                  onMouseEnter={e => setTooltip({ msg, x:e.clientX, y:e.clientY, segIdx:null })}
                  onMouseMove={e => setTooltip(t2 => t2 ? { ...t2, x:e.clientX, y:e.clientY } : null)}
                  onMouseLeave={() => setTooltip(null)}
                  style={{
                    background: rowActive ? "#1a2030" : "#111827",
                    fontFamily:"'Poppins',sans-serif", fontSize:11, color:"#cbd5e1",
                    fontWeight:600, padding:"3px 4px", whiteSpace:"nowrap", cursor:"help",
                    borderLeft: rowActive ? "2px solid #60a5fa" : "2px solid transparent",
                    transition:"all 0.1s"
                  }}
                >{msg.shortName}</td>

                {/* Theme badge */}
                <td style={{ background: rowActive ? "#1a2030" : "#111827", textAlign:"center", padding:2 }}>
                  <span style={{ fontSize:6, fontFamily:"'JetBrains Mono',monospace", padding:"1px 4px", borderRadius:3, background:"rgba(0,0,0,0.3)", color:THEME_COLORS[msg.theme] || "#94a3b8", fontWeight:600 }}>{(msg.theme || "").toUpperCase()}</span>
                </td>

                {/* ── Total cell ── */}
                {(() => { const val = sop[totalIdx], { bg, t: tx } = getSopC(val), isSel = sortCol === totalIdx, isHovC = isColActive(totalIdx); return (
                  <td
                    onMouseEnter={() => setHoverCol(totalIdx)}
                    onMouseLeave={() => setHoverCol(null)}
                    style={{
                      textAlign:"center", borderRadius:2,
                      background: isHovC || isSel ? `${bg}` : bg,
                      fontFamily:"'JetBrains Mono',monospace", fontWeight:700, fontSize:12, color:tx,
                      padding:"6px 2px", minWidth:62,
                      opacity: (isSel || isHovC || rowActive) ? 1 : 0.85,
                      transition:"all 0.1s",
                      borderLeft:"2px solid #34d399", borderRight:"2px solid #1e293b",
                      boxShadow: (isHovC && rowActive) ? "inset 0 0 0 1px rgba(96,165,250,0.5)" : "none"
                    }}>{val.toFixed(1)}</td>
                ); })()}

                {/* ── Segment cells ── */}
                {SEGMENTS.map((seg, si) => { const colIdx = si + segStartIdx; const val = sop[colIdx], { bg, t: tx } = getSopC(val), isSel = sortCol === colIdx, isHovC = isColActive(colIdx); return (
                  <td key={seg.id}
                    onMouseEnter={e => { setHoverCol(colIdx); setTooltip({ msg, x:e.clientX, y:e.clientY, segIdx:si }); }}
                    onMouseMove={e => setTooltip(t2 => t2 ? { ...t2, x:e.clientX, y:e.clientY } : null)}
                    onMouseLeave={() => { setHoverCol(null); setTooltip(null); }}
                    style={{
                      textAlign:"center", borderRadius:2,
                      background: isHovC || isSel ? `${bg}` : bg,
                      fontFamily:"'JetBrains Mono',monospace", fontWeight:700, fontSize:12, color:tx,
                      padding:"6px 2px", minWidth:68,
                      opacity: (isSel || isHovC || rowActive) ? 1 : 0.85,
                      transition:"all 0.1s",
                      boxShadow: (isHovC && rowActive) ? "inset 0 0 0 1px rgba(96,165,250,0.5)" : "none",
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
