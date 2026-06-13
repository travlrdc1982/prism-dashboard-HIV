// ═══════════════════════════════════════════════════════════════
// MESSAGE MAP — standalone /messages page
//
// Renders the messagemap pipeline output (persuasion_messaging /
// base_messaging) merged into src/data/topline/dashboard.json:
//   - messages[]            17 message themes × proof tokens
//   - message_map_cells{}   per-metric lift cells: msg×seg×arm×proof
//   - baskets[]             total / priority_all / priority_d / gop / dem
//   - variants{}            per-message text by persona token
//   - lift_variants[]       metric metadata (sigma, scale)
//
// COMMIT B1.6 — chrome polish per analyst feedback:
//   • InfoDot switched to "?" + radar-style tooltip palette
//   • Variant Universe column moved to LEFT, beside Message header
//   • Variant Universe icon legend now lives IN the column header
//     (band / ○ CORE / ● OPTIMAL / dashed-zero / live tick)
//   • Cell-architecture graphic replaced by a compact interactive
//     widget — click to fold the PERSONA card open from CORE, click
//     ▸ to drill into proof tokens.
//   • Sub-header counts strip is now data-driven:
//       N PRISM SEGMENTS · N MESSAGES · N PROOF POINT TOKENS · NNNN
//       TOTAL MESSAGE VARIANTS
//
// Live cell rendering, hover-variant text, row drill-down, priority
// basket reorganization, and the variant-universe data still land
// in B2–B6.
// ═══════════════════════════════════════════════════════════════
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import dashboard from "../data/topline/dashboard.json";
import { C, FONT, MONO } from "../data/theme";
import { STUDY_METRICS } from "../data/study";
import PageHeader from "../components/PageHeader";
import InfoDot from "../components/InfoDot";
import {
  SegmentCircle,
  VariantUniverseLegend,
  SplitCell,
  CubePair,
  VariantUniverseBar,
  WordingDrawer,
  OutcomeCards,
  ScaleBlock,
  ViewOptions,
  SopGrid,
  UtilityGrid,
} from "../components/MessageMap";
import { scaleLift } from "../components/MessageMap/liftScale";

// ─── Data wiring (frame only — cells render in B2) ───
const SEGMENTS = dashboard.segments;             // 16 segments
const MESSAGES = dashboard.messages || [];       // 17 message-theme records
const BASKETS  = dashboard.baskets  || [];       // 5 baskets
const METRICS  = dashboard.lift_variants || [];  // persuasion / base
// UI config authored in study/study.yaml (dashboard: section), emitted by
// the messagemap pipeline as dashboard.json's `ui` section. Defaults +
// render rules come from here; hardcoded fallbacks cover old artifacts.
const UI = dashboard.ui || {};
const FADE_BELOW = UI.fade_shrink_weight_below ?? 0.6;

// ─── Derived study counts ───
// PROOF POINT TOKENS = count of tokens with proof_id > 0 across messages
// TOTAL MESSAGE VARIANTS = sum over messages of n_tokens × (CORE + 16 persona)
const N_SEGMENTS = SEGMENTS.length;
const N_MESSAGES = MESSAGES.length;
const N_PROOF_TOKENS = MESSAGES.reduce(
  (sum, m) => sum + (m.proofs?.filter(p => p.proof_id > 0).length || 0),
  0
);
const N_TOTAL_VARIANTS = MESSAGES.reduce(
  (sum, m) => sum + (m.proofs?.length || 0) * (1 + N_SEGMENTS),
  0
);

// ─── Outcome scale ranges (computed from data, never hardcoded) ───
// SoP and Utility ranges differ by study, so the SCALE legend reads
// the ACTUAL min/max from message_topline rather than any fixed
// 0–100. Persuasion/Base are indexed 0–100 by construction (scaleLift
// clamps), so they use the shared red→white→green ramp.
const MSG_TOPLINE = dashboard.message_topline || [];
function rangeOfTopline(field) {
  let mn = Infinity, mx = -Infinity;
  for (const m of MSG_TOPLINE) {
    for (const code in (m.by_segment || {})) {
      const v = m.by_segment[code][field];
      if (typeof v === "number") { if (v < mn) mn = v; if (v > mx) mx = v; }
    }
  }
  return Number.isFinite(mn) ? { min: mn, max: mx } : null;
}
const SOP_RANGE = rangeOfTopline("sop_pct");
// UTILITY uses the SIGNED bw_mean (the raw B-W score) so the diverging
// visual is symmetric about 0. The unsigned 'utility' 0-100 field in
// dashboard.json is the legacy per-segment min-max rescale and isn't
// comparable across segments; we'll switch to the Bayesian utility_signed
// field once the new pipeline runs (prism_topline_bayes.py). Same code
// path either way — the range memo just gets bigger numbers.
const UTILITY_RANGE = rangeOfTopline("bw_mean");

// Priority basket → segment IDs ordered by ROI desc.
const PRIORITY_BASKET = (BASKETS.find(b => b.id === "priority_all") || { segments: [] }).segments;
const PRIORITY_ORDERED_BY_ROI = [...PRIORITY_BASKET].sort((a, b) => {
  const ca = SEGMENTS.find(s => s.id === a)?.code;
  const cb = SEGMENTS.find(s => s.id === b)?.code;
  return (STUDY_METRICS[cb]?.roi || 0) - (STUDY_METRICS[ca]?.roi || 0);
});

// PersonaIcon — generic person silhouette in a circle. Sits above the
// focal cube column's PERSONA half to label the right side of the cube
// as the persona-tuned variant. Violet (matches the column bracket +
// cube divider); 1.5× the original size.
function PersonaIcon() {
  return (
    <svg width="27" height="27" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="none"
              stroke="#7F77DD" strokeWidth="1.5" />
      <circle cx="12" cy="9.5" r="2.6" fill="none"
              stroke="#7F77DD" strokeWidth="1.5" />
      <path d="M5.5 19 Q12 14 18.5 19" fill="none"
            stroke="#7F77DD" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function MessageMap() {
  const hasData = MESSAGES.length > 0
    && dashboard.message_map_cells
    && Object.keys(dashboard.message_map_cells).length > 0;

  const defaultMetric = UI.default_outcome || METRICS[0]?.name || "persuasion_messaging";
  // OUTCOME — the measurement selector (4 cards). Values:
  //   'sop' | 'utility'            → their own views (built next)
  //   'persuasion_messaging' | 'base_messaging' → the lift cube (now)
  const [outcome, setOutcome] = useState(defaultMetric);
  const isLiftView = outcome === "persuasion_messaging"
    || outcome === "base_messaging";
  // The cube's data hooks always read a valid lift metric; for the
  // SoP/Utility cards we fall back to the default so the memos below
  // never see an unknown metric (the grid itself is gated on isLiftView).
  const metric = isLiftView ? outcome : defaultMetric;
  const [basket, setBasket] = useState(UI.default_basket || "total");

  // CUBE — the focal intersection. Clicking ANY cell of an intersection
  // (the aggregated cell or any proof cell) unfolds its mini-grid IN
  // the grid: the focal row regroups into one grid so the cube rows
  // align with their proof labels in the first column and the cube
  // sits under its segment circle. While focal, everything except the
  // headers and the focal row's labels fades out — the mini-grid is
  // the only focal point. Clicking the mini-grid folds it back.
  // {msgId, segId} | null
  const [focal, setFocal] = useState(null);          // {msgId, segId}
  // Column-only spotlight — click a segment header to lift its whole
  // column into a violet rounded rectangle (header + body). Mutually
  // exclusive with focal: opening a cube clears it, and vice versa.
  const [colFocus, setColFocus] = useState(null);    // segId
  // Chevron-expanded rows (no zoom/spotlight — just the accordion).
  const [openRows, setOpenRows] = useState(() => new Set());
  // CROSSHAIR — hover any cell to light up its full row + column;
  // suppressed while a focal cell is active (focal logic wins).
  const [hoverMsg, setHoverMsg] = useState(null);
  const [hoverSeg, setHoverSeg] = useState(null);
  // VARIANT-UNIVERSE override — a per-cell raw lift that wins over
  // both the basket aggregate and the msg×seg aggregate. Set when the
  // mouse is inside a cube MiniCell so the focal row's bar tick can
  // point at the specific (arm × proof × seg) variant under the
  // cursor instead of an aggregate.
  const [hoverLift, setHoverLift] = useState(null);
  const [hoverLiftMsg, setHoverLiftMsg] = useState(null);
  // VARIANT WORDING drawer — slides out from the LEFT of the hovered
  // message row. msgId pins it to its row; all wording text comes
  // straight from the variants workbook (captions are chrome).
  const [hoverWording, setHoverWording] = useState(null);
  // Debounce the clear so moving across the cell seam (CORE → divider
  // → PERSONA, or row → row) doesn't blink the drawer in and out.
  // A new hover within ~80ms cancels the pending clear.
  const clearTimerRef = useRef(null);
  const cellHoverHandler = (m, seg, proofLbl) => (info) => {
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    if (info == null) {
      clearTimerRef.current = setTimeout(() => {
        setHoverLift(null);
        setHoverLiftMsg(null);
        setHoverWording(null);
      }, 80);
      return;
    }
    if (info.lift != null) {
      setHoverLift(info.lift);
      setHoverLiftMsg(m.id);
    }
    setHoverWording({
      msgId: m.id,
      wording: info.wording || "",
      side: info.side,
      messageLabel: m.theme_label,
      segName: seg?.name,
      segCode: seg?.code,
      proofLabel: proofLbl,
    });
  };

  const activeBasket = BASKETS.find(b => b.id === basket) || BASKETS[0];
  const activeMetric = METRICS.find(m => m.name === metric) || METRICS[0];

  // ── VIEW OPTIONS state ──────────────────────────────────────────
  // columnMode: 'all' canonical | 'tier1' tier-1 first by ROI (others
  //             remain but render dimmed / unspotlighted)
  // personaAll: slide every column's persona half open
  // sortMode:   'survey' design order | 'sop' total Share-of-Pref desc
  const [columnMode, setColumnMode] = useState("all");
  const [personaAll, setPersonaAll] = useState(false);
  const [sortMode, setSortMode] = useState("survey");

  // Tier-1 segment ids (from the generated study metrics).
  const tier1Set = useMemo(
    () => new Set(SEGMENTS.filter(s => STUDY_METRICS[s.code]?.tier === 1)
                          .map(s => s.id)),
    []
  );

  // Segment column order — drag a segment circle to reorder. Initial
  // order matches the data; the user can rearrange the 16 columns.
  const [segmentOrder, setSegmentOrder] = useState(
    () => SEGMENTS.map(s => s.id)
  );
  const orderedSegments = useMemo(() => {
    const base = segmentOrder
      .map(id => SEGMENTS.find(s => s.id === id))
      .filter(Boolean);
    if (columnMode !== "tier1") return base;
    // Tier-1 first, ordered by ROI desc; the rest keep their order.
    const roi = (s) => STUDY_METRICS[s.code]?.roi || 0;
    const t1 = base.filter(s => tier1Set.has(s.id))
                   .sort((a, b) => roi(b) - roi(a));
    const rest = base.filter(s => !tier1Set.has(s.id));
    return [...t1, ...rest];
  }, [segmentOrder, columnMode, tier1Set]);
  // In tier-1 mode, non-tier-1 columns are always "unspotlighted"
  // (dimmed) unless a cube / column spotlight is actively driving the
  // dim state.
  const tier1Dim = (segId) =>
    (columnMode === "tier1" && !focal && colFocus === null
      && !tier1Set.has(segId)) ? 0.4 : 1;

  const [dragSegId, setDragSegId] = useState(null);
  const moveSegment = (sourceId, targetId) => {
    if (sourceId == null || sourceId === targetId) return;
    setSegmentOrder(prev => {
      const next = prev.filter(id => id !== sourceId);
      const idx = next.indexOf(targetId);
      next.splice(idx, 0, sourceId);
      return next;
    });
  };

  // Message row order. 'survey' = design order (as authored); 'sop' =
  // by total Share of Preference for the active basket, descending
  // (rank from the pipeline's sop_simple).
  const sortedMessages = useMemo(() => {
    if (sortMode !== "sop") return MESSAGES;
    const rows = dashboard.sop_simple?.[basket]?.messages || [];
    const rank = new Map(rows.map(r => [r.message, r.rank]));
    return [...MESSAGES].sort(
      (a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99)
    );
  }, [sortMode, basket]);

  // ── Cell aggregation ──────────────────────────────────────────────
  // The artifact carries one cell per (message × segment × arm × proof).
  // The collapsed row shows one value per (message × segment × arm): the
  // n-weighted mean of lift_shrunk across that half's proof tokens
  // (per-proof rows land with the B3 drill-down). Shrink weight is
  // n-weight-averaged the same way and drives the low-confidence fade.
  const cellIndex = useMemo(() => {
    const cells = dashboard.message_map_cells?.[metric] || [];
    const acc = new Map();
    for (const c of cells) {
      const key = `${c.message}|${c.segment}|${c.arm}`;
      let a = acc.get(key);
      if (!a) { a = { sumLift: 0, sumW: 0, n: 0 }; acc.set(key, a); }
      a.sumLift += c.lift_shrunk * c.n;
      a.sumW += c.shrink_weight * c.n;
      a.n += c.n;
    }
    const out = new Map();
    for (const [key, a] of acc) {
      out.set(key, { lift: a.sumLift / a.n, w: a.sumW / a.n, n: a.n });
    }
    return out;
  }, [metric]);

  // CUBE — exact per-proof cells (no aggregation): `msg|seg|arm|proof`.
  const proofIndex = useMemo(() => {
    const cells = dashboard.message_map_cells?.[metric] || [];
    const idx = new Map();
    for (const c of cells) {
      idx.set(`${c.message}|${c.segment}|${c.arm}|${c.proof}`, c);
    }
    return idx;
  }, [metric]);

  // CUBE — full core wording per message id (variants workbook).
  const coreTextByMsg = useMemo(() => {
    const out = new Map();
    for (const m of dashboard.variants?.messages || []) {
      const id = parseInt(String(m.msg_id).split("_").pop(), 10);
      out.set(id, m.tokens?.[0]?.text_core || "");
    }
    return out;
  }, []);

  // VARIANT UNIVERSE — per-message stats: {min,max,core,optimal,live}.
  // Restricted to the active basket so the band, the ○/● dots and the
  // live tick all describe the audience the analyst is targeting.
  const universeByMsg = useMemo(() => {
    const cells = dashboard.message_map_cells?.[metric] || [];
    const basketSegs = (BASKETS.find(b => b.id === basket) || BASKETS[0])
      ?.segments || [];
    const basketSet = new Set(basketSegs);

    const wmean = (cs) => {
      let sl = 0, sn = 0;
      for (const c of cs) { sl += c.lift_shrunk * c.n; sn += c.n; }
      return sn > 0 ? sl / sn : null;
    };

    const out = new Map();
    for (const m of MESSAGES) {
      const mc = cells.filter(c => c.message === m.id);
      const bc = basketSet.size > 0
        ? mc.filter(c => basketSet.has(c.segment)) : mc;
      if (bc.length === 0) continue;

      const lifts = bc.map(c => c.lift_shrunk);
      const min = Math.min(...lifts);
      const max = Math.max(...lifts);

      const core = wmean(bc.filter(c => c.arm === 2 && c.proof === 0));

      const armProofs = new Set(bc.map(c => `${c.arm}|${c.proof}`));
      let optimal = -Infinity;
      for (const k of armProofs) {
        const [a, p] = k.split("|").map(Number);
        const apMean = wmean(bc.filter(c => c.arm === a && c.proof === p));
        if (apMean != null && apMean > optimal) optimal = apMean;
      }
      if (optimal === -Infinity) optimal = null;

      const live = wmean(bc);
      out.set(m.id, { min, max, core, optimal, live });
    }
    return out;
  }, [metric, basket]);

  // Bar color tracks the active metric: green for persuasion, blue for
  // base (matches the strong-color callouts in the description).
  const universeColor = metric === "base_messaging" ? "#60a5fa" : "#34d399";

  // Per-(msg, seg) n-weighted lift (both arms, all proofs). Drives the
  // hover-following live tick on the Variant Universe bar: hovering a
  // cell in MSG M × SEG S moves M's tick to that intersection's
  // aggregated lift. When nothing is hovered the tick falls back to
  // the basket aggregate.
  const msgSegLift = useMemo(() => {
    const cells = dashboard.message_map_cells?.[metric] || [];
    const acc = new Map();
    for (const c of cells) {
      const key = `${c.message}|${c.segment}`;
      let a = acc.get(key);
      if (!a) { a = { sl: 0, sn: 0 }; acc.set(key, a); }
      a.sl += c.lift_shrunk * c.n;
      a.sn += c.n;
    }
    const out = new Map();
    for (const [k, a] of acc) out.set(k, a.sn > 0 ? a.sl / a.sn : null);
    return out;
  }, [metric]);
  const liveFor = (msgId) => {
    if (hoverLiftMsg === msgId && hoverLift != null) return hoverLift;
    if (hoverMsg === msgId && hoverSeg !== null) {
      const hov = msgSegLift.get(`${msgId}|${hoverSeg}`);
      if (hov != null) return hov;
    }
    return universeByMsg.get(msgId)?.live;
  };

  // CUBE — full token records per message id (core + per-persona text).
  const tokensByMsg = useMemo(() => {
    const out = new Map();
    for (const m of dashboard.variants?.messages || []) {
      const id = parseInt(String(m.msg_id).split("_").pop(), 10);
      out.set(id, m.tokens || []);
    }
    return out;
  }, []);

  const colorScale = activeMetric?.color_scale;
  // arm encoding from the survey: 1 = PERSONA-tuned, 2 = CORE
  const getHalf = (msgId, segId, arm) => {
    const a = cellIndex.get(`${msgId}|${segId}|${arm}`);
    if (!a) return null;
    return { v: scaleLift(a.lift, colorScale), lift: a.lift, n: a.n, w: a.w };
  };
  // Per-proof half, with the significance flag (95% CI excludes zero).
  const getProofHalf = (msgId, segId, arm, proof) => {
    const c = proofIndex.get(`${msgId}|${segId}|${arm}|${proof}`);
    if (!c) return null;
    return {
      v: scaleLift(c.lift_shrunk, colorScale), lift: c.lift_shrunk,
      n: c.n, w: c.shrink_weight,
      sig: c.ci_low > 0 || c.ci_high < 0,
    };
  };

  // The proof-token values present for a message in the cell data.
  // Order rule: every "no proof point" row (token v=0, or v≥1 whose
  // proofs[v-1] is the base placeholder) sits FIRST; real proof points
  // follow in their natural authoring order (proofs[] index). We never
  // sort by lift or value — the survey design order is preserved.
  const proofValuesFor = (msgId) => {
    const m = MESSAGES.find(x => x.id === msgId);
    const vals = new Set();
    for (const key of proofIndex.keys()) {
      const [mk, , , p] = key.split("|");
      if (+mk === msgId) vals.add(+p);
    }
    const ascending = [...vals].sort((a, b) => a - b);
    const noProof = [];
    const real = [];
    for (const v of ascending) {
      if (v === 0) { noProof.push(v); continue; }
      const p = m?.proofs?.[v - 1];
      if (!p || p.short_label === "base") noProof.push(v);
      else real.push(v);
    }
    return [...noProof, ...real];
  };
  const proofLabel = (m, v) => {
    if (v === 0) return "no proof point";
    const p = m.proofs?.[v - 1];
    if (!p || p.short_label === "base") return "no proof point";
    return p.short_label;
  };

  const toggleFocal = (msgId, segId) => {
    // Same cell again → fold the cube back up. Opening clears any
    // segment-column spotlight (the two are mutually exclusive).
    setColFocus(null);
    setFocal(prev =>
      prev && prev.msgId === msgId && prev.segId === segId
        ? null
        : { msgId, segId }
    );
  };
  const toggleColFocus = (segId) => {
    setFocal(null);
    setColFocus(prev => prev === segId ? null : segId);
  };

  // Click-outside-to-close: a mousedown anywhere outside the active
  // spotlight closes it. Focal cube → ref on the focal-row grid.
  // Column spotlight → ref on the segment header band.
  const focalRef = useRef(null);
  const segBandRef = useRef(null);
  useEffect(() => {
    if (!focal && colFocus === null) return;
    const onDown = (e) => {
      if (focal && focalRef.current?.contains(e.target)) return;
      if (colFocus !== null && segBandRef.current?.contains(e.target)) return;
      setFocal(null);
      setColFocus(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [focal, colFocus]);
  const toggleRow = (msgId) => {
    if (focal?.msgId === msgId) { setFocal(null); return; }
    setOpenRows(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId); else next.add(msgId);
      return next;
    });
  };

  if (!hasData) {
    return (
      <div style={{ maxWidth: 1400, margin: "0 auto", color: C.text, fontFamily: FONT }}>
        <PageHeader title="Message Map" />
        <div style={{
          background: C.card, border: `1px solid ${C.cardBorder}`,
          borderRadius: 6, padding: "20px 24px", fontSize: 12, color: C.textMuted,
        }}>
          <strong style={{ color: C.text }}>Message Map data not yet available.</strong>{" "}
          Run <code style={{ fontFamily: MONO, color: C.violet }}>python scripts/refresh.py</code>{" "}
          to regenerate <code style={{ fontFamily: MONO, color: C.violet }}>src/data/topline/dashboard.json</code>{" "}
          with the messagemap pipeline output.
        </div>
      </div>
    );
  }


  // ─── Tooltip copy (title + body, radar-style) ───
  const FILTER_INFO = (
    <>
      Filter a specific group. Baskets are study-specific groupings of segments
      that reflect this study's priorities (typically: priority audiences for
      persuasion, primary or secondary audiences by partisanship or some other
      strategic frame). TOTAL shows the full sample without basket restriction.
    </>
  );
  const MESSAGE_INFO = (
    <>
      The substantive message themes using PRISM's "message grammar"
      methodology tested using a discrete choice methodology (MaxDiff
      exercise). Click any message label to see the "core message" — the
      precise wording a subset of respondents are exposed to.
    </>
  );
  const PROOF_INFO = (
    <>
      Proof points for the messages were tested with subsets of respondents
      to assess the marginal impact in overall message impact.
    </>
  );
  const VARIANT_UNIVERSE_INFO = (
    <>
      A one-dimensional projection of a four-dimensional cell space (message
      × segment × persona tuning × proof token), reduced to the most
      operationally useful summary of a single message's performance. Each
      row's strip summarizes the range of message impact scores across every
      combination of persona framing × proof token, evaluated against every
      PRISM segment. The gap between ○ and ● is the persuasion{" "}
      <em>headroom</em>: how much lift is unlocked by persona tuning + best
      proof selection, above the untuned baseline.
    </>
  );

  // CUBE — the shared column template. EITHER a focal cube OR a
  // segment-column spotlight widens the spotlit segment column to host
  // the open persona half; everything else keeps its share. Header +
  // every row use this same template so the whole COLUMN expands
  // together (segment circles included).
  const gridTemplate = orderedSegments.map(seg => {
    const widened = (focal && focal.segId === seg.id) || colFocus === seg.id;
    return widened ? "minmax(180px, 3fr)" : "minmax(56px, 1fr)";
  }).join(" ");
  const rowTemplate = `36px 220px 150px ${gridTemplate}`;

  return (
    <div style={{ color: C.text, fontFamily: FONT, maxWidth: 1800, margin: "0 auto" }}>

      {/* ─── HEADER (title + description + counts) on the LEFT,
           OUTCOME CARDS (4 measurement options, 2×2) on the RIGHT.
           Both sides flex; the left side compresses first via
           minWidth:0 + a softer flex-basis so the cards stay legible
           as the viewport shrinks before the title text wraps. ─── */}
      <div style={{
        display: "flex", gap: 24, alignItems: "flex-start",
        marginBottom: 14, flexWrap: "wrap",
      }}>
        <div style={{ flex: "1 1 360px", minWidth: 0 }}>
          <PageHeader title="Message Map" />
          <div style={{
            fontSize: 12, color: C.textMuted, maxWidth: 980, lineHeight: 1.6,
            marginBottom: 8,
          }}>
            <strong style={{ color: C.text }}>The PRISM Message Map maps which messages work best with each audience.</strong>{" "}
            The map also shows the impact customizing the language to the
            segment persona{" "}
            <strong style={{ color: "#7F77DD" }}>(persona-tuned variant)</strong>{" "}
            and / or including specific facts or other proof points{" "}
            <strong style={{ color: C.text }}>(tokens)</strong>{" "}
            has on message impact. Message impact can be measured and used in
            several ways:
          </div>

          {/* Configurable counts strip */}
          <div style={{
            fontSize: 9, color: C.textDim, fontFamily: MONO,
            letterSpacing: 1, textTransform: "uppercase",
          }}>
            {N_MESSAGES} MESSAGES{" · "}
            {N_PROOF_TOKENS} PROOF POINT TOKENS{" · "}
            {N_TOTAL_VARIANTS.toLocaleString()} TOTAL MESSAGE VARIANTS
            {dashboard.study?.n_total ? (
              <>{" · "}{dashboard.study.n_total.toLocaleString()} RESPONDENTS</>
            ) : null}
          </div>

          {/* VIEW OPTIONS sits beneath the title block on the left,
              matching its width (per the wireframe). filter +
              columns + persona + sort + proofs. */}
          <div style={{ marginTop: 12 }}>
            <ViewOptions
              basket={basket} onBasket={setBasket} baskets={BASKETS}
              filterInfo={FILTER_INFO}
              columnMode={columnMode} onColumnMode={setColumnMode}
              personaAll={personaAll} onPersonaAll={setPersonaAll}
              sortMode={sortMode} onSortMode={setSortMode}
              proofsAllOpen={openRows.size === MESSAGES.length && MESSAGES.length > 0}
              onProofsExpand={() => setOpenRows(new Set(MESSAGES.map(m => m.id)))}
              onProofsCollapse={() => { setOpenRows(new Set()); setFocal(null); }}
              personaDisabled={!isLiftView}
              proofsDisabled={!isLiftView}
            />
          </div>
        </div>

        {/* OUTCOME cards on the right — locked to 2×2 (the cards'
            inner auto-fit grid at 230px min lands on 2 columns inside
            this 520px-capped wrapper). flex-basis 480px keeps the
            cards from squeezing before the title block compresses;
            below the wrap point they sit under the title still 2×2. */}
        <div style={{
          flex: "0 1 520px", width: 520, maxWidth: "100%",
        }}>
          <OutcomeCards value={outcome} onChange={setOutcome} />
        </div>
      </div>

      {/* ─── SCALE / MEASUREMENT block — active outcome's pillbox +
           scale legend + verbatim definition. Renders for ALL FOUR
           outcomes (the SCALE block is the one consistent piece
           across views). ─── */}
      <ScaleBlock outcome={outcome}
        sopRange={SOP_RANGE} utilityRange={UTILITY_RANGE} />

      {/* ── LIFT VIEWS (Persuasion / Base) render the cube grid.
           SoP / Utility render their own views — built in the next
           steps; until then a clear placeholder stands in. ── */}
      {outcome === "sop" ? (
        <SopGrid
          messages={sortedMessages}
          segments={orderedSegments}
          basket={basket}
          range={SOP_RANGE}
          dragSegId={dragSegId}
          onSegDragStart={(e, segId) => {
            setDragSegId(segId);
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", String(segId));
          }}
          onSegDragEnd={() => setDragSegId(null)}
          onSegDragOver={(e) => {
            if (dragSegId == null || dragSegId === undefined) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }}
          onSegDrop={(e, segId) => {
            e.preventDefault();
            moveSegment(dragSegId, segId);
            setDragSegId(null);
          }}
          tier1Dim={tier1Dim}
          colFocus={colFocus}
          onSegmentClick={toggleColFocus}
          openRows={openRows}
          onToggleRow={toggleRow}
        />
      ) : outcome === "utility" ? (
        <UtilityGrid
          messages={sortedMessages}
          segments={orderedSegments}
          basket={basket}
          range={UTILITY_RANGE}
          dragSegId={dragSegId}
          onSegDragStart={(e, segId) => {
            setDragSegId(segId);
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", String(segId));
          }}
          onSegDragEnd={() => setDragSegId(null)}
          onSegDragOver={(e) => {
            if (dragSegId == null || dragSegId === undefined) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }}
          onSegDrop={(e, segId) => {
            e.preventDefault();
            moveSegment(dragSegId, segId);
            setDragSegId(null);
          }}
          tier1Dim={tier1Dim}
          colFocus={colFocus}
          onSegmentClick={toggleColFocus}
          openRows={openRows}
          onToggleRow={toggleRow}
        />
      ) : (
      <>
      {/* ─── PROOF POINTS ORIENTATION STRIP ─── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        fontSize: 11, color: C.textMuted, fontFamily: FONT,
        padding: "8px 12px", marginBottom: 10,
        background: "rgba(167,139,250,0.05)",
        border: `1px solid rgba(167,139,250,0.18)`,
        borderRadius: 4,
      }}>
        <span style={{
          fontFamily: MONO, fontSize: 9, color: C.violet,
          fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
        }}>Proof Points</span>
        <InfoDot title="Proof points">{PROOF_INFO}</InfoDot>
        <span>
          Each row drills into its proof-token grid via the ▸ chevron.{" "}
          <em style={{ color: C.textDim }}>Themes are listed in the order they appeared
          in the survey design; the order does not reflect importance or ranking.</em>
        </span>
      </div>

      {/* Wording is shown by a per-row WordingDrawer that slides out
          from the LEFT of the hovered row — see below. The global
          preview strip was replaced because the layout shift it
          caused on hover read as a screen 'blink'. */}

      {/* ─── GRID FRAME ─── */}
      {/*
          Column layout (left → right):
              chevron · Message · Variant Universe · 16 segment columns
          Variant Universe moved LEFT per analyst feedback.
      */}
      <div style={{
        background: C.card, border: `1px solid ${C.cardBorder}`,
        borderRadius: 6, overflow: "visible", position: "relative",
      }}>
        {/* Column spotlight — segment header click lifts the whole
            column (header + every body cell) into one rounded violet
            rectangle. Spans the frame; pointer-events off so cells
            below stay clickable. */}
        {colFocus !== null && (() => {
          const idx = orderedSegments.findIndex(s => s.id === colFocus);
          if (idx < 0) return null;
          return (
            <div style={{
              position: "absolute",
              top: 32, bottom: 6, left: 12, right: 12,
              display: "grid",
              gridTemplateColumns: rowTemplate,
              gap: 3,
              pointerEvents: "none", zIndex: 4,
            }}>
              <div style={{ gridColumn: idx + 4, margin: "-4px -4px" }}>
                <div style={{
                  width: "100%", height: "100%",
                  border: "1.5px solid #7F77DD",
                  borderRadius: 8,
                  background: "transparent",
                }} />
              </div>
            </div>
          );
        })()}
        {/* Header row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: rowTemplate,
          gap: 3,
          padding: "10px 12px",
          borderBottom: `1px solid ${C.cardBorder}`,
          background: C.bg,
          transition: "grid-template-columns 0.3s",
        }}>
          <div /> {/* chevron gutter */}

          {/* MESSAGE column header (big) + Proof points sub-header (small) */}
          <div style={{
            display: "flex", flexDirection: "column", justifyContent: "flex-end",
            paddingRight: 10, paddingBottom: 4,
          }}>
            <span style={{
              fontFamily: MONO, fontSize: 12, color: C.text,
              fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
              display: "flex", alignItems: "center",
            }}>
              Message
              <InfoDot title="Message" placement="below">{MESSAGE_INFO}</InfoDot>
            </span>
            <span style={{
              fontFamily: MONO, fontSize: 8, color: C.textDim,
              marginTop: 4, letterSpacing: 1.5, textTransform: "uppercase",
              fontWeight: 600,
              display: "flex", alignItems: "center",
            }}>
              Proof points
              <InfoDot title="Proof points" placement="below">{PROOF_INFO}</InfoDot>
            </span>
          </div>

          {/* VARIANT UNIVERSE column header — legend inline */}
          <div style={{
            display: "flex", flexDirection: "column", justifyContent: "flex-end",
            paddingRight: 10, paddingBottom: 2,
            borderRight: `1px dashed ${C.cardBorder}`,
          }}>
            <span style={{
              fontFamily: MONO, fontSize: 8, color: C.violet,
              fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
              display: "flex", alignItems: "center",
            }}>
              Variant Universe
              <InfoDot title="Variant universe" placement="right">{VARIANT_UNIVERSE_INFO}</InfoDot>
            </span>
            <VariantUniverseLegend />
            <div style={{
              display: "flex", justifyContent: "space-between",
              fontFamily: MONO, fontSize: 6, color: C.textDim,
              letterSpacing: 0.5, textTransform: "uppercase",
              marginTop: -2, paddingLeft: 14, paddingRight: 14,
            }}>
              <span>○ core</span>
              <span style={{ color: "#34d399" }}>● optimal</span>
            </div>
          </div>

          {/* PRISM SEGMENTS — segment-circle band. The 'N PRISM SEGMENTS'
              group label is gone; the circles + names speak for
              themselves. Same tracks + gap as the body rows, so the
              circles track the focal column when it widens. */}
          <div ref={segBandRef} style={{
            gridColumn: `4 / span ${orderedSegments.length}`,
            display: "grid",
            gridTemplateColumns: gridTemplate,
            columnGap: 3,
            transition: "grid-template-columns 0.3s",
          }}>
            {/* Segment-circle column headers. When the column is the focal
                (persona-open) column, a small persona icon appears above the
                circle to label the unfolded side. */}
            {orderedSegments.map(seg => {
              const spot = focal?.segId ?? colFocus;
              // No hover-driven crosshair anymore — only an active
              // spotlight (focal cube column / clicked-segment column)
              // dims the rest.
              const lit = spot === null || seg.id === spot;
              const isDragging = dragSegId === seg.id;
              return (
                <div key={seg.id}
                  draggable
                  onDragStart={(e) => {
                    setDragSegId(seg.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", String(seg.id));
                  }}
                  onDragEnd={() => setDragSegId(null)}
                  onDragOver={(e) => {
                    if (dragSegId == null || dragSegId === seg.id) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    moveSegment(dragSegId, seg.id);
                    setDragSegId(null);
                  }}
                  onClick={() => toggleColFocus(seg.id)}
                  style={{
                    display: "flex", justifyContent: "center",
                    opacity: (lit ? 1 : 0.15) * tier1Dim(seg.id),
                    transition: "opacity 0.12s",
                    cursor: isDragging ? "grabbing" : "grab",
                    position: "relative", zIndex: 5,
                  }}>
                  <SegmentCircle seg={seg}
                    widened={focal?.segId === seg.id || colFocus === seg.id} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Body — the cube grid. Clicking any cell of an intersection
            unfolds its mini-grid in place; while focal, everything
            except headers + the focal row's labels fades out.
            Chevron = proof accordion only. */}
        <div>
          {sortedMessages.map((m, i) => {
            const isFocalRow = focal?.msgId === m.id;
            const isOpen = openRows.has(m.id);
            const rowDim = focal ? !isFocalRow : false;
            const proofVals = isOpen ? proofValuesFor(m.id) : [];
            const groupBorder = i < sortedMessages.length - 1
              ? `1px solid ${C.cardBorder}` : "none";

            // ── FOCAL ROW GROUP — one grid, so every cube row aligns
            // with its proof label in the first column and the cube
            // columns sit under their segment circle. Two spanning divs
            // draw the chrome behind the cells: the violet persona-
            // column bracket (whole column) and the white cube outline
            // (token rows — the mini-grid box). No labels inside the
            // cube itself.
            if (isFocalRow) {
              const tokens = tokensByMsg.get(m.id) || [];
              const vals = proofValuesFor(m.id);
              const focalIdx = orderedSegments.findIndex(s => s.id === focal.segId);
              return (
                <div key={m.id} style={{
                  borderBottom: groupBorder, position: "relative",
                }}>
                  {hoverWording?.msgId === m.id && (
                    <WordingDrawer hover={hoverWording} />
                  )}
                  <div ref={focalRef} style={{
                    display: "grid", gridTemplateColumns: rowTemplate, gap: 3,
                    padding: "8px 12px", alignItems: "center",
                    background: "rgba(96,165,250,0.04)",
                    transition: "grid-template-columns 0.3s",
                  }}>
                    {/* row 1 — chevron + message label stay lit (they
                        label the cube); the B6 strip fades */}
                    <div
                      onClick={() => toggleRow(m.id)}
                      style={{
                        gridRow: 1, gridColumn: 1,
                        fontFamily: MONO, fontSize: 10, color: C.violet,
                        textAlign: "center", cursor: "pointer",
                        transform: "rotate(90deg)",
                      }}>▸</div>
                    <div style={{
                      gridRow: 1, gridColumn: 2,
                      display: "flex", alignItems: "center", gap: 8,
                      paddingRight: 10, cursor: "pointer",
                    }} onClick={() => toggleRow(m.id)}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontFamily: MONO, fontSize: 9, color: C.textDim,
                          letterSpacing: 0.5,
                        }}>MSG {String(m.id).padStart(2, "0")}</div>
                        <div style={{
                          fontFamily: FONT, fontSize: 14.3, fontWeight: 700,
                          color: C.text, overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{m.theme_label}</div>
                      </div>
                    </div>
                    {/* Variant Universe strip stays SPOTLIT in focal
                        mode — it's the at-a-glance summary for the
                        message the cube is dissecting. Cube hovers
                        drive its tick through hoverLift / hoverLiftMsg. */}
                    <div style={{
                      gridRow: 1, gridColumn: 3, marginRight: 10,
                      display: "flex", alignItems: "center",
                    }}>
                      <VariantUniverseBar
                        stats={universeByMsg.get(m.id)
                          ? { ...universeByMsg.get(m.id), live: liveFor(m.id) }
                          : null}
                        colorScale={colorScale}
                        color={universeColor}
                      />
                    </div>

                    {/* THE VIOLET COLUMN BRACKET — one container around
                        the persona-open column. Border only (no fill,
                        no shadow); the persona/core differentiation
                        now lives inside the cells via the persona
                        cell gradient. */}
                    <div style={{
                      gridRow: `1 / span ${2 + vals.length}`,
                      gridColumn: focalIdx + 4,
                      alignSelf: "stretch", justifySelf: "stretch",
                      margin: "-6px -5px",
                      border: "1.5px solid #7F77DD",
                      borderRadius: 5,
                      background: "transparent",
                      zIndex: 1, pointerEvents: "none",
                    }} />
                    {/* THE CUBE OUTLINE — one white box around the
                        mini-grid (the focal column's token rows) */}
                    {vals.length > 0 && (
                      <div style={{
                        gridRow: `3 / span ${vals.length}`,
                        gridColumn: focalIdx + 4,
                        alignSelf: "stretch", justifySelf: "stretch",
                        margin: "-4px -2px",
                        background: "#0c1322",
                        border: "1.5px solid rgba(203,213,225,0.9)",
                        borderRadius: 6,
                        boxShadow: "0 0 0 1px rgba(241,245,249,0.25), 0 0 22px rgba(203,213,225,0.2), 0 14px 36px rgba(0,0,0,0.7)",
                        zIndex: 2, pointerEvents: "none",
                      }} />
                    )}

                    {/* row 1 — aggregated cells. The FOCAL column's
                        aggregated cell spans rows 1+2 (the message
                        header row AND the question-wording row), so
                        the CORE | PERSONA pair sits centered next to
                        the core wording — visually the focal point —
                        and the proof-point cube rows below read as
                        add-ons stacking under it. The focal column
                        also carries its own CORE | PERSONA mini
                        header just above the cell, and the persona
                        silhouette icon riding the bracket's top
                        border. */}
                    {orderedSegments.map((seg, j) => {
                      const isFocalCol = seg.id === focal.segId;
                      if (isFocalCol) {
                        return (
                          <div key={seg.id} style={{
                            gridRow: "1 / span 2",
                            gridColumn: j + 4,
                            position: "relative",
                            alignSelf: "center",
                            display: "flex", flexDirection: "column",
                            gap: 3, zIndex: 3,
                          }}>
                            {/* Persona icon — sits atop the violet
                                bracket's top border */}
                            <div style={{
                              position: "absolute", top: -34,
                              left: "50%", right: 0,
                              display: "flex", justifyContent: "center",
                              zIndex: 7, pointerEvents: "none",
                            }}>
                              <PersonaIcon />
                            </div>
                            {/* CORE | PERSONA mini header — labels
                                the two arms right above the cells */}
                            <div style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 8px 1fr",
                              fontFamily: MONO, fontSize: 8,
                              fontWeight: 700, letterSpacing: 1.5,
                              textAlign: "center",
                            }}>
                              <span style={{ color: "#cbd5e1" }}>CORE</span>
                              <div />
                              <span style={{ color: "#7F77DD" }}>PERSONA</span>
                            </div>
                            <SplitCell
                              core={getHalf(m.id, seg.id, 2)}
                              tuned={getHalf(m.id, seg.id, 1)}
                              fadeBelow={FADE_BELOW}
                              height={50}
                              compact={false}
                              personaOpen
                              coreTitle={coreTextByMsg.get(m.id)}
                              tunedTitle={tokens[0]?.text_by_persona?.[seg.code]}
                              onCellHover={cellHoverHandler(m, seg, null)}
                              onClick={() => toggleFocal(m.id, seg.id)}
                            />
                          </div>
                        );
                      }
                      return (
                        <div key={seg.id} style={{
                          gridRow: 1, gridColumn: j + 4,
                          opacity: 0.15, transition: "opacity 0.12s",
                        }}>
                          <SplitCell
                            core={getHalf(m.id, seg.id, 2)}
                            tuned={getHalf(m.id, seg.id, 1)}
                            fadeBelow={FADE_BELOW}
                            height={24}
                            compact
                            coreTitle={coreTextByMsg.get(m.id)}
                            tunedTitle={tokensByMsg.get(m.id)?.[0]
                              ?.text_by_persona?.[seg.code]}
                            onCellHover={cellHoverHandler(m, seg, null)}
                            onClick={() => toggleFocal(m.id, seg.id)}
                          />
                        </div>
                      );
                    })}

                    {/* row 2 — core wording (lit: it labels the cube's
                        base row) */}
                    <div
                      title={coreTextByMsg.get(m.id) || ""}
                      style={{
                        gridRow: 2, gridColumn: "2 / span 2",
                        paddingRight: 16,
                        fontFamily: "'Lora', Georgia, serif",
                        fontSize: 16, fontStyle: "italic", lineHeight: 1.45,
                        color: "#cbd5e1",
                        borderLeft: `2px solid ${C.violet}`,
                        paddingLeft: 10, marginLeft: 2, marginTop: 4,
                        display: "-webkit-box", WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical", overflow: "hidden",
                        cursor: "help",
                      }}>
                      “{coreTextByMsg.get(m.id) || "(core wording unavailable)"}”
                      <span style={{
                        display: "block", marginTop: 3,
                        fontFamily: MONO, fontSize: 7.5, fontStyle: "normal",
                        color: C.textDim, letterSpacing: 1,
                        textTransform: "uppercase",
                      }}>Core message — exact wording shown to respondents</span>
                    </div>

                    {/* token rows — proof labels span col 2 + 3 (like
                        the core wording above), so long proof labels
                        get the same horizontal runway as the question
                        wording. Hover surfaces the full label. */}
                    {vals.map((v, k) => {
                      const tok = tokens[Math.max(v - 1, 0)] || {};
                      const isBase = proofLabel(m, v) === "no proof point";
                      const fullLabel = proofLabel(m, v);
                      return (
                        <Fragment key={v}>
                          <div style={{
                            gridRow: 3 + k, gridColumn: 1,
                            textAlign: "center", fontFamily: MONO,
                            fontSize: 8, color: C.textDim,
                          }}>·</div>
                          <div
                            title={fullLabel}
                            style={{
                              gridRow: 3 + k, gridColumn: "2 / span 2",
                              paddingLeft: 22, paddingRight: 16,
                              fontFamily: "'Lora', Georgia, serif",
                              fontSize: 16, fontWeight: 500,
                              color: isBase ? C.textDim : "#e2e8f0",
                              fontStyle: isBase ? "italic" : "normal",
                              display: "-webkit-box", WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical", overflow: "hidden",
                              cursor: "help", lineHeight: 1.3,
                            }}>↳ {fullLabel}</div>
                          {orderedSegments.map((seg, j) => {
                            const isFocalCol = seg.id === focal.segId;
                            return (
                              <div key={seg.id} style={{
                                gridRow: 3 + k, gridColumn: j + 4,
                                position: "relative",
                                zIndex: isFocalCol ? 3 : "auto",
                                opacity: isFocalCol ? 1 : 0.15,
                                transition: "opacity 0.12s",
                              }}>
                                {isFocalCol ? (
                                  <CubePair
                                    core={getProofHalf(m.id, seg.id, 2, v)}
                                    tuned={getProofHalf(m.id, seg.id, 1, v)}
                                    fadeBelow={FADE_BELOW}
                                    coreText={tok.text_core || ""}
                                    personaText={tok.text_by_persona?.[seg.code] || ""}
                                    onCellHover={cellHoverHandler(m, seg,
                                      proofLabel(m, v))}
                                    onClick={() => toggleFocal(m.id, seg.id)}
                                  />
                                ) : (
                                  <SplitCell
                                    core={getProofHalf(m.id, seg.id, 2, v)}
                                    tuned={getProofHalf(m.id, seg.id, 1, v)}
                                    fadeBelow={FADE_BELOW}
                                    height={20}
                                    personaOpen
                                    coreTitle={tok.text_core}
                                    tunedTitle={tok.text_by_persona?.[seg.code]}
                                    onCellHover={cellHoverHandler(m, seg,
                                      proofLabel(m, v))}
                                    onClick={() => toggleFocal(m.id, seg.id)}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </div>
                </div>
              );
            }

            // ── Standard row (+ chevron accordion) — while a focal box
            // is open elsewhere, everything here fades out. The wording
            // drawer ONLY renders for the focal row (the cube being
            // dissected); resting-state hovers don't summon it.
            return (
              <div key={m.id} style={{
                borderBottom: groupBorder, position: "relative",
              }}>
                {/* ── Main (aggregated) row ── */}
                <div style={{
                  display: "grid", gridTemplateColumns: rowTemplate, gap: 3,
                  padding: "8px 12px", alignItems: "center", minHeight: 38,
                  background: isFocalRow ? "rgba(96,165,250,0.04)" : "transparent",
                  transition: "background 0.25s, grid-template-columns 0.3s",
                }}>
                  <div
                    onClick={() => toggleRow(m.id)}
                    style={{
                      fontFamily: MONO, fontSize: 10,
                      color: isOpen ? C.violet : C.textDim,
                      textAlign: "center", cursor: "pointer",
                      transform: isOpen ? "rotate(90deg)" : "none",
                      transition: "transform 0.2s, opacity 0.12s",
                      opacity: rowDim ? 0.15 : 1,
                    }}>▸</div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    paddingRight: 10,
                    opacity: rowDim ? 0.15 : 1,
                    transition: "opacity 0.12s", cursor: "pointer",
                  }} onClick={() => toggleRow(m.id)}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontFamily: MONO, fontSize: 9, color: C.textDim, letterSpacing: 0.5,
                      }}>MSG {String(m.id).padStart(2, "0")}</div>
                      <div style={{
                        // Analyst direction: message label 1.3x (11 → 14.3)
                        fontFamily: FONT, fontSize: 14.3, fontWeight: 700, color: C.text,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{m.theme_label}</div>
                    </div>
                  </div>
                  {/* Variant Universe strip — per-message 1-D summary */}
                  <div style={{
                    marginRight: 10,
                    display: "flex", alignItems: "center",
                    opacity: rowDim ? 0.15 : 1,
                    transition: "opacity 0.25s",
                  }}>
                    <VariantUniverseBar
                      stats={universeByMsg.get(m.id)
                        ? { ...universeByMsg.get(m.id), live: liveFor(m.id) }
                        : null}
                      colorScale={colorScale}
                      color={universeColor}
                    />
                  </div>
                  {orderedSegments.map(seg => {
                    // Only column spotlight or focal cube dims the rest;
                    // hover no longer drives a crosshair.
                    const cross = (focal
                      ? 0.15
                      : colFocus !== null
                        ? (seg.id === colFocus ? 1 : 0.15)
                        : 1) * tier1Dim(seg.id);
                    const cellPersonaOpen = colFocus === seg.id || personaAll;
                    return (
                      <div
                        key={seg.id}
                        onMouseEnter={() => { setHoverMsg(m.id); setHoverSeg(seg.id); }}
                        onMouseLeave={() => { setHoverMsg(null); setHoverSeg(null); }}
                        style={{
                          opacity: cross,
                          transition: "opacity 0.12s",
                        }}>
                        <SplitCell
                          core={getHalf(m.id, seg.id, 2)}
                          tuned={getHalf(m.id, seg.id, 1)}
                          fadeBelow={FADE_BELOW}
                          height={colFocus === seg.id ? 30 : 24}
                          compact={colFocus !== seg.id}
                          personaOpen={cellPersonaOpen}
                          coreTitle={coreTextByMsg.get(m.id)}
                          tunedTitle={tokensByMsg.get(m.id)?.[0]
                            ?.text_by_persona?.[seg.code]}
                          onCellHover={cellHoverHandler(m, seg, null)}
                          onClick={() => toggleFocal(m.id, seg.id)}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* ── Accordion: core wording + per-proof sub-rows ── */}
                <div style={{
                  maxHeight: isOpen ? 600 : 0, overflow: "hidden",
                  opacity: focal ? 0.15 : 1,
                  transition: "max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.12s",
                }}>
                  {isOpen && (
                    <>
                      <div style={{
                        display: "grid", gridTemplateColumns: rowTemplate, gap: 3,
                        padding: "2px 12px 6px",
                      }}>
                        <div />
                        <div
                          title={coreTextByMsg.get(m.id) || ""}
                          style={{
                          gridColumn: "2 / span 2", paddingRight: 16,
                          // Lora (serif) for respondent-facing wording;
                          // 16px, clamped to 2 lines — hover (title)
                          // carries the full text.
                          fontFamily: "'Lora', Georgia, serif",
                          fontSize: 16, fontStyle: "italic", lineHeight: 1.45,
                          color: "#cbd5e1",
                          borderLeft: `2px solid ${C.violet}`,
                          paddingLeft: 10, marginLeft: 2,
                          display: "-webkit-box", WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical", overflow: "hidden",
                          cursor: "help",
                        }}>
                          “{coreTextByMsg.get(m.id) || "(core wording unavailable)"}”
                          <span style={{
                            display: "block", marginTop: 3,
                            fontFamily: MONO, fontSize: 7.5, fontStyle: "normal",
                            color: C.textDim, letterSpacing: 1, textTransform: "uppercase",
                          }}>Core message — exact wording shown to respondents</span>
                        </div>
                        <div style={{ gridColumn: `4 / span ${orderedSegments.length}` }} />
                      </div>
                      {proofVals.map(v => {
                        const tok = tokensByMsg.get(m.id)
                          ?.[Math.max(v - 1, 0)] || {};
                        const fullLabel = proofLabel(m, v);
                        const isBase = fullLabel === "no proof point";
                        return (
                        <div key={v} style={{
                          display: "grid", gridTemplateColumns: rowTemplate, gap: 3,
                          padding: "0 12px 4px", alignItems: "center",
                        }}>
                          <div style={{
                            textAlign: "center", fontFamily: MONO,
                            fontSize: 8, color: C.textDim,
                          }}>·</div>
                          {/* Proof label spans col 2 + 3 (Message +
                              Variant Universe) — matches the core-
                              wording row above and gives long labels
                              real runway. Hover surfaces the full
                              label so a 2-line clamp never hides it. */}
                          <div
                            title={fullLabel}
                            style={{
                              gridColumn: "2 / span 2",
                              paddingLeft: 22, paddingRight: 16,
                              fontFamily: "'Lora', Georgia, serif",
                              fontSize: 16, fontWeight: 500,
                              color: isBase ? C.textDim : "#e2e8f0",
                              fontStyle: isBase ? "italic" : "normal",
                              display: "-webkit-box", WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical", overflow: "hidden",
                              cursor: "help", lineHeight: 1.3,
                            }}>↳ {fullLabel}</div>
                          {orderedSegments.map(seg => {
                            // Crosshair removed; cells stay at full
                            // opacity unless a focal cube / colFocus
                            // owns the dim state above.
                            // Persona × proof cells render when the
                            // persona column is expanded — either this
                            // column's spotlight or the global
                            // "expand all persona" toggle.
                            const open = colFocus === seg.id || personaAll;
                            return (
                              <div
                                key={seg.id}
                                onMouseEnter={() => { setHoverMsg(m.id); setHoverSeg(seg.id); }}
                                onMouseLeave={() => { setHoverMsg(null); setHoverSeg(null); }}
                                style={{ transition: "opacity 0.12s" }}>
                                <SplitCell
                                  core={getProofHalf(m.id, seg.id, 2, v)}
                                  tuned={getProofHalf(m.id, seg.id, 1, v)}
                                  fadeBelow={FADE_BELOW}
                                  height={open ? 26 : 20}
                                  compact={!open}
                                  personaOpen={open}
                                  coreTitle={tok.text_core}
                                  tunedTitle={tok.text_by_persona?.[seg.code]}
                                  onCellHover={cellHoverHandler(m, seg,
                                    proofLabel(m, v))}
                                  onClick={() => toggleFocal(m.id, seg.id)}
                                />
                              </div>
                            );
                          })}
                        </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </>
      )}

      {/* ─── METHODOLOGY FOOTNOTE ─── */}
      <details style={{
        marginTop: 14,
        background: C.card, border: `1px solid ${C.cardBorder}`,
        borderRadius: 6, fontFamily: FONT,
      }}>
        <summary style={{
          padding: "10px 14px", cursor: "pointer",
          fontSize: 11, color: C.textMuted, fontWeight: 600,
          fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase",
        }}>Methodology · how each cell is computed</summary>
        <div style={{
          padding: "0 18px 14px", fontSize: 11, color: C.textMuted, lineHeight: 1.65,
        }}>
          <p>
            The Message Map is a cell-level analytical surface. Each cell
            estimates the persuasion lift produced by a specific combination of
            four dimensions: <strong>message theme</strong> (one of the
            substantive messages tested in this study),{" "}
            <strong>audience segment</strong> (one of the 16 PRISM segments
            derived from cultural-ideological clustering),{" "}
            <strong>persona framing arm</strong> (PERSONA, meaning the message
            was tuned to the segment's worldview; vs. CORE, the untuned baseline
            version), and <strong>proof token</strong> (token 0 = base message;
            tokens 1+ = the same message with one of several specific
            statistical proof points appended). The cell space dimensions vary
            by study (number of messages, number of tokens per message, framing
            arms used); the dashboard displays the cells that the study's
            design populated.
          </p>

          <h4 style={{ color: C.text, fontSize: 12, marginTop: 14, marginBottom: 4 }}>
            The two outcomes (toggle)
          </h4>
          <p>
            <strong style={{ color: "#34d399" }}>PERSUASION MESSAGING.</strong>{" "}
            Cell value = engagement-weighted residualized attitudinal shift.
            This measures how much exposure to a specific (message × framing ×
            proof) combination produced movement in attitudinal alignment,
            above what the respondent's baseline and segment would have
            predicted. Use this view for paid media targeting decisions (where
            will spending budget produce attitudinal movement).
          </p>
          <p>
            <strong style={{ color: "#60a5fa" }}>BASE MESSAGING.</strong>{" "}
            Cell value = engagement-weighted within-segment alignment deviation.
            This measures whether the audience that engages with a specific
            variant is already more aligned than their segment's baseline. Use
            this view for owned-channel content decisions (what to put in
            supporter emails, fundraising appeals, and content that reinforces
            the base without alienating it).
          </p>
          <p style={{ color: C.textDim }}>
            The two outcomes typically correlate weakly across cells, confirming
            they measure operationally distinct phenomena.
          </p>

          <h4 style={{ color: C.text, fontSize: 12, marginTop: 14, marginBottom: 4 }}>
            How each cell value is computed
          </h4>
          <p>
            <strong>Step 1: engagement-weighted mean.</strong> Among
            respondents assigned to <code>(s, a, t)</code> who saw message{" "}
            <code>m</code>:
            {" "}<code style={{ color: C.violet, fontFamily: MONO }}>
              lift_raw = Σ (outcome_i × bw_score_im) / Σ |bw_score_im|
            </code>{" "}where <code>bw_score_im</code> is respondent <code>i</code>'s
            Best-Worst differential for message <code>m</code>. Signed B-W in
            the numerator = engagement direction × outcome direction. Absolute
            B-W in the denominator = engagement intensity regardless of
            direction.
          </p>
          <p>
            <strong>Step 2: empirical Bayes shrinkage.</strong> Cells with
            small <em>n</em> are pulled toward the message's overall marginal:
            {" "}<code style={{ color: C.violet, fontFamily: MONO }}>
              w = (n/σ²<sub>within</sub>) / (n/σ²<sub>within</sub> + 1/σ²<sub>between</sub>)
            </code>{" "}and{" "}<code style={{ color: C.violet, fontFamily: MONO }}>
              lift_shrunk = w·lift_raw + (1−w)·message_marginal
            </code>. Large stable cells retain raw; small/noisy cells move
            toward the message average. The shrinkage weight per cell is in
            tooltips for diagnostic transparency.
          </p>
          <p>
            <strong>Step 3: bootstrap confidence intervals.</strong>{" "}
            Respondent-level resampling with replacement, 500 iterations, fixed
            seed for reproducibility. The reported 95% CI is the 2.5th and
            97.5th percentiles of the cell's bootstrap distribution. A cell is
            statistically significant if its CI strictly excludes zero.
          </p>

          <h4 style={{ color: C.text, fontSize: 12, marginTop: 14, marginBottom: 4 }}>
            Interpretation conventions
          </h4>
          <p>
            <strong>+0.20 under PERSUASION:</strong> respondents in this cell
            shifted +0.20 points on the composite scale above what their
            baseline and segment predicted. Effect sizes in well-designed
            message tests typically range from 0.05 to 0.30. Values above 0.40
            warrant outlier scrutiny; values below 0.05 are within sampling
            noise.
          </p>
          <p>
            <strong>+0.20 under BASE:</strong> respondents who engaged with
            this variant were 0.20 points more aligned at baseline than their
            segment's average. This is a selection signal, not a causal claim.
          </p>

          <h4 style={{ color: C.text, fontSize: 12, marginTop: 14, marginBottom: 4 }}>
            Methodological limitations
          </h4>
          <p>
            <strong>Cell sample sizes vary.</strong> Priority segments are
            typically oversampled to support more reliable cell estimates;
            non-priority segments are smaller. Shrinkage handles this honestly
            but reduces resolution on thin cells.
          </p>
          <p>
            <strong>Multiple testing.</strong> With many cells per outcome,
            raw significance at α=0.05 would produce a non-trivial number of
            false positives. No correction applied — operational decisions
            should rely on patterns across a message-token family, not on
            individual cell p-values. Treat single-cell significance as
            exploratory.
          </p>
          <p>
            <strong>Reverse causality.</strong> Positive lift indicates
            engagement is associated with attitudinal movement. Pre-post timing
            plus residualization on pre-composite mitigates but does not
            eliminate the possibility that movement preceded engagement.
          </p>
          <p>
            <strong>Sample composition.</strong> Results apply to the survey
            panel's representation of the population sampled. Generalization to
            specific subpopulations (registered voters, specific media
            audiences) requires weighting or re-fielding.
          </p>
        </div>
      </details>

      {/* ─── PROVENANCE FOOTER ─── */}
      <div style={{
        marginTop: 12, padding: "10px 14px",
        fontSize: 10, color: C.textDim, fontFamily: MONO, letterSpacing: 0.5,
        background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 6,
      }}>
        <strong style={{ color: C.textMuted }}>{dashboard.study?.id}</strong>{" "}
        · {dashboard.study?.version} · Analyst: {dashboard.study?.analyst} ·
        N={dashboard.study?.n_total || "—"} ·
        Active basket: <span style={{ color: C.text }}>{activeBasket?.name}</span>{" "}
        ({activeBasket?.segments?.length} segments) ·
        Outcome: <span style={{ color: C.text }}>{activeMetric?.label}</span>{" "}
        (σ<sub>within</sub>={activeMetric?.sigma_within?.toFixed(3)})
      </div>
    </div>
  );
}

// Exported for B5 (priority-basket reorganization) — not used here yet.
export { PRIORITY_ORDERED_BY_ROI };
