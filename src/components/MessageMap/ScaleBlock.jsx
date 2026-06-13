// ScaleBlock — the "SCALE / MEASUREMENT" status block.
//
// One horizontal card that sits between the controls bar and the
// proof-points orientation strip on the Message Map page. It shows
// the analyst three things about the ACTIVE outcome at a glance:
//
//   1) PILLBOX (left)         — four small pills (SoP / Utility /
//      Persuasion / Base) where the active outcome's pill is filled
//      with that outcome's accent color. NOT clickable — this is a
//      status indicator. The outcome selector cards remain the
//      canonical control.
//
//   2) SCALE LEGEND (middle)  — a small inline visual that matches
//      the active outcome's measurement scale. SoP and the two lift
//      metrics use 0–100 ramps; Utility uses a diverging −X / 0 / +X
//      bar (placeholder labels until the pipeline emits real bounds).
//
//   3) DEFINITION (right)     — the analyst's verbatim definition of
//      the active outcome, in Lora serif italic, right there in the
//      block (NOT a tooltip).
//
// Read-only on math: no data invented. The Utility "-X / +X" labels
// are intentional until the messagemap pipeline emits real bounds.
import { C, FONT, MONO } from "../../data/theme";
import LiftRamp from "./LiftRamp";

// Pill labels (display) keyed by outcome id.
const OUTCOMES = [
  { id: "sop",                  pill: "SoP",        title: "Share of Preference",      accent: "#22d3ee" },
  { id: "utility",              pill: "Utility",    title: "Message Utility",          accent: "#a78bfa" },
  { id: "persuasion_messaging", pill: "Persuasion", title: "Persuasion Messaging Lift",accent: "#34d399" },
  { id: "base_messaging",       pill: "Base",       title: "Base Messaging Lift",      accent: "#60a5fa" },
];

// Verbatim analyst definitions — do NOT paraphrase.
const DEFINITIONS = {
  sop: "The percent share of overall likely preference one has toward the message compared to other messages. All messages add to 100% for each audience",
  utility: "A number that ranges from -X to +X that shows the probability the message will be most compelling compared to other messages. Negative values reflect messages more likely to be seen as least compelling.",
  persuasion_messaging: "Indexed score from 0-100 that depicts the relative, incremental impact each message and message variant has in persuading the audience--moving opinion",
  base_messaging: "Indexed score from 0-100 that depicts the relative, incremental impact each message and message variant has in shaping the opinion of the audience",
};

// ── PILL — read-only status indicator ─────────────────────────────
function Pill({ label, active, accent }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      padding: "3px 7px", borderRadius: 3,
      fontFamily: MONO, fontSize: 9, fontWeight: 700,
      letterSpacing: 1.2, textTransform: "uppercase",
      background: active ? accent : "transparent",
      color: active ? "#0f1520" : C.textMuted,
      border: `1px solid ${active ? accent : C.cardBorder}`,
      boxShadow: active ? `0 0 0 1px ${accent}44` : "none",
      whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

// ── GRADIENT LEGEND — data-driven 6-bin red→green ramp ────────────
// Matches the AL/Pharma study idiom: the value range (which differs
// by study) is split into N discrete categories shaded red (low) →
// green (high) along an HSL hue sweep. Reads the ACTUAL {min, max}
// from the data; the same binned ramp colors the SoP / Utility
// heatmap cells, so legend and cells agree.
function gradientBins(n) {
  // hue 0° (red) → 120° (green), through amber, at fixed sat/lightness.
  return Array.from({ length: n }, (_, i) =>
    `hsl(${Math.round((i / (n - 1)) * 120)}, 60%, 46%)`);
}
function GradientLegend({ range, unit = "", bins = 6 }) {
  if (!range || !Number.isFinite(range.min) || !Number.isFinite(range.max)) {
    return (
      <span style={{
        fontFamily: MONO, fontSize: 8, color: C.textDim, letterSpacing: 0.5,
      }}>no data</span>
    );
  }
  const { min, max } = range;
  const dec = (Math.abs(max) >= 10 || Math.abs(min) >= 10) ? 0 : 1;
  const fmt = v => `${v.toFixed(dec)}${unit}`;
  const chips = gradientBins(bins);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, width: 186 }}>
      <div style={{ display: "flex", gap: 1 }}>
        {chips.map((c, i) => (
          <div key={i} style={{
            flex: 1, height: 16, background: c,
            borderTop: `1px solid ${C.cardBorder}`,
            borderBottom: `1px solid ${C.cardBorder}`,
            borderLeft: i === 0 ? `1px solid ${C.cardBorder}` : "none",
            borderRight: i === chips.length - 1 ? `1px solid ${C.cardBorder}` : "none",
            borderTopLeftRadius: i === 0 ? 2 : 0,
            borderBottomLeftRadius: i === 0 ? 2 : 0,
            borderTopRightRadius: i === chips.length - 1 ? 2 : 0,
            borderBottomRightRadius: i === chips.length - 1 ? 2 : 0,
          }} />
        ))}
      </div>
      <div style={{
        display: "flex", justifyContent: "space-between",
        fontFamily: MONO, fontSize: 7, fontWeight: 700, color: C.textMuted,
        letterSpacing: 0.5,
      }}>
        <span>{fmt(min)}</span>
        <span style={{ color: C.textDim }}>lower → higher</span>
        <span>{fmt(max)}</span>
      </div>
    </div>
  );
}

// ── PERSUASION / BASE RAMP — the EXACT legend the cells use ────────
// Persuasion and Base cells are colored by the shared red→white→green
// diverging ramp (liftScale.rampColor), via LiftRamp. The scale block
// must show that same ramp, not a single-hue accent ramp, so the
// legend matches what's actually on the grid. A tiny caption names
// the diverging poles.
function LiftRampLegend() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <LiftRamp />
      <div style={{
        display: "flex", justifyContent: "space-between",
        fontFamily: MONO, fontSize: 6.5, letterSpacing: 0.5,
        color: C.textDim, textTransform: "uppercase",
      }}>
        <span style={{ color: "#f87171" }}>backfire</span>
        <span>neutral</span>
        <span style={{ color: "#34d399" }}>lift</span>
      </div>
    </div>
  );
}

// ── SCALE LEGEND — chooses the right legend for the active outcome ─
// SoP / Utility read their REAL data range (sopRange / utilityRange);
// Persuasion / Base reuse the cells' own 0–100 red→white→green ramp.
function ScaleLegend({ outcome, sopRange, utilityRange }) {
  if (outcome === "sop")      return <GradientLegend range={sopRange} unit="%" />;
  if (outcome === "utility")  return <GradientLegend range={utilityRange} />;
  return <LiftRampLegend />;
}

// ═══════════════════════════════════════════════════════════════════
// ScaleBlock — the exported block.
// ═══════════════════════════════════════════════════════════════════
export default function ScaleBlock({ outcome, sopRange, utilityRange }) {
  const active = OUTCOMES.find(o => o.id === outcome) || OUTCOMES[0];
  const def = DEFINITIONS[active.id];

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 18,
      padding: "12px 14px", marginBottom: 12,
      background: C.card, border: `1px solid ${C.cardBorder}`,
      borderRadius: 6,
      fontFamily: FONT,
    }}>
      {/* (1) PILLBOX — four read-only status pills */}
      <div style={{
        display: "flex", gap: 4, flexShrink: 0, alignItems: "center",
      }}>
        {OUTCOMES.map(o => (
          <Pill key={o.id}
            label={o.pill}
            active={o.id === active.id}
            accent={o.accent} />
        ))}
      </div>

      {/* (2) SCALE LEGEND — matches the active outcome's scale */}
      <div style={{
        display: "flex", alignItems: "center",
        flexShrink: 0,
        paddingLeft: 14, paddingRight: 14,
        borderLeft: `1px solid ${C.cardBorder}`,
        borderRight: `1px solid ${C.cardBorder}`,
      }}>
        <ScaleLegend outcome={active.id}
          sopRange={sopRange} utilityRange={utilityRange} />
      </div>

      {/* (3) DEFINITION — verbatim analyst copy, in serif italic */}
      <div style={{
        flex: 1, minWidth: 0,
        display: "flex", flexDirection: "column", gap: 4,
      }}>
        <span style={{
          fontFamily: MONO, fontSize: 9, fontWeight: 700,
          letterSpacing: 1.5, textTransform: "uppercase",
          color: active.accent,
        }}>
          Measurement — {active.title}
        </span>
        <span style={{
          fontFamily: "'Lora', Georgia, serif",
          fontSize: 13, fontStyle: "italic",
          lineHeight: 1.5, color: "#cbd5e1",
        }}>
          {def}
        </span>
      </div>
    </div>
  );
}
