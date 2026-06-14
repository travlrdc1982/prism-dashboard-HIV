# PRISM Platform Wizard — Architecture Design

**Status:** Design doc. Not yet implemented.
**Audience:** Future Bryan, future engineer picking this up.
**Built on:** The auth scaffolding from commit `c1802b1` (env-driven Supabase config).

---

## 1. What problem this solves

Today, spinning up a new PRISM study takes ~2 hours of clicking through GitHub,
Vercel, Supabase, DNS, and editing config files. As Reservoir adds more studies,
this:
- Doesn't scale to multiple-studies-per-week
- Requires Bryan (only person who's done the full setup) to be in the loop
- Leaves no audit trail of "who set up what when"
- Is error-prone (each step is a chance to forget an env var)

The wizard replaces phases 1, 4, and 5 of the setup playbook (clone code, deploy
Vercel, stand up auth) with a single web form. Phases 2 (configure study.yaml)
and 3 (run pipeline) still need a human + the .sav file.

---

## 2. Overall architecture

```
                                  ┌─────────────────────────────────┐
                                  │  admin.rcghealthprism.app       │
                                  │  (separate Vercel project)      │
                                  │                                 │
                                  │  - Auth: prism-platform-admin   │
                                  │    Supabase project             │
                                  │  - Pages: Users / Studies /     │
                                  │    Audit / Settings             │
                                  │  - Wizard tab → POSTs to        │
                                  │    create-study edge function   │
                                  └────────────┬────────────────────┘
                                               │
                                               │ POST /functions/v1/create-study
                                               │ Authorization: Bearer <staff JWT>
                                               │
                                               ▼
                       ┌──────────────────────────────────────────────────────┐
                       │  prism-platform-admin Supabase project               │
                       │                                                      │
                       │  Tables:                                             │
                       │    studies         - registry of all PRISM studies   │
                       │    audit_log       - every wizard action             │
                       │                                                      │
                       │  Edge functions:                                     │
                       │    create-study    ← runs the orchestration          │
                       │    refresh-study   ← triggers GH Action for refresh  │
                       │    onboard-user    ← invites user to one or many     │
                       │                      studies in one shot             │
                       │                                                      │
                       │  Secrets (env vars on the functions):                │
                       │    GITHUB_PAT          - repo:create + workflow:write│
                       │    VERCEL_TOKEN        - account-scoped              │
                       │    SUPABASE_MGMT_TOKEN - org-scoped                  │
                       │    DNS_PROVIDER_API    - if DNS automation enabled   │
                       └───────────┬──────────────────────────────────────────┘
                                   │
                                   │ parallel fan-out
                                   │
                ┌──────────────────┼──────────────────┐
                │                  │                  │
                ▼                  ▼                  ▼
       ┌─────────────────┐ ┌──────────────┐  ┌────────────────────┐
       │  GitHub API     │ │  Vercel API  │  │  Supabase Mgmt API │
       │                 │ │              │  │                    │
       │  - Create repo  │ │  - Create    │  │  - Create project  │
       │    from         │ │    project   │  │  - Set auth config │
       │    template     │ │  - Link repo │  │  - Deploy func     │
       │  - Set env vars │ │  - Add       │  │  - Set secrets     │
       │  - Add team     │ │    domain    │  │  - Get URL + anon  │
       │  - Trigger      │ │  - Set env   │  │    key             │
       │    workflow     │ │    vars      │  │                    │
       └─────────────────┘ └──────────────┘  └────────────────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  New study      │
                          │  fully deployed │
                          │  at slug.rcg... │
                          └─────────────────┘
```

---

## 3. File structure (new admin portal repo)

The portal is a SEPARATE repo from any individual dashboard:

```
prism-admin-portal/
├── src/
│   ├── App.jsx                          ← router + auth gate
│   ├── supabaseClient.js                ← points at prism-platform-admin
│   ├── pages/
│   │   ├── Login.jsx                    ← same pattern as dashboard
│   │   ├── Users.jsx                    ← invite + manage users
│   │   ├── Studies.jsx                  ← list + create studies
│   │   ├── StudyDetail.jsx              ← per-study config editor (later phase)
│   │   ├── Audit.jsx                    ← scrollable log
│   │   └── wizard/
│   │       ├── NewStudyWizard.jsx       ← the main form
│   │       ├── steps/
│   │       │   ├── Identity.jsx         ← slug, title, sponsor, analyst
│   │       │   ├── Instrument.jsx       ← template selection
│   │       │   ├── Auth.jsx             ← admin emails, domain
│   │       │   └── Confirm.jsx          ← preview + create
│   │       └── ProgressView.jsx         ← live status during creation
│   ├── components/
│   │   ├── Shell.jsx                    ← nav (Users / Studies / Audit)
│   │   └── PageHeader.jsx               ← shared brand strip
│   └── data/theme.js                    ← Inter, MONO (same as dashboard)
├── supabase/
│   ├── functions/
│   │   ├── create-study/index.ts        ← orchestration
│   │   ├── refresh-study/index.ts       ← trigger GH Action
│   │   ├── onboard-user/index.ts        ← invite to N studies at once
│   │   └── revoke-user/index.ts         ← pull access from N studies
│   └── migrations/
│       ├── 001_studies.sql
│       └── 002_audit_log.sql
├── package.json
└── README.md
```

---

## 4. Database schema

In the `prism-platform-admin` Supabase project (not in any individual study):

```sql
-- studies: registry of every PRISM dashboard
CREATE TABLE studies (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text UNIQUE NOT NULL,           -- e.g. "hiv", "ahip"
  title             text NOT NULL,                  -- e.g. "PRISM HIV Wave 1"
  sponsor           text,                            -- e.g. "Gilead"
  analyst           text,                            -- e.g. "Jen Holdsworth"
  github_repo       text NOT NULL,                  -- "travlrdc1982/prism-dashboard-hiv"
  vercel_project_id text NOT NULL,
  supabase_ref      text NOT NULL,                  -- project-ref of study's auth project
  dashboard_url     text NOT NULL,                  -- "https://hiv.rcghealthprism.app"
  status            text NOT NULL DEFAULT 'active', -- active / archived / failed
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid NOT NULL REFERENCES auth.users(id),
  retired_at        timestamptz,
  metadata          jsonb NOT NULL DEFAULT '{}'     -- room for future fields
);

CREATE INDEX studies_status_idx ON studies(status);

-- audit_log: every wizard action, ever
CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  ts          timestamptz NOT NULL DEFAULT now(),
  actor       uuid REFERENCES auth.users(id),     -- who clicked
  actor_email text,                                -- denormalized for read perf
  action      text NOT NULL,                       -- "create_study", "invite_user", "rotate_token"
  target      text,                                -- e.g. study slug or email
  details     jsonb NOT NULL DEFAULT '{}',         -- full request payload + response codes
  success     boolean NOT NULL,
  error       text                                 -- if !success
);

CREATE INDEX audit_log_ts_idx ON audit_log(ts DESC);
CREATE INDEX audit_log_actor_idx ON audit_log(actor);
CREATE INDEX audit_log_action_idx ON audit_log(action);

-- RLS: only platform admins can read these tables
ALTER TABLE studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform admins read studies"
  ON studies FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'email') IN (
      SELECT email FROM platform_admins
    )
  );

-- (similar for audit_log; both write-only via edge functions using service-role)
```

---

## 5. The `create-study` edge function flow

```
INPUT:
  { slug, title, sponsor, analyst, template: "hiv" | "blank",
    domain, admin_emails: [...], dns_automation: false }

STEPS (in order, with checkpointing — if any fails, audit_log records WHERE):

  1. Validate input
     - slug regex: [a-z][a-z0-9-]{1,30}
     - admin_emails: at least 1 valid
     - check slug not already in `studies` table

  2. Create GitHub repo from template
     - POST /repos/{org}/{template}/generate
     - body: { name: "prism-dashboard-{slug}", owner: "travlrdc1982",
              private: true, include_all_branches: false }
     - record repo_id in audit details

  3. Wait for GitHub to settle (poll until repo exists, max 10s)

  4. Create Supabase project for this study's CLIENT auth
     - POST https://api.supabase.com/v1/projects
     - body: { name: "prism-dashboard-{slug}-auth", region, organization_id }
     - poll until provisioned (max 90s)
     - record supabase_ref

  5. Get the new project's URL + anon key
     - GET /v1/projects/{ref}/api-keys
     - extract anon key

  6. Configure auth on the new Supabase project
     - PATCH /v1/projects/{ref}/config/auth
     - body: { mailer_otp_exp: 604800 }      # 7-day invite expiry

  7. Deploy generate-invite edge function to the new project
     - POST /v1/projects/{ref}/functions
     - upload function source (template baked into create-study)

  8. Set the new project's function secrets
     - PATCH /v1/projects/{ref}/secrets
     - { ADMIN_EMAILS: <from form>,
         REDIRECT_DEFAULT: "https://{slug}.rcghealthprism.app" }

  9. Create Vercel project
     - POST /v9/projects
     - body: { name, framework: "vite",
              gitRepository: { type: "github", repo: "travlrdc1982/prism-dashboard-{slug}" } }
     - record vercel_project_id

 10. Set Vercel env vars
     - POST /v10/projects/{id}/env (×3)
     - VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (from step 5)
     - VITE_BYPASS_AUTH: false

 11. Add custom domain to Vercel
     - POST /v9/projects/{id}/domains
     - { name: "{slug}.rcghealthprism.app" }

 12. (Optional) Set DNS via provider API
     - if dns_automation enabled, POST to your DNS provider
     - else return the CNAME record for manual entry

 13. Trigger initial Vercel deploy
     - POST /v13/deployments

 14. Insert into studies table
     - record everything for the registry

 15. Audit log success
     - INSERT INTO audit_log
     - return JSON with all the URLs to the wizard UI

OUTPUT (success):
  {
    study_id: uuid,
    dashboard_url: "https://ahip.rcghealthprism.app",
    admin_url:     "https://ahip.rcghealthprism.app/admin",
    repo_url:      "https://github.com/travlrdc1982/prism-dashboard-ahip",
    vercel_url:    "https://vercel.com/...",
    supabase_url:  "https://supabase.com/dashboard/project/...",
    next_steps:    ["Edit study.yaml", "Upload .sav", "Generate analyst invite"],
    dns_record:    { type: "CNAME", name: "ahip", value: "cname.vercel-dns.com" }
  }

OUTPUT (failure at step N):
  {
    error: "Failed at step N: <description>",
    partial_state: { ...what was created so far... },
    cleanup_url: "/studies/cleanup?id=<draft_id>"
  }
```

---

## 6. Auth + permissions model

### Two auth pools, intentionally separate

| Pool | Lives in | Who's in it | What they can do |
|---|---|---|---|
| **Platform admins** | `prism-platform-admin` Supabase project | Bryan, Jen, Vicky (Reservoir staff) | Use the admin portal: create studies, manage users, view audit |
| **Per-study clients** | Each study's own Supabase project (HIV, AHIP, …) | Gilead exec, AHIP exec, etc. | Sign into their study's dashboard. Can't see other studies. |

**No staff user appears in a client pool.** When Bryan needs to QA the HIV dashboard, he generates himself an invite via /admin like anyone else.

### Permission check on every wizard action

The `create-study` function does:

```typescript
// 1. Get caller's JWT
const userClient = createClient(supabaseUrl, anonKey, {
  global: { headers: { Authorization: req.headers.get("Authorization") } }
});
const { data: { user } } = await userClient.auth.getUser();

// 2. Check they're in the platform_admins table
const { data: admin } = await admin.from("platform_admins")
  .select("role")
  .eq("email", user.email.toLowerCase())
  .single();

if (!admin) {
  await audit({ actor: user.id, action: "create_study", success: false,
                error: "Not a platform admin" });
  return 403;
}

// 3. Check role allows this action
if (admin.role !== "owner" && admin.role !== "engineer") {
  return 403;  // viewers can't create studies
}
```

### Roles (in `platform_admins` table)

```sql
CREATE TABLE platform_admins (
  email   text PRIMARY KEY,
  role    text NOT NULL,    -- 'owner' | 'engineer' | 'viewer'
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by uuid REFERENCES auth.users(id)
);

INSERT INTO platform_admins (email, role) VALUES
  ('bdumont@reservoircg.com',     'owner'),
  ('jholdsworth@reservoircg.com', 'engineer'),
  ('vudani@reservoircg.com',      'engineer');
```

| Role | Can use wizard | Can edit study config | Can view audit | Can manage admin roles |
|---|---|---|---|---|
| owner | ✓ | ✓ | ✓ | ✓ |
| engineer | ✓ | ✓ | ✓ | ✗ |
| viewer | ✗ | ✗ | ✓ | ✗ |

---

## 7. Token storage + rotation

The wizard needs four sensitive tokens, all stored as Supabase function secrets
on `prism-platform-admin`. Never in client code, never in env vars on Vercel.

| Token | Scope | Where | Rotation |
|---|---|---|---|
| `GITHUB_PAT` | `repo` + `workflow` on `travlrdc1982` org | Supabase secret | Quarterly |
| `VERCEL_TOKEN` | Account-scoped (or team-scoped) | Supabase secret | Quarterly |
| `SUPABASE_MGMT_TOKEN` | Org-scoped | Supabase secret | Quarterly |
| `DNS_PROVIDER_API` | Zone-scoped to rcghealthprism.app | Supabase secret | Quarterly |

Rotation UI lives in `/settings` on the admin portal: "Rotate tokens"
button → owner-only → form to paste new value → audit log entry. No
downtime — wizard reads fresh value on next invocation.

---

## 8. Failure modes + recovery

Setup is multi-step across three external APIs. Failures will happen.

| Failure point | Recovery |
|---|---|
| GitHub repo creation fails | Nothing else was touched. Show error. Wizard retries are safe. |
| Supabase project creation fails | GitHub repo exists but is orphaned. UI offers "delete repo and retry" or "use existing repo". |
| Vercel project creation fails | Both GitHub repo + Supabase project exist. UI offers "complete setup later" (links to studies tab) or "tear everything down". |
| Vercel domain assignment fails (e.g. DNS not configured) | Everything else worked. Show DNS record for manual entry; wizard polls every 30s until domain resolves, then proceeds. |
| Function secrets fail | Wizard succeeded structurally but admin can't mint invites. Show clear error + recovery path: `supabase secrets set --project-ref <ref> ADMIN_EMAILS=...`. |

Every failure logs to `audit_log` with full request payload + response code,
so debugging post-hoc is possible without re-running.

---

## 9. UI walkthrough

```
┌──────────────────────────────────────────────────────────────────┐
│  RESERVOIR PRISM PLATFORM                       bdumont ▾  ⚙     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Users  Studies  Audit  Settings                                 │
│  ─────                                                           │
│                                                                  │
│  STUDIES                                       + New Study       │
│  ─────────────────────────────────────────────────────────────   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ HIV         Active     hiv.rcghealthprism.app    [open]  │   │
│  │ Sponsor: Gilead  ·  Analyst: Jen  ·  Created Jun 13       │   │
│  │ 4 admins · 12 clients · Last refresh: Jun 14 02:11        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ AHIP        Active     ahip.rcghealthprism.app   [open]  │   │
│  │ Sponsor: AHIP  ·  Analyst: Vicky  ·  Created Jun 17       │   │
│  │ 3 admins · 5 clients · Last refresh: Jun 17 14:30         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

Clicking **+ New Study** opens the 4-step wizard:

**Step 1 — Identity**
```
Slug          [ahip                ]
Title         [PRISM AHIP Wave 1   ]
Sponsor       [AHIP                ]
Analyst       [Vicky Udani         ]
Fielded       [2026-Q3 ▾           ]
                                  [ Next → ]
```

**Step 2 — Survey instrument**
```
Template      ○ HIV (use HIV's items as a starting point)
              ● Blank (start from scratch)
              ○ Upload (paste existing study.yaml)
                                  [ ← Back ]  [ Next → ]
```

**Step 3 — Auth**
```
Admin emails  [bdumont@reservoircg.com, jholdsworth, vudani]
Domain        [ahip.rcghealthprism.app]
DNS           ● Manual (I'll add the CNAME)
              ○ Automatic (Cloudflare token configured)
                                  [ ← Back ]  [ Next → ]
```

**Step 4 — Confirm**
```
Review:
  Slug:        ahip
  Domain:      ahip.rcghealthprism.app
  Repo:        github.com/travlrdc1982/prism-dashboard-ahip (new)
  Vercel:      prism-dashboard-ahip (new)
  Supabase:    prism-dashboard-ahip-auth (new)
  Admins:      3 emails will be in ADMIN_EMAILS
                                  [ ← Back ]  [ Create Study ]
```

**Progress view** (during the 60-90 sec creation):

```
Creating "ahip"...

  ✓ GitHub repo created
  ✓ Supabase project provisioned
  ✓ Supabase project URL captured
  ⟳ Configuring auth (7-day invite expiry)...
    Vercel project (queued)
    Vercel env vars (queued)
    Custom domain (queued)
    Initial deploy (queued)
```

**Done** view:

```
✓ AHIP is live!

  Dashboard:  https://ahip.rcghealthprism.app  [open ↗]
  Admin:      https://ahip.rcghealthprism.app/admin
  Repo:       github.com/travlrdc1982/prism-dashboard-ahip  [open ↗]

  Next steps:
  ☐ Add this CNAME record at your DNS provider:
       Type:  CNAME
       Name:  ahip
       Value: cname.vercel-dns.com
  ☐ Edit study.yaml to map AHIP-specific survey field names
  ☐ Upload first .sav and run refresh.py
  ☐ Generate invite for analyst (Vicky Udani — vudani@reservoircg.com)

                                                       [ Done ]
```

---

## 10. Effort breakdown

| Phase | Pieces | Effort | Ship-on-its-own? |
|---|---|---|---|
| **0. Foundation** | Set up `prism-platform-admin` Supabase project, create `prism-admin-portal` repo, copy auth from dashboard, deploy bare login | 4 hrs | Yes — useful for cross-study user management even without wizard |
| **1. Studies registry + audit** | Tables, RLS policies, basic /studies and /audit pages | 4 hrs | Yes — view-only of what already exists |
| **2. User management** | Cross-study invite (POST to N study auth projects in one shot), revoke flow | 4 hrs | Yes — solves the "I have to log into 3 dashboards to invite one person" pain |
| **3. Wizard form** | 4-step React form, validation, progress view, done view | 6 hrs | No — depends on 4 |
| **4. create-study edge function** | Full orchestration: GitHub + Vercel + Supabase mgmt + DNS + audit | 8 hrs | Yes (CLI version) — wizard is just the UI on top |
| **5. Token management** | Settings page, rotation UI, secrets API integration | 2 hrs | Yes |
| **6. Failure recovery** | Cleanup UI for half-created studies | 3 hrs | Yes |
| **7. Polish + docs** | Onboarding tour, README, runbooks | 2 hrs | Yes |
| **Total** | | **33 hrs** | |

The phases are independent. You could ship through phase 2 (foundation +
user management) in **~12 hrs** and have real value without the wizard
itself.

---

## 11. Recommended build order

For 2 studies launching next week, the wizard is too late. Build it for studies #4+.

**Sprint 1 (week 1-2): Phases 0-2 (foundation + registry + user mgmt). ~12 hrs.**
Already pays for itself: one place to invite users across studies, one
place to see what exists. Even without the wizard, this is valuable.

**Sprint 2 (week 3): Phases 3-4 (wizard form + create-study function). ~14 hrs.**
The wizard ships. New studies created in 90 seconds.

**Sprint 3 (week 4): Phases 5-7 (polish). ~7 hrs.**
Token rotation, cleanup UI, docs. Production-ready.

---

## 12. Decisions to make before building

| Decision | Options | Notes |
|---|---|---|
| **DNS automation** | Manual / Cloudflare API / Vercel-managed | Manual is fine for v1; Cloudflare adds nice "1-click" UX |
| **Per-study Supabase region** | Always us-east-1 / configurable | Latency only matters if a study is global. Start fixed. |
| **GitHub org** | travlrdc1982 (personal) / new Reservoir org | Personal works; org is cleaner long-term |
| **Audit log retention** | Forever / 1 year / 90 days | Compliance call. Default forever for now. |
| **Failure cleanup** | Manual / automatic | Manual cleanup is safer; UI offers "tear down" button |
| **Wizard for non-admins?** | Owners only / engineers too | Engineers should be able to create studies; owners only for token rotation |

---

## 13. What this design explicitly DOESN'T solve

1. **Study config editing.** Editing `study.yaml` blocks (tier overrides, drawer
   copy, etc.) is a separate feature — the "per-study config editor" we
   discussed. It would slot in as `/studies/{slug}/config`.

2. **Data refresh from the browser.** Running `refresh.py` needs the .sav, the
   prism Python package, and a Python runtime. Out of scope for this wizard.
   See the separate "GitHub Actions auto-patch" design.

3. **Survey instrument design.** The wizard creates a working dashboard
   skeleton. Filling in items, demographics, segment-specific bindings still
   needs an analyst editing study.yaml. The HIV-template option short-circuits
   this for studies using the same instrument.

4. **Client onboarding emails.** Same as today — analyst copies the invite URL
   and sends it through their own channel. No SMTP setup needed.

---

## 14. Open questions

- Should the wizard support **dev environments** (e.g., `ahip-staging`)? Adds
  complexity but useful for testing config changes.
- Should there be a **"clone study"** action (e.g., AHIP Wave 2 starts from
  AHIP Wave 1)?
- Should the audit log surface in Slack / email when significant events happen
  (study created, admin token rotated)?

---

**Bottom line:** this wizard is 33 focused hours of work for permanent
escape velocity from manual study setup. Build it after studies 2 and 3
land manually; the third study is the last one you'll set up by hand.
