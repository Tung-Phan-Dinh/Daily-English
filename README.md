# Daily English

A laptop-first web app that gives one Vietnamese learner a 25-minute daily English session — review, grammar, new words, a reading micro-passage and a mini writing task with AI feedback — plus a phone-first, read-only progress dashboard for the family.

**Stack:** Next.js 16 (App Router, TypeScript strict) · Supabase (Auth + Postgres + RLS) · OpenAI Responses API (structured outputs, zod-validated) · ts-fsrs (FSRS-6) · Tailwind v4 + shadcn/ui · Recharts · Vitest · Playwright.

## Accounts

The app has exactly three accounts. Public sign-up is disabled and there is no email: users sign in with email + password.

| Role | Email | Can do |
| --- | --- | --- |
| Admin | `admin@dailyenglish.app` | Admin page (approval queue, AI spend, learner time zone, session reset), family view, settings |
| Viewer | `parent@dailyenglish.app` | Family dashboard (read-only, Vietnamese by default) |
| Learner | `hung@dailyenglish.app` | Daily session, dictionary, My words, Grammar map, My progress, placement |

Passwords live only in environment variables (`ACCOUNT_*_PASSWORD`) and are never committed. `npm run accounts` creates or updates the accounts (it also resets their passwords to the values in the environment). `npm run accounts -- --prune` additionally deletes any other auth user.

## Local development

Requires Node 22+, Docker and the Supabase CLI.

```bash
npm install
```

```bash
supabase start
```

This uses ports 544xx (see `supabase/config.toml`) so it can run next to other local Supabase projects.

```bash
supabase db reset
```

```bash
npm run seed
```

```bash
npm run accounts
```

```bash
npm run dev -- -p 3100
```

Copy `.env.example` to `.env.local` first and fill it in (local Supabase keys come from `supabase status -o env`). Without `OPENAI_API_KEY` everything still runs: open answers fall back to the answer list and writing is queued for grading later.

## Production (Vercel + Supabase)

1. **Supabase project:** create one, then link and apply migrations.
   ```bash
   supabase link --project-ref <ref>
   ```
   ```bash
   supabase db push
   ```
2. **Auth settings** in the Supabase dashboard (Authentication → Sign In / Providers):
   - Email provider: **enabled** (needed for password sign-in).
   - **Allow new users to sign up: off.**
   - Confirm email: off (accounts are created pre-confirmed by the script).
   - If *Leaked password protection* is on, weak passwords such as `12345678` may be rejected — use stronger ones.
3. **Seed content and accounts** against production (put the production values in a local, untracked `.env.production.local`):
   ```bash
   node --env-file=.env.production.local scripts/seed-content.ts
   ```
   ```bash
   node --env-file=.env.production.local scripts/accounts.ts --prune
   ```
4. **Vercel:** import the repo, then add the environment variables from `.env.example` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL_FAST`, `OPENAI_MODEL_GRADER`, `CRON_SECRET`, `AI_DAILY_CALL_LIMIT`, `AI_MONTHLY_BUDGET_USD`). The `ACCOUNT_*` variables are only needed where you run the accounts script, not on Vercel.
5. **OpenAI:** set a monthly budget limit in the OpenAI dashboard as a second guard (the app also stops at `AI_MONTHLY_BUDGET_USD`).

### Scheduled jobs (`vercel.json`, all protected by `CRON_SECRET`)

| Route | When (UTC) | What |
| --- | --- | --- |
| `/api/cron/daily` | 21:30 daily (04:30 in Vietnam) | Keeps the free Supabase project awake, marks unfinished sessions `partial`, grades writing queued while OpenAI was down, snapshots vocabulary |
| `/api/cron/ingest` | 22:00 daily | Polls the OpenAI Batch job, validates (evidence offsets, vocabulary coverage, blind answer check) and inserts next week's content as drafts |
| `/api/cron/weekly-content` | Sunday 02:00 | Submits next week's passages, items and writing tasks via the Batch API |
| `/api/cron/weekly-summary` | Sunday 08:00 (Sunday evening in Melbourne) | Writes the five-sentence family summary in English and Vietnamese |

## Content scripts

| Command | What it does | Cost |
| --- | --- | --- |
| `npm run seed` | Topics, 24 grammar points, 192 items, week-1 vocabulary/reading/writing, a starter dictionary | Free |
| `npm run content:wordlists -- --ngsl NGSL_1.2.csv --nawl NAWL_1.2.csv` | Imports NGSL/NAWL (CC BY-SA 4.0) for placement, coverage checks and NAWL vocab items | Free |
| `npm run content:dictionary -- --vi vi-extract.jsonl.gz [--en en-extract.jsonl.gz]` | Builds 30–40k dictionary rows from kaikki.org Wiktextract dumps | Free |
| `npm run content:topic-vocab [-- --topic environment]` | Generates ~60 words/collocations per IELTS topic (drafts) | ~US$0.05/topic |
| `npm run content:items [-- --target 20]` | Fills grammar item banks with blind-validated drafts | ~US$0.02/point |

Generated content appears in **Admin → Content approval queue**; anything not reviewed goes live after 24 hours.

## Tests

```bash
npm test
```

Unit tests (Vitest): FSRS rating mapping, day boundaries, session builder, answer normalisation, offset validation, mastery and streak rules.

```bash
npm run test:rls
```

RLS tests against local Supabase: a viewer cannot insert, update or delete anything; hidden writing stays hidden; learners can only write to today's open session. Test users are created and deleted automatically.

```bash
npm run test:e2e
```

Playwright (uses installed Google Chrome; set `E2E_BASE_URL` if your dev server isn't on port 3100): a full session on a laptop viewport including resume-after-reload and the one-session-per-day rule, keyboard-only operation, and the family dashboard on a 390px phone.

## Credits

NGSL and NAWL by Browne, Culligan and Phillips (CC BY-SA 4.0). Dictionary data from Wiktionary via kaikki.org (CC BY-SA). Scheduling by ts-fsrs (FSRS-6). Writing feedback guided by the public IELTS Writing band descriptors (paraphrased); band numbers are AI estimates, not official scores.
