// SegmentSummaryDrawer — view-agnostic strategic brief for a single
// audience. Opens when colFocus is set; slides in from the right.
//
// DESIGN PRINCIPLES (per analyst direction):
//
//   1. NO HARDCODED COMMENTARY. Every piece of editorial copy
//      (card titles, subtitles, contextual notes, chip labels,
//      arm/proof badge wording, the "no candidate" placeholder)
//      is read from dashboard.ui.segment_summary.copy. That config
//      lives in study.yaml and is patched into dashboard.json by
//      scripts/patch_segment_summary.py. If a key is missing, the
//      drawer renders nothing for that slot — the analyst owns the
//      voice.
//
//   2. NO HAND-PICKED FINDINGS. Per-card picks are deterministic
//      from dashboard.json (rules below). The analyst can OVERRIDE
//      any pick by setting dashboard.ui.segment_summary.overrides
//      (also from study.yaml).
//
// RULES (auto-pick; can be overridden per segment):
//
//   LEAD WITH        max utility_signed where util >= +0.03 AND
//                    sop_pct >= median(sop_pct).
//
//   AVOID            min utility_signed where util <= −0.05.
//
//   PERSUADE WITH    top 3 cells from message_map_cells.persuasion_messaging,
//                    POSITIVE LIFT ONLY, dedup'd so the BEST VARIANT PER
//                    MESSAGE (best arm × proof) wins (a message never
//                    appears as both CORE and PERSONA in the same slot).
//                    EXCLUDES the AVOID message — if polarizing enough
//                    to be avoid, stays out of every other slot.
//
//   REINFORCE        same rule on message_map_cells.base_messaging
//   SUPPORT          (same dedup, same AVOID exclusion).
//
// ACTION CHIPS [→ View] on every card flip the outcome card AND for
// Persuasion/Base also drop the cube focal on (target msg × this seg).

import { useMemo } from "react";
import dashboard from "../../data/topline/dashboard.json";
import { C, FONT, MONO } from "../../data/theme";

// ───────────────────────────────────────────────────────────────────
// Config wiring — read all editorial copy + per-segment overrides
// from dashboard.ui.segment_summary, populated from study.yaml.
// ───────────────────────────────────────────────────────────────────
const CFG = dashboard.ui?.segment_summary || {};
const COPY = CFG.copy || {};
const OVERRIDES = CFG.overrides || {};
const slotCopy = (slot) => COPY.cards?.[slot] || {};
const msgBoxCopy = COPY.message_box || {};

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
  if (proof_v === 0) return null;
  const p = msg?.proofs?.[proof_v - 1];
  if (!p || p.short_label === "base") return null;
  return p.short_label;
}
function wordingFor(msg, proof_v, arm, segCode) {
  const v = (dashboard.variants?.messages || []).find(x => {
    const id = parseInt(String(x.msg_id).split("_").pop(), 10);
    return id === msg.id;
  });
  if (!v) return "";
  const tok = v.tokens?.[Math.max((proof_v || 0) - 1, 0)] || v.tokens?.[0];
  if (!tok) return "";
  if (arm === 1) return tok.text_by_persona?.[segCode] || tok.text_core || "";
  return tok.text_core || tok.text_by_persona?.[segCode] || "";
}
function stdev(arr) {
  if (!arr.length) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) * (v - m), 0) / arr.length);
}

// ───────────────────────────────────────────────────────────────────
// Auto-pick rule for PERSUADE / REINFORCE
//   1. POSITIVE LIFT ONLY
//   2. BEST VARIANT PER MESSAGE (group by message, keep max lift)
//   3. EXCLUDE AVOID message
// ───────────────────────────────────────────────────────────────────
function pickTopCells(metric, segId, n = 3, excludeMsgIds = new Set()) {
  const cells = (dashboard.message_map_cells?.[metric] || [])
    .filter(c => c.segment === segId
                 && c.lift_shrunk != null
                 && c.lift_shrunk > 0
                 && !excludeMsgIds.has(c.message));
  const bestByMsg = new Map();
  for (const c of cells) {
    const prev = bestByMsg.get(c.message);
    if (!prev || c.lift_shrunk > prev.lift_shrunk) bestByMsg.set(c.message, c);
  }
  return [...bestByMsg.values()]
    .sort((a, b) => b.lift_shrunk - a.lift_shrunk)
    .slice(0, n)
    .map(c => ({ ...c, _sig: c.ci_low > 0 }));
}

// Override resolver — when the analyst pinned message IDs in
// study.yaml, find the BEST (arm × proof) variant for each pinned
// message in this segment (same rule as auto-pick).
function resolveOverrideCells(metric, segId, msgIds) {
  if (!Array.isArray(msgIds) || !msgIds.length) return null;
  const all = (dashboard.message_map_cells?.[metric] || [])
    .filter(c => c.segment === segId && c.lift_shrunk != null);
  return msgIds
    .map(mid => {
      const ms = all.filter(c => c.message === mid);
      if (!ms.length) return null;
      const best = ms.sort((a, b) => b.lift_shrunk - a.lift_shrunk)[0];
      return { ...best, _sig: best.ci_low > 0 };
    })
    .filter(Boolean);
}

// ───────────────────────────────────────────────────────────────────
// useSegmentBrief — pure derivation. Applies overrides on top.
// ───────────────────────────────────────────────────────────────────
function useSegmentBrief(segId) {
  return useMemo(() => {
    if (segId == null) return null;
    const seg = (dashboard.segments || []).find(s => s.id === segId);
    if (!seg) return null;
    const messages = dashboard.messages || [];
    const ov = OVERRIDES[seg.code] || {};

    // Per-message topline rows.
    const tl = new Map();
    for (const e of (dashboard.message_topline || [])) {
      const c = e.by_segment?.[seg.code];
      if (c) tl.set(e.message, c);
    }
    const rows = messages.map(m => {
      const r = tl.get(m.id) || {};
      return {
        msgId: m.id, msg: m, theme: m.theme_label,
        util: r.utility_signed, sop: r.sop_pct,
      };
    });

    const sopVals = rows.map(r => r.sop).filter(v => v != null).sort((a, b) => a - b);
    const sopMedian = sopVals[Math.floor(sopVals.length / 2)] ?? 0;
    const sigma = stdev(sopVals);
    const sopTop = sopVals[sopVals.length - 1] ?? 0;
    const sopTop3 = sopVals[sopVals.length - 3] ?? 0;
    const sopTied = (sopTop - sopTop3) < sigma;

    // 1. LEAD — overridable
    let lead;
    if (ov.lead != null) {
      lead = rows.find(r => r.msgId === ov.lead);
    }
    if (!lead) {
      const pool = rows
        .filter(r => r.util != null && r.util >= 0.03 && r.sop >= sopMedian)
        .sort((a, b) => b.util - a.util);
      lead = pool[0] || rows.slice()
        .sort((a, b) => (b.util ?? -Infinity) - (a.util ?? -Infinity))[0];
    }

    // 2. AVOID — overridable
    let avoid;
    if (ov.avoid != null) {
      avoid = rows.find(r => r.msgId === ov.avoid);
    }
    if (!avoid) {
      const pool = rows
        .filter(r => r.util != null && r.util <= -0.05)
        .sort((a, b) => a.util - b.util);
      avoid = pool[0];
    }

    const excludeIds = new Set();
    if (avoid?.msgId != null) excludeIds.add(avoid.msgId);

    // "Still works for owned channels" diagnostic for AVOID
    let avoidOwnedNote = null;
    if (avoid) {
      const baseCells = (dashboard.message_map_cells?.base_messaging || [])
        .filter(c => c.segment === segId && c.message === avoid.msgId
                  && c.lift_shrunk != null);
      const best = baseCells.sort((a, b) => b.lift_shrunk - a.lift_shrunk)[0];
      if (best && best.lift_shrunk > 0.25) avoidOwnedNote = best;
    }

    // 3 & 4. PERSUADE + REINFORCE — overridable; auto with AVOID exclusion
    const persuade =
      resolveOverrideCells("persuasion_messaging", segId, ov.persuade)
      || pickTopCells("persuasion_messaging", segId, 3, excludeIds);
    const reinforce =
      resolveOverrideCells("base_messaging", segId, ov.reinforce)
      || pickTopCells("base_messaging", segId, 3, excludeIds);

    const decorateCell = c => ({ ...c, msg: messages.find(m => m.id === c.message) });

    return {
      seg, lead, sopTied, sopStdev: sigma,
      avoid, avoidOwnedNote,
      persuade: persuade.map(decorateCell),
      reinforce: reinforce.map(decorateCell),
      isOverridden: {
        lead: ov.lead != null,
        avoid: ov.avoid != null,
        persuade: Array.isArray(ov.persuade) && ov.persuade.length > 0,
        reinforce: Array.isArray(ov.reinforce) && ov.reinforce.length > 0,
      },
    };
  }, [segId]);
}

// ───────────────────────────────────────────────────────────────────
// Persona silhouette — lit when arm = 1 (persona-tuning is winner)
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

function CardHeader({ slot, accent, chip, onChip, isOverridden }) {
  const c = slotCopy(slot);
  return (
    <div style={{
      display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: MONO, fontSize: 9, fontWeight: 800,
          letterSpacing: 1.5, textTransform: "uppercase", color: accent,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          {c.title}
          {isOverridden && c.override_badge && (
            <span style={{
              fontFamily: MONO, fontSize: 7, fontWeight: 700,
              color: C.textMuted, padding: "1px 4px", borderRadius: 2,
              background: "rgba(148,163,184,0.12)",
              border: `1px solid ${C.cardBorder}`, letterSpacing: 0.6,
            }}>{c.override_badge}</span>
          )}
        </div>
        {c.subtitle && (
          <div style={{
            fontFamily: FONT, fontSize: 10, color: C.textDim, marginTop: 2,
          }}>{c.subtitle}</div>
        )}
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
    }}>{msgBoxCopy.empty}</div>
  );
  const proofLbl = proof != null ? proofLabelFor(msg, proof) : null;
  const isPersona = arm === 1;
  const wording = arm != null && proof != null
    ? wordingFor(msg, proof, arm, segCode)
    : wordingFor(msg, 0, 2, segCode);
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
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {showPersona && <PersonaSilhouette lit={isPersona} />}
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
          }}>{isPersona ? msgBoxCopy.persona_arm : msgBoxCopy.core_arm}</span>
        )}
      </div>

      {wording && (
        <div style={{
          fontFamily: "'Lora', Georgia, serif",
          fontSize: 12, fontStyle: "italic", lineHeight: 1.4,
          color: "#e2e8f0",
          borderLeft: `2px solid ${isPersona ? "#7F77DD" : C.cardBorder}`,
          paddingLeft: 8,
        }}>“{wording}”</div>
      )}

      {proof != null && (
        proofLbl
          ? <div style={{
              fontFamily: MONO, fontSize: 8.5, fontWeight: 700,
              letterSpacing: 0.6, color: "#fbbf24",
            }}>{msgBoxCopy.proof_prefix}{proofLbl}</div>
          : msgBoxCopy.no_proof_label && (
              <div style={{
                fontFamily: MONO, fontSize: 8, color: C.textDim,
                letterSpacing: 0.5,
              }}>{msgBoxCopy.no_proof_label}</div>
            )
      )}

      <div style={{
        display: "flex", gap: 10, flexWrap: "wrap",
        fontFamily: MONO, fontSize: 9, color: C.textMuted, marginTop: 2,
      }}>
        {lift != null && (
          <span>
            lift{" "}
            <span style={{ color: lift >= 0 ? "#34d399" : "#f87171", fontWeight: 700 }}>
              {lift >= 0 ? "+" : ""}{lift.toFixed(3)}
            </span>
            {sig && <span style={{ color: "#22c55e", marginLeft: 4 }}>✓ {msgBoxCopy.sig_label || "sig"}</span>}
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
// SegmentSummaryDrawer
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

            <section>
              <CardHeader slot="lead" accent={ACCENT_BY_OUTCOME.utility}
                isOverridden={brief.isOverridden.lead}
                chip={slotCopy("lead").action_chip}
                onChip={() => onChip("utility", brief.lead?.msgId)} />
              <MessageBox
                msg={brief.lead?.msg} segCode={brief.seg.code}
                util={brief.lead?.util} sop={brief.lead?.sop}
              />
              {brief.sopTied && brief.lead && slotCopy("lead").sigma_tied_note && (
                <div style={{
                  marginTop: 6,
                  fontFamily: MONO, fontSize: 8, color: C.textDim,
                  fontStyle: "italic", letterSpacing: 0.4,
                }}>{slotCopy("lead").sigma_tied_note.replace("{sigma}", brief.sopStdev.toFixed(2))}</div>
              )}
            </section>

            <section>
              <CardHeader slot="avoid" accent="#f87171"
                isOverridden={brief.isOverridden.avoid}
                chip={brief.avoid ? slotCopy("avoid").action_chip : null}
                onChip={() => onChip("utility", brief.avoid?.msgId)} />
              <MessageBox tone="bad"
                msg={brief.avoid?.msg} segCode={brief.seg.code}
                util={brief.avoid?.util} sop={brief.avoid?.sop}
              />
              {brief.avoidOwnedNote && slotCopy("avoid").owned_channel_note && (
                <div style={{
                  marginTop: 6, padding: "6px 9px",
                  background: "rgba(96,165,250,0.08)",
                  border: "1px solid rgba(96,165,250,0.18)",
                  borderRadius: 4,
                  fontFamily: FONT, fontSize: 10, color: "#bfdbfe",
                  lineHeight: 1.45,
                }}>
                  {slotCopy("avoid").owned_channel_note.replace(
                    "{base_lift}",
                    `+${brief.avoidOwnedNote.lift_shrunk.toFixed(2)}`
                  )}
                </div>
              )}
            </section>

            <section>
              <CardHeader slot="persuade"
                accent={ACCENT_BY_OUTCOME.persuasion_messaging}
                isOverridden={brief.isOverridden.persuade}
                chip={slotCopy("persuade").action_chip}
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

            <section>
              <CardHeader slot="reinforce"
                accent={ACCENT_BY_OUTCOME.base_messaging}
                isOverridden={brief.isOverridden.reinforce}
                chip={slotCopy("reinforce").action_chip}
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
