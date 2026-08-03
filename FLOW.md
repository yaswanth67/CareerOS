# MatchIQ — Overall Flow & Feature Guide

This document explains what MatchIQ does, how the pieces fit together, and — most
importantly — **where your resume is used** at every step.

## 1. What MatchIQ is

MatchIQ is a personal job-search assistant. It:

1. **Fetches live job listings** from public job APIs (Greenhouse, Ashby, Lever, and
   direct company career APIs like Amazon). Every apply link is validated so broken
   links never reach the feed.
2. **Parses the resumes you upload** (PDF, DOCX, or text) into structured data.
3. **Scores every job against your resume** — using AI when an API key is configured,
   otherwise a built-in offline heuristic — so you can see how well each role fits.
4. **Lets you save and track applications** so you never lose track of where you applied.

Everything is stored in a local SQLite database on your machine. No account data or
resume text leaves your computer except when AI scoring is enabled (see Privacy Policy).

---

## 2. Overall flow

```
┌────────────┐   ┌─────────────────────┐   ┌─────────────────────────┐
│ Sign in    │──▶│ Dashboard           │──▶│ Upload a resume         │
│ (name+pass)│   │  · Active jobs      │   │  · PDF / DOCX / text    │
└────────────┘   │  · Strong matches   │   └───────────┬─────────────┘
                 │  · Applications     │               ▼
                 │  · Job feed         │   ┌─────────────────────────┐
                 └─────────┬───────────┘   │ parseResume()          │
                           │               │  · text extraction      │
                           ▼               │  · skills (AI or rules) │
                 ┌─────────────────────┐   │  · experience           │
                 │ Set preferences     │   │  · education            │
                 │  · target roles     │   │  · role type detection  │
                 │  · locations        │   └───────────┬─────────────┘
                 │  · remote / visa    │               ▼
                 │  · excluded words   │   ┌─────────────────────────┐
                 └─────────────────────┘   │ Stored as Resume in DB │
                                           │  parsedText + skills   │
                                           └───────────┬─────────────┘
                                                       ▼
                 ┌────────────────────────────────────────────────┐
                 │ "Score Matches" — score jobs vs your resume    │
                 │  batchScoreJobs(): AI or heuristic per job     │
                 │  → Match row: score, reasoning, matched/missing│
                 └─────────────────────────┬──────────────────────┘
                                           ▼
                 ┌────────────────────────────────────────────────┐
                 │ Job feed shows a % score + reasoning per card  │
                 │ Sort/filter by score, role, location, remote   │
                 └─────────────────────────┬──────────────────────┘
                                           ▼
                 ┌────────────────────────────────────────────────┐
                 │ Track applications (SAVED → APPLIED → ...)     │
                 │ Apply opens the employer's real application    │
                 └────────────────────────────────────────────────┘
```

### Key routes

| Path | What it does |
|---|---|
| `/` | Landing page → redirects to sign-in |
| `/auth/signin` · `/auth/register` | Name + password auth (email optional) |
| `/dashboard` | Stats, filters, scored job feed |
| `/resumes` · `/resumes/new` | List / upload + edit resumes |
| `/preferences` | Target roles, locations, remote/visa, salary, exclusions |
| `/applications` | Your saved & applied jobs — update status, add notes, remove |
| `/api/jobs` `POST {action:"fetch"}` | Fetch fresh jobs from all providers |
| `/api/jobs/check-links` `POST` | Guard-rail: check every apply link, deactivate broken ones |
| `/api/matches` `POST` | Score jobs against a resume |
| `/api/applications` `POST` | Save / mark an application |
| `/api/cron/fetch-jobs` | Scheduled (Vercel Cron) job refresh **+ link check** |

### Guard-rail: broken apply links

Every apply URL must pass `validateApplyUrl()` (`src/lib/job-providers/base.ts`)
before it is saved — fabricated homepage links, placeholder ids (`/jobs/123`), and
malformed URLs are rejected at fetch time. A separate link-checker
(`scripts/check-job-links.ts`, or the dashboard **Check Links** button → `POST
/api/jobs/check-links`) then HTTP-checks every active job and **deactivates** the
ones that 404. The scheduled cron runs the same check every 6h. Bot-blocked
(403/429) and server-error (5xx) links are reported but left in place.

---

## 3. Where your resume is used

The resume is the **single most important input** in MatchIQ. It is used in four places:

### 3.1 Resume upload & parsing — `src/lib/resume-parser/index.ts`

When you upload a file, `parseResume()` extracts:

- **Raw text** from PDF (`pdf-parse`), DOCX (`mammoth`), or plain text.
- **Skills** — matched against a known tech-skill dictionary, upgraded to an
  AI extraction when `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` is set.
- **Experience** (role, company, duration, achievements) and **education**.
- **Role type** — e.g. `AI_ENGINEER`, `FULLSTACK`, `DEVOPS` — auto-detected from
  the extracted skills + experience.

Everything is stored on the `Resume` row (`parsedText`, `skills` as a JSON string).

### 3.2 Match scoring — `src/lib/ai-matcher/index.ts`

The **"Score Matches"** button (dashboard) and `POST /api/matches` use your resume:

```
resume.parsedText + resume.skills
        │
        ▼
batchScoreJobs(resumeText, resumeSkills, jobs)
        │
        ├─ AI path:    Anthropic prompt → { score, reasoning, matchedSkills, missingSkills }
        └─ Fallback:   heuristicScore():
                         40% skill overlap  (resume.skills ∩ job.skills)
                         30% experience     (keywords found in both texts)
                         20% role alignment (resume text ↔ job role type)
                         10% experience level (resume text ↔ job level)
        │
        ▼
Match row upserted per (job, resume):  score, reasoning, matched/missing skills
```

### 3.3 Job feed display — `src/components/dashboard/JobCard.tsx`

`GET /api/jobs?includeMatches=true` joins the latest `Match` for each job and your
user, and each job card renders a **score badge** (e.g. `92%`), the AI reasoning,
matched skills, and missing skills. This is the "match score on every job role"
you asked for — it only appears after you upload a resume and run **Score Matches**.

### 3.4 Applications — `src/app/api/applications/route.ts`

Saving an application **requires a resume** (`resumeId` is mandatory in the API).
The application row links: `you → job → the resume you applied with`. This is so the
app can show "you applied to X using resume Y".

Each job card in the feed shows a **Save** button (when you have at least one
resume). Saving records a `SAVED` application linked to your most recent resume.
The **Applications** page (`/applications`) lists everything you've saved, lets you
move a job through the pipeline (`SAVED → APPLIED → INTERVIEWING → OFFER →
REJECTED → WITHDRAWN`), add notes, open the employer's application page, or remove
the entry. The **Apply** button on a job card opens the employer's own site.

---

## 4. Feature-by-feature use cases

### 4.1 Sign in / Register
- **Use case:** Create an account with a unique name + password, then sign in.
- **Flow:** Register validates name uniqueness + password strength, then auto-signs in.
- **Seed login:** `buddy` / `qwerty@1`.

### 4.2 Dashboard
- **Active Jobs** — live count of active jobs in the DB. *Not hardcoded*: it is
  `prisma.job.count({ where: { isActive: true } })` on every load. Grows when you
  click **Refresh Jobs** (fetches real listings from Greenhouse, Ashby, Lever, and
  Amazon), shrinks when the scheduled cron deactivates expired postings.
- **Check Links button** — runs the apply-link guard-rail over every active job
  and deactivates the ones with broken/fabricated links.
- **Strong Matches** — jobs scored ≥80% against any of your resumes.
- **Applications** — count of saved/applied jobs.
- **Score Matches button** — runs your most recent resume against the newest jobs.

### 4.3 Job feed & filters
- **Use case:** Find jobs that fit your profile. Filter by role type, experience
  level, location, remote-only, posted-within, and minimum match score; sort by
  score descending when `includeMatches` is on.
- **Apply** — opens the employer's own application page in a new tab.

### 4.4 Resumes
- **Upload** (`/resumes/new`): pick a file, review the parsed title/role/skills,
  then confirm.
- **Edit** (`/resumes` → pencil): change title, role type, and skills after upload
  (`PATCH /api/resumes/[id]`).
- **Delete**: remove a resume and its matches/applications.

### 4.5 Preferences
- Target roles (multi-select), preferred locations, remote-only, visa-sponsorship
  priority, minimum salary, and excluded keywords. These shape filtering and
  matching for new jobs.

### 4.6 Applications
- Save a job to apply later; mark it `SAVED → APPLIED → INTERVIEWING → OFFER →
  REJECTED → WITHDRAWN` and attach notes; view everything on one page.
- **Filters (all optional):** status chips, a **position/company** search box, and
  a **location** box — combine freely to narrow your list.

---

## 5. Notes for developers

- **SQLite + Prisma:** array fields are stored as JSON strings; normalize with
  `parseJsonArray` / `stringifyJsonArray` in `src/lib/utils.ts`.
- **AI is optional:** with no API key, matching and resume parsing fall back to
  offline heuristics so the app works end-to-end.
- **Job providers:** `greenhouse` / `ashby` / `lever` hit real public APIs;
  `company-direct` is Amazon only (its `search.json` returns `job_path` +
  `url_next_step`, which are turned into real apply URLs); `wellfound` has no
  public API and returns nothing. Provider board/company lists are pruned to
  slugs **verified live** — dead boards (e.g. Notion/Linear/Snowflake moved to
  Ashby) are removed so stale links are never refetched.
- **Guard-rail:** `npm run check-links` (report) / `npm run check-links:fix`
  (report + deactivate). `validateApplyUrl()` shape-checks at save time;
  `src/lib/job-fetcher/link-checker.ts` HTTP-checks on demand.
- **Cron:** `vercel.json` schedules `GET /api/cron/fetch-jobs` every 6h; requires
  `CRON_SECRET` if set. It also runs the link check and deactivates broken links.
