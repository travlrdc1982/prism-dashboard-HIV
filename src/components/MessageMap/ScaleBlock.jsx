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

// ── RANGE BAR — data-driven legend for SoP and Utility ────────────
// Reads the ACTUAL {min, max} from the data (ranges differ by study).
// If the range straddles zero (e.g. signed Utility), it renders a
// diverging red→grey→green bar with a 0 tick at the true position;
// otherwise a sequential low→accent bar. Labels are the real numbers.
function RangeBar({ range, unit = "", accent = "#22d3ee" }) {
  if (!range || !Number.isFinite(range.min) || !Number.isFinite(range.max)) {
    return (
      <span style={{
        fontFamily: MONO, fontSize: 8, color: C.textDim,
        letterSpacing: 0.5,
      }}>no data</span>
    );
  }
  const W = 180, H = 16;
  const { min, max } = range;
  const span = (max - min) || 1;
  const straddles = min < 0 && max > 0;
  const zeroFrac = straddles ? (0 - min) / span : null;
  const dec = (Math.abs(max) >= 10 || Math.abs(min) >= 10) ? 0 : 1;
  const fmt = v => `${v.toFixed(dec)}${unit}`;
  const gid = `rb-${straddles ? "div" : "seq"}-${accent.replace("#", "")}`;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2,
                  position: "relative", width: W }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
            {straddles ? (
              <>
                <stop offset="0%"   stopColor="#f87171" />
                <stop offset={`${zeroFrac * 100}%`} stopColor="#64748b" />
                <stop offset="100%" stopColor="#34d399" />
              </>
            ) : (
              <>
                <stop offset="0%"   stopColor="rgba(148,163,184,0.18)" />
                <stop offset="100%" stopColor={accent} />
              </>
            )}
          </linearGradient>
        </defs>
        <rect x="0" y="2" width={W} height={H - 4}
              fill={`url(#${gid})`} rx="2"
              stroke={C.cardBorder} strokeWidth="0.8" />
        {straddles && (
          <line x1={zeroFrac * W} y1="0" x2={zeroFrac * W} y2={H}
                stroke="#cbd5e1" strokeWidth="1" strokeDasharray="2,2" />
        )}
      </svg>
      {/* labels: min (left), max (right), 0 at its true position if straddled */}
      <div style={{ position: "relative", height: 10 }}>
        <span style={{
          position: "absolute", left: 0, top: 0,
          fontFamily: MONO, fontSize: 7, fontWeight: 700, color: C.textMuted,
        }}>{fmt(min)}</span>
        {straddles && (
          <span style={{
            position: "absolute", left: `${zeroFrac * 100}%`, top: 0,
            transform: "translateX(-50%)",
            fontFamily: MONO, fontSize: 7, fontWeight: 700, color: "#cbd5e1",
          }}>0</span>
        )}
        <span style={{
          position: "absolute", right: 0, top: 0,
          fontFamily: MONO, fontSize: 7, fontWeight: 700, color: C.textMuted,
        }}>{fmt(max)}</span>
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
function ScaleLegend({ outcome, accent, sopRange, utilityRange }) {
  if (outcome === "sop")      return <RangeBar range={sopRange} unit="%" accent={accent} />;
  if (outcome === "utility")  return <RangeBar range={utilityRange} accent={accent} />;
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
        <ScaleLegend outcome={active.id} accent={active.accent}
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
