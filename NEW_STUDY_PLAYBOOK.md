# PRISM Dashboard — New Study Playbook

How to spin up a new client dashboard from this template. Aimed at the engineer doing the first-time setup; the recurring-refresh story for analysts is in [`ANALYST_WORKFLOW.md`](./ANALYST_WORKFLOW.md).

---

## Architecture model

The codebase has three concentric layers. Be honest about which layer your change belongs in.

### Layer 1 — Scaffold (never touched per study)

Reused as-is for every study. Live under `src/` outside of the study folders.

- **PRISM 16-segment frame** — `src/data/segments.js`, `ideology.js`, `vectors.js`, `trust.js`, `experiential.js`, `theme.js`. Canonical content.
- **Cross-study pages** — `src/pages/SegmentMap.jsx`, `AudienceROI.jsx`, `MessageMap.jsx`, `SegmentProfile.jsx` (shell + tab strip).
- **Topline framework** — `src/components/Topline/Topline.jsx`, components, primitives, CSS scoping script.
- **Data pipeline plumbing** — the way `.sav` → `dashboard.json` → derive → React. Mechanical.

If you find yourself editing a scaffold file for study-specific reasons, **stop** — that's a sign the value belongs in study config, not the scaffold.

### Layer 2 — Study config (light engineering + analyst edits)

Per-study text, item lists, module definitions, weighting. Six files; mostly mechanical.

| File | Owner | What goes here |
|---|---|---|
| `{STUDY}_Study_Template.xlsx` | Analyst | Tier, message stimuli, study metadata, theme colors |
| `pipeline/topline/compute_core.py` | Engineering | `STUDY` dict (titles), `MODULES` array, item definitions, `TRUST_LBL`, composite formulas |
| `pipeline/topline/compute.py` | Engineering | Default `.sav` filename + weight var |
| `pipeline/extract_study.py` → `pipeline/extract_study.py` | Engineering | Workbook filename + study-specific labels |
| `scripts/refresh.py` | Engineering | `DEFAULT_WORKBOOK` filename |
| `package.json`, `index.html`, `README.md` | Engineering | Project name, study title |

### Layer 3 — Custom-built per project (scoped engagement)

Bespoke visualizations specific to one study's constructs. The HIV tab (`HIVTab.jsx`) is the example — four custom tiles, scatter, trust list — designed around HIV stigma constructs (MBS/SDS/SCF/HKS) that don't generalize to another disease area.

**Future studies do NOT inherit the HIV tab.** Each project decides whether to build its own custom deep-dive, what it should look like, and what it costs. Treat this layer as a separately scoped engagement, not part of the dashboard template.

---

## New-study setup, step by step

Target: a working production dashboard at `{study}.rcghealthprism.app` running against the new study's `.sav` and workbook.

### Step 0 — Decide first

- **Study name** (e.g., `obesity`, `diabetes`, `medicare-2026`)
- **Custom persona tab needed?** (default: no — analysts work in the topline + segment profile)
- **Domain** (`{study}.rcghealthprism.app` or something else)

### Step 1 — Fork the template

```bash
# Create the new repo on GitHub (private), then:
git clone https://github.com/travlrdc1982/prism-dashboard-HIV prism-dashboard-{STUDY}
cd prism-dashboard-{STUDY}
git remote set-url origin https://github.com/travlrdc1982/prism-dashboard-{STUDY}
git push -u origin main
```

### Step 2 — Rename branding

```bash
# package.json
"name": "prism-{STUDY}-dashboard"

# index.html
<title>PRISM {Study Title}</title>

# README.md — replace HIV references with the study name
```

Login screen and Shell badge already read from `STUDY_META.name`, so they update automatically once you edit `STUDY` in `compute_core.py` (next step).

### Step 3 — Update the topline pipeline config

Open `pipeline/topline/compute_core.py`. Edit in place:

**a. `STUDY` dict** (top of file):
```python
STUDY = {
    'id': 'PRISM_{STUDY}_2026',
    'title': 'PRISM {Study Title}',
    'subtitle': 'PRISM Voter Study — RCG / {Vendor}',
    'field_dates': '{TBD}',
    'analyst': '{Name}',
    # ... etc
}
```

**b. `MODULES` array** — module titles + section intros. Update the 8 entries (most still apply; rewrite copy for the new domain).

**c. Item definitions** — `ITEMS`, `PRE_POST`, `BATTERIES`, `STIGMA_EXTRAS`, `DEMOGRAPHICS`, `INFLUENCER`. These reference SPSS variable names in the new `.sav` (e.g., `QSTIGMA*` instead of `QHIVSTIGMA*`). The pipeline auto-detects which variables exist and skips missing batteries.

**d. `TRUST_LBL`** — relevant messengers for this study's domain.

**e. Composite definitions** — if the study has its own composites (MBS/SDS/SCF are HIV-specific), define them in the same pattern.

### Step 4 — Rename the data extractor

```bash
```

Then edit `extract_study.py`:
- Change `WORKBOOK = "study/judgments.xlsx"` → `"{STUDY}_Study_Template.xlsx"`
- Update study-specific labels in comments and prints

Update `scripts/refresh.py`:
- `DEFAULT_WORKBOOK = str(REPO / '{STUDY}_Study_Template.xlsx')`
- `subprocess.run(['python', 'extract_study.py'], ...)`

### Step 5 — Set up the new workbook

Copy `study/judgments.xlsx` to `{STUDY}_Study_Template.xlsx`. The tab structure is the same — only the cell contents change:

- **StudyMeta** — title, client, field dates
- **SegmentMetrics** — tier assignments (analyst will fill these)
- **Messages** — N message stimuli (id, theme, text)
- **VariantText, ControlSoP, VariantSoP** — wave-2 (analyst fills when data lands)
- **ThemeColors** — optional palette

Add or remove `prepost_keyN_*` column groups in SegmentMetrics as needed — `extract_study.py` auto-detects K.

### Step 6 — Drop the HIV tab (unless building a new one)

If the new study isn't getting a custom persona tab:

```bash
git rm src/pages/HIVTab.jsx src/pages/HIVTab.css
git rm -r src/data/hiv/
```

Then in `src/pages/SegmentProfile.jsx`:
- Remove the import: `import HIVTab from "./HIVTab";`
- Remove the `{ id:"hiv", label:"HIV" }` entry from `PROFILE_TABS`
- Remove the `{profileTab === "hiv" && <HIVTab ... />}` line

In `scripts/refresh.py`:
- Remove the `derive_hiv_seg_data.py` call (step 3 of 4 in the orchestrator)

The dashboard now ships with the cross-study scaffold only. If a custom tab is in scope, build it under `src/studies/{study}/` and add it to the `PROFILE_TABS` import.

### Step 7 — Install + first refresh

```bash
pip install -r requirements.txt
npm install

# Drop the first .sav at data/{study}.sav (gitignored)
python scripts/refresh.py --sav data/{study}.sav
```

Should output step-by-step progress and end with `═══ Refresh complete ═══`. If anything fails, the error tells you which file or variable.

```bash
npm run dev   # smoke-test locally at http://localhost:5173/
```

Verify the dashboard renders with the new data before deploying.

### Step 8 — Vercel deployment

1. Go to vercel.com → Add New → Project → import the new repo.
2. Build settings: framework `Vite`, build command `npm run build`, output `dist`.
3. Add environment variables if using Supabase auth:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. First build takes ~2 minutes.

### Step 9 — Custom domain

1. Vercel → Project Settings → Domains → Add `{study}.rcghealthprism.app`.
2. On the `rcghealthprism.app` DNS provider, add a CNAME: `{study}` → `cname.vercel-dns.com`.
3. Wait for SSL provisioning (~5-15 minutes).

### Step 10 — Auth (if not bypassed)

Auth is configured entirely by environment variables — no code edits.

**A. To bypass login (early review):** in Vercel project env vars set
```
VITE_BYPASS_AUTH=true
```
Redeploy. The dashboard renders directly without a session.

**B. To enable login (production):** unset `VITE_BYPASS_AUTH` (or set
`false`) and provision a Supabase project.

#### B.1 Create the Supabase project
1. supabase.com → New Project. Choose a region; copy the URL + anon key.
2. Authentication → Email Templates → Invite expiry → bump to **604800**
   (7 days), so invite links the analyst hands out don't expire fast.
3. Vercel project env vars:
   ```
   VITE_SUPABASE_URL=https://<your-project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your anon key>
   ```
   (NO fallback — if either is missing the dashboard refuses to boot.)

#### B.2 Deploy the generate-invite edge function
The /admin page calls a Supabase Edge Function that mints signed invite
URLs without using Supabase's email delivery. Each new project needs
its own deploy of this function.

```bash
# In the dashboard repo root:
supabase login
supabase link --project-ref <your-project-ref>
supabase functions deploy generate-invite
```

Then set the function's env vars (these are read at runtime by the
function — they are NOT in source code):

```bash
supabase secrets set \
  ADMIN_EMAILS="bdumont@reservoircg.com,jholdsworth@reservoircg.com,vudani@reservoircg.com" \
  REDIRECT_DEFAULT="https://<study>.rcghealthprism.app"
```

`ADMIN_EMAILS` is the authoritative server-side allowlist for who can
generate invites. `REDIRECT_DEFAULT` is the per-deployment fallback the
function uses when the caller's Origin header is missing.

The client-side allowlist in `src/data/admins.js` controls who sees the
`/admin` link in the nav. Keep it in sync with `ADMIN_EMAILS` above.

#### B.3 Onboard users
- Sign in as an admin to the new dashboard.
- Visit `/admin`, enter the client's email, copy the generated URL.
- Send it to them through your own channel (signed email, Slack, etc.).
- They click the link → set their password → land on the dashboard.

### Step 11 — Handoff to the analyst

Give them:
- The repo URL
- The Vercel project URL
- `ANALYST_WORKFLOW.md` (already in the repo)
- The new workbook filename (so they know what to drop their .sav and Excel as)

After this, the daily refresh is one command they run from their laptop. Engineering doesn't get pulled in until the next wave's `.sav` arrives with a structural change.

---

## What can go wrong (and how to recognize it)

| Symptom | Likely cause |
|---|---|
| `refresh.py` says "variable X not in dataframe" | The new `.sav` is missing a SPSS variable that `compute_core.py` references — comment out the offending item in `ITEMS`/`BATTERIES`/`STIGMA_EXTRAS`. |
| Login screen still says "HIV STUDY" | `STUDY_META.name` isn't reaching the Login. Check that you re-ran `python extract_study.py` after editing the workbook (the workbook is the source of `STUDY_META`). |
| ROI tier badges show wrong colors | Workbook's `tier` column wasn't read. Confirm the header is `tier` (case-insensitive, whitespace-tolerant in `extract_study.py`). |
| Topline shows empty modules | Pipeline ran but a module's items don't exist in the `.sav` — check the pipeline log for warnings; usually safe to disable the module via `'active': False` in `MODULES`. |
| HIV tab references break the build | You removed the data files but forgot the imports in `SegmentProfile.jsx`. |

---

## What stays HIV-specific (do not generalize)

These exist in this repo because this IS the HIV deploy. They should NOT be copied verbatim to the next study:

- `src/pages/HIVTab.jsx`, `src/pages/HIVTab.css`, `src/data/hiv/*.json` — designed around HIV stigma constructs
- `compute_core.py`'s HIV-specific `MBS / SDS / EDS / SCS / CFS / PFS / SCF / HKS` composite definitions
- `TRUST_LBL` — HIV-relevant messengers
- The "01 HIV Stigma" umbrella module structure

If a future study wants something similar, scope it as a separate custom deliverable — don't try to abstract the HIV tab into a "generic persona tab." Premature abstraction across one example produces a tab that fits neither the second study nor (cleanly) the first.

---

## Maintenance — when the scaffold itself changes

If a fix or feature applies to the scaffold (e.g., a bug in `SegmentMap.jsx`, a new cross-study primitive in the topline), the change should propagate to every deployed study. Two options:

1. **Repo-per-study** (current pattern): apply the patch to each repo's `main` separately. Use `git cherry-pick` from one to another.
2. **Monorepo + per-study branches** (future option): all studies branches off a `template/main` that gets fixes. Heavier setup, easier propagation.

For 1-3 studies, option 1 is fine. Beyond that, consider option 2.

---

## Quick reference

```bash
# First-time engineering setup for new study
git clone <template-repo> prism-dashboard-{study}
# ... edit per Step 2-6 above
pip install -r requirements.txt && npm install
python scripts/refresh.py --sav data/{study}.sav
npm run dev   # smoke test
# Push, connect to Vercel, configure domain.

# Recurring analyst workflow
python scripts/refresh.py --commit
```

That's the production playbook. Keep it updated as the scaffold evolves.
