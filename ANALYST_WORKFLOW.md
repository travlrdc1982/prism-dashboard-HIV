# Analyst Workflow

How an analyst refreshes the dashboard with new field data — **without touching code**.

## TL;DR

1. Export your SPSS dataset → `data/260433.sav`
2. Edit `study/judgments.xlsx` in Excel (tier, messages, etc.)
3. Run **one command**: `python scripts/refresh.py --commit`
4. Done. Vercel redeploys in ~60 seconds.

---

## One-time setup

Install Python 3.10+ and the data pipeline dependencies:

```bash
# clone the repo (one time)
git clone https://github.com/travlrdc1982/prism-dashboard-HIV
cd prism-dashboard-HIV

# install python deps (one time per machine)
pip install -r requirements.txt
```

You should already have:
- **SPSS** for producing the `.sav` file
- **Excel** for editing `study/judgments.xlsx`
- **Git** (just so the `--commit` step works; you never need to touch git commands directly)

---

## The daily refresh

### Step 1 — Drop your SPSS export here

After your SPSS work, save the file as:

```
data/260433.sav
```

(That folder is git-ignored, so the `.sav` never leaves your machine.)

If your file lives elsewhere, pass `--sav /path/to/file.sav` to the refresh command (Step 3).

### Step 2 — Update the workbook in Excel

Open `study/judgments.xlsx` in Excel. The tabs that drive the dashboard:

| Tab | What it controls |
|---|---|
| **StudyMeta** | Study title, client name, field dates, methodology |
| **SegmentMetrics** | Per-segment **tier** (1/2/3), pop weight (informational) |
| **Messages** | 17 message stimuli (id, theme, text) — what the audience saw |
| **VariantText** | Per-segment variant text (wave 2) |
| **ControlSoP / VariantSoP** | Share-of-preference matrices (wave 2) |
| **ThemeColors** | Color palette for theme tags (optional) |

Save when done.

### Step 3 — Run one command

```bash
python scripts/refresh.py --commit
```

That's it. The script:

1. Runs the topline pipeline against your `.sav` → produces a fresh `dashboard.json`
2. Copies `dashboard.json` into the React app
3. Derives the HIV-tab data (composites, trust, items) from the same `dashboard.json`
4. Reads the workbook → regenerates `study.js` + `studyData.js`
5. `git add` + `git commit` + `git push` — Vercel notices and redeploys

You'll see step-by-step progress like:

```
━━━ 1/4  Topline pipeline (compute_core) ━━━
  Reading data/260433.sav ...
  Loaded 1,044 rows × 287 columns
  ...
━━━ 2/4  Copy dashboard.json → src/data/topline/ ━━━
  ✓ src/data/topline/dashboard.json
━━━ 3/4  HIV-tab data (derive_hiv_seg_data) ━━━
  Derived HIV-tab data from dashboard.json:
    seg_data.json: 16 segments
    bench.json: All/Republicans/Democrats
    items.json: scf=7 stigma=6 know=10 contact=2
    zparams.json: 8 composites
    trust.json: REGENERATED from dashboard.json (22 messengers)
━━━ 4/4  Workbook → study.js / studyData.js (extract_hiv) ━━━
  ...
═══ Refresh complete ═══
  ✓ pushed — Vercel will redeploy
```

Open `hiv.rcghealthprism.app` ~60 seconds later to see the new data.

---

## Variants

| Command | What it does |
|---|---|
| `python scripts/refresh.py` | Refresh data, but don't auto-commit. (You can review the diff first, then `git push` from your editor.) |
| `python scripts/refresh.py --commit` | Refresh + auto-commit + push. |
| `python scripts/refresh.py --skip-pipeline` | Skip the slow `.sav` step. Use after you edited only the workbook (analyst overrides like tier) — re-runs steps 3 & 4 only. |
| `python scripts/refresh.py --sav /elsewhere.sav` | Use a `.sav` outside the default `data/` folder. |

---

## What if something breaks?

The script stops at the first error with a clear message. The most likely cases:

- **".sav not found"** — drop it in `data/260433.sav` or pass `--sav`.
- **"Workbook not found"** — make sure `study/judgments.xlsx` is in the repo root (it should be by default).
- **"Module not found: pyreadstat" (etc.)** — re-run `pip install -r requirements.txt`.
- **Anything else** — copy the error and ping the engineering side. The data scripts are designed so a partial failure doesn't corrupt anything; the previous `dashboard.json` stays intact until the new one writes successfully.

---

## What you never touch

The whole `src/` folder (React app, components, CSS). Code changes happen in PRs from the engineering side; your refresh only updates the data files that the React app reads.
