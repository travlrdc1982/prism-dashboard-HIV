// ═══════════════════════════════════════════════════════════════
// PRISM DESIGN SYSTEM — Shared Colors & Styles
// ═══════════════════════════════════════════════════════════════

export const C = {
  // Backgrounds
  bg:       "#080c16",
  card:     "#0f1520",
  cardBorder: "#1e293b",
  dotStrip: "#1a2030",

  // Text
  white:    "#f1f5f9",
  text:     "#cbd5e1",
  textMuted:"#94a3b8",
  textDim:  "#475569",
  steel:    "#64748b",

  // Party
  partyGOP: "#ef4444",
  partyDEM: "#3b82f6",

  // Accents
  cyan:     "#22d3ee",
  violet:   "#a78bfa",
  rose:     "#fb7185",
  amber:    "#f59e0b",
  green:    "#34d399",
  red:      "#f87171",
  teal:     "#2dd4bf",
  blue:     "#60a5fa",

  // Trust
  govtBlue:  "#60a5fa",
  corpAmber: "#f59e0b",
};

export const FONT = "'Nunito Sans', -apple-system, sans-serif";
export const MONO = "'JetBrains Mono', 'Fira Code', monospace";

// Party color helper
export function partyColor(party) {
  return party === "GOP" ? C.partyGOP : C.partyDEM;
}
