# MatchIQ

An AI-powered job matching app that pulls live jobs from real job boards, parses your resume, and uses **AI to score how well you match each job** — with reasoning, matched skills, and missing skills.

Built with Next.js 16 (App Router), Prisma + SQLite, NextAuth, and the **Anthropic SDK pointed at your local Claude Code connection** (no cloud API key required).

---

## What this project does

| # | Feature | How it works |
|---|---------|--------------|
| 1 | **Fetch live jobs** | Pulls real postings from **Greenhouse** (Airbnb, Stripe, Coinbase, Instacart, Lyft, Datadog, etc.), **Ashby** (OpenAI, Snowflake, Notion, ElevenLabs, …), **Lever**, direct **company career-page APIs** (Amazon), plus high-volume public job boards: **Remotive, RemoteOK, Arbeitnow, and Jobicy** — ~10k jobs per fetch |
| 2 | **Parse resumes** | Upload a `.pdf`, `.docx`, or `.txt` resume. AI extracts skills, work experience, and education (heuristic fallback if the AI is unavailable) |
| 3 | **Auto match scoring** | Jobs are scored **automatically** against your most recent resume the moment they're fetched — a fast heuristic scorer (thousands of jobs in well under a second, no LLM call) — so every card shows a match %, reasoning, and matched/missing skills with no manual step. AI scoring is available for deeper reasoning |
| 4 | **Filters** | Filter by keyword, **company** (autocomplete), role type, experience level (**New Grad** / Senior quick chips), location, **country**, remote-only, **posted within (24h / 48h / 7 days)**, status (All Jobs / Saved / Applied), **visa sponsorship**, and minimum match score. Feed shows the **newest jobs first**, paginated with a **Load More** button to browse all of them |
| 5 | **Visa sponsorship (AI-detected)** | Every job is classified for visa sponsorship — a keyword pre-screen catches the obvious "we do / do not sponsor" statements, and **Claude AI** reads the rest. A green **Visa sponsorship** badge appears on confirmed sponsors, and the Sponsorship filter shows only those jobs |
| 6 | **Dashboard** | Real stats (total jobs, active jobs for the selected country, strong matches) and a full-width vertical job feed. Country + filters **persist when switching tabs** |
| 7 | **Preferences** | Target roles, locations, remote-only, visa requirement, min salary, excluded keywords |
| 8 | **Applications** | Save jobs, mark **Applied** (auto-tracked via the **"Have you applied?"** popup when you return from an apply link), move through the pipeline (SAVED → APPLIED → INTERVIEWING → OFFER / REJECTED), and add notes. **Applied jobs leave the All-Jobs feed** (still under the Applied filter) and can be reverted to "not applied" |
| 9 | **Scheduled fetch** | `GET /api/cron/fetch-jobs` (protected by `CRON_SECRET`) re-fetches jobs idempotently, **auto-scores every user's jobs**, checks apply links, deactivates stale ones, and **classifies a batch of jobs for visa sponsorship** |

### How the AI connection works

This app is configured to use **your local Claude Code connection**, not the Anthropic cloud API:

```env
ANTHROPIC_BASE_URL="http://localhost:20128"   # local Claude Code proxy
ANTHROPIC_AUTH_TOKEN="dummy"                  # accepted by the local proxy
ANTHROPIC_MODEL="auto/best-coding-fast"       # model the proxy serves
```

Every AI feature constructs the Anthropic SDK client from `ANTHROPIC_AUTH_TOKEN || ANTHROPIC_API_KEY`. When the local connection is set (or `ANTHROPIC_API_KEY` is set), AI features call it; if a call fails or returns empty, the app transparently falls back to heuristics, so nothing breaks offline.

> Note: the local proxy returns a `thinking` content block before the `text` block, so all parsers find the `text` block explicitly (`response.content.find(b => b.type === 'text')`).

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
- (Recommended) the **Claude Code local connection running on `http://localhost:20128`** so AI matching/parsing works. Without it, the app still runs using heuristic fallbacks.

### 1. One-command setup

```bash
npm run setup
```

That single command does the whole first-run flow — it's safe to re-run:

1. Creates your `.env` from the template (generates a fresh `NEXTAUTH_SECRET` and `CRON_SECRET`; skips it if `.env` already exists)
2. Installs all dependencies — dev deps **included**, even if your shell exports `NODE_ENV=production`
3. Creates the SQLite schema (`prisma db push`)
4. Seeds sample data (`npm run db:seed`, idempotent)

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
| `/dashboard` | Stats cards + full-width vertical job feed. Filters + country are URL-driven (`/dashboard?q=…&posted=48&country=United%20States`) so they survive tab switches and can be bookmarked/shared. Applied jobs are hidden from the feed |
| `/resumes` | Your resumes with expandable details |
| `/resumes/new` | Upload + AI-parse a resume (drag-and-drop) |
| `/preferences` | Target roles, locations, remote, salary, exclusions |
| `/applications` | Everything you've saved or applied to — change status, add notes, remove |

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
| `countries` | Comma-separated country names (or `Global/Remote`) | `?countries=United States,United Kingdom` |
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

### Preferences
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/preferences` | Current preferences (array fields normalized) |
| PUT | `/api/preferences` | Update: `{targetRoles[], locations[], remoteOnly, visaRequired, minSalary, excludedKeywords[]}` |

### Applications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/applications` | Your applications (optional `?status=`) |
| POST | `/api/applications` | `{jobId, resumeId, status, notes}` (upsert per user+job; `status: 'APPLIED'` records `appliedAt`) |
| PATCH | `/api/applications/[id]` | Change `status` / `notes` (sets `appliedAt` on first transition to APPLIED) |
| DELETE | `/api/applications/[id]` | Remove an application (used by the card's **Not applied** button) |

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
jobmatch-ai/
├── prisma/
│   ├── schema.prisma          # 6 models: User, Resume, Preference, Job, Match, Application
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
│   │       ├── preferences/       # GET / PUT
│   │       └── cron/fetch-jobs/   # Scheduled fetch + auto-score + link check (CRON_SECRET)
│   ├── components/
│   │   ├── dashboard/         # JobList, JobFilters, JobCard, StatsCards, DashboardHeader, skeletons
│   │   └── ui/                # Badge, Button, Card, Checkbox, Input, Label
│   ├── lib/
│   │   ├── ai-matcher/        # batchScoreJobsHeuristic (fast auto-score) + AI scoreJob
│   │   ├── resume-parser/     # parseResume for PDF/DOCX/TXT (AI + heuristic fallback)
│   │   ├── job-fetcher/       # fetchAllJobs orchestration + getJobStats + saveJob (dedup)
│   │   │   ├── auto-score.ts  # autoScoreUserJobs / autoScoreAllUsers (cron) — heuristic scoring
│   │   │   └── link-checker.ts# HTTP-check apply links, deactivate broken ones
│   │   ├── job-providers/     # base (shared parse + filters), greenhouse, lever, wellfound, company-direct
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
- **ExperienceLevel:** `ENTRY, MID, SENIOR, STAFF, PRINCIPAL`
- **JobProvider:** `GREENHOUSE, LEVER, COMPANY_DIRECT, WELLFOUND, OTHER`
- **AppStatus:** `SAVED, APPLIED, INTERVIEWING, OFFER, REJECTED, WITHDRAWN`

> **Storage note:** SQLite has no array column type, so array fields (`skills`, `requirements`, `matchedSkills`, `missingSkills`, `experience`, `education`, `targetRoles`, `locations`, `excludedKeywords`) are stored as **JSON strings**. Read/write paths normalize them with `parseJsonArray` / `stringifyJsonArray` in `src/lib/utils.ts`. If you add a new array field, follow the same pattern.

---

## Development commands

```bash
npm run setup        # First-run setup: .env + install + schema + seed (one command)
npm run dev          # Dev server (forces NODE_ENV=development, port 3000)
npm run build        # Production build
npm run start        # Production server (port 3000)
npm run lint         # ESLint
npm run db:push      # Push schema → DB
npm run db:studio    # Prisma Studio GUI
npm run db:seed      # Seed sample data (idempotent)
npm run postinstall  # prisma generate
```

---

## Common issues

| Symptom | Cause / fix |
|---------|-------------|
| `next dev` fails or binds a weird port | Your shell exports `NODE_ENV=production` or `PORT`. Use `npm run dev` (it forces correct values). |
| Job fetch returns 0 from Lever / Wellfound | Expected — the Lever companies listed aren't all Lever customers (404), and Wellfound has no public API. Greenhouse is the main source. |
| `Failed to set fetch cache … over 2MB` in logs | Old provider fetches used `next: {revalidate}`. Removed — fetch now uses `AbortSignal.timeout`. If you re-add caching, don't cache route-handler responses >2MB. |
| AI matching/parsing shows generic reasoning | The local connection returned empty and the heuristic fallback ran. Check the local Claude connection is reachable (`curl` test above). |
| Prisma error "Argument `targetRoles` must not be an array" | SQLite arrays must be JSON strings — use `stringifyJsonArray` on write (see the preferences route). |
| Reset the DB | `rm prisma/dev.db && npm run db:push && npm run db:seed` |

---

## Roadmap (ideas for later)

- [ ] **Job detail page** (`/jobs/[id]`) — full description, salary, apply CTA
- [x] **Applications tracker UI** — `/applications` with status pipeline (SAVED → APPLIED → INTERVIEWING → OFFER/REJECTED), notes, and filters (a kanban board is still optional)
- [ ] **Dedicated matches view** — browse jobs sorted by match score (API already supports `includeMatches&minScore`)
- [ ] **Infinite scroll** on the dashboard (currently a **Load More** button)
- [ ] **Salary filter UI** (schema + API already have `salaryMin/Max`)
- [ ] **More job providers** — add e.g. Workable, Ashby, or custom scrapers (extend `BaseJobProvider` and register in `src/lib/job-fetcher/index.ts`)
- [ ] **AI resume feedback** — a prompt that suggests improvements (connection already wired)
- [ ] **Email notifications** for new strong matches (cron endpoint already exists)
- [ ] **Tests** — unit tests for matcher fallback + provider parsers, and e2e for the auth/fetch/matches flow
- [ ] **Deployment configs** — Dockerfile, `vercel.json` (with `crons`) scheduling `/api/cron/fetch-jobs`
- [ ] **Migrate SQLite → Postgres** when needed (Prisma makes this a config change + array handling)

---

**Built with Next.js, Prisma, and the local Claude Code connection.**
