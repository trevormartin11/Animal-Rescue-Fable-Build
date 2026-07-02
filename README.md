# Biscuit 🦴

**Rescue giving, handled.** Biscuit is the case tracker for the Rowley Family
Charitable Giving Trust's animal-rescue giving — the 10–15 requests a month that
arrive from [PACC 911](https://pacc911.org) asking for help with a vet bill.

## What it does

1. **Watches a dedicated Gmail inbox.** When Bari or Doug from PACC 911 emails a
   request, Biscuit reads it, extracts the case (animal, owner, vet, cost), and
   creates it automatically.
2. **Queues the reply.** Every new case gets a warm, personalized introduction
   email to the animal's owner — created as a *draft in Gmail* (BCC to PACC 911),
   so Chelsea just reviews and hits send. Denials: delete the draft, log the
   reason in Biscuit.
3. **Tracks the workflow.** New → Accepted → Owner contacted → On vet account →
   Paid → Closed, with a dashboard showing exactly what's waiting on whom.
4. **Handles receipts.** Emailed receipts are matched to their case, filed, and
   auto-forwarded to the Dext accounting address. Screenshots can be uploaded and
   are forwarded the same way.
5. **Reports the giving.** Yearly/monthly totals, average per case, per-owner
   history, PDF export, and an optional monthly recap email to the family.

## Stack

- **Next.js 16** (App Router) on Vercel
- **Supabase** — Postgres (isolated `biscuit` schema), auth, storage
- **Gmail API** — inbox ingestion, draft creation, forwarding (dedicated mailbox only)
- **Claude API** (`claude-opus-4-8`) — email parsing, draft writing, recap narrative
- **@react-pdf/renderer** — giving report PDFs

## Environment

Copy `.env.example` to `.env.local` and fill in:

| Variable | What |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project |
| `SYSTEM_USER_EMAIL` / `SYSTEM_USER_PASSWORD` | background-job account (allow-listed in `biscuit.app_users`) |
| `ANTHROPIC_API_KEY` | Claude API key for parsing/drafting |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth client (Gmail API enabled, redirect `{APP_URL}/api/gmail/oauth/callback`) |
| `APP_URL` | public URL of the app |
| `CRON_SECRET` | shared secret for `/api/cron/*` |

## Development

```bash
pnpm install
pnpm dev
```

Database schema lives in `supabase/migrations/`. The app expects the `biscuit`
schema to be exposed in PostgREST (`pgrst.db_schemas`).

## Scheduled jobs

- `/api/cron/sync` — inbox check (Vercel cron daily as backstop; a Supabase
  `pg_cron` job calls it every 10 minutes for near-real-time pickup)
- `/api/cron/recap` — monthly family recap (1st of the month)

Both require `Authorization: Bearer $CRON_SECRET`.
