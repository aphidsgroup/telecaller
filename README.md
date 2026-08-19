# Buildogram Telecalling PWA

An installable Progressive Web App for running a construction-company telecalling desk.

Telecallers see **exactly one lead at a time** and cannot move on until they have pressed Call
and logged a disposition. Admins get the opposite: total visibility — every lead, every
telecaller, and a timestamp for every action.

---

## What is in the box

**Telecaller (`/caller`)**
- One lead on screen: name, phone, project/site, city, budget, sheet notes, previous attempts.
- No lead list, no skip button, no way to reach another lead.
- `Call` fires a `tel:` link and logs a timestamped *call button clicked* event. The disposition
  form stays locked until that happens.
- Submitting the disposition closes out the lead and loads the next one in the same request.
- A lead you were holding when the app closed or the signal dropped comes straight back to you —
  it is never silently released to the pool.
- Offline: the disposition is queued in IndexedDB and replayed when the connection returns.
  A *new* lead is never handed out while offline, so two people can never work the same lead.

**Admin (`/admin`)**
- Overview: live telecaller status (who is online, what lead they are holding right now), counters
  for due follow-ups and flagged leads, and a live activity feed.
- Leads: filter by status, telecaller, disposition, source, project, city and upload date range;
  bulk reassign; per-lead timeline (uploaded → assigned → shown on screen → call clicked → status
  updated → follow-up scheduled) with every timestamp.
- Telecallers: create/deactivate accounts, reset passwords, per-person productivity, login sessions.
- Sheet sync: every import run with row counts, duplicates and errors; duplicate resolution queue.
- Reports: conversion funnel, leaderboard, disposition/source/project breakdowns, CSV export.
- Settings: follow-up delays, working hours, weekly offs, holidays, SLA thresholds, assignment mode,
  WhatsApp template, privacy switches.

---

## Quick start

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

Open http://localhost:3000.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@buildogram.in` | `admin@123` |
| Telecaller | `priya@buildogram.in` | `caller@123` |
| Telecaller | `arun@buildogram.in` | `caller@123` |
| Telecaller | `divya@buildogram.in` | `caller@123` |

The seed loads 42 demo leads, round-robined across the three telecallers, so both sides of the app
are usable immediately without Google Sheets.

> Change these passwords before anyone real signs in.

---

## Configuration (`.env`)

```ini
DATABASE_URL="file:./dev.db"          # SQLite locally; a postgres:// URL in production
JWT_SECRET="at-least-32-random-chars"
CRON_SECRET="random-string"           # protects /api/cron/tick
SHEETS_WEBHOOK_SECRET="random-string" # protects /api/webhooks/sheets

# Option A - Sheets API v4 with a service account
GOOGLE_SHEET_ID=""
GOOGLE_SHEET_TAB="Leads"
GOOGLE_SERVICE_ACCOUNT_EMAIL=""
GOOGLE_PRIVATE_KEY=""                 # keep the \n escapes from the JSON key file

# Web push (npm run vapid generates these)
VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
VAPID_SUBJECT="mailto:admin@yourcompany.com"
```

Everything operational — follow-up delays, working hours, SLA limits, assignment mode — lives in
**Admin → Settings**, not in env vars, so it can be changed without a deploy.

---

## Lead ingestion

The master sheet keeps its fixed columns: `Name, Phone Number, Alternate Phone, Source,
Project/Site of Interest, City/Area, Budget Range, Notes, Date Added`. Headers are matched
case/spacing-insensitively, so a slightly renamed or reordered column still imports.

**Option A — Sheets API (pull).** Add the service-account credentials above, share the sheet with
that service-account email (Viewer), then set the sheet ID in Admin → Settings. The cron tick polls
it on the configured interval; **Sync now** on the Sheet sync page runs it on demand.

**Option B — Apps Script webhook (push).** Paste `docs/google-apps-script.js` into the sheet's
Apps Script editor, set `WEBHOOK_URL` / `WEBHOOK_SECRET` in script properties, and add a
time-driven (or on-change) trigger. No Google credentials live in the app at all.

Both paths run through the same ingestion pipeline:

1. Validate the phone number (10 digits, Indian mobile prefix). Bad rows are counted and listed in
   the import log rather than dropped silently.
2. De-duplicate on the normalised phone number, **within the batch and against the whole database**.
   A duplicate is *flagged* for the admin — it never creates a second lead record. The admin can
   ignore it, merge its notes into the original, or deliberately create it as a separate lead.
3. Score the lead (budget, source, notes intent) so hot leads jump the FIFO queue.
4. Write a `LEAD_UPLOADED` timeline event, then distribute the pool by round robin or rules.

Every run is logged with a timestamp, source sheet/tab, row count, inserts, duplicates and errors.

---

## The one-lead-at-a-time engine

`src/lib/queue.js` — `serveCurrentLead(userId)`:

1. If the telecaller is already holding a lead (`ACTIVE` or `IN_PROGRESS`), that same lead comes
   back. This is what makes a closed app, a reload or a dead network safe.
2. Otherwise the top eligible lead in *their own* queue is locked to them with a conditional
   `updateMany`, so two requests can never claim the same lead.
3. Ordering: admin priority first, then due callbacks (a promised time is a commitment), then lead
   score, then FIFO.
4. If their queue is empty, a lead is optionally pulled from the central pool.

Lead status flow:

```
UNASSIGNED → ASSIGNED → ACTIVE → IN_PROGRESS → SCHEDULED → (ACTIVE again when due)
                                              ↘ CLOSED
```

Server-side guards, not just UI:
- The disposition endpoint rejects a submit unless the call button was pressed (`409`).
- A lead can only be acted on by the telecaller it is assigned to (`403`).
- Every disposition carries a `clientEventId`; replays are idempotent.
- A lead sitting `IN_PROGRESS` past the configured threshold is auto-flagged for admin review —
  and stays with its telecaller rather than being yanked back.

---

## Follow-up scheduling

`src/lib/schedule.js` turns a call category into a real date:

| Call category | Result |
| --- | --- |
| Call Me After Some Time | `+N` hours (admin-configurable, default 3) |
| Call Me Tomorrow | next day at the default callback time |
| Call Me Next Week | `+7` days |
| Call Me Next Month | `+1` month |
| Call Me Monday | the next Monday |
| Call Not Answered | retry after `N` hours, auto-closing after the attempt limit |

Every result is then pushed into the next valid working slot: inside working hours, not on a weekly
off, not on a company holiday. A terminal lead status (Not Interested, Converted, Wrong Number,
Duplicate) closes the lead instead, whatever the call category says.

Verify it with `npm run test:schedule` (12 checks covering Sunday skipping, holidays and after-hours
rollover).

---

## Scheduled jobs

`GET|POST /api/cron/tick` (auth: `Authorization: Bearer $CRON_SECRET` or `?secret=`) does one pass:
poll the sheet, distribute the pool, push due-follow-up reminders, auto-flag stale in-progress
leads, raise SLA alerts.

- **Vercel:** `vercel.json` already schedules it every 5 minutes; set `CRON_SECRET` in the project
  and Vercel sends the bearer token automatically.
- **Anywhere else:** `APP_BASE_URL=https://... CRON_SECRET=... node scripts/worker.mjs`.

---

## PWA behaviour

- `public/manifest.webmanifest` + a hand-written `public/sw.js` (no build plugin, so nothing is
  magic): navigations are network-first with an offline fallback, static assets are
  stale-while-revalidate, and **API responses are never cached** — a stale lead is worse than no
  lead.
- Web Push for new assignment / follow-up due / reassignment, with Background Sync used to flush the
  outbox when the OS reports the connection is back (the `online` listener does the same job where
  Background Sync is unavailable).
- Install prompt on the telecaller screen; icons are generated by `npm run icons`.

**Known limitation, by design of the web platform:** a `tel:` link only opens the dialler. The app
cannot detect whether the call connected, how long it lasted, or record it. Everything reported here
is "the call button was pressed at this timestamp". Verified call tracking needs either a native
Android app with telephony permissions or a cloud-telephony provider (Exotel, Knowlarity, Twilio)
replacing click-to-dial.

---

## Compliance and privacy

- Per-user logins with role-based access enforced in middleware *and* in every API route — without
  that, timestamps would mean nothing.
- Append-only history: dispositions and timeline events are never updated or deleted. An admin
  override writes a new attributed row.
- Leads can be marked DND; DND numbers are suppressed before they ever reach a telecaller screen and
  the call endpoint refuses them. Indian promotional calling is regulated under TRAI's TCCCP rules —
  scrub your lists against the DND registry and keep consent records.
- Phone numbers can be masked in CSV exports (Admin → Settings), and every export is written to the
  audit log with who ran it and over what range.

---

## Deployment

**Vercel + a hosted Postgres (Supabase/Neon/Railway)** is the shortest path:

1. In `prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"`.
   No other schema change is needed — enums are modelled as strings deliberately.
2. Set `DATABASE_URL` and the rest of the env vars in the Vercel project.
3. `npx prisma db push` against the production database, then run the seed (or create the first
   admin manually) once.
4. Deploy. `vercel.json` wires the cron.

Serve over HTTPS — service workers, install prompts and web push all require it.

---

## Project layout

```
prisma/schema.prisma        data model (SQLite + Postgres compatible)
prisma/seed.mjs             demo admin, telecallers and leads
src/lib/queue.js            one-lead-at-a-time engine, assignment, round robin
src/lib/workflow.js         call click, disposition, admin override, SLA scans
src/lib/schedule.js         working-hours/holiday-aware follow-up dates
src/lib/sheets.js           Sheets API + webhook ingestion, validation, de-duplication
src/lib/offline-queue.js    IndexedDB outbox for offline dispositions
src/app/caller              telecaller screen
src/app/admin               admin dashboard
src/app/api                 REST endpoints (auth, telecaller, admin, webhook, cron, push)
public/sw.js                service worker: offline shell, background sync, push
docs/google-apps-script.js  sheet-side push script
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | development server |
| `npm run build` / `npm start` | production build and serve |
| `npm run db:push` / `db:seed` / `db:studio` | schema, demo data, Prisma Studio |
| `npm run db:reset` | wipe the local SQLite file and reseed |
| `npm run vapid` | generate web-push keys |
| `npm run icons` | regenerate PWA icons |
| `npm run test:schedule` | follow-up scheduling unit checks |
| `npm run test:e2e` | end-to-end API checks against a running server |
| `npm run worker` | self-hosted cron replacement |
