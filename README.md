# ReportHub

A white-label client reporting dashboard for marketing agencies. Your clients
see **your** brand — your name, your logo, your colors, your domain. One
purchase, hosted on your own infrastructure, no per-client monthly fees.

## Quick start

Requirements: Docker and Docker Compose on any Linux server / VPS.

```bash
docker compose up --build -d
```

Open `http://<your-server>:3000` and sign in with the demo accounts below.
Your data lives in `./data/app.db` (SQLite) — back up that file and you've
backed up everything.

## First steps after install

1. Sign in as the demo owner: `owner@demo.agency` / `demo1234`.
2. Go to **Settings** → set your agency name, logo, colors, and support email.
   The whole product rebrands instantly — login screen, dashboards, reports.
3. Go to **Team** → create your own owner account, then remove the demo accounts.
4. Go to **Settings** → **Danger zone** → **Remove all client data** to wipe the
   demo clients, then add your real clients under **Clients**.

## Demo accounts (seeded on first boot)

| Role | Email | Password | Sees |
|---|---|---|---|
| Owner | `owner@demo.agency` | `demo1234` | Everything |
| Account manager | `manager@demo.agency` | `demo1234` | Assigned clients only |
| Client | `client@demo.agency` | `demo1234` | One client, read-only |

## How it works

- **Clients** — add each client with their retainer, website, status, and
  assigned account manager. Onboarding templates (PPC-only, SEO+PPC,
  full-service) pre-configure channels and the monthly report schedule.
- **Import data** — upload one CSV with a channel column, or several
  channel-specific CSVs at once. Columns are detected automatically per
  file ("Cost" vs "Spend", "Clicks" vs "click_count", MM/DD/YYYY vs
  YYYY-MM-DD); you confirm the mapping before anything imports, with a
  per-file channel fallback tag. Bad rows are skipped with reasons, never
  silently. Re-uploading the same dates replaces old rows — no duplicates.
  Manual entry sits front-and-center next to import.
- **Dashboards** — per-client KPIs (spend, impressions, clicks, CTR,
  conversions, CPA, revenue, ROAS), trend charts with date-range picker,
  channel breakdown, period-over-period comparison, and a plain-English
  performance summary of what moved and why. Funnel view
  (impressions → clicks → conversions → revenue) and channel-contribution
  comparison included.
- **Alerts** — the system watches every client's numbers and flags big
  swings (spend, CTR, conversions, CPA) before your clients notice. Feed
  with unread badge, per-client adjustable thresholds, one-click re-check.
- **Client health** — every client gets a 0–100 health score on the agency
  overview (performance trend, anomaly severity, budget pacing, reporting
  activity), with at-risk flags and a clickable breakdown of what's driving
  it.
- **Reports** — one click per client per period produces a clean,
  print-ready report with your branding. **Batch generation** builds every
  client's report at once for the selected period (30/90/180 days or all
  time) with a progress view; finished reports live in a library with
  exact date ranges. Use the browser's Print → Save as PDF to send them.
- **Delivery** — schedule weekly/monthly report emails per client with
  recipient lists, upcoming sends, and a send history. Delivery uses your
  own SMTP server (Settings → Email delivery), configured by your tech team.
- **Invoices** — create branded invoices for your clients: line items,
  quantities, rates, tax, notes, invoice numbers, paid/unpaid/overdue
  tracking, printable and downloadable as PDF.
- **Budgets** — monthly budgets per client (optionally per channel) with a
  pacing bar showing spend vs. time elapsed; off-track months are flagged.
- **Platform connections** — map each client's Google Ads, Meta Ads, GA4,
  LinkedIn Ads, and TikTok Ads accounts with per-platform credential
  storage and one-click sync. Live imports activate once your tech team
  installs the provider adapters and real API credentials (see below) —
  CSV import and manual entry work out of the box.
- **My account** — every user can edit their display name, change their
  password, and upload a profile picture (with crop/zoom/position adjust).
- **Team** — owners, account managers (assigned clients only), and client
  logins (read-only, one client each).

## For your tech team

- **Stack:** Next.js 15, React 19, SQLite. No external services, no license
  servers, no telemetry, no outbound network calls.
- **Data:** single SQLite file at `./data/app.db` (mounted volume).
  Back it up on your own schedule; restore by putting the file back.
- **Config:** `COOKIE_SECURE=true` environment variable if you serve over
  HTTPS (recommended) — see `docker-compose.yml`.
- **Email delivery:** scheduled report emails send through your SMTP server.
  Fill in host/port/credentials under Settings → Email delivery (owner).
  Until configured, sends are logged as queued, not delivered.
- **Platform live imports:** the app ships the full connection framework
  (per-client account mapping, credential storage, sync controls) for
  Google Ads, Meta Ads, GA4, LinkedIn Ads, and TikTok Ads. Activating live
  imports is a deploy-time step: install each provider's OAuth credentials
  and a provider adapter that writes into the `metrics` table
  (`lib/platforms.ts` marks the integration point). Until then the sync
  buttons report honestly instead of pretending, and CSV/manual entry
  cover data intake.
- **Updates:** rebuild with `docker compose up --build -d`. The database
  file is preserved across rebuilds.
- **Reset:** Settings → Danger zone offers "Remove all client data" and
  "Restore demo dataset" (owner only).

## Port / demo notes

The demo dataset ships with two sample alerts, monthly budgets, two mapped
(but disconnected) platform accounts per active client, one sample invoice,
and one monthly delivery schedule, so every workspace shows real content on
first boot.
