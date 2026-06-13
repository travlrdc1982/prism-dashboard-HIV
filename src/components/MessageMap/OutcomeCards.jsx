// OutcomeCards — the Message Map's measurement selector.
//
// Four clickable cards replace the old "Outcome" dropdown. Each names
// one way message impact is measured + the strategic question it
// answers. The active card is highlighted and drives the whole grid:
//   sop / utility                  → their own views
//   persuasion_messaging / base    → the lift cube (as wired now)
//
// Copy is the analyst's verbatim; only the chrome is ours.
import { C, FONT, MONO } from "../../data/theme";

const OUTCOMES = [
  {
    id: "sop",
    accent: "#22d3ee",
    title: "Share of Preference (SoP)",
    body: "A simple measure of how receptive the audience is to the message. The higher the score the more popular the message.",
    question: "Will the message be broadly embraced?",
  },
  {
    id: "utility",
    accent: "#a78bfa",
    title: "Message Utility",
    body: "The probability the message will be viewed as more compelling than other messages. The higher the score the more strongly one feels about the message.",
    question: "Is the message polarizing?",
  },
  {
    id: "persuasion_messaging",
    accent: "#34d399",
    title: "Persuasion Messaging Lift",
    body: "How persuasive the message is — how predictive it is in moving / changing overall perceptions.",
    question: "What will move people to our side?",
  },
  {
    id: "base_messaging",
    accent: "#60a5fa",
    title: "Base Messaging Lift",
    body: "How important the message is to an audience's support — how predictive it is of an audience's overall perceptions.",
    question: "What messages help reinforce our base support?",
  },
];

function Card({ outcome, active, onSelect }) {
  const a = outcome.accent;
  return (
    <button
      onClick={() => onSelect(outcome.id)}
      style={{
        minWidth: 0, textAlign: "left",
        display: "flex", flexDirection: "column", gap: 6,
        padding: "13px 15px 14px",
        borderRadius: 7, cursor: "pointer",
        background: active ? `${a}14` : C.card,
        border: `1.5px solid ${active ? a : C.cardBorder}`,
        boxShadow: active ? `0 0 0 1px ${a}55, 0 6px 18px rgba(0,0,0,0.45)` : "none",
        transform: active ? "translateY(-1px)" : "none",
        transition: "all 0.15s",
        outline: "none",
      }}
    >
      {/* Accent dot + title */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
          background: a, boxShadow: active ? `0 0 8px ${a}` : "none",
        }} />
        <span style={{
          fontFamily: FONT, fontSize: 15, fontWeight: 800,
          color: active ? "#f1f5f9" : C.text, lineHeight: 1.2,
        }}>{outcome.title}</span>
      </div>
      {/* Body */}
      <span style={{
        fontFamily: FONT, fontSize: 12, lineHeight: 1.5,
        color: active ? C.textMuted : C.textDim,
      }}>{outcome.body}</span>
      {/* Strategic question */}
      <span style={{
        marginTop: "auto",
        fontFamily: "'Lora', Georgia, serif", fontSize: 14,
        fontStyle: "italic", lineHeight: 1.4,
        color: active ? a : C.textDim,
      }}>{outcome.question}</span>
    </button>
  );
}

export default function OutcomeCards({ value, onChange }) {
  return (
    <div>
      <div style={{
        fontFamily: MONO, fontSize: 8, color: C.textDim,
        letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6,
      }}>
        Measurement · how message impact is measured and used
      </div>
      {/* Responsive: 4-across on wide screens, 2×2 on medium, 1-col
          on narrow — auto-fit collapses columns as width shrinks. */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
        gap: 10, alignItems: "stretch",
      }}>
        {OUTCOMES.map(o => (
          <Card key={o.id} outcome={o}
            active={value === o.id} onSelect={onChange} />
        ))}
      </div>
    </div>
  );
}
