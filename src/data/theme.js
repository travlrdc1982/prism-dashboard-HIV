// ═══════════════════════════════════════════════════════════════
// PRISM DESIGN SYSTEM — Shared Colors & Styles
// ═══════════════════════════════════════════════════════════════
// To switch themes, change ACTIVE_THEME below to "dark" or "foundation".

const ACTIVE_THEME = "dark";

// ── Theme definitions ──────────────────────────────────────────

const themes = {
  dark: {
    C: {
      isDark: true,

      // Backgrounds
      bg:         "#080c16",
      card:       "#0f1520",
      cardBorder: "#1e293b",
      dotStrip:   "#1a2030",
      panelDeep:  "#0a0f1a",

      // Glass overlays (for use in gradient strings)
      glassA:    "rgba(255,255,255,0.03)",
      glassB:    "rgba(255,255,255,0.01)",
      greenTint: "rgba(34,197,94,0.08)",
      dividerStrong: "rgba(255,255,255,0.85)",

      // Tier badge backgrounds
      tier1Bg: "#064e3b",
      tier2Bg: "#854d0e",
      tier3Bg: "#991b1b",

      // Ideology heatmap section backgrounds
      gopSectionBg: "#110808",
      demSectionBg: "#080811",

      // Text
      white:     "#f8fbff",
      text:      "#dde6f0",
      textMuted: "#b0bece",
      textDim:   "#7a8ca1",
      steel:     "#91a3b6",

      // Party
      partyGOP: "#ef4444",
      partyDEM: "#3b82f6",

      // Accents
      cyan:   "#22d3ee",
      violet: "#a78bfa",
      rose:   "#fb7185",
      amber:  "#f59e0b",
      green:  "#34d399",
      red:    "#f87171",
      teal:   "#2dd4bf",
      blue:   "#60a5fa",

      // Trust
      govtBlue:  "#60a5fa",
      corpAmber: "#f59e0b",
    },
    FONT: "'Inter', -apple-system, sans-serif",
    MONO: "'JetBrains Mono', 'Fira Code', monospace",
  },

  foundation: {
    C: {
      isDark: false,

      // Backgrounds
      bg:         "#faf8f4",
      card:       "#ffffff",
      cardBorder: "#ddd8ce",
      dotStrip:   "#f0ece4",
      panelDeep:  "#f0ece4",

      // Glass overlays (for use in gradient strings)
      glassA:    "rgba(0,0,0,0.02)",
      glassB:    "rgba(0,0,0,0.01)",
      greenTint: "rgba(45,106,79,0.06)",
      dividerStrong: "rgba(30,24,16,0.15)",

      // Tier badge backgrounds
      tier1Bg: "#d1fae5",
      tier2Bg: "#fef3c7",
      tier3Bg: "#fee2e2",

      // Ideology heatmap section backgrounds
      gopSectionBg: "#fff8f8",
      demSectionBg: "#f8faff",

      // Text — white maps to the heading/prominent color (near-black on light bg)
      white:     "#1e1810",
      text:      "#3a3428",
      textMuted: "#8a8070",
      textDim:   "#a89e8e",
      steel:     "#8a8070",

      // Party
      partyGOP: "#b91c1c",
      partyDEM: "#1d4ed8",

      // Accents — cyan maps to the main accent (oxford navy)
      cyan:   "#1e3a5f",
      violet: "#4a3a6a",
      rose:   "#8b2c1a",
      amber:  "#92400e",
      green:  "#2d6a4f",
      red:    "#8b2c1a",
      teal:   "#1e3a5f",
      blue:   "#1e3a5f",

      // Trust
      govtBlue:  "#1e3a5f",
      corpAmber: "#92400e",
    },
    FONT: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
    MONO: "'Courier New', monospace",
  },
};

// ── Exports ────────────────────────────────────────────────────

export const C    = themes[ACTIVE_THEME].C;
export const FONT = themes[ACTIVE_THEME].FONT;
export const MONO = themes[ACTIVE_THEME].MONO;

// Party color helper
export function partyColor(party) {
  return party === "GOP" ? C.partyGOP : C.partyDEM;
}

// Apply theme tokens as CSS custom properties on the document root.
// Call this once before the React app mounts so index.css variables resolve correctly.
export function applyThemeCSSVars() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--t-bg",               C.bg);
  root.style.setProperty("--t-text",             C.text);
  root.style.setProperty("--t-card",             C.card);
  root.style.setProperty("--t-scrollbar-thumb",  C.cardBorder);
  root.style.setProperty("--t-scrollbar-track",  C.panelDeep);
}
