# Plannr (v1 prototype)

Web-based financial planning for small, independent Dutch wealth managers and
financial planners — with a focus on DGA's (BV + private wealth). Guided A-to-Z
planning flow, connected input fields, and client-facing PDF reports in each
firm's own house style.

> **Prototype.** The calculation engine is a simplified mock and document
> extraction returns example data. Not suitable for real advice yet.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase
(Postgres, Auth, Storage, Row Level Security) · React-PDF.

---

## Contents

1. [First-time setup (step by step)](#1-first-time-setup-step-by-step)
2. [Daily development](#2-daily-development)
3. [Deploying (Vercel + admin.gligor.xyz)](#3-deploying-vercel--admingligorxyz)
4. [How the app is built](#4-how-the-app-is-built)
5. [Tests](#5-tests)
6. [Known limitations / next steps](#6-known-limitations--next-steps)

---

## 1. First-time setup (step by step)

You need **Node.js 20.9 or newer** (`node -v`) and a free
[Supabase](https://supabase.com) account. No local database is required —
everything runs in your Supabase project.

### Step 1 — Create the Supabase project

1. Go to <https://supabase.com/dashboard> → **New project**.
2. Pick a name (e.g. `plannr`), choose a strong **database password** and save
   it in your password manager.
3. **Region: choose an EU region (e.g. Frankfurt or Amsterdam).** Client data
   is personal financial data under the AVG/GDPR; keep it in the EU.
4. Click **Create new project** and wait ~2 minutes until it is ready.

### Step 2 — Copy your API keys

In the dashboard, click **Connect** (top) or go to **Project Settings → API Keys**:

| What                   | Where to find it                                    | Used for                         |
| ---------------------- | --------------------------------------------------- | -------------------------------- |
| Project URL            | Project Settings → Data API (`https://xxxx.supabase.co`) | everything                  |
| Publishable key        | API Keys → `sb_publishable_…`                       | the app (safe for the browser)   |
| Secret key             | API Keys → Secret keys → `sb_secret_…` (click to reveal) | seed script + invitation e-mails (**server only, never share**) |

### Step 3 — Create `.env.local`

```bash
cd plannr
cp .env.example .env.local
```

Open `.env.local` and fill in the three values from step 2. Leave the other
lines as they are for now. `.env.local` is ignored by git — it is never committed.

### Step 4 — Create the database tables ("run the migration")

The whole schema — tables, security rules, triggers, storage buckets — lives in
one file: `supabase/migrations/20261012000000_plannr_schema.sql`.

**Option A — SQL Editor (easiest):**

1. In the Supabase dashboard open **SQL Editor → New query**.
2. Open `supabase/migrations/20261012000000_plannr_schema.sql` in your code
   editor, select everything, copy, and paste it into the SQL Editor.
3. Click **Run**. You should see *Success. No rows returned*.
4. Check **Table Editor**: you should now see `firms`, `users`, `clients`,
   `plans`, `assets`, … and under **Storage** three private buckets:
   `documents`, `exports`, `logos`.

Run it **once**. Running it a second time fails with "already exists" — that is
harmless and means it is already done.

Later migrations are separate, smaller files in the same folder (for example
`20261014000000_ai_reader_switch.sql`). Run each new file once, in date order,
the same way. They use `if not exists`, so running one twice is harmless.

**Option B — Supabase CLI:**

```bash
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF   # asks for the database password from step 1
npx supabase db push
```

### Step 5 — Configure authentication

In the dashboard, **Authentication → URL Configuration**:

- **Site URL:** `http://localhost:3000` (change to your production URL later).
- **Redirect URLs:** add `http://localhost:3000/**` (and later `https://YOUR-DOMAIN/**`).

**Authentication → Emails → Templates** — make the links land in Plannr
(recommended; this makes links work in any browser):

- **Confirm signup** — replace the link with
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/clienten`
- **Invite user** — replace the link with
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`

Keep **Confirm email** switched on (Authentication → Sign In / Providers →
Email). Invitations rely on people proving they own their e-mail address.

> Supabase's built-in e-mail sender is rate limited (a few e-mails per hour)
> and meant for testing. For real use, add your own SMTP server under
> Authentication → Emails → SMTP Settings.

### Step 6 — Install and seed demo data

```bash
npm install
npm run seed
```

This creates **Demo Vermogensbeheer B.V.** with an owner, a planner, a default
house style, 4 clients — including a complete DGA case (eigen woning +
hypotheek, savings and investments in box 3, a BV with eigen vermogen, liquide
middelen and ODV) with a finished plan and one exported PDF — plus a super admin.

| Account        | E-mail                 | Password            |
| -------------- | ---------------------- | ------------------- |
| Owner          | `eigenaar@example.com` | `Plannr-demo-2026!` |
| Planner        | `planner@example.com`  | `Plannr-demo-2026!` |
| Super admin    | `beheer@example.com`   | `Plannr-demo-2026!` |

Start over at any time with `npm run seed -- --opnieuw`. Override the password
with `SEED_PASSWORD=… npm run seed`.

### Step 7 — Run it

```bash
npm run dev
```

Open <http://localhost:3000> and log in as the planner or owner. The super
admin dashboard is at <http://localhost:3000/admin> (or
<http://admin.localhost:3000>, which mimics the admin subdomain).

### Make your own account super admin

Register normally, then run this in the SQL Editor (with your own e-mail):

```sql
insert into public.super_admins (user_id)
select id from auth.users where email = 'you@example.com';
```

Super admins only ever see usage counts and dates — see section 4.

---

## 2. Daily development

```bash
npm run dev        # app on http://localhost:3000
npm run typecheck  # TypeScript
npm run lint       # ESLint
npm test           # unit tests (engine, formatting, plan logic)
npm run test:db    # database/RLS tests (needs Docker)
npm run build      # production build
```

**Changing the database:** add a new file in `supabase/migrations/` (never edit
one that already ran in production) and run it the same way as step 4.

**Fully local Supabase (optional, needs Docker):** `npx supabase start` runs
the whole stack locally and applies the migrations; `npx supabase status`
prints the local URL and keys for `.env.local`.

---

## 3. Deploying (Vercel + admin.gligor.xyz)

Plannr lives in the `plannr/` folder of this repository, next to the
existing gligor.xyz site, so it gets its **own** Vercel project:

1. Vercel → **Add New → Project** → import this repository.
2. **Root Directory:** `plannr`. Framework: Next.js (auto-detected).
3. **Environment Variables:** the same as `.env.local`, with
   `NEXT_PUBLIC_SITE_URL=https://YOUR-APP-DOMAIN` and
   `ADMIN_HOSTNAME=admin.gligor.xyz`.
4. **Domains:** add your app domain *and* `admin.gligor.xyz` to this project.
   Requests to `admin.gligor.xyz` are served the admin area only
   (`src/proxy.ts` rewrites them to `/admin/...`); the planner app is not
   reachable on that hostname.
5. In Supabase (step 5) set the **Site URL** to the app domain and add
   `https://YOUR-APP-DOMAIN/**` and `https://admin.gligor.xyz/**` to the redirect URLs.

---

## 4. How the app is built

```
src/
  app/
    (auth)/            inloggen, registreren, wachtwoord-instellen, geen-kantoor
    (app)/clienten/    client list, client dashboard, plans
      [clientId]/plannen/[planId]/[step]   the 6-step planning flow
    (app)/instellingen/                    team + huisstijl (owner only)
    admin/                                 super admin dashboard
    api/                                   PDF preview/export, downloads, house-style samples
  lib/
    engine/            calculatePlan() + assumptions.ts + mock engine
    extraction/        extractDocument(): AI reader (Bedrock, EU) or example data + applying results to a plan
    house-style/       curated fonts, layout variants, generateHouseStyleFromWebsite()
    pdf/               React-PDF report (3 layouts)
    plan/              plan definitions (sections, steps, fields, asset types), status logic
    supabase/          server / browser / proxy / admin clients
  proxy.ts             session refresh + admin subdomain routing
supabase/migrations/   the full database schema
scripts/seed.tsx       demo data
```

### The swappable seams

| Seam | File | Swap later for |
| ---- | ---- | -------------- |
| `calculatePlan(input): Promise<PlanResult>` | `src/lib/engine/index.ts` | a licensed rekenkern (e.g. Bokkz / FINACT). The UI, results step and PDF only talk to this function. |
| Assumptions (tax rates, returns, inflation) | `src/lib/engine/assumptions.ts` | — all in one place |
| `extractDocument(file, type, ai)` | `src/lib/extraction/extract-document.ts` | Claude on Amazon Bedrock (EU) when configured and switched on by the firm owner; otherwise labelled example data that never reads the file. |
| `generateHouseStyleFromWebsite(url)` | `src/lib/house-style/generate-from-website.ts` | a smarter brand scraper. v1 reads theme-color, CSS colors and font names. |

The engine is deterministic and has no AI in it. `calculatePlan` is `async`
on purpose, so an API-backed version needs no changes elsewhere.

### Data model

`firms`, `users` (role `owner` | `planner`), `invitations`, `house_styles`,
`clients`, `client_notes`, `plans` (with typed JSON `config` + `inputs`),
`assets`, `documents`, `exports` (PDF path + sections + house-style snapshot),
`activity_log` (metadata only) and `super_admins`.

**Assets are extensible without schema changes:** each row has a `type` from
the registry in `src/lib/plan/definitions.ts`, a `side`, `tax_box`, `value`
and type-specific fields in `metadata`. Adding e.g. foreign real estate with a
`land` field is one new registry entry. A BV is one `bv_aandelen` row, so
holding structures (several BVs) fit the same model: a werkmaatschappij is a
second row with `gehouden_door = holding`.

**Income and expenses over time** live in `plans.inputs.posten`: each item has
a kind (registry `CASH_KINDS` in `definitions.ts`), an amount per year, a start
and end year and an optional growth rate. Optional wealth topics (kapitaal-
verzekering, lijfrente, spaarrekening eigen woning, loans to and from the own
BV, loans to others) are asset types marked `optional`: they appear only after
"Onderwerp toevoegen". A BV can switch on its full balance sheet and P&L; equity
and the result after Vpb are then derived in `src/lib/plan/bv.ts`.

### Security & privacy

- **Row Level Security on every table**: a user can only read and write rows of
  their own firm. Child tables carry `firm_id` with composite foreign keys, so a
  row can never point at another firm's client or plan.
- **Owner-only actions** (house style, invitations, firm settings, deleting a
  client) are checked in server actions *and* enforced by RLS policies.
- **Private storage buckets** with one folder per firm; files are only served
  through short-lived signed URLs.
- **Super admin** data comes from `SECURITY DEFINER` SQL functions
  (`admin_totals`, `admin_firm_stats`, `admin_monthly_stats`) that return
  counts and dates only and refuse anyone not in `super_admins`. The super
  admin account has no firm, so RLS hides every client row from it.
- No financial data or document contents are logged — also not by the AI
  reader, which logs only the error type when reading fails.
- The AI reader is off unless the deployment is configured for it **and** the
  firm owner switches it on (`firms.ai_extraction_enabled`, owner-only by RLS).
  See "AI document reader" below.
- The secret key is only used by the seed script and for sending invitation
  e-mails; everything else runs as the logged-in user.

### AI document reader

`src/lib/extraction/ai/` reads an uploaded IB-aangifte or jaarrekening with
Claude through Amazon Bedrock.

- **EU only.** Requests enter AWS in an EU region (`eu.ts` holds an explicit
  list; `eu-west-2` is London and `eu-central-2` is Zürich, so a plain `eu-`
  prefix is not enough). The default is `eu-central-1`, Frankfurt. Model IDs
  must use the `eu.` inference profile (default `eu.anthropic.claude-opus-5-5`)
  or no profile. `global.`, `us.` and other profiles are refused.
- **Endpoint.** The reader uses the standard Bedrock runtime (`InvokeModel`).
  Structured outputs are not offered there, so the model answers through one
  tool call, and Plannr checks that call against its own schema (zod).
- **Data minimisation.** Only the file is sent: no client name, plan data or
  user data. The schema (`schema.ts`) asks for amounts, birth years, the
  partner's first name and page numbers. It never asks for a BSN, address or
  account number.
- **No AI arithmetic.** The model transcribes. `map.ts` adds up wages per
  employer, derives an interest rate from interest paid and maps owners, and it
  is unit-tested. The engine stays deterministic.
- **Check by the planner.** Every value is marked "uit document" and listed
  with its page under the uploaded document.
- **Refusals.** If the main model declines, the request is retried once on a
  fallback model (`PLANNR_BEDROCK_FALLBACK_MODEL`, default
  `eu.anthropic.claude-opus-4-8`).
- **Two switches.** The environment variables in `.env.example` (server) and
  the owner's switch under Instellingen (per firm, off by default).

### Roles & invitations

- **Register** (`/registreren`) creates a new firm with you as **owner**
  (database trigger `handle_new_auth_user`), plus a default house style.
- **Invite** (Instellingen → Team): the owner enters an e-mail address. With
  `SUPABASE_SECRET_KEY` set, Supabase e-mails an invitation; Plannr always also
  shows a sign-up link to share. Whoever registers or logs in with that address
  joins the firm as **planner** and automatically uses the firm's house style.

---

## 5. Tests

- `npm test` — unit tests for formatting (Dutch amounts/dates), the engine,
  insights, choice comparisons, step/missing-field logic, and document
  pre-filling including the mapping of AI reader output.
- `npm run test:db` — starts a throwaway `supabase/postgres` container,
  applies the migration and checks RLS isolation between firms, owner-only
  rules, invitations, storage folders and that the super admin sees counts only.

---

## 6. Known limitations / next steps

- Mock calculation engine (indicative 2025 rules; no heffingskortingen or
  toeslagen).
- Document extraction returns example data unless the AI reader is set up
  (Amazon Bedrock, EU) and switched on by the firm owner.
- One BV per plan in the UI (the data model supports more).
- No billing, seat limits, client portal or custom fonts (out of scope for v1).
- If two planners edit the *same plan* at the same moment, the last save wins.
