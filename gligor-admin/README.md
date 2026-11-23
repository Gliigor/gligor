# Gligor.ai admin dashboard

Private dashboard for Gligor.ai. Only Gligor uses it. Each day it shows what needs to be done, keeps a full logbook per client, handles client email as tickets, and shows payment status. The interface is in Dutch.

**Stack:** Next.js 16 (App Router) + TypeScript + Tailwind 4, Supabase (Postgres, Auth, Storage, EU), Resend (sending + inbound), Vercel (hosting + daily cron).

```
gligor-admin/
├── supabase/migrations/     database: tables, RLS, audit log, starter templates, storage bucket
├── src/lib/config.ts        business rules: packages, amounts, payment terms, response times
├── src/lib/domain/          pure logic: working days, lifecycle, payments, tickets, Vandaag list
├── src/lib/services/        database work (clients, logbook, tickets, e-mail, daily job)
├── src/app/(app)/           pages: Vandaag, Klanten, Pipeline, Tickets, Betalingen, Templates, Instellingen
├── src/app/api/             cron, inbound e-mail, attachments, Stripe placeholder
└── tests/                   unit tests + database tests (PGlite, no Docker needed)
```

---

## Try it first: demo mode (no setup)

```bash
cd gligor-admin
npm install
npm run demo          # http://localhost:3100
```

Demo mode runs a local Postgres (PGlite, stored in `.demo-data/`) with 3 fictional clients in different stages. There is no login and **no e-mail is actually sent**. Delete `.demo-data/` to start over.

> Never set `DEMO_MODE=true` on the real deployment: demo mode skips the login.

## Tests

```bash
npm test              # 31 tests: lifecycle, payments, ticket matching, working days, RLS, services
npm run typecheck
```

The database tests run every migration on PGlite (real Postgres in WebAssembly). They check that only the admin with 2FA can read or write data, that the audit log is read-only, and that a GDPR (AVG) delete removes everything.

---

## Going live

### 1. Supabase (database, login, storage)

1. Create a project at [supabase.com](https://supabase.com). **Region: Central EU (Frankfurt)**. Supabase encrypts data at rest by default (AES-256).
2. **Run the migrations**, in this order, in the SQL Editor (or `npx supabase link` + `npx supabase db push`):
   - `supabase/migrations/20261123000000_admin_schema.sql`
   - `supabase/migrations/20261123000100_starter_templates.sql`
   - `supabase/migrations/20261123000200_storage_bucket.sql` (creates the private bucket `ticket-bijlagen`)
3. **Authentication → Sign In / Providers**
   - Email: on. **"Allow new users to sign up": off.**
   - Multi-factor (TOTP): on (it is on by default).
4. **Authentication → Users → Add user**: create your own account with your e-mail address. This must match `ADMIN_EMAIL` exactly. Only this account can log in. On the first login it is registered as the one and only admin.
5. **Authentication → URL Configuration**
   - Site URL: `https://admin.gligor.ai`
   - Redirect URLs: `https://admin.gligor.ai/auth/callback` (and `http://localhost:3100/auth/callback` for local testing)
6. **Authentication → Emails → SMTP**: use Resend as the SMTP server so the login links come from your own domain. Supabase's default mailer is heavily rate-limited.
   Host `smtp.resend.com`, port `465`, user `resend`, password = your Resend API key, sender `hello@gligor.ai`.
7. Collect these values for the environment variables:
   - **Connect → Transaction pooler** (port 6543) → `DATABASE_URL`
   - **Project Settings → API Keys** → `NEXT_PUBLIC_SUPABASE_URL`, the publishable key (`sb_publishable_…`) and the secret key (`sb_secret_…`)

**Logging in:** enter your e-mail → click the link in your mailbox → enter the 6-digit code from your authenticator app. The first time, you scan a QR code (1Password, Google Authenticator or Microsoft Authenticator all work). Passkeys can be added later through Supabase Auth.

### 2. Resend (sending and receiving e-mail at hello@gligor.ai)

1. Create an account at [resend.com](https://resend.com) and add the domain `gligor.ai` with **region EU (eu-west-1)**.
2. Create an API key (Sending + Receiving) → `RESEND_API_KEY`.
3. **Receiving**: turn on Receiving for the domain. Then **Webhooks → Add endpoint**:
   - URL: `https://admin.gligor.ai/api/inbound/resend`
   - Event: `email.received`
   - Copy the signing secret (`whsec_…`) → `RESEND_WEBHOOK_SECRET`

   Every e-mail to hello@gligor.ai now becomes a ticket. It is matched to a client by sender address. Replies stay in the same thread (`Message-ID` / `In-Reply-To`, plus `[T-1234]` in the subject). An unknown sender becomes a new Lead.
4. **Postmark instead of Resend Inbound?** Use `https://admin.gligor.ai/api/inbound/postmark?token=<INBOUND_TOKEN>` as the inbound webhook, and set `INBOUND_TOKEN` to a long random string.

### 3. DNS records for gligor.ai (in Cloudflare)

Resend shows the exact values for your account after you add the domain. Copy them from there. You need roughly the following (proxy off / grey cloud for all of them):

| Type | Name | Value | Purpose |
| --- | --- | --- | --- |
| TXT | `resend._domainkey` | `p=MIGfMA0…` (from Resend) | **DKIM**: signs your mail |
| MX | `send` | `feedback-smtp.eu-west-1.amazonses.com` (priority 10) | bounces for sending |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | **SPF**: Resend may send for you |
| MX | `@` (gligor.ai) | the inbound MX from Resend (priority 10) | **receiving** at hello@gligor.ai |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:hello@gligor.ai` | **DMARC**; after a few weeks without problems, change to `p=quarantine` |
| CNAME | `admin` | `cname.vercel-dns.com` | the dashboard at admin.gligor.ai |

> **Note:** the MX record of `gligor.ai` can only point to one place. If you used Cloudflare Email Routing for gligor.ai (forwarding to Gmail), turn it off. From now on, all mail to @gligor.ai arrives in the dashboard as tickets.

### 4. Vercel

1. **Add New → Project** → import this repository → **Root Directory: `gligor-admin`**.
2. Fill in the environment variables (see below) under Settings → Environment Variables.
3. Deploy, then add the domain `admin.gligor.ai` under Settings → Domains.
4. The daily job is in `vercel.json` and is picked up automatically. Vercel Cron runs in UTC, so the route is called at 05:00 and 06:00 UTC. Only the call that lands on 07:00 Amsterdam time does anything (winter or summer time). Set `CRON_SECRET`; Vercel sends it along automatically.
5. The functions run in `fra1` (Frankfurt), close to the database.

### Environment variables

| Variable | Example | Required |
| --- | --- | --- |
| `ADMIN_EMAIL` | `gligor@…` | yes: the only address that can log in |
| `DATABASE_URL` | `postgres://postgres.xxxx:…@aws-0-eu-central-1.pooler.supabase.com:6543/postgres` | yes |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | yes |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` | yes (attachments) |
| `NEXT_PUBLIC_SITE_URL` | `https://admin.gligor.ai` | yes (login links) |
| `RESEND_API_KEY` | `re_…` | yes |
| `RESEND_WEBHOOK_SECRET` | `whsec_…` | yes (inbound mail) |
| `EMAIL_FROM` | `Gligor van Gligor.ai <hello@gligor.ai>` | no (this is the default) |
| `CRON_SECRET` | long random string | yes |
| `INBOUND_TOKEN` | long random string | only with Postmark |

Secrets live only in environment variables, never in code. For local development, put them in `.env.local` (that file is never committed).

---

## How it works

**Vandaag.** One list, sorted by urgency:

1. Tickets past or near their response deadline
2. Overdue payments
3. Follow-ups due today
4. Draft e-mails waiting for review
5. Lifecycle moments this week
6. Clients with no contact for 30+ days

Every item has one-click actions (send, call/WhatsApp/mail, done, paid, snooze to tomorrow or next week). The daily job (07:00) also mails you this list. If the job didn't run, it catches up as soon as you open the dashboard.

**Lifecycle.** Lead → Kennismaking → Intake → Inrichting → Training → Check-in (week 4, guarantee review) → Doorlopend → Opgezegd. Every stage change is stored with a date and creates tasks and e-mail drafts (see `src/lib/domain/lifecycle.ts`):

| Stage | Automatic |
| --- | --- |
| Kennismaking | task "Kennismakingsgesprek voorbereiden" |
| Intake | draft *Welkom na kennismaking*, task to plan the intake |
| Inrichting | start date is set, draft *Bevestiging intake*, set-up tasks, payments start |
| Training | draft *Inrichting klaar + spiekbriefjes*, training task, *Check-in na 2 weken* scheduled |
| Check-in | *Garantie-evaluatie na 4 weken* (day 28) + task to measure the time saved |
| Doorlopend (Plus) | every quarter: task "Volgend proces kiezen en verbeteren" + *Kwartaal-update* |
| Opgezegd | end date; future payments and unsent drafts are cancelled |

Moving a client back and forth never creates anything twice. **Templates** decides per template: a draft for review (default) or fully automatic sending.

**Payments.** The start fee plus a monthly payment on the same day of the month as the start date, due 14 days later. Status is calculated:

- **Betaald**: has a paid date
- **Te laat**: due date has passed
- **Openstaand**: due within 7 days
- **Op tijd**: due later than that

Overdue payments appear in Vandaag with a ready-made friendly reminder.

**Response times.** Basis: 2 working days, Plus: 1 working day. The deadline is the end of the working day in Amsterdam, skipping weekends and Dutch public holidays. Change this in `src/lib/config.ts`.

## Security and privacy (AVG/GDPR)

- **Row Level Security on every table.** The app talks to Postgres as the role `authenticated` with your verified login claims. Only the registered admin with a second factor (`aal2`) can read or write anything. The database enforces this, not just the app.
- Only one admin account. It is configured with `ADMIN_EMAIL` and registered on the first login. Sign-ups are disabled.
- **Audit log** of every change to clients, logbook and payments (who, when, before/after). It is read-only.
- **Export** (client → Privacy → export JSON) and **full deletion** per client. Deletion also removes attachments from storage, and personal data is stripped from the audit log.
- All data in the EU: Supabase Frankfurt, Vercel `fra1`, Resend `eu-west-1`.
- Webhooks are verified (Resend signature, Postmark token, cron secret).
- Attachments are in a private bucket and are only downloadable through 60-second signed links.

## Connecting Stripe later

The payments table already has `source`, `external_provider` and `external_id`. All status changes go through `src/lib/services/work.ts` (`markPaid`, `markPaidByExternalId`). Connecting Stripe only means filling in the placeholder `src/app/api/webhooks/stripe/route.ts`:

1. `npm install stripe`, and set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
2. Store the Stripe invoice ID per expected payment (`external_provider = 'stripe'`, `external_id = 'in_…'`).
3. In the webhook: `invoice.paid` → `markPaidByExternalId(...)`. For `invoice.payment_failed` you don't need to do anything: after the due date the payment automatically becomes "Te laat" and shows up in Vandaag.

The UI doesn't need to change.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `⌘K` / `Ctrl+K` | Command palette: search clients, `T-1001` for a ticket, actions |
| `N` | New note (on a client page, that client is pre-selected) |
| `⌘↵` | Save the note |
| `g` then `v` / `k` / `p` / `t` / `b` / `e` / `i` | Go to Vandaag / Klanten / Pipeline / Tickets / Betalingen / Templates / Instellingen |
| `↑` `↓` (or `j` `k`) + `Enter` | Move through tables and open the selected row |
