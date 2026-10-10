# ReportHub — Build Notes (v1 + feature port)

Internal build log. For buyer-facing docs see README.md.

## Port: test-version features → sellable codebase (2026-10-10)

All features from the private test version were ported into this Next.js
codebase so the two match. Work split: schema/libs/APIs/seed by the lead,
four UI builders in parallel (account, alerts/health/summary, invoices/
reports/batch, delivery/panels/import/client-form), integration + full
verification by the lead.

### What was ported
0. **Dockerfile**: restored `ENV PORT=3000` / `EXPOSE 3000` (was 7860 from
   a failed deploy); reconciled with `docker-compose.yml` (3000:3000).
1. **Profile management** (`/account`): display-name edit, password change
   (current + new, PBKDF2), avatar upload with canvas crop/zoom/reposition
   + live circular preview (256px JPEG data URL, ~350KB cap); `Avatar`
   component with initials fallback in sidebar, topbar, team list.
   New `users.avatar` column via migration in `initDb()`.
2. **Anomaly alerts** (`/alerts`, `lib/alerts.ts`): 30d-vs-prior-30d swing
   detection on spend/conversions/CTR/CPA, default thresholds 30/30/25/25,
   per-client tunable (`alert_thresholds`), severity warning/critical,
   idempotent per window, feed + unread badge in sidebar (server-computed),
   "check now" re-run. **Read/unread state is never used by scoring** —
   `recentAnomalyCounts()` deliberately ignores `is_read`.
3. **Batch reports** (`/reports`, `POST /api/reports`): selected period
   (30/90/180/all) flows explicitly from the overview picker into
   generation and is stored verbatim per report — the old 30-day hard-code
   bug was not repeated. Progress view, report library with exact
   start/end dates, per-report view with snapshot (summary + KPIs +
   channels) + print.
4. **Deterministic summaries** (`lib/summaries.ts`): template logic over
   metric data only — movement vs prior, revenue/ROAS, best/worst channel
   by CPA, spend concentration. On dashboards, per-client reports, and
   stored report snapshots. Zero AI mentions anywhere (verified by grep).
5. **Invoices** (`/invoices`, `lib/invoices.ts`): full CRUD, auto
   `INV-0001` numbering, line items (qty × rate), tax %, notes,
   draft/unpaid/paid/overdue, server-computed totals, printable white-label
   invoice doc with Save/Download (print-to-PDF). Delete is owner-only.
6. **Multi-channel import**: `POST /api/clients/:id/import` accepts
   `channelFallback`; rewritten `ImportWizard` handles multiple files
   sequentially with per-file mapping confirmation + fallback tag.
7. **Manual entry**: import page restructured — manual entry prominent
   next to CSV import (existing `upsertManualEntry` unchanged).
8. **Platform connections** (`lib/platforms.ts`, per-client panel):
   Google Ads / Meta Ads / GA4 / LinkedIn Ads / TikTok Ads mapping,
   credential slot per client/platform, connection states, last-sync,
   per-platform + sync-all. **Live imports stay inactive without real
   provider credentials + adapters** — the UI and README say so plainly;
   sync attempts log honestly instead of pretending.
9. **Budget pacing** (`lib/pacing.ts`): monthly budgets per client
   (optional per channel), spend-vs-pro-rata-expected bar, on-track/over/
   under/no-budget states; pacing feeds health scoring.
10. **Onboarding templates** (`lib/templates.ts`): PPC-only / SEO+PPC /
    full-service; applied at client creation (`POST /api/clients`
    `template` field) → sets `clients.template`, creates an active monthly
    delivery schedule.
11. **Funnel + channel analytics** (`lib/funnel.ts`, `/api/.../funnel`):
    impressions → clicks → conversions → revenue with stage rates, plus
    per-channel spend/conversion share.
12. **Health score** (`lib/health.ts`, `/api/health`): 0–100 from last-30d
    anomaly counts weighted by severity (critical −15, warning −8,
    info −3, cap −40) + conversion/CPA trend + budget pacing + reporting
    engagement. Flags healthy ≥75 / watch ≥50 / at-risk. Clickable driver
    breakdown. **Never depends on alert read state** (verified: scores
    identical before/after marking an alert read).
13. **Scheduled delivery** (`/delivery`, `lib/schedules.ts`): weekly/
    monthly schedules, recipient validation, send-now queue, send history
    (`email_log`). **No mail server in this environment** — sends log as
    `queued` with an honest note; SMTP settings in Settings (owner).

### Schema additions (all in `lib/db.ts` SCHEMA, `IF NOT EXISTS`)
alerts, alert_thresholds, reports, invoices, invoice_items,
platform_connections, budgets, report_schedules, email_log;
migrations: `users.avatar`, `clients.template`. `wipeAll()` clears them.

### Seed additions
2 demo alerts with real computed values, current-month budgets (one
deliberately over pace to demo the warning), 2 disconnected platform
mappings per active client, 1 sample invoice (INV-0001), 1 monthly
delivery schedule.

### Verified (2026-10-10, production `npm start`, fresh DB)
- [x] `npx tsc --noEmit` clean; `npm run build` clean (17 routes)
- [x] Fresh-boot auto-seed incl. all new tables (alerts=2, budgets=3,
      invoice=1, schedule=1, connections=6)
- [x] All 3 role logins; v1 gating preserved (client 404 on others'
      dashboards, redirected off /alerts /invoices /team /settings;
      manager API lists only assigned clients 1,2,3)
- [x] New pages render 200 for owner: /, /account, /alerts, /invoices,
      /invoices/new, /reports, /delivery, /clients/1, /clients/1/import,
      /team, /settings
- [x] Overview shows health scores (82/87/80/100 demo) + batch panel
      with 30/90/180/all presets; dashboard shows performance summary,
      funnel, pacing, platforms, budgets panels
- [x] Batch 90-day (2026-07-12→2026-10-09) stored with exact 90-day
      boundaries in the library
- [x] Invoice CRUD: create (totals 3100/310/3410 @10% tax), status
      change, owner-only delete
- [x] Import: channelFallback tags rows ("LinkedIn Ads"); re-import
      idempotent (spend unchanged 2378.79)
- [x] Health scores identical before/after marking alert read
- [x] Account: name change, wrong-password rejected (403), correct
      change accepted; schedule send logs "queued — no mail server"
      honestly; platform sync returns honest inactive message
- [x] No server errors in log; zero AI/build-origin mentions (grep)
- [x] Dockerfile port 3000 reconciled with compose

### Known limitations (carried + new)
- Docker daemon unavailable here: `docker compose up` not executed;
  Dockerfile mirrors the proven pattern; watch the first real compose up.
- No headed-browser visual check (loopback). New pages verified via
  rendered HTML + API data; eyeball once in a real browser.
- Live platform imports + real email delivery are deploy-time tech-team
  steps (documented in README); the demo honestly reports inactive state.
- Charts remain hand-rolled SVG; avatars downscaled to 256px JPEG.

## v1 baseline (2026-10-09)
(Original v1 notes preserved below.)

## What it is
White-label client reporting dashboard for mid-size marketing agencies.
Next.js 15 + React 19 + SQLite (better-sqlite3) + Docker Compose one-command deploy.
No external services, no API keys, no network calls at runtime.

## Local run
- `docker compose up --build` → http://localhost:3000 (Docker not available in
  this build environment, so verification was done with `npm run build` +
  `npm start`, which is exactly what the Dockerfile runs.)
- Fresh boot auto-seeds the demo dataset (see below) when the DB is empty.

## Demo logins (seeded on fresh install)
- Owner: `owner@demo.agency` / `demo1234` — full access, branding, team, reset
- Manager: `manager@demo.agency` / `demo1234` — assigned clients only (3 of 4 demo clients)
- Client: `client@demo.agency` / `demo1234` — read-only, sees only "Northwind Outdoors"

Demo data: 4 clients (3 active + 1 paused), ~1,790 daily metric rows across
6 months, Google/Meta/TikTok/Email/Display channels. Wipe via Settings →
"Remove all client data" (keeps users/branding) or "Restore demo dataset"
(full wipe + re-seed).

## Verified working (2026-10-09, production `npm start`)
- [x] `npm run build` clean (after fixing: TS 7→5 downgrade, `@/` alias →
      relative imports — the alias fails to resolve in this env's webpack,
      relative imports are bulletproof everywhere; `force-dynamic` on
      DB-touching routes so build-time prerender doesn't hit a missing DB)
- [x] Fresh-boot auto-seed: 3 users, 4 clients, 1790 metric rows
- [x] All 3 role logins; wrong password rejected
- [x] Role gating: client gets 404 on other clients, redirected off /team and
      /settings; manager API lists only assigned clients; manager cannot
      reassign clients (403); owner-only routes 403 for others
- [x] CSV auto-detect on a messy sample (mixed header names, MM/DD/YYYY +
      ISO dates, `$`/`1,234` amounts): 8/8 columns mapped correctly
      (7 high + 1 medium confidence)
- [x] CSV commit: 10 imported, 2 skipped with field-level reasons
      (bad date, non-numeric spend); totals verified by hand ($9,713.05 spend)
- [x] Re-import of same file is idempotent (totals unchanged, no duplicates)
- [x] Metrics API: KPIs + derived CTR/CPC/CPA/ROAS, 6-point trend, channel
      breakdown, previous-period comparison
- [x] Dashboard page renders with SVG trend chart; metric toggle works
- [x] Report page renders (fixed a server→client function-prop serialization
      bug), SVG chart present, print stylesheet present
- [x] Manual metric entry saved and visible in trend
- [x] White-label settings update reflected on login page immediately
      (agency name + primary color), then restored
- [x] Reset endpoint: full wipe + re-seed restores pristine demo state
- [x] No "AI" or build-origin mentions anywhere in UI, code, or docs
- [x] Clients CRUD, team CRUD (disable kills sessions), contacts shown

## Known limitations / untested behaviors
- Docker daemon is not available in this build environment, so
  `docker compose up` itself was NOT executed. The Dockerfile and compose
  file mirror the proven OFM Command Center pattern (same base image,
  same build steps, `serverExternalPackages: ['better-sqlite3']`); risk is
  low but a first `docker compose up --build` on a machine with Docker
  should be watched once.
- No visual browser check was possible (no headed browser in this env).
  Layout verified via rendered HTML structure + API data; CSS is
  hand-written and responsive (sidebar collapses under 860px), but eyeball
  the dashboard once in a real browser before demoing to a buyer.
- Charts are hand-rolled SVG (no chart library): hover tooltips work via
  mouse events; touch devices get the static chart without tooltips.
- CSV date parsing accepts YYYY-MM-DD and M/D/YYYY only. Ambiguous
  D/M/YYYY (e.g. 13/02/2026 is fine, but 02/03/2026 reads as Feb 3) is
  interpreted US-style — documented on the import screen.
- v1 has no ad-platform API connectors (GA4/Google Ads/Meta) — CSV +
  manual entry only. The metrics table is connector-ready (source column).
- Logo upload capped at ~350KB, stored as data URL in SQLite.
- Client-role users whose client is deleted keep their login but see
  nothing (client_id set NULL) — disable/remove the account in Team.
- Passwords: PBKDF2-SHA-256, 120k iterations. No password-reset flow in
  v1 — owners set/reset passwords in Team.
