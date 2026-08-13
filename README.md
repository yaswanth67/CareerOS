# CareerOS

An AI-powered job matching app that pulls live **US** jobs from real job boards, parses your resume, and **scores how well you match each job** — with reasoning, matched skills, and missing skills. It also writes the application for you: tailored CV, cover letter, outreach emails, interview prep and follow-ups, per job.

Built with Next.js 16 (App Router), Prisma + SQLite, NextAuth, and the **Anthropic SDK pointed at your local Claude Code connection** (no cloud API key required).

> **Scope: United States only.** Non-US postings are rejected at ingest and filtered out of every query — see [US-only](#us-only).

---

## What this project does

| # | Feature | How it works |
|---|---------|--------------|
| 1 | **Fetch live jobs** | Pulls real postings from **Greenhouse** (Airbnb, Stripe, Coinbase, Instacart, Lyft, Datadog, etc.), **Ashby** (OpenAI, Snowflake, Notion, ElevenLabs, …), **Lever**, direct **company career-page APIs** (Amazon), plus high-volume public job boards: **Remotive, RemoteOK, Arbeitnow, and Jobicy** — ~10k jobs per fetch |
| 2 | **Parse resumes** | Upload a `.pdf`, `.docx`, or `.txt` resume. AI extracts skills, work experience, and education (heuristic fallback if the AI is unavailable) |
| 3 | **Auto match scoring** | Jobs are scored **automatically** against your most recent resume the moment they're fetched — a fast heuristic scorer (thousands of jobs in well under a second, no LLM call) — so every card shows a match %, reasoning, and matched/missing skills with no manual step. AI scoring is available for deeper reasoning |
| 4 | **Filters** | Filter by keyword, **company** (autocomplete), role type, experience level (**New Grad** / Senior quick chips), location, remote-only, **posted within (24h / 48h / 7 days)**, status (All Jobs / Saved / Applied), **visa sponsorship**, and minimum match score. Feed shows the **newest jobs first**, paginated with a **Load More** button to browse all of them |
| 5 | **Visa sponsorship (AI-detected)** | Every job is classified for visa sponsorship — a keyword pre-screen catches the obvious "we do / do not sponsor" statements, and **Claude AI** reads the rest. A green **Visa sponsorship** badge appears on confirmed sponsors, and the Sponsorship filter shows only those jobs |
| 6 | **Dashboard** | Real stats (total jobs, active jobs, strong matches) and a full-width vertical job feed. Filters **persist when switching tabs** |
| 7 | **Target filters** | Save any number of named filters on the Preferences tab — target roles, preferred locations, excluded keywords, and work preferences (remote / sponsorship / min salary). The dashboard's **Advanced Filters** offers them as a dropdown; with none saved, that button takes you to Preferences to create one |
| 8 | **Applications** | Save jobs, mark **Applied** (auto-tracked via the **"Have you applied?"** popup when you return from an apply link), move through the pipeline (SAVED → APPLIED → INTERVIEWING → OFFER / REJECTED), and add notes. **Applied jobs leave the All-Jobs feed** (still under the Applied filter) and can be reverted to "not applied" |
| 9 | **Scheduled fetch** | `GET /api/cron/fetch-jobs` (protected by `CRON_SECRET`) re-fetches jobs idempotently, **auto-scores every user's jobs**, checks apply links, deactivates stale ones, and **classifies a batch of jobs for visa sponsorship** |
| 10 | **US-only ingest** | Every posting is classified by location at fetch time; non-US jobs never enter the database, and jobs that move abroad are deactivated. Every read path filters on it in SQL so pagination totals stay honest |
| 11 | **Level-aware ranking** | Seniority is read from the job title, and matches are ranked against **your** level — an exact-level role outranks a senior one with the same skill overlap, so a mid-level candidate doesn't get a feed full of Staff roles |
| 12 | **Role suggestions** | Scans your resume and proposes adjacent job titles at your level, then shows **real US postings** for each one, scored against your resume and linking to the employer's own application page |
| 13 | **AI Career toolkit** | Open any saved job and get the full [career-ops](https://career-ops.org) methodology against it: fit report, tailored CV, cover letter, five email variants (HR, cold outreach, referral request, stalled process, no-show), LinkedIn note, interview prep, follow-up plan and an upskill map — each copyable and downloadable |

### How the AI connection works

This app is configured to use **your local Claude Code connection**, not the Anthropic cloud API:

```env
ANTHROPIC_BASE_URL="http://localhost:20128"   # local Claude Code proxy
ANTHROPIC_AUTH_TOKEN="dummy"                  # accepted by the local proxy
ANTHROPIC_MODEL="auto/best-coding-fast"       # model the proxy serves
```

Every AI feature constructs the Anthropic SDK client from `ANTHROPIC_AUTH_TOKEN || ANTHROPIC_API_KEY`. Matching, resume parsing and sponsorship detection fall back to heuristics when a call fails or returns empty, so the core app keeps working offline. The career-ops features generate prose and have no fallback — they surface an error instead of inventing one.

> Note: the local proxy returns a `thinking` content block before the `text` block, so all parsers find the `text` block explicitly (`response.content.find(b => b.type === 'text')`).

> **These calls are slow.** A career-ops generation runs for **4–6 minutes** against the local connection (measured: a resume scan takes ~263s). Timeouts live in one place — `src/lib/career-ops/timeouts.ts` — with the browser's abort deliberately just under the SDK's ceiling. Don't lower them: a shorter client abort silently kills work the server has already completed.

---

## US-only

The app targets the US market, and that is enforced in three places rather than as a UI filter:

| Layer | Behaviour |
|-------|-----------|
| **Ingest** | `isUsJob()` (`src/lib/geo/us-location.ts`) classifies every posting by location before it is written. Non-US postings are never stored; a stored job whose location moves abroad is deactivated rather than refreshed |
| **Queries** | Every read path spreads `US_ONLY_WHERE` into its Prisma `where`. Filtering in SQL rather than in JS keeps pagination counts correct |
| **Backfill** | `npm run purge:non-us` re-classifies existing rows (dry-run by default, `-- --apply` to commit) |

Postings whose location names no country at all are also rejected — an unlabelled location is far more often a foreign listing than a US one. The classifier is covered by `tests/us-location.test.mjs` (95 assertions).

---

## The AI Career page

`/ai` merges the resume-driven tools into one place, and every saved job carries the same toolkit.

**Role suggestions** scan your resume, propose adjacent titles at your level, and list real US postings for each — scored against your resume, each linking to the employer's official application page. Save one and it lands in Applications.

A scan runs for minutes, so it is **not owned by the page**: the request is parked in `src/lib/career-ops/scan-registry.ts`, which lives as long as the browser tab. Navigate to the dashboard and back and you rejoin the same run — the elapsed counter picks up where it actually is, and no second scan starts. (A hard reload still discards it; the request belonged to the page that issued it.) Finished suggestions are cached in `localStorage`, so they are there on your next visit.

**The toolkit** opens from any saved job on `/applications` (the **Toolkit** button) and covers nine modes:

| Mode | What it produces |
|------|------------------|
| Description | The stored posting text |
| Fit report | career-ops A–G evaluation with a 0–5 score. **Writes a numbered report and a tracker row into the career-ops workspace** — the only mode that isn't read-only |
| Tailor CV | Your resume rewritten for the posting. Reorders and reframes; never invents experience |
| Cover letter | Tailored letter with the posting's own keywords |
| Email | Five variants: HR application, cold outreach, referral request, stalled process, interview no-show. **Draft only — nothing is ever sent for you** |
| LinkedIn note | Short first-person outreach to a recruiter or hiring manager |
| Interview prep | Likely rounds, who you meet, questions to expect |
| Follow-up | Cadence and draft touchpoints after applying |
| Upskill | Skill gaps across your pipeline, weighted by frequency |

Each result is copyable and downloadable as markdown. Results are cached per mode for the life of the drawer, so switching tabs doesn't re-spend minutes of model time. A resume-version picker applies to every mode.

---

## How matching works

Scoring is a fast heuristic (`src/lib/ai-matcher`) — thousands of jobs in well under a second, no LLM call — over four weighted signals:

| Signal | Weight | Notes |
|--------|--------|-------|
| Skill overlap | 40% | Resume skills ∩ job skills |
| Experience relevance | 25% | Shared vocabulary between resume and posting |
| Role alignment | 20% | Resume text vs the job's role type |
| **Seniority fit** | 15% | Your level vs the job's level |

**Seniority is the part worth understanding.** A job's level comes from its title (`src/lib/job-providers/experience-level.ts`) — before that it came from a field almost no board sends, so 99% of postings defaulted to `MID` and "Staff Frontend Engineer" ranked as mid-level. A provider's own field is used only when it carries a real signal: Ashby, Remotive and Arbeitnow put an *employment* type there ("FullTime", "full_time"), which classifies to `MID` and used to shadow the title, silently re-flattening every posting from those boards. Your own level is inferred from your resume: stated years of experience first, then held titles, defaulting to `MID` when neither appears.

Scores then scale down for roles above your level (×0.9 one level up, ×0.75 two, ×0.6 beyond), so an out-of-reach posting stays visible but cannot outrank a comparable role you could actually get. Each card explains the verdict — *"Seniority (MID): matches your level"* or *"well above your level"*.

Re-derive levels and rescore after changing any of this:

```bash
npm run reclassify:levels              # dry run — reports what would change
npm run reclassify:levels -- --apply --rescore
```

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router, React 19) |
| Database | SQLite + Prisma ORM |
| Auth | NextAuth v4 (Credentials provider, JWT sessions) |
| AI | `@anthropic-ai/sdk` → local Claude Code connection |
| Forms / validation | React Hook Form + Zod |
| Styling | Tailwind CSS + lucide-react icons |
| File parsing | `pdf-parse`, `mammoth` (PDF / DOCX / TXT) |
| Extras | react-hot-toast, date-fns, dnd-kit (installed) |

---

## Quick start

### Prerequisites

- Node.js 20.9+ (Next.js 16 requirement; tested on Node 24)
- npm
- The **Claude Code local connection on `http://localhost:20128`**. Two different levels of need:
  - *Optional* for matching and resume parsing — both fall back to heuristics, so the app is fully usable without it.
  - *Required* for everything on the [AI Career page](#the-ai-career-page) and the per-job toolkit. There is no fallback for generated prose; those features report an error when the connection is down.

### 1. One-command setup

```bash
npm install
```

…or the explicit form (identical result):

```bash
npm run setup
```

Both run the whole first-run flow automatically and are **safe to re-run** — every step is a no-op when already done. `npm install` triggers it for you through its `postinstall` hook; `npm run setup` is the explicit form and is the one to reach for when your shell exports `NODE_ENV=production` (see [Setup in detail](#setup-in-detail)).

The flow:

| # | Step | What it does |
|---|------|--------------|
| 1 | `.env` bootstrap | Copies `.env.example` → `.env` with freshly generated `NEXTAUTH_SECRET` / `CRON_SECRET` (skipped if `.env` exists) |
| 2 | Install dependencies | `npm install --include=dev` — dev deps **included**, even when the shell exports `NODE_ENV=production` |
| 3 | Prisma client | `prisma generate` — generates the type-safe client from `prisma/schema.prisma` |
| 4 | Database schema | `prisma db push` — creates the SQLite `dev.db` from the schema |
| 5 | Seed data | `npm run db:seed` — idempotent sample user, target filter, jobs, matches, applications |
| 6 | Career-ops workspace | Installs `./career-ops` (deps + modes) so the app's Career Ops features work out of the box |

> **Career Ops extras:** the app itself doesn't need the Playwright browser — only the career-ops CLI's PDF flow does. Install it on demand with `cd career-ops && npx playwright install chromium`.

For the full explanation — how the `postinstall` hook works, the `NODE_ENV=production` gotcha, and the career-ops workspace — see [Setup in detail](#setup-in-detail).

### 2. Run it

```bash
npm run dev
# → http://localhost:3000
```

Sign in with the seeded account, or register your own:

- **Name:** `buddy`
- **Password:** `qwerty@1`

> **macOS / Linux gotcha:** if your shell exports `NODE_ENV=production` or `PORT=…`, `next dev` can misbehave. The `dev` script forces `NODE_ENV=development` and pins port `3000` so this doesn't happen. If you ever run Next directly, use `NODE_ENV=development next dev -p 3000`.

### 3. Production

```bash
npm run build         # production build (verified passing)
npm run start         # serve on http://localhost:3000
```

---

## Setup in detail

### What the one command actually does

Both `npm install` and `npm run setup` end up running `scripts/setup.mjs` — a single idempotent script that takes a fresh clone to a fully running app in six steps:

1. **`.env` bootstrap** — if `.env` is missing, it's created from `.env.example` with two fresh secrets: `NEXTAUTH_SECRET` (32 random bytes, base64) and `CRON_SECRET` (24 random bytes, hex). An existing `.env` is never touched, so your custom values survive re-runs.
2. **Dependency install** — `npm install --include=dev`. The `--include=dev` is deliberate: if your shell exports `NODE_ENV=production`, a plain `npm install` silently skips devDependencies (`prisma`, `tsx`, `typescript`, `tailwindcss`, …), which would break both the dev server and the seed step. This flag forces them in regardless.
3. **Prisma client** — `npx prisma generate` produces `@prisma/client` from `prisma/schema.prisma` before anything touches the database.
4. **Database schema** — `npx prisma db push` creates/updates the local SQLite file (`prisma/dev.db`). Because SQLite is a single file, there are no migration files to manage.
5. **Seed** — `npm run db:seed` inserts the sample data (idempotent): the `buddy` account, a sample target filter, jobs, matches, and applications. Resumes are uploaded by the user, never seeded.
6. **Career-ops workspace** — ensures `./career-ops` exists and has its dependencies installed. This is the vendored tool the app's Career Ops features read their methodology from. See [The career-ops workspace](#the-career-ops-workspace).

### Two equivalent entry points

| Command | When to use |
|---------|-------------|
| `npm install` | The default. Runs setup automatically through its `postinstall` hook — you never have to remember a second command. |
| `npm run setup` | The explicit form. Use it when you want to see the full setup output on its own, or when your shell exports `NODE_ENV=production` and you're on a fresh clone — it forces dev dependencies in. |

Both are safe to re-run any number of times; every step is a no-op when already done.

### How `npm install` runs setup without recursing

`npm run setup` installs dependencies by shelling out to `npm install --include=dev`, and that child install re-fires the root `postinstall` hook — which would otherwise run the setup script again (and again). Two guards prevent that:

- **Skip-install mode** — `postinstall` invokes the setup script in a mode that skips the dependency-install step (npm just ran it), then does steps 1, 3–6. No recursion.
- **Nested-call guard** — when the child `npm install` inside `npm run setup` re-fires `postinstall`, it inherits `SETUP_ORIGIN=setup-full`, which tells the script it's a nested call under `npm run setup`. It prints a note and exits, leaving the work to the outer run.

The net effect: **every step runs exactly once** in both entry points.

### The `NODE_ENV=production` gotcha

If your shell exports `NODE_ENV=production` (common on CI and some local setups), npm treats installs as production installs and **skips devDependencies**. For this app that's a problem because the tooling that builds and seeds it — `prisma`, `tsx`, `typescript`, `tailwindcss` — all live in devDependencies.

What to do:

- **Fresh clone:** run `npm run setup` (forces dev deps with `--include=dev`), or `env -u NODE_ENV npm install && npm run setup`.
- **Plain `npm install`** on a fresh clone under this shell prints a clear warning and points you to `npm run setup`. If dependencies are already on disk, `npm install` works fully.
- `npm run dev` forces `NODE_ENV=development`, so the dev server is unaffected.

### The career-ops workspace

`./career-ops` is the [career-ops](https://career-ops.org) job-search toolkit, vendored into the repo. The app's **Career Ops** features — evaluate a posting, cover letter, interview prep, upskill, follow-up, tailor-resume — read their evaluation methodology (modes, CV, profile) live from this workspace and run it through the app's existing Claude connection, so no separate API key is needed.

- **Location:** `./career-ops` (override with the `CAREER_OPS_DIR` env var).
- **Git-ignored:** the workspace isn't committed, so setup recreates it on a fresh clone via `npx @santifer/career-ops init`.
- **Reinstall / repair:** delete it and re-run `npm run setup`, or run `npx @santifer/career-ops init` from the project root.
- **Update:** run `npx @santifer/career-ops update` from inside `./career-ops`; the app picks up the new modes on the next evaluation.
- **Optional Playwright browser:** only the career-ops *CLI's* PDF flow needs it — `cd career-ops && npx playwright install chromium`. The app doesn't require it.
- **If it's missing or setup failed:** the app still runs normally; only Career Ops features report "not installed".

### Re-running, resetting, and repairing

| I want to… | Do this |
|-----------|---------|
| Re-run setup | `npm run setup` (no-ops where already done) |
| Reset the database | `rm prisma/dev.db && npm run db:push && npm run db:seed` |
| Repair / recreate career-ops | `rm -rf career-ops && npm run setup` (or `npx @santifer/career-ops init`) |
| Re-seed only | `npm run db:seed` |
| Inspect the database | `npm run db:studio` |

---

## Environment variables

`.env.example` documents every variable. The ones that matter:

| Variable | Purpose | Default |
|----------|---------|---------|
| `DATABASE_URL` | SQLite connection string | `file:./dev.db` |
| `NEXTAUTH_SECRET` | JWT signing secret (`openssl rand -base64 32`) | — |
| `NEXTAUTH_URL` | Canonical app URL | `http://localhost:3000` |
| `ANTHROPIC_BASE_URL` | AI endpoint — **local Claude Code connection** by default | `http://localhost:20128` |
| `ANTHROPIC_AUTH_TOKEN` | Token the local proxy accepts | `dummy` |
| `ANTHROPIC_MODEL` | Model name the local proxy serves | `auto/best-coding-fast` |
| `ANTHROPIC_API_KEY` | Only needed if you switch to cloud Anthropic (leave blank for local) | *(empty)* |
| `UPLOAD_DIR` | Where uploaded resumes are written | `./public/uploads` |
| `CRON_SECRET` | Bearer token required by `/api/cron/fetch-jobs` | *(set yours)* |

> Provider API keys (`GREENHOUSE_API_KEY`, `LEVER_API_KEY`, `WELLFOUND_API_KEY`, `LINKEDIN_*`) are **not required** — the job providers in this codebase use public endpoints. They're listed for future use.

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/auth/signin`, `/auth/register` | Credentials auth |
| `/dashboard` | Stats cards + full-width vertical job feed. Filters are URL-driven (`/dashboard?q=…&posted=48`) so they survive tab switches and can be bookmarked/shared. Applied jobs are hidden from the feed |
| `/matches` | Jobs sorted by match score, with a threshold slider and a resume picker. **Tailor CV** opens per job |
| `/ai` | AI Career — role suggestions, job evaluation, and the resume-driven tools in one place |
| `/suggestions`, `/evaluate` | Direct entry points to the tabs on `/ai` |
| `/analytics` | Pipeline stats and insights |
| `/resumes` | Your resumes with expandable details |
| `/resumes/new` | Upload + AI-parse a resume (drag-and-drop) |
| `/preferences` | Target filters — create/edit/delete named filters (roles, locations, exclusions, work preferences) |
| `/applications` | Everything you've saved or applied to — change status, add notes, remove, and open the **Toolkit** |
| `/onboarding`, `/tools` | First-run flow and utility pages |
| `/privacy`, `/terms` | Static pages |

---

## API reference

All routes require a logged-in session (cookie) except `/api/auth/*`.

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account `{name, password}` (name is unique login) → 201 |
| POST | `/api/auth/[...nextauth]` | NextAuth (credentials sign-in) |

### Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs` | List jobs with filters (below) |
| GET | `/api/jobs/companies` | Distinct company names across active jobs — feeds the Company filter autocomplete |
| POST | `/api/jobs` | `{"action":"fetch"}` fetches from all providers **and auto-scores** the new jobs against your resume (also classifies a batch for visa sponsorship); `{"action":"score"}` scores every unscored active job; `{"action":"sponsorship"}` classifies the next batch of unclassified jobs (see `npm run backfill:sponsorship` for the whole DB); `{"action":"stats"}` returns stats |

**`GET /api/jobs` query params:**

| Param | Meaning | Example |
|-------|---------|---------|
| `page` / `pageSize` | Pagination (pageSize defaults to 20) | `?page=2&pageSize=50` |
| `search` | Matches title, company, description, skills | `?search=react` |
| `company` | Substring match on company name (AND with other filters) | `?company=stripe` |
| `sponsorship` | `true` = only jobs confirmed to sponsor visas | `?sponsorship=true` |
| `roleTypes` | Comma-separated roles | `?roleTypes=BACKEND,AI_ENGINEER` |
| `experienceLevels` | Comma-separated levels | `?experienceLevels=ENTRY,MID` |
| `locations` | Comma-separated locations (OR) | `?locations=San Francisco,Remote` |
| `remoteOnly` | `true` = remote jobs only | `?remoteOnly=true` |
| `provider` | Job source | `?provider=GREENHOUSE` |
| `postedWithin` | **Hours** — this is the 24h/48h filter | `?postedWithin=24`, `48`, `168` |
| `includeMatches` | Attach best match score for your resumes | `?includeMatches=true&minScore=70` |
| `minScore` | Minimum best-match score (needs `includeMatches`) | `&minScore=70` |

Response shape: `{ jobs: [...], pagination: { page, pageSize, total, totalPages } }`.

### Matches
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/matches` | Score jobs vs a resume `{resumeId, jobIds?: []}` (no `jobIds` → scores latest 100 jobs). Returns + saves matches |
| GET | `/api/matches` | Your saved matches, best-first. Params: `resumeId`, `minScore`, `limit` |

### Resumes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/resumes` | List resumes (skills/experience/education normalized) |
| POST | `/api/resumes` | **multipart** `file` → AI-parses and returns parsed data for review; **JSON** → saves a parsed resume to the DB |
| GET | `/api/resumes/[id]` | One resume |
| DELETE | `/api/resumes/[id]` | Delete resume + its uploaded file |

### Target filters
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/preferences` | `{filters: [...]}` — every saved target filter (array fields normalized) |
| POST | `/api/preferences` | Create: `{name, targetRoles[], locations[], remoteOnly, visaRequired, minSalary, excludedKeywords[]}` — `name` is required |
| PUT | `/api/preferences?id=` | Update one filter (same body as POST) |
| DELETE | `/api/preferences?id=` | Delete one filter |

### Applications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/applications` | Your applications (optional `?status=`) |
| POST | `/api/applications` | `{jobId, resumeId?, status, notes}` (upsert per user+job; `status: 'APPLIED'` records `appliedAt`). `resumeId` is optional — it falls back to your newest resume, so a job can be saved from a list with no resume picker in reach |
| PATCH | `/api/applications/[id]` | Change `status` / `notes` (sets `appliedAt` on first transition to APPLIED) |
| DELETE | `/api/applications/[id]` | Remove an application (used by the card's **Not applied** button) |

### Career Ops

Every route runs the vendored career-ops methodology through the local Claude connection. They accept a `jobId` (a saved job), a `url` (any posting), or a pasted `customJd`, plus an optional `resumeId` — omit it and the newest resume is used. **Expect 4–6 minutes per call.**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/career-ops/suggest` | Scan a resume → adjacent role titles at your level (`{suggestions[], markdown}`) |
| POST | `/api/career-ops/resume-jobs` | Real US postings for given keywords, scored against your resume. `{refresh:true}` also pulls fresh listings from the boards |
| POST | `/api/career-ops/evaluate` | A–G evaluation of a posting. **Persists a numbered report + tracker row** |
| POST | `/api/career-ops/tailor-resume` | Resume rewritten for the job (`{resume:{markdown, keywords[], gaps[]}}`) |
| POST | `/api/career-ops/cover` | Cover letter (`{coverLetter:{markdown, keywords, wordCount}}`) |
| POST | `/api/career-ops/email` | Application email. `variant`: `hr_application` (default), `cold_application`, `referral_request`, `process_stuck`, `confirmed_time_noshow` |
| POST | `/api/career-ops/interview-prep` | Rounds, panel intel, likely questions |
| POST | `/api/career-ops/followup` | Follow-up cadence + drafts (takes `company` / `role`) |
| POST | `/api/career-ops/upskill` | Weighted skill gaps across your pipeline |
| POST | `/api/jobs/[id]/career-ops` | Evaluate a saved job by id |
| GET | `/api/career-ops/report?path=` | Serve a saved report file (path-traversal guarded) |

### Cron
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cron/fetch-jobs` | Fetch + deactivate expired jobs. Requires `Authorization: Bearer $CRON_SECRET` |

---

## Testing the app (connection, fetch, filters, fields)

### 1. Confirm the local Claude connection is up

```bash
curl -s http://localhost:20128/v1/messages \
  -H "Authorization: Bearer dummy" -H "Content-Type: application/json" \
  -d '{"model":"auto/best-coding-fast","max_tokens":50,"messages":[{"role":"user","content":"Say hi"}]}'
```

You should get a `message` JSON with a `thinking` block and a `text` block. The app's AI features use exactly this endpoint.

### 2. Sign in

Open `http://localhost:3000/auth/signin` and log in as `buddy` / `qwerty@1`.

### 3. Trigger a live job fetch

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"action":"fetch"}'
```

Expect ~2,000+ jobs from Greenhouse (Airbnb, Stripe, Coinbase, Vercel, …) plus whatever company-direct APIs respond. The fetch runs providers in parallel and is idempotent (re-running updates existing jobs instead of duplicating).

### 4. Test the 24h / 48h / 7-day filters

The "posted within" filter takes **hours** as a number:

```bash
# Last 24 hours
curl "http://localhost:3000/api/jobs?postedWithin=24&pageSize=5"

# Last 2 days
curl "http://localhost:3000/api/jobs?postedWithin=48&pageSize=5"

# Last 7 days
curl "http://localhost:3000/api/jobs?postedWithin=168&pageSize=5"
```

Or in the UI: on `/dashboard` pick **Last 24 hours / Last 2 days / Last 7 days** from the Posted dropdown (sets `?posted=24|48|168`).

### 4b. Confirm the US-only invariant

```bash
sqlite3 prisma/dev.db "select count(*) from Job where isActive=1 and isUs=0"   # expect 0
npm run purge:non-us                                                          # dry run; expect 0 to deactivate
```

### 5. Verify every job field

```bash
curl "http://localhost:3000/api/jobs?pageSize=1&provider=GREENHOUSE" | python3 -m json.tool
```

Fields on each job: `id`, `externalId`, `provider`, `title`, `company`, `location`, `isRemote`, `description`, `requirements[]`, `skills[]`, `experienceLevel`, `roleType`, `salaryMin/Max`, `currency`, `applyUrl`, `postedAt`, `fetchedAt`, `expiresAt`, `isActive`.

### 6. AI matching end-to-end

1. Upload a resume at `/resumes/new` (or use the seeded one).
2. Call the matcher:

```bash
curl -X POST http://localhost:3000/api/matches \
  -H "Content-Type: application/json" \
  -d '{"resumeId":"<resume-id>","jobIds":["<job-id-1>","<job-id-2>"]}'
```

3. You'll get `{score, reasoning, matchedSkills, missingSkills, recommendation}` per job. The `reasoning` is a human-written sentence when the AI produced it (e.g. *"The candidate's background is in AI/ML engineering and research, which is fundamentally different from the Health and Safety Manager role"*); deterministic phrasing means the heuristic fallback kicked in.

---

## Project structure

```
job_search/
├── prisma/
│   ├── schema.prisma          # 6 models: User, Resume, Preference (target filter), Job, Match, Application
│   └── seed.ts                # Idempotent sample data (buddy@gmail.com / qwerty@1)
├── public/uploads/            # Uploaded resume files
├── src/
│   ├── app/
│   │   ├── page.tsx               # Landing page
│   │   ├── layout.tsx             # Root layout + ToastProvider
│   │   ├── providers.tsx          # NextAuth session provider
│   │   ├── auth/                  # /auth/signin, /auth/register
│   │   ├── dashboard/             # /dashboard (stats + job list) + layout (nav)
│   │   ├── preferences/           # /preferences
│   │   ├── resumes/               # /resumes, /resumes/new (drag-drop upload)
│   │   └── api/
│   │       ├── auth/register      # POST register
│   │       ├── auth/[...nextauth] # NextAuth route handler
│   │       ├── jobs/              # GET list / POST fetch|score|stats (+ countries)
│   │       ├── matches/           # POST score / GET saved
│   │       ├── resumes/           # GET list / POST upload-or-save
│   │       ├── resumes/[id]/      # GET / PATCH / DELETE
│   │       ├── applications/      # GET / POST
│   │       ├── applications/[id]/ # PATCH status / DELETE
│   │       ├── preferences/       # Target filters: GET / POST / PUT?id / DELETE?id
│   │       └── cron/fetch-jobs/   # Scheduled fetch + auto-score + link check (CRON_SECRET)
│   ├── components/
│   │   ├── dashboard/         # JobList, JobFilters, JobCard, StatsCards, DashboardHeader, skeletons
│   │   └── ui/                # Badge, Button, Card, Checkbox, Input, Label
│   ├── lib/
│   │   ├── ai-matcher/        # batchScoreJobsHeuristic (fast auto-score) + AI scoreJob
│   │   │                      #   incl. inferCandidateLevel + level-distance penalty
│   │   ├── career-ops/        # Toolkit modes (cover, tailor, email, prep, upskill…)
│   │   │   ├── timeouts.ts    # Single source for the SDK / client timeout budget
│   │   │   ├── persist.ts     # Writes reports + tracker rows into ./career-ops
│   │   │   └── resume-select.ts # Shared "this resume or the newest one" lookup
│   │   ├── geo/us-location.ts # isUsJob + US_ONLY_WHERE (the US-only gate)
│   │   ├── resume-parser/     # parseResume for PDF/DOCX/TXT (AI + heuristic fallback)
│   │   ├── job-fetcher/       # fetchAllJobs orchestration + getJobStats + saveJob (dedup)
│   │   │   ├── auto-score.ts  # autoScoreUserJobs / autoScoreAllUsers (cron) — heuristic scoring
│   │   │   ├── link-checker.ts# HTTP-check apply links, deactivate broken ones
│   │   │   ├── dedup.ts       # findDuplicateJob — applyUrl, then companySlug+title+location
│   │   │   └── normalize-company.ts # companySlug: case/punctuation-insensitive key
│   │   ├── job-providers/     # base (shared parse + filters), greenhouse, ashby, lever,
│   │   │                      #   wellfound, company-direct, remotive, remoteok, arbeitnow, jobicy
│   │   │   └── experience-level.ts # Seniority from the job title
│   │   ├── auth.ts            # getCurrentUser / requireAuth
│   │   ├── auth-options.ts    # NextAuth config (kept out of route file for build)
│   │   ├── db.ts              # Prisma singleton
│   │   └── utils.ts           # parseJsonArray / stringifyJsonArray (SQLite has no arrays)
│   └── types/
│       ├── index.ts           # RawJob, MatchResult, enums (string unions)
│       └── next-auth.d.ts     # session.user.id typing
├── .env.example               # Documented config template
└── package.json               # Scripts below
```

### Key enums (in `src/types/index.ts`)

- **RoleType:** `SDE, AI_ENGINEER, ML_ENGINEER, DATA_SCIENTIST, DATA_ENGINEER, DEVOPS, SRE, FULLSTACK, FRONTEND, BACKEND, MOBILE, EMBEDDED, SECURITY, QA, PM, OTHER`
- **ExperienceLevel:** `ENTRY, MID, SENIOR, STAFF, PRINCIPAL` — derived from the job title at ingest, see [How matching works](#how-matching-works)
- **JobProvider:** `GREENHOUSE, ASHBY, LEVER, COMPANY_DIRECT, WELLFOUND, REMOTIVE, REMOTEOK, ARBEITNOW, JOBICY, OTHER`
- **AppStatus:** `SAVED, APPLIED, INTERVIEWING, OFFER, REJECTED, WITHDRAWN`

> **Storage note:** SQLite has no array column type, so array fields (`skills`, `requirements`, `matchedSkills`, `missingSkills`, `experience`, `education`, `targetRoles`, `locations`, `excludedKeywords`) are stored as **JSON strings**. Read/write paths normalize them with `parseJsonArray` / `stringifyJsonArray` in `src/lib/utils.ts`. If you add a new array field, follow the same pattern.

---

## Development commands

```bash
npm install          # Installs deps AND runs full setup via postinstall (.env + DB + career-ops)
npm run setup        # First-run setup: .env + install + schema + seed + career-ops (one command)
npm run dev          # Dev server (forces NODE_ENV=development, port 3000)
npm run build        # Production build
npm run start        # Production server (port 3000)
npm run lint         # ESLint
npm run db:push      # Push schema → DB
npm run db:studio    # Prisma Studio GUI
npm run db:seed      # Seed sample data (idempotent)
npm run postinstall  # Full setup (the hook `npm install` runs automatically)
```

### Maintenance scripts

All are idempotent, and the destructive ones dry-run until you pass `-- --apply`.

```bash
npm run purge:non-us              # Re-classify stored jobs; deactivate non-US ones
npm run reclassify:levels         # Re-derive seniority from job titles
npm run reclassify:levels -- --apply --rescore   # …and rescore existing matches
npm run backfill:company-slug     # Fill companySlug (dedup key) and report duplicates
npm run backfill:sponsorship      # Classify visa sponsorship across the DB
npm run check-links               # HTTP-check apply links (--limit=N to sample)
npm run check-links:fix           # …and deactivate the broken ones
```

### Tests

Three assertion suites under `tests/`, run directly with `npx tsx` — no runner, no framework:

```bash
npx tsx tests/us-location.test.mjs        # 95 assertions — US classifier
npx tsx tests/experience-level.test.mjs   # 38 — seniority parsing + level-aware ranking
npx tsx tests/job-dedup.test.mjs          # 20 — company normalization + duplicate detection
```

153 assertions total, all passing. `tests/` previously also held ~37 files that
were either copies of career-ops' own suites (which live and pass in
`career-ops/`, next to the modules they test) or one-off debug scripts with
stale import paths — every one of them threw on start. They were removed rather
than left to look like coverage.

---

## Common issues

| Symptom | Cause / fix |
|---------|-------------|
| `npm install` prints "prisma CLI is missing" | Your shell exports `NODE_ENV=production`, so dev deps were skipped. Run `npm run setup` (or `env -u NODE_ENV npm install && npm run setup`). See [The `NODE_ENV=production` gotcha](#the-node_envproduction-gotcha). |
| Career Ops features report "not installed" | The `./career-ops` workspace is missing or incomplete. Run `npm run setup`, or `npx @santifer/career-ops init`. |
| Career-ops CLI PDF fails ("browser not found") | The Playwright browser isn't installed — `cd career-ops && npx playwright install chromium`. |
| `next dev` fails or binds a weird port | Your shell exports `NODE_ENV=production` or `PORT`. Use `npm run dev` (it forces correct values). |
| Job fetch returns 0 from Lever / Wellfound | Expected — the Lever companies listed aren't all Lever customers (404), and Wellfound has no public API. Greenhouse is the main source. |
| `Failed to set fetch cache … over 2MB` in logs | Old provider fetches used `next: {revalidate}`. Removed — fetch now uses `AbortSignal.timeout`. If you re-add caching, don't cache route-handler responses >2MB. |
| AI matching/parsing shows generic reasoning | The local connection returned empty and the heuristic fallback ran. Check the local Claude connection is reachable (`curl` test above). |
| Resume scan spins forever, then times out | The generation is slower than the browser's abort. A scan legitimately takes **4–6 minutes**; the elapsed counter tells you it's alive. If it always times out, your proxy is unusually slow — raise `CLIENT_ABORT_MS` and `SDK_TIMEOUT_MS` together in `src/lib/career-ops/timeouts.ts`, keeping the client below the SDK. |
| Career Ops call fails instantly with a 401 / "model not supported" | The proxy resolved `ANTHROPIC_MODEL` to a provider that is out of quota. Probe it directly (`curl` test above) and read the `diagnostics.attemptOrder` in the error — then point `ANTHROPIC_MODEL` at a model your proxy actually serves. |
| Best Matches is full of Senior / Staff roles | Stored seniority is stale. Run `npm run reclassify:levels -- --apply --rescore`. |
| A button renders as a solid colour block with no label | A global CSS rule is repainting its label. `globals.css` once carried `.card .text-white { color: khaki-700 !important }`, which hit every button that paints its own dark background and made label and background the same colour (1.00:1). Don't re-add a blanket `.text-white` override — fix the offending element's own classes instead. |
| Prisma error: "Unknown field `companySlug`" or `applicationsAdjustment` | Either the schema was never pushed to SQLite (`npx prisma db push`) or a long-running `next dev` is holding a client generated before the change. Push, then restart the dev server — the running process caches the old client. |
| Prisma error "Argument `targetRoles` must not be an array" | SQLite arrays must be JSON strings — use `stringifyJsonArray` on write (see the preferences route). |
| Reset the DB | `rm prisma/dev.db && npm run db:push && npm run db:seed` |

---

## Roadmap

**Shipped**

- [x] **Job detail view** — full description, salary, and apply CTA. Shipped as a dashboard **drawer** (`JobDetailDrawer`), not a routed `/jobs/[id]` page — a `GET /api/jobs/[id]` endpoint exists, so a standalone page is still optional
- [x] **Applications tracker UI** — `/applications` with status pipeline (SAVED → APPLIED → INTERVIEWING → OFFER/REJECTED → WITHDRAWN), notes, and filters, plus an application calendar and insights
- [x] **Dedicated matches view** — `/matches` browses jobs sorted by best match score with a threshold slider (`includeMatches&minScore`)
- [x] **More job providers** — **Ashby** wired into `src/lib/job-fetcher/index.ts`, plus public boards Remotive / RemoteOK / Arbeitnow / Jobicy. **Workable** and custom scrapers are still open (extend `BaseJobProvider`)
- [x] **Deployment config — Vercel** — `vercel.json` schedules `/api/cron/fetch-jobs` via `crons`
- [x] **US-only pipeline** — classification at ingest, SQL-level filtering on every read, and a backfill script
- [x] **Level-aware ranking** — seniority parsed from job titles and scored against your own level
- [x] **AI Career toolkit** — the full career-ops methodology against any saved job, incl. all five email variants

**Open**

- [ ] **Infinite scroll** on the dashboard (currently a **Load More** button)
- [ ] **Salary filter UI** (schema + API already have `salaryMin/Max`)
- [ ] **AI resume feedback** — a prompt that critiques the resume itself. `/ai` offers role-title suggestions and per-job tailoring today, but no standalone "here's what's weak in your CV" pass
- [ ] **Email notifications** for new strong matches (the cron endpoint exists, but sending isn't wired)
- [ ] **Test runner** — `tests/` now holds real assertion suites (US classifier, seniority/ranking, dedup — see [Tests](#tests)), but there is still no `npm test` script, no coverage of the provider parsers, and no e2e for the auth/fetch/matches flow
- [ ] **Dockerfile** — container image for the app (the Vercel config is already in place)
- [ ] **Migrate SQLite → Postgres** when needed (Prisma makes this a config change + array handling)

---

**Built with Next.js, Prisma, and the local Claude Code connection.**
