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

// ── 0–100 RAMP — used for SoP, Persuasion, Base ───────────────────
// Five chips 0/25/50/75/100. The high-end chip is tinted with the
// active outcome's accent so the eye reads the scale + the color
// association in one glance. Mirrors LiftRamp's visual idiom (chip
// width 28, height 16, MONO labels).
function ZeroToHundredRamp({ accent, suffix = "" }) {
  const stops = [0, 25, 50, 75, 100];
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {stops.map(v => {
        // Linear ramp from cardBorder → accent across the five stops.
        const t = v / 100;
        const bg = t === 0
          ? "rgba(148,163,184,0.10)"
          : `${accent}${Math.round(0x22 + t * (0xee - 0x22)).toString(16).padStart(2, "0")}`;
        const textColor = t >= 0.5 ? "#0f1520" : C.textMuted;
        return (
          <div key={v} style={{
            width: 30, height: 16, background: bg,
            border: `1px solid ${C.cardBorder}`, borderRadius: 2,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 7, color: textColor, fontFamily: MONO, fontWeight: 700,
          }}>{v}{suffix}</div>
        );
      })}
    </div>
  );
}

// ── DIVERGING BAR — used for Utility ──────────────────────────────
// Red (left, most negative) → grey (0) → green (right, most positive).
// Placeholder labels "−X / 0 / +X" until the messagemap pipeline
// emits real bounds.
function DivergingBar() {
  const W = 170, H = 16;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="util-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"  stopColor="#f87171" />
            <stop offset="50%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
        <rect x="0" y="2" width={W} height={H - 4}
              fill="url(#util-grad)" rx="2"
              stroke={C.cardBorder} strokeWidth="0.8" />
        {/* Zero center tick */}
        <line x1={W / 2} y1="0" x2={W / 2} y2={H}
              stroke="#cbd5e1" strokeWidth="1" strokeDasharray="2,2" />
      </svg>
      <div style={{
        display: "flex", justifyContent: "space-between",
        fontFamily: MONO, fontSize: 7, color: C.textMuted,
        letterSpacing: 0.5, fontWeight: 700,
      }}>
        <span>−X</span>
        <span>0</span>
        <span>+X</span>
      </div>
    </div>
  );
}

// ── SCALE LEGEND — chooses the right legend for the active outcome ─
function ScaleLegend({ outcome, accent }) {
  if (outcome === "sop")      return <ZeroToHundredRamp accent={accent} suffix="%" />;
  if (outcome === "utility")  return <DivergingBar />;
  // persuasion_messaging | base_messaging
  return <ZeroToHundredRamp accent={accent} />;
}

// ═══════════════════════════════════════════════════════════════════
// ScaleBlock — the exported block.
// ═══════════════════════════════════════════════════════════════════
export default function ScaleBlock({ outcome }) {
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
        <ScaleLegend outcome={active.id} accent={active.accent} />
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
