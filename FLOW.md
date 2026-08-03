# MatchIQ — Overall Flow & Feature Guide

This document explains what MatchIQ does, how the pieces fit together, and — most
importantly — **where your resume is used** at every step.

## 1. What MatchIQ is

MatchIQ is a personal job-search assistant. It:

1. **Fetches live job listings** from public job APIs (Greenhouse, Ashby, Lever, and
   direct company career APIs like Amazon). Every apply link is validated so broken
   links never reach the feed.
2. **Parses the resumes you upload** (PDF, DOCX, or text) into structured data.
3. **Scores every job against your resume automatically** — a fast offline heuristic
   runs the moment jobs are fetched (AI can be used for deeper reasoning) — so you
   see how well each role fits with no manual step.
4. **Lets you save and track applications** so you never lose track of where you
   applied. Apply, come back, and a "Have you applied?" popup records it for you.

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
                 │ AUTO-SCORING — every fetched job is scored vs  │
                 │ your most recent resume (fast heuristic, no LLM│
                 │  → Match row: score, reasoning, matched/missing│
                 └─────────────────────────┬──────────────────────┘
                                           ▼
                 ┌────────────────────────────────────────────────┐
                 │ Job feed (full-width vertical cards) shows     │
                 │  title, company, role tag + % match, reasoning │
                 │  Filters: role, level, country, remote, posted │
                 └─────────────────────────┬──────────────────────┘
                                           ▼
                 ┌────────────────────────────────────────────────┐
                 │ Apply → opens employer's site; on return the   │
                 │  "Have you applied?" popup asks Yes/No         │
                 │  Yes → APPLIED (tracked, leaves the feed)      │
                 │  No  → nothing recorded                        │
                 └────────────────────────────────────────────────┘
```

### Key routes

| Path | What it does |
|---|---|
| `/` | Landing page → redirects to sign-in |
| `/auth/signin` · `/auth/register` | Name + password auth (email optional) |
| `/dashboard` | Country + stats + full-width scored job feed (filters persist) |
| `/resumes` · `/resumes/new` | List / upload + edit resumes |
| `/preferences` | Target roles, locations, remote/visa, salary, exclusions |
| `/applications` | Your saved & applied jobs — change status, add notes, remove |
| `/api/jobs` `POST {action:"fetch"}` | Fetch fresh jobs **+ auto-score** them against your resume |
| `/api/jobs` `POST {action:"score"}` | Score every active job you don't have a match for |
| `/api/jobs/check-links` `POST` | Guard-rail: check every apply link, deactivate broken ones |
| `/api/applications` `POST` | Save / mark applied (`{status:'SAVED'|'APPLIED', …}`) |
| `/api/applications/[id]` `PATCH`/`DELETE` | Change status or remove an application |
| `/api/cron/fetch-jobs` | Scheduled job refresh **+ auto-score + link check** |

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

Scoring is **automatic**: `src/lib/job-fetcher/auto-score.ts` runs
`batchScoreJobsHeuristic()` over every unscored active job each time jobs are
fetched (and on the cron), so every card has a match score without a manual step.
An optional **"Score Matches"** button / `POST /api/matches` re-scores on demand
and can use the AI path.

```
resume.parsedText + resume.skills
        │
        ▼
batchScoreJobsHeuristic(resumeText, resumeSkills, jobs)   ← fast, no LLM
        │
        ├─ heuristicScore():   (used for the automatic full-coverage pass)
        │    40% skill overlap  (resume.skills ∩ job.skills)
        │    30% experience     (keywords found in both texts)
        │    20% role alignment (resume text ↔ job role type)
        │    10% experience level (resume text ↔ job level)
        └─ AI path:    Anthropic prompt → { score, reasoning, matchedSkills, missingSkills }
                        (optional, deeper reasoning; falls back to heuristic)
        │
        ▼
Match row inserted per (job, resume):  score, reasoning, matched/missing skills
        │
        ▼
Every job card shows a % match + reasoning + matched/missing skills
```

### 3.3 Job feed display — `src/components/dashboard/JobCard.tsx`

Each full-width vertical card shows, top to bottom:

1. **Job title** and **company** (never truncated).
2. **Tags below the title**: readable **role label** (e.g. "Software Engineer" not
   `SDE`), the **match %** badge, and the **application status** badge if any.
3. Location, experience level, salary, and "posted X ago".
4. Match reasoning + matched/missing skills, then the job's skill badges.
5. Actions: **Apply** (opens the employer's site), **Save**, and — for applied
   jobs — **Not applied** (reverts tracking so the job returns to the feed).

Jobs the user has **already applied to are hidden from the All-Jobs feed** (they
remain under the Applied filter and on `/applications`).

### 3.4 Applications — `src/app/api/applications/route.ts`

Saving an application **requires a resume** (`resumeId` is mandatory in the API).
The application row links: `you → job → the resume you applied with`. This is so the
app can show "you applied to X using resume Y".

Each job card in the feed shows a **Save** button (when you have at least one
resume). Saving records a `SAVED` application linked to your most recent resume.

**Applying is auto-tracked via a popup.** When you click **Apply**, the employer's
site opens in a new tab and a **"Have you applied?"** popup is queued on the
dashboard. When you come back to the tab, the popup (rendered through a portal so
nothing can hide it) asks:

- **Yes, I applied** → the application is marked `APPLIED` (`appliedAt` recorded),
  and the job leaves the All-Jobs feed.
- **Not yet** → nothing is recorded.

Marking a job applied also records it under **Applications**. An applied card
shows a **Not applied** button that deletes the application and returns the job
to the feed. The **Applications** page (`/applications`) lists everything you've
saved, lets you move a job through the pipeline (`SAVED → APPLIED → INTERVIEWING →
OFFER → REJECTED → WITHDRAWN`), add notes, open the employer's application page,
or remove the entry.

---

## 4. Feature-by-feature use cases

### 4.1 Sign in / Register
- **Use case:** Create an account with a unique name + password, then sign in.
- **Flow:** Register validates name uniqueness + password strength, then auto-signs in.
- **Seed login:** `buddy` / `qwerty@1`.

### 4.2 Dashboard
- **Country dropdown** — pick a country (or **Global/Remote**); the Active Jobs
  stat and the feed are scoped to it. The selection lives in the URL and is kept
  when you switch tabs (sidebar nav preserves the query string).
- **Active Jobs** — live count of active jobs in the DB, filtered to the selected
  country. *Not hardcoded*. Grows when you click **Refresh Jobs**, shrinks when
  the scheduled cron deactivates expired postings.
- **Status filters** — All Jobs / Saved / Applied. **All Jobs hides jobs you've
  already applied to**; Applied shows them.
- **Refresh Jobs** — fetches real listings from Greenhouse, Ashby, Lever, and
  Amazon, then **auto-scores every new job** against your most recent resume.
- **Score Matches** — instantly scores any active job you don't have a match for
  yet (fast heuristic, no AI call).
- **Check Links** — runs the apply-link guard-rail over every active job and
  deactivates the ones with broken/fabricated links.
- **Strong Matches** — jobs scored ≥80% against any of your resumes.
- **Applications** — count of saved/applied jobs.

### 4.3 Job feed & filters
- **Use case:** Find jobs that fit your profile. Filter by role type, experience
  level, location, **country**, remote-only, posted-within, status
  (All/Saved/Applied), and minimum match score; sort by score descending.
- **Layout:** full-width vertical cards (title + company + role tag + score),
  no pagination cap — every matching job is listed.
- **Apply** — opens the employer's own application page in a new tab and queues
  the **"Have you applied?"** popup; answering **Yes** auto-tracks it as APPLIED.

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
