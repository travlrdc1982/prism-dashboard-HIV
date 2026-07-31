// ═══════════════════════════════════════════════════════════════
// DEPLOYMENT VARIANT — one codebase, several dashboards
// ═══════════════════════════════════════════════════════════════
// Each Vercel project deploys this same repo/branch and sets
// VITE_APP_VARIANT to decide which pages it exposes:
//
//   (unset) | "full"   every page      → hiv.rcghealthprism.app
//   "profile"          map + profiles  → profile.rcghealthprism.app
//
// Adding a variant is a one-line change here plus a new Vercel
// project with the env var set — no branch, no fork, no drift.
// Every fix shipped to this branch reaches every variant.
//
// NOTE: gating is presentational. The JS bundle and dashboard.json
// still contain the data behind hidden pages, so this is a scoping
// tool, not an access-control boundary. If a variant must not ship
// the underlying data at all, that needs a separate build.

const VARIANT = import.meta.env.VITE_APP_VARIANT || "full";

// Page ids are internal keys, not URLs — see App.jsx / Shell.jsx.
const PAGES_BY_VARIANT = {
  full: [
    "executive-summary",
    "map",
    "roi",
    "messages",
    "profile",
    "topline",
  ],
  profile: [
    "map",
    "profile",
  ],
};

// Unknown variant → fail open to the full dashboard rather than
// rendering an empty shell.
const enabledPages = new Set(
  PAGES_BY_VARIANT[VARIANT] || PAGES_BY_VARIANT.full
);

export const APP_VARIANT = VARIANT;

export function hasPage(id) {
  return enabledPages.has(id);
}
