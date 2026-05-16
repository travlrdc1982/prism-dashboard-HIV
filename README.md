# PRISM HIV Treatment & Prevention Dashboard

Client-facing dashboard for the HIV Treatment & Prevention study (Gilead, May 2026), built on the PRISM 16-segment audience-intelligence frame.

## Stack

React 19 + Vite, deployed to Vercel. Auth via Supabase.

## Data flow

- `src/data/segments.js`, `src/data/ideology.js`, `src/data/vectors.js`, `src/data/trust.js`, `src/data/experiential.js` — canonical PRISM content (does not change across studies).
- `src/data/studyData.js` — canonical 16-segment skeleton consumed by the dashboard pages.
- `src/data/study.js` — study-specific layer (HIV) auto-generated from `HIV_Study_Template.xlsx` in the repo root. Contains `STUDY_META`, `MESSAGES`, `STUDY_METRICS`, `PREPOST_METRICS`, `THEME_COLORS`, `TIER_CONFIG`, helper functions.

## Local development

```bash
npm install
npm run dev
```

## Routes

- `/` — SegmentMap (bubble map)
- `/roi` — AudienceROI scorecard
- `/messages` — MessageMap (wave-2 placeholder until SoP is computed)
- `/profile` — SegmentProfile deep-dive
