# Phase A Verification — HIV Wiring

This document lets a non-programmer verify that HIV data flows correctly from the workbook (`HIV_Study_Template.xlsx`) into the dashboard. Each section is a side-by-side check.

## (a) Per-segment metrics: workbook vs dashboard

Tier is **read directly from workbook column 50** (`tier`). Tier is no longer derived from ROI; per analyst instruction it is always the configured value. The legacy `getTierNum(roi)` is still exported but marked deprecated and is not called from any component.

| Code | ROI    | Tier (workbook col 50) | HighROI | Supporters | Activation | Influence |
|------|--------|------------------------|---------|------------|------------|-----------|
| TSP  | 1.0236 | T1 | 30% | 32% | 32% | 31% |
| CEC  | 0.8524 | T2 | 16% | 11% | 16% | 12% |
| TC   | 0.7189 | T3 | 7% | 2% | 16% | 21% |
| HF   | 1.0796 | T1 | 27% | 21% | 32% | 46% |
| PP   | 0.7353 | T2 | 9% | 6% | 18% | 19% |
| WE   | 0.6176 | T3 | 9% | 5% | 16% | 24% |
| PFF  | 0.7958 | T2 | 13% | 13% | 21% | 36% |
| HHN  | 1.0430 | T1 | 29% | 23% | 29% | 30% |
| MFL  | 0.8055 | T2 | 14% | 8% | 17% | 21% |
| VS   | 0.7492 | T2 | 12% | 7% | 20% | 25% |
| UCP  | 1.3316 | T1 | 69% | 64% | 34% | 42% |
| FJP  | 1.2991 | T1 | 56% | 57% | 34% | 35% |
| HCP  | 1.1387 | T1 | 35% | 42% | 31% | 26% |
| HAD  | 1.0605 | T2 | 31% | 23% | 31% | 30% |
| HCI  | 1.0669 | T2 | 29% | 34% | 22% | 31% |
| GHI  | 1.0832 | T2 | 48% | 43% | 27% | 29% |

Supporters / activation / influence / highRoi are rounded to integer percentages for display.

## (b) Pre/Post metric labels

The workbook stores the SPSS variable name in the `label` column for each of the 7 pre/post items. The full question text (used in the hover tooltip) and the scale come from adjacent columns.

| # | key | label (SPSS var) | scale | source workbook column |
|---|-----|------------------|-------|-------------------------|
| 1 | `item1` | `QPRE_1r1` | 1--7 | col 17 |
| 2 | `item2` | `QPRE_2` | 1--7 | col 22 |
| 3 | `item3` | `QPRE_3` | 1--7 | col 27 |
| 4 | `item4` | `QPRE_4` | 1--7 | col 32 |
| 5 | `item5` | `QPRE_5` | 1--7 | col 37 |
| 6 | `item6` | `QPRE_6` | 1--7 | col 42 |
| 7 | `item7` | `QPRE_7` | 1--7 | col 47 |

## (c) Messages — themes display as plain text (no color coding)

The 17 HIV messages have no theme assigned in the workbook. MessageMap renders a wave-2 placeholder banner with the message text only — no heatmap, no theme color pattern.

| # | shortName | theme | spss_var |
|---|-----------|-------|----------|
| 1 | THE ONGOING EPIDEMIC | (none) | QHIV_Item1 |
| 2 | PROGRESS PARADOX | (none) | QHIV_Item2 |
| 3 | THE PREVENTABLE DIAGNOSIS | (none) | QHIV_Item3 |
| 4 | COMPASSION | (none) | QHIV_Item4 |
| 5 | VIGILANCE | (none) | QHIV_Item5 |
| 6 | ECONOMIC RETURN | (none) | QHIV_Item6 |
| 7 | SHARED COMMUNITIES | (none) | QHIV_Item7 |
| 8 | WORKFORCE COST | (none) | QHIV_Item8 |
| 9 | BARRIERS | (none) | QHIV_Item9 |
| 10 | THE FINISH LINE | (none) | QHIV_Item10 |
| 11 | INNOVATION SPILLOVER | (none) | QHIV_Item11 |
| 12 | TREATMENT AS PREVENTION | (none) | QHIV_Item12 |
| 13 | SOUTHERN EPIDEMIC | (none) | QHIV_Item13 |
| 14 | GETTING YOUNGER | (none) | QHIV_Item14 |
| 15 | RURAL HEALTH | (none) | QHIV_Item15 |
| 16 | RACIAL DISPARITY | (none) | QHIV_Item16 |
| 17 | ALL OF US AFFECTED | (none) | QHIV_Item17 |

## What renders where

- **SegmentMap (`/`):** 16 bubbles render from the canonical `BUBBLES` array (not touched). Pop weights approximate HIV's distribution.
- **AudienceROI (`/roi`):** Reads `STUDY_METRICS` from `study.js`. Per-segment ROI, **assigned tier**, persuadability, supporters, activation, influence all reflect HIV values. Pre/Post toggle dynamically renders 7 items (was 4 for the previous study), sourced from `PREPOST_METRICS`.
- **SegmentProfile (`/profile`):** "HIV STUDY ROI" card on the left rail shows HIV values per segment with the assigned tier badge.
- **MessageMap (`/messages`):** Wave-2 placeholder banner with 17-message list (theme rendered as plain text when present).

## Auth

Auth gate is **paused** via `BYPASS_AUTH = true` in `src/App.jsx`. Auth code (Supabase session check + Login page + SIGN OUT button) is intact — flip `BYPASS_AUTH` back to `false` to require login again.

## Out-of-scope reminders

- `BUBBLES` in `SegmentMap.jsx` unchanged (canonical).
- `SEGMENTS` array in `SegmentProfile.jsx` unchanged (canonical persona/demo content).
- `convert_study.py` not re-run (its output schema differs from what the dashboard reads).
- SoP tabs were blank in the workbook — confirmed deferred to Wave 2.
- ThemeColors tab blank — confirmed intentional (no theme palette for HIV).
