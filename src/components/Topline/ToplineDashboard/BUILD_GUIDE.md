# PRISM HIV Topline — Build Guide & Project State

**As of 2026-05-15 · v1.0 production data**

This document captures the current state of the PRISM HIV topline dashboard so you can continue the project in a new chat or hand it to someone else. It supersedes any earlier build notes.

---

## 1. What this project produces

A single self-contained HTML deliverable, `PRISM_HIV_Topline.html` (~620KB), that renders the topline analytics for the PRISM HIV Treatment & Prevention study. Eight modules total (six active, two disabled until V2):

| # | Module | Status | What it contains |
|---|---|---|---|
| 01 | HIV Stigma | active | 13 stigma items + 8 MFQ items (Critics-style) · 11 Knowledge items (demographics-style) · 8 composites (Influencer-style) |
| 02 | Pre-Post Outcome Metrics | active | 7 items × PRE/POST/Δ × 17 cuts |
| 03 | ROI Scorecard | active | 16-segment ROI infographic (SVG) |
| 04 | Critics Messages | active | 11 counter-argument items (Critics-style) |
| 05 | Message Testing | disabled | MaxDiff B-W utilities (V2) |
| 06 | Trusted Sources | disabled | 23 sources × split-sample blocked (V2) |
| 07 | Demographics | active | 11 demographic blocks including Personal Contact (4-row binary) |
| 08 | Influencer360 | active | 5 blocks (composites · high-engagement · low-engagement · followers · social-media activity) |

Plus a **title page** (first section) with three panes: survey intro · study metadata + LOI · sample composition table.

---

## 2. Files you need

### Working set (required to rebuild)

| File | Role |
|---|---|
| `compute_core.py` | All registries (STUDY, MODULES, ITEMS, BATTERIES, DEMOGRAPHICS, INFLUENCER_BLOCKS, SEGMENTS) and the `build_topline(df, weight_var=...)` function. ~2,000 lines. This is the brain. |
| `compute.py` | CLI entry. Reads the .sav, sets `WEIGHT_VAR = 'WGT'`, calls `build_topline()`. |
| `build.py` | Trivial wrapper that runs `compute.py`. |
| `dashboard_template.html` | The renderer. Contains CSS, JS, and the `__DATA_PLACEHOLDER__` token. ~110KB. Everything visual lives here. |
| `260433.sav` | Production dataset, n=1,044, rake-weighted (WGT). May 1-15, 2026 fieldwork. |

### Generated artifacts (rebuilt on every run)

| File | Purpose |
|---|---|
| `dashboard.json` | Computed snapshot of every module's data. Injected into the template. |
| `dashboard.html` (or `PRISM_HIV_Topline.html`) | The final deliverable. |
| `results_long.csv` | Long-format audit trail. 2,414 rows across 6 sources: items, pre_post, demos, influencer, knowledge, composites. Every cell visible on the page has a row here. |

### ROI artifact (separate deliverable)

| File | Purpose |
|---|---|
| `roi_infographic.py` | SVG builder for the standalone ROI infographic (3000×1650 PNG export). |
| `roi_infographic.svg`, `roi_infographic.png` | Outputs. |
| `render_roi_png.js` | Playwright PNG exporter. |

---

## 3. How to rebuild

```bash
# 1. Place files in a directory
mkdir hiv_dashboard && cd hiv_dashboard
# Drop in: compute_core.py, compute.py, build.py, dashboard_template.html

# 2. Place the SPSS file
mkdir data
# Drop in: 260433.sav

# 3. Update the data path at the top of compute.py if needed:
#    SAV_PATH = 'data/260433.sav'

# 4. Run
python3 build.py
```

Build output should report:
```
Loaded 1,044 rows × 821 columns
Computed Demographics: 11 questions
Computed Influencer360: 5 blocks, 30 total rows
Computed HIV Stigma extras: Knowledge 11 items, Composites 8 items
Computed ROI module: 16 segments, SVG ~55,500 chars
Wrote results_long.csv: ~2,414 rows · items=544 pre_post=238 demos=799 influencer=510 knowledge=187 composites=136
Wrote dashboard.json
Wrote dashboard.html
Total n: 1044, segments populated: 16
Build complete.
```

Open `dashboard.html` in a browser. Everything is self-contained — no external dependencies, no API calls.

---

## 4. Architectural concepts you must know

### "Brochure rails" layout principle

Every module uses the same three-pane block geometry: **survey pane (240px) · codebook pane (240px) · banner pane (variable-width)**. Looking down the page, all three rails line up vertically across every module. Inside the banner rail, every segment column (TOTAL · TSP · CEC · ... · GHI = 18 columns) appears at the same x-coordinate in every block. Row labels on the left wrap to multiple lines and are right-justified.

CSS rule that enforces this: `.banner-table td.rlbl { text-align: right; white-space: normal; max-width: 420px; }` combined with `.banner-table td.cell { width: 46px }`. Don't break this — it's load-bearing.

### Module rendering pipeline

Each module declares an `item_type` in `MODULES`:
- `items` → Critics-style, one-block-per-item from the ITEMS registry filtered by `battery` field
- `pre_post` → Pre/Post structure with PRE and POST waves stacked
- `demographics` → Loops `DEMOGRAPHICS` registry, dispatches to either standard frequency block or `binary_set` block (Personal Contact)
- `influencer` → Loops `INFLUENCER_BLOCKS` (5 blocks: composites, high-engagement, low-engagement, followers, social-media)
- `roi` → Renders pre-computed SVG infographic
- HIV Stigma's `items` branch also appends `stigma_extras.knowledge` (Knowledge battery) and `stigma_extras.composites` (8 composites) at the end of the section

### Significance testing

Every cell that's a proportion uses **z-test of proportion vs. rest of sample**. Every cell that's a mean (BCS, all 8 stigma composites) uses **Welch's t-test vs. rest of sample**. Two-tier markers: `•` = p<.05, `••` = p<.01. Markers display in the cell corner; full stat and p-value in the popover.

### Title page

First section after the chip nav. Three panes:
- Left: survey introduction prose
- Middle: study_id, total_n, field_dates (computed from SPSS `date` variable), version, analyst, rendered, weighted_by, **avg LOI** (computed from `qtime`, trimmed median in minutes)
- Right: sample composition table (16 segments × n/n_wgt/%/%_wgt with GOP/DEM bands)

### Weighting

`WEIGHT_VAR = 'WGT'` in `compute.py`. WGT contains production rake weights (range 0.202-6.049, mean 1.0). Every cell stores both unweighted (`pct`, `n`) and weighted (`pct_wgt`, `n_wgt`) values. The Demographics module has a Weighted/Unweighted toggle that swaps which value is displayed in cells; the popover shows the other.

### Split-sample batteries

HIV Stigma (n=833), MFQ (n=829), HIV Knowledge (n=820), and the composites derived from them are on a **designed split sample** (LOI-reduction allocation): ~80% of the 1,044 total respondents received those items. The codebook FILTER row notes this. The `_n_total` in each cell reflects the valid n for that variable, not the full sample N. Critics, Pre/Post, Demographics, and Influencer360 are on the full sample.

---

## 5. Recent design decisions (latest first)

These reflect the most recent state and override anything older.

1. **Right-justified row labels with wrapping.** `.rlbl` cells wrap text up to 420px max-width and right-justify. Long labels (Knowledge items, full Critics arguments) wrap to 2-3 lines; banner segment columns stay anchored at fixed x.

2. **Survey panes do not contain methodological notes.** Split-sample / LOI-reduction notes live in codebook FILTER row only, not in survey panes. Survey panes show only the prose the respondent saw.

3. **Module ordering and renumbering (locked):** 01 HIV Stigma · 02 Pre-Post Outcome Metrics · 03 ROI Scorecard · 04 Critics Messages · 05 Message Testing (disabled) · 06 Trusted Sources (disabled) · 07 Demographics · 08 Influencer360.

4. **HIV Stigma is one umbrella module with four sub-batteries:** 13 stigma items + 8 MFQ items + 11 Knowledge items + 8 composites. Renamed from "Moral Blame Score" because the umbrella measures more than blame.

5. **Composites computed in-pipeline from raw items, not from derived SPSS variables.** This makes the build robust to whether XMBS/XSDS/etc. exist in the .sav. Eight composites: MBS, SDS, EDS, SCS (stigma family), CFS, PFS (Moral Foundations), SCF = PFS−CFS (differential), HKS (knowledge sum excluding K5).

6. **K5 (false statement) flagged visually.** The Knowledge item "epidemic is effectively over" is the trap item; flagged with `FALSE` badge in survey pane and tinted pink in banner. Excluded from HKS scoring.

7. **Personal Contact (QCON_LGBr1-r4) added to Demographics as single 4-row binary_set block.** r1 (LGB) and r2 (HIV+) are substantive; r3 (cancer) and r4 (addiction) are CTRL controls.

8. **5-level RUCA collapse:** Urban (1), Suburban (2-3), Exurban (4-6), Small Town Rural (7-9), Rural (10).

9. **Influencer360 restructured to 5 demographics-style blocks:** composites · high-engagement behaviors (14 items) · low-engagement actions (3 items) · followers (categorical) · social-media activity (3 frequency items). QSM2r1-r3 excluded from topline (only feeds BCS composite).

10. **PRISM canonical 16-segment order** (matches questionnaire and SPSS XSEG_ASSIGNED):
    - GOP 1-10: TSP, CEC, TC, HF, PP, WE, PFF, HHN, MFL, VS
    - DEM 11-16: UCP, FJP, HCP, HAD, HCI, GHI

---

## 6. Known pending / on the horizon

1. **Validity flags review** — title page advisory mentions "validity flags pending review." If/when a quality flag exists in the data (probably `XVALID` or similar), update CONFIG to filter.

2. **MaxDiff B-W (Module 05 "Message Testing")** — disabled. When HB utilities are available, activate the module and render tabular utilities.

3. **Trusted Sources (Module 06)** — disabled. 23 sources × split-sample blocked k=9 design.

4. **MFQ field added the Liberty, Loyalty, Authority items but they have no composites yet** — currently only CFS (Care r1-r2), PFS (Purity r3-r4), and SCF (PFS−CFS) are computed. If you want a full 6-foundation composite framework, items r5 (Fairness), r6 (Liberty), r7 (Loyalty), r8 (Authority) are sitting unused for composite purposes.

5. **PDF export** — the "PDF" button in the top nav currently calls `window.print()`. There's no dedicated PDF renderer.

---

## 7. To pick this up in a new chat

Drop these files into the new chat:

**Minimum to keep building:**
1. `compute_core.py`
2. `dashboard_template.html`
3. `compute.py`
4. `build.py`
5. `260433.sav` (or whatever the current data file is)
6. This `BUILD_GUIDE.md`

**Nice to have:**
- The latest `PRISM_HIV_Topline.html` for visual reference
- `dashboard.json` for inspecting current values without rebuilding
- `results_long.csv` if doing data audits

**One-line orientation for the new chat:**
> "I'm continuing the PRISM HIV topline dashboard build. Read BUILD_GUIDE.md for state. The working set is compute_core.py + dashboard_template.html + compute.py + build.py + the .sav. Last touched: [date]. Next thing I want to do: [task]."

That's enough context for any session to pick up cleanly.

---

## 8. Bryan's operating preferences (carry forward)

- Statistician background, not a programmer. Treat code as configuration not engineering.
- No em dashes; use parens / colons / semicolons / commas. (Exception: "—" as zero-change indicator in delta cells.)
- Terse responses, minimal formatting, no marketing register.
- Push back on errors directly; honest acknowledgment over rationalization.
- PRISM client work uses single-column HTML tables for spreadsheet copy.
- Competitive/sales materials use evidence-led understated register (DC policy audience), not marketing language.
