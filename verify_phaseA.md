# Phase A Verification — HIV Wiring

This document lets a non-programmer verify that HIV data flows correctly from the workbook (`HIV_Study_Template.xlsx`) into the dashboard. Each section is a side-by-side check.

## (a) Per-segment metrics: workbook vs generated `study.js`

\* Tier is computed from ROI via `getTierNum(roi)` thresholds: `roi >= 1.07 → 1, roi >= 1.00 → 2, else 3`. The workbook does not provide a `tier` column; derived tier shown here.

| Code | Workbook ROI | Generated ROI | Workbook tier* | Generated tier* | Supporters (wb→gen) | Activation | Influence |
|------|--------------|---------------|----------------|-----------------|----------------------|------------|-----------|
| TSP  | 1.0236 | 1.0236 | T2 | T2 | 32.3% → 32% | 32.0% → 32% | 31.0% → 31% |
| CEC  | 0.8524 | 0.8524 | T3 | T3 | 11.0% → 11% | 16.0% → 16% | 12.0% → 12% |
| TC   | 0.7189 | 0.7189 | T3 | T3 | 2.2% → 2% | 16.0% → 16% | 21.0% → 21% |
| HF   | 1.0796 | 1.0796 | T1 | T1 | 20.9% → 21% | 32.0% → 32% | 46.0% → 46% |
| PP   | 0.7353 | 0.7353 | T3 | T3 | 6.5% → 6% | 18.0% → 18% | 19.0% → 19% |
| WE   | 0.6176 | 0.6176 | T3 | T3 | 5.3% → 5% | 16.0% → 16% | 24.0% → 24% |
| PFF  | 0.7958 | 0.7958 | T3 | T3 | 12.9% → 13% | 21.0% → 21% | 36.0% → 36% |
| HHN  | 1.0430 | 1.0430 | T2 | T2 | 23.4% → 23% | 29.0% → 29% | 30.0% → 30% |
| MFL  | 0.8055 | 0.8055 | T3 | T3 | 7.6% → 8% | 17.0% → 17% | 21.0% → 21% |
| VS   | 0.7492 | 0.7492 | T3 | T3 | 6.7% → 7% | 20.0% → 20% | 25.0% → 25% |
| UCP  | 1.3316 | 1.3316 | T1 | T1 | 64.5% → 64% | 34.0% → 34% | 42.0% → 42% |
| FJP  | 1.2991 | 1.2991 | T1 | T1 | 57.0% → 57% | 34.0% → 34% | 35.0% → 35% |
| HCP  | 1.1387 | 1.1387 | T1 | T1 | 42.1% → 42% | 31.0% → 31% | 26.0% → 26% |
| HAD  | 1.0605 | 1.0605 | T2 | T2 | 23.0% → 23% | 31.0% → 31% | 30.0% → 30% |
| HCI  | 1.0669 | 1.0669 | T2 | T2 | 34.3% → 34% | 22.0% → 22% | 31.0% → 31% |
| GHI  | 1.0832 | 1.0832 | T1 | T1 | 42.8% → 43% | 27.0% → 27% | 29.0% → 29% |

**Note:** Supporters / activation / influence / high-ROI are rounded to integer percentages for display (matches existing dashboard convention).

## (b) Pre/Post metric labels

The workbook stores the SPSS variable name in the `label` column for each of the 7 pre/post items. The full question text (used in the hover tooltip) and the scale come from adjacent columns. Display labels match what the workbook provides — if cleaner display labels are desired, update the workbook's label column.

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

The 17 HIV messages have **no theme assigned** in the workbook (the `theme` column is empty). MessageMap renders the wave-2 placeholder banner with message text only. No heatmap, no theme color pattern.

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

- **SegmentMap (`/`):** 16 bubbles render from canonical `BUBBLES` array (unchanged). Pop weights are the canonical PRISM weights — they approximate HIV weights closely (e.g. WE ≈ 9%, UCP ≈ 11%) but exact HIV fractions live in the workbook.
- **AudienceROI (`/roi`):** Reads from `study.js` `STUDY_METRICS`. Each segment shows HIV-specific ROI / tier / persuadability / supporters / activation / influence. Pre/Post toggle dynamically shows 7 items (was 4 for the previous study), sourced from `PREPOST_METRICS` in `study.js`.
- **SegmentProfile (`/profile`):** HIV STUDY ROI card on the left rail shows the HIV values per segment (was "AL STUDY ROI"). PREPOST internal data is updated to 7 items.
- **MessageMap (`/messages`):** Wave-2 placeholder banner: "Message testing results available in Wave 2. Messages and stimulus text shown below for reference." Below the banner, the 17 messages display as a simple list. Theme tag is rendered as plain text only when present.

## Spot checks called out in the brief

The verification call in §A.6 says: *"ROI card shows HIV values (roi 1.024, tier 1, highRoi 30%, supporters 32%, activation 32%, influence 31%)"* for TSP.

- TSP ROI: **1.0236** → displays as **1.02** ✓
- TSP highRoi: **30%** ✓
- TSP supporters: **32%** ✓
- TSP activation: **32%** ✓
- TSP influence: **31%** ✓
- TSP tier: computed as **T2** with current `getTierNum` thresholds (the brief says "tier 1" but with thresholds >=1.07 → T1, TSP's 1.0236 falls into T2; flag for Bryan to confirm thresholds).

## Out-of-scope reminders

- `BUBBLES` in `SegmentMap.jsx` not modified (canonical).
- `SEGMENTS` array in `SegmentProfile.jsx` not modified (canonical persona/demo content).
- `convert_study.py` not re-run (its output schema differs from what the dashboard reads).
- HIV ControlSoP / VariantSoP / SigFlags tabs were blank in the workbook — confirmed deferred to Wave 2.
- HIV ThemeColors tab blank — confirmed intentional (no theme palette for HIV).
