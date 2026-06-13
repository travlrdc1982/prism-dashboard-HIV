// SegmentSummaryDrawer — view-agnostic strategic brief for a single
// audience. Triggered by colFocus (clicking a segment circle in ANY
// view); slides in from the right; renders the same 4 cards no matter
// which measurement view is active in the background.
//
// All five fields are DETERMINISTIC from dashboard.json — no
// hand-picked findings, no LLM curation. Rules:
//
//   LEAD WITH        max utility_signed among messages with
//                    utility_signed >= +0.03 AND sop_pct >= median
//                    Surfaces σ-tie warning when top-3 SoP < 1 σ apart.
//   AVOID            min utility_signed where utility_signed <= −0.05
//                    Surfaces "still works for owned channels" when
//                    that message has top-quartile Base lift.
//   PERSUADE WITH    top 3 cells from message_map_cells.persuasion_messaging
//                    (this segment), ranked by lift_shrunk DESC,
//                    significant first (CI excludes 0). If <3 sig,
//                    fills from top unsignificant with a "test" tag.
//   REINFORCE BASE   same rule applied to message_map_cells.base_messaging.
//
// Action chips ([→ View]) flip the outcome card AND focus the chosen
// message × this segment in the new view (cube focal, column spotlight).
import { useMemo } from "react";
import dashboard from "../../data/topline/dashboard.json";
import { C, FONT, MONO } from "../../data/theme";

const ACCENT_BY_OUTCOME = {
  sop: "#22d3ee",
  utility: "#a78bfa",
  persuasion_messaging: "#34d399",
  base_messaging: "#60a5fa",
};

// ───────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────
function proofLabelFor(msg, proof_v) {
  if (proof_v === 0) return "no proof";
  const p = msg?.proofs?.[proof_v - 1];
  if (!p || p.short_label === "base") return "no proof";
  return p.short_label;
}
function wordingFor(msg, proof_v, arm, segCode) {
  // tokens[0] = base/no-proof; tokens[v] for v>=1 is the proof variant.
  // Variants are keyed by msg_id in dashboard.variants.messages.
  const v = (dashboard.variants?.messages || []).find(x => {
    const id = parseInt(String(x.msg_id).split("_").pop(), 10);
    return id === msg.id;
  });
  if (!v) return "";
  const tok = v.tokens?.[Math.max(proof_v - 1, 0)] || v.tokens?.[0];
  if (!tok) return "";
  if (arm === 1) return tok.text_by_persona?.[segCode] || tok.text_core || "";
  return tok.text_core || tok.text_by_persona?.[segCode] || "";
}
function stdev(arr) {
  if (!arr.length) return 0;
  const m = arr.reduce((a,b) => a+b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s,v) => s + (v-m)*(v-m), 0) / arr.length);
}
function pickTopCells(metric, segId, n = 3) {
  // PERSUADE/REINFORCE: positive-lift cells only. A "significant"
  // cell here means the CI excludes 0 ON THE POSITIVE side
  // (ci_low > 0) — a significantly negative cell is the OPPOSITE
  // of a winner and would mislead the analyst.
  const cells = (dashboard.message_map_cells?.[metric] || [])
    .filter(c => c.segment === segId
                 && c.lift_shrunk != null
                 && c.lift_shrunk > 0);
  cells.sort((a, b) => b.lift_shrunk - a.lift_shrunk);
  return cells.slice(0, n).map(c => ({ ...c, _sig: c.ci_low > 0 }));
}

// ───────────────────────────────────────────────────────────────────
// useSegmentBrief — pure computation (DETERMINISTIC)
// ───────────────────────────────────────────────────────────────────
function useSegmentBrief(segId) {
  return useMemo(() => {
    if (segId == null) return null;
    const seg = (dashboard.segments || []).find(s => s.id === segId);
    if (!seg) return null;
    const messages = dashboard.messages || [];

    // Per-message topline rows for this segment.
    const tl = new Map();
    for (const e of (dashboard.message_topline || [])) {
      const cell = e.by_segment?.[seg.code];
      if (cell) tl.set(e.message, cell);
    }
    const rows = messages.map(m => {
      const r = tl.get(m.id) || {};
      return {
        msgId: m.id, msg: m, theme: m.theme_label,
        util: r.utility_signed, sop: r.sop_pct,
      };
    });

    const sopVals = rows.map(r => r.sop).filter(v => v != null).sort((a,b)=>a-b);
    const sopMedian = sopVals[Math.floor(sopVals.length / 2)] ?? 0;
    const sopStdev = stdev(sopVals);
    const sopTop = sopVals[sopVals.length - 1] ?? 0;
    const sopTop3 = sopVals[sopVals.length - 3] ?? 0;
    const sopTied = (sopTop - sopTop3) < sopStdev;

    // 1. LEAD WITH — highest utility among broadly acceptable
    const leadPool = rows
      .filter(r => r.util != null && r.util >= 0.03 && r.sop >= sopMedian)
      .sort((a,b) => b.util - a.util);
    const lead = leadPool[0] || rows.slice().sort((a,b)=>(b.util??-Infinity)-(a.util??-Infinity))[0];

    // 2. AVOID — most polarizing (lowest negative utility)
    const avoidPool = rows
      .filter(r => r.util != null && r.util <= -0.05)
      .sort((a,b) => a.util - b.util);
    const avoid = avoidPool[0];

    // For AVOID: does it still work for owned channels?
    let avoidOwnedNote = null;
    if (avoid) {
      const baseCells = (dashboard.message_map_cells?.base_messaging || [])
        .filter(c => c.segment === segId && c.message === avoid.msgId
                  && c.lift_shrunk != null);
      const best = baseCells.sort((a,b)=>b.lift_shrunk-a.lift_shrunk)[0];
      if (best && best.lift_shrunk > 0.25) {
        avoidOwnedNote = best;
      }
    }

    // 3 + 4. PERSUADE WITH + REINFORCE BASE — top significant cells.
    const persuade = pickTopCells("persuasion_messaging", segId, 3)
      .map(c => ({ ...c, msg: messages.find(m => m.id === c.message) }));
    const reinforce = pickTopCells("base_messaging", segId, 3)
      .map(c => ({ ...c, msg: messages.find(m => m.id === c.message) }));

    return {
      seg, lead, sopTied, sopStdev,
      avoid, avoidOwnedNote,
      persuade, reinforce,
    };
  }, [segId]);
}

// ───────────────────────────────────────────────────────────────────
// PersonaSilhouette — small SVG, lights up when the cell is arm=1
// ───────────────────────────────────────────────────────────────────
function PersonaSilhouette({ lit }) {
  const c = lit ? "#7F77DD" : "rgba(127,119,221,0.32)";
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="none" stroke={c} strokeWidth="1.5" />
      <circle cx="12" cy="9.5" r="2.6" fill="none" stroke={c} strokeWidth="1.5" />
      <path d="M5.5 19 Q12 14 18.5 19" fill="none"
            stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ───────────────────────────────────────────────────────────────────
// Card chrome
// ───────────────────────────────────────────────────────────────────
function CardHeader({ slot, sub, chip, onChip, accent }) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: MONO, fontSize: 9, fontWeight: 800,
          letterSpacing: 1.5, textTransform: "uppercase", color: accent,
        }}>{slot}</div>
        <div style={{
          fontFamily: FONT, fontSize: 10, color: C.textDim,
          marginTop: 2,
        }}>{sub}</div>
      </div>
      {chip && (
        <button onClick={onChip} style={{
          background: "transparent", border: `1px solid ${accent}66`,
          borderRadius: 4, padding: "3px 8px", cursor: "pointer",
          color: accent, fontFamily: MONO, fontSize: 8, fontWeight: 700,
          letterSpacing: 1, textTransform: "uppercase",
        }}>{chip}</button>
      )}
    </div>
  );
}

function MessageBox({
  msg, arm, proof, lift, sig, n, util, sop, segCode,
  showPersona = false, tone = "neutral",
}) {
  if (!msg) return (
    <div style={{
      padding: 10, border: `1px dashed ${C.cardBorder}`, borderRadius: 4,
      color: C.textDim, fontFamily: FONT, fontSize: 10, fontStyle: "italic",
    }}>No candidate met the rule for this slot.</div>
  );
  const proofLbl = proof != null ? proofLabelFor(msg, proof) : null;
  const isPersona = arm === 1;
  const wording = arm != null && proof != null
    ? wordingFor(msg, proof, arm, segCode)
    : wordingFor(msg, 0, 2, segCode); // default to no-proof core
  const borderColor = tone === "bad" ? "#fca5a522"
                    : tone === "good" ? "#7F77DD33"
                    : C.cardBorder;
  return (
    <div style={{
      background: "rgba(15,21,32,0.55)",
      border: `1px solid ${borderColor}`,
      borderRadius: 5, padding: "9px 11px 10px",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      {/* Title row: theme + arm badge + persona icon */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {showPersona && (
          <PersonaSilhouette lit={isPersona} />
        )}
        <div style={{
          fontFamily: FONT, fontSize: 13, fontWeight: 800,
          color: C.text, flex: 1, minWidth: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{msg.theme_label}</div>
        {arm != null && (
          <span style={{
            fontFamily: MONO, fontSize: 7.5, fontWeight: 700,
            letterSpacing: 1.2, textTransform: "uppercase",
            padding: "2px 5px", borderRadius: 2,
            background: isPersona ? "rgba(127,119,221,0.18)" : "rgba(148,163,184,0.12)",
            color: isPersona ? "#bdb6f5" : C.textMuted,
            border: `1px solid ${isPersona ? "#7F77DD55" : C.cardBorder}`,
          }}>{isPersona ? "Persona" : "Core"}</span>
        )}
      </div>

      {/* Wording */}
      {wording && (
        <div style={{
          fontFamily: "'Lora', Georgia, serif",
          fontSize: 12, fontStyle: "italic", lineHeight: 1.4,
          color: "#e2e8f0",
          borderLeft: `2px solid ${isPersona ? "#7F77DD" : C.cardBorder}`,
          paddingLeft: 8,
        }}>“{wording}”</div>
      )}

      {/* Proof point (highlighted when present + not base) */}
      {proofLbl && proofLbl !== "no proof" && (
        <div style={{
          fontFamily: MONO, fontSize: 8.5, fontWeight: 700,
          letterSpacing: 0.6, color: "#fbbf24",
        }}>+ PROOF · {proofLbl}</div>
      )}
      {proofLbl === "no proof" && (
        <div style={{
          fontFamily: MONO, fontSize: 8, color: C.textDim,
          letterSpacing: 0.5,
        }}>no proof point</div>
      )}

      {/* Stats row */}
      <div style={{
        display: "flex", gap: 10, flexWrap: "wrap",
        fontFamily: MONO, fontSize: 9, color: C.textMuted,
        marginTop: 2,
      }}>
        {lift != null && (
          <span>
            lift{" "}
            <span style={{ color: lift >= 0 ? "#34d399" : "#f87171", fontWeight: 700 }}>
              {lift >= 0 ? "+" : ""}{lift.toFixed(3)}
            </span>
            {sig && <span style={{ color: "#22c55e", marginLeft: 4 }}>✓ sig</span>}
            {n != null && <span style={{ color: C.textDim }}>  n={n}</span>}
          </span>
        )}
        {util != null && (
          <span>
            util{" "}
            <span style={{ color: util >= 0 ? "#a78bfa" : "#f87171", fontWeight: 700 }}>
              {util >= 0 ? "+" : ""}{util.toFixed(3)}
            </span>
          </span>
        )}
        {sop != null && (
          <span>SoP <span style={{ color: "#22d3ee", fontWeight: 700 }}>{sop.toFixed(2)}%</span></span>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// SegmentSummaryDrawer — the exported drawer
// ───────────────────────────────────────────────────────────────────
export default function SegmentSummaryDrawer({
  segId, onClose, onChip,
}) {
  const brief = useSegmentBrief(segId);
  const open = brief != null;
  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0,
      width: 460, maxWidth: "92vw",
      background: "#0c1322",
      borderLeft: `1px solid ${C.cardBorder}`,
      boxShadow: "-12px 0 40px rgba(0,0,0,0.55)",
      zIndex: 100, overflowY: "auto",
      transform: open ? "translateX(0)" : "translateX(100%)",
      transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
      pointerEvents: open ? "auto" : "none",
    }}>
      {brief && (
        <>
          {/* Header — segment identity */}
          <div style={{
            padding: "14px 18px 12px",
            borderBottom: `1px solid ${C.cardBorder}`,
            display: "flex", alignItems: "center", gap: 12,
            background: "rgba(15,21,32,0.7)",
            position: "sticky", top: 0, zIndex: 2,
            backdropFilter: "blur(6px)",
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: "50%",
              border: `3px solid ${brief.seg.party === "GOP" ? "#ef4444" : "#3b82f6"}`,
              background: "#1e293b", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: FONT, fontWeight: 800,
              fontSize: brief.seg.code.length <= 2 ? 16 : 13,
              flexShrink: 0,
            }}>{brief.seg.code}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: FONT, fontSize: 14, fontWeight: 800,
                color: C.text, lineHeight: 1.2,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{brief.seg.name}</div>
              <div style={{
                fontFamily: MONO, fontSize: 8.5, color: C.textDim,
                letterSpacing: 0.8, marginTop: 2,
              }}>
                {brief.seg.party} · {brief.seg.pct?.toFixed(1)}% sample
                {brief.seg.n != null && <> · n={brief.seg.n}</>}
              </div>
            </div>
            <button onClick={onClose} style={{
              background: "transparent", border: `1px solid ${C.cardBorder}`,
              borderRadius: 4, color: C.textMuted, cursor: "pointer",
              fontFamily: MONO, fontSize: 11, padding: "4px 9px", lineHeight: 1,
            }}>×</button>
          </div>

          {/* Body — the four cards */}
          <div style={{
            padding: "14px 16px 24px",
            display: "flex", flexDirection: "column", gap: 14,
          }}>

            {/* 1. LEAD WITH */}
            <section>
              <CardHeader slot="1 · Lead with" accent={ACCENT_BY_OUTCOME.utility}
                sub="Universal, non-polarizing"
                chip="→ Utility" onChip={() => onChip("utility", brief.lead?.msgId)} />
              <MessageBox
                msg={brief.lead?.msg} segCode={brief.seg.code}
                util={brief.lead?.util} sop={brief.lead?.sop}
              />
              {brief.sopTied && brief.lead && (
                <div style={{
                  marginTop: 6,
                  fontFamily: MONO, fontSize: 8, color: C.textDim,
                  fontStyle: "italic", letterSpacing: 0.4,
                }}>
                  Top-3 SoP within 1 σ ({brief.sopStdev.toFixed(2)}pp) —
                  lead is the highest-utility pick among near-ties.
                </div>
              )}
            </section>

            {/* 2. AVOID */}
            <section>
              <CardHeader slot="2 · Avoid" accent="#f87171"
                sub="Backfire / polarizing"
                chip={brief.avoid ? "→ Utility" : null}
                onChip={() => onChip("utility", brief.avoid?.msgId)} />
              <MessageBox tone="bad"
                msg={brief.avoid?.msg} segCode={brief.seg.code}
                util={brief.avoid?.util} sop={brief.avoid?.sop}
              />
              {brief.avoidOwnedNote && (
                <div style={{
                  marginTop: 6, padding: "6px 9px",
                  background: "rgba(96,165,250,0.08)",
                  border: "1px solid rgba(96,165,250,0.18)",
                  borderRadius: 4,
                  fontFamily: FONT, fontSize: 10, color: "#bfdbfe",
                  lineHeight: 1.45,
                }}>
                  <strong>Still works for owned channels.</strong>{" "}
                  Strong Base lift here (+{brief.avoidOwnedNote.lift_shrunk.toFixed(2)})
                  — OK in supporter emails / fundraising appeals; never broadcast.
                </div>
              )}
            </section>

            {/* 3. PERSUADE WITH */}
            <section>
              <CardHeader slot="3 · Persuade with"
                accent={ACCENT_BY_OUTCOME.persuasion_messaging}
                sub={`Top ${brief.persuade.length} significant cells — light the persona icon means persona-tuning is better`}
                chip="→ Persuasion"
                onChip={() => onChip("persuasion_messaging", brief.persuade[0]?.message)} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {brief.persuade.map((c, i) => (
                  <MessageBox key={i}
                    msg={c.msg} arm={c.arm} proof={c.proof}
                    lift={c.lift_shrunk} sig={c._sig} n={c.n}
                    segCode={brief.seg.code} showPersona tone="good"
                  />
                ))}
              </div>
            </section>

            {/* 4. REINFORCE SUPPORT */}
            <section>
              <CardHeader slot="4 · Reinforce support"
                accent={ACCENT_BY_OUTCOME.base_messaging}
                sub={`Top ${brief.reinforce.length} significant cells — for owned channels`}
                chip="→ Base"
                onChip={() => onChip("base_messaging", brief.reinforce[0]?.message)} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {brief.reinforce.map((c, i) => (
                  <MessageBox key={i}
                    msg={c.msg} arm={c.arm} proof={c.proof}
                    lift={c.lift_shrunk} sig={c._sig} n={c.n}
                    segCode={brief.seg.code} showPersona tone="good"
                  />
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
