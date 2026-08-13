import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { US_ONLY_WHERE } from '@/lib/geo/us-location'
import { getResumeForUser } from '@/lib/career-ops/resume-select'
import { batchScoreJobsHeuristic } from '@/lib/ai-matcher'
import { fetchAllJobs } from '@/lib/job-fetcher'
import { parseJsonArray } from '@/lib/utils'
import { Prisma } from '@prisma/client'

// POST /api/career-ops/resume-jobs — real US job postings for a resume.
//
// This is what the Suggestions tab needed and never had: the titles produced by
// the career-ops resume scan used to link out to a Google search, so the user
// never saw an actual posting or an official apply link. Here the keywords are
// matched against the job table, scored against the resume, and returned with
// each posting's real applyUrl.
//
// Every job is US-only — the filter lives in the query (Job.isUs), so it cannot
// be widened by a request parameter.
export const runtime = 'nodejs'

/** Pool size to score. Heuristic scoring is pure JS, so this stays fast. */
const POOL_SIZE = 400
const DEFAULT_LIMIT = 12

interface ResumeJobsRequest {
  resumeId?: string
  /** Keywords from the suggestion cards. Falls back to the resume's own skills. */
  keywords?: string[]
  minScore?: number
  limit?: number
  /** Also pull fresh postings from the providers before querying. Slow. */
  refresh?: boolean
}

/**
 * Keywords to search with when the caller sends none: the resume's parsed
 * skills, which is what the heuristic scorer keys off anyway.
 */
function keywordsFromResume(resume: { skills: string; roleType: string; title: string }): string[] {
  const skills = (parseJsonArray<string>(resume.skills) || [])
    .map(s => s.trim())
    .filter(Boolean)
  return skills.slice(0, 12)
}

/**
 * Words too generic to identify a role on their own. Kept out of the widened
 * fallbacks so "ETL Developer" doesn't degrade into every "Developer" posting.
 */
const GENERIC_ROLE_WORDS = new Set([
  'engineer', 'engineering', 'developer', 'analyst', 'manager', 'specialist',
  'lead', 'senior', 'junior', 'staff', 'principal', 'associate', 'i', 'ii', 'iii',
])

/**
 * Conditions matching a suggested role title, widened only as far as needed.
 *
 * A suggestion is a *role title*, not a search query — the model proposes
 * things like "Data Pipeline Engineer" that no posting is worded exactly that
 * way. Matching the phrase verbatim (the original behaviour) returned zero jobs
 * for those, which surfaced as an empty, broken-looking list. Measured against
 * the current database: "Data Pipeline Engineer" 0 hits, "ETL Developer" 0.
 *
 * So try progressively looser rungs and stop at the first that matches:
 *
 *   1. the phrase itself, in title or skills — most precise
 *   2. any ordered pair of its words in the title — this is what rescues
 *      "Data Pipeline Engineer", whose first+last pair is "data engineer" (45)
 *   3. every distinctive word present somewhere (title or skills) — rescues
 *      "ETL Developer" via "etl" (3)
 *
 * Stopping at the first non-empty rung keeps precision: a keyword that matches
 * exactly never gets widened, so good matches are never diluted by loose ones.
 */
async function matchConditionsForKeyword(keyword: string): Promise<Prisma.JobWhereInput[]> {
  const words = keyword.toLowerCase().split(/\s+/).filter(Boolean)
  const distinctive = words.filter(w => !GENERIC_ROLE_WORDS.has(w))

  const pairs: string[] = []
  for (let a = 0; a < words.length; a++) {
    for (let b = a + 1; b < words.length; b++) pairs.push(`${words[a]} ${words[b]}`)
  }

  const rungs: Prisma.JobWhereInput[][] = [
    [{ title: { contains: keyword } }, { skills: { contains: keyword } }],
    pairs.map(pair => ({ title: { contains: pair } })),
    distinctive.length
      ? [{
          AND: distinctive.map(word => ({
            OR: [{ title: { contains: word } }, { skills: { contains: word } }],
          })),
        }]
      : [],
  ]

  for (const rung of rungs) {
    if (rung.length === 0) continue
    const hits = await prisma.job.count({
      where: { isActive: true, ...US_ONLY_WHERE, OR: rung },
    })
    if (hits > 0) return rung
  }

  // Nothing in the database for this role yet — the UI offers a live fetch.
  return []
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as ResumeJobsRequest
    const resume = await getResumeForUser(user.id, body.resumeId)
    if (!resume) {
      return NextResponse.json(
        { error: 'Upload a resume first — job matches are generated from it.' },
        { status: 400 }
      )
    }

    const keywords = (body.keywords?.length ? body.keywords : keywordsFromResume(resume))
      .map(k => k.trim())
      .filter(Boolean)
      .slice(0, 12)

    const minScore = Math.max(0, Math.min(100, body.minScore ?? 0))
    const limit = Math.max(1, Math.min(50, body.limit ?? DEFAULT_LIMIT))

    // Optional live top-up. Providers fetch whole boards and filter in memory,
    // so this costs a full provider sweep — hence opt-in, never automatic.
    let refreshed: { jobsNew: number; jobsSkippedNonUs: number } | undefined
    if (body.refresh) {
      const results = await fetchAllJobs({ keywords, limit: POOL_SIZE })
      refreshed = {
        jobsNew: results.reduce((sum, r) => sum + r.jobsNew, 0),
        jobsSkippedNonUs: results.reduce((sum, r) => sum + r.jobsSkippedNonUs, 0),
      }
    }

    // Candidate pool: active US jobs matching each keyword, widened one rung at
    // a time until something matches (see matchConditionsForKeyword).
    const perKeyword = await Promise.all(keywords.map(kw => matchConditionsForKeyword(kw)))
    const keywordConditions: Prisma.JobWhereInput[] = perKeyword.flat()

    const where: Prisma.JobWhereInput = {
      isActive: true,
      ...US_ONLY_WHERE,
      ...(keywordConditions.length ? { OR: keywordConditions } : {}),
    }

    const pool = await prisma.job.findMany({
      where,
      orderBy: { postedAt: 'desc' },
      take: POOL_SIZE,
      include: {
        applications: { where: { userId: user.id }, select: { id: true, status: true }, take: 1 },
      },
    })

    const scores = await batchScoreJobsHeuristic(
      resume.parsedText,
      parseJsonArray<string>(resume.skills),
      pool.map(job => ({
        id: job.id,
        title: job.title,
        company: job.company,
        description: job.description,
        skills: parseJsonArray<string>(job.skills),
        experienceLevel: job.experienceLevel,
        roleType: job.roleType,
      }))
    )

    // The heuristic scorer only compares skill lists, so a support role whose
    // posting happens to name Python scores as highly as a real engineering
    // match. Rank with two relevance signals on top — the job title actually
    // containing a keyword, and the role type matching the resume's — while
    // still showing the unmodified match score to the user.
    const lowerKeywords = keywords.map(k => k.toLowerCase())
    const relevanceBonus = (title: string, roleType: string) => {
      const lowerTitle = title.toLowerCase()
      const titleHit = lowerKeywords.some(kw => lowerTitle.includes(kw)) ? 15 : 0
      const roleHit = roleType === resume.roleType ? 10 : 0
      return titleHit + roleHit
    }

    const jobs = pool
      .map(job => {
        const match = scores.get(job.id)
        return {
          rank: (match?.score ?? 0) + relevanceBonus(job.title, job.roleType),
          id: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          isRemote: job.isRemote,
          provider: job.provider,
          // The official posting URL, validated at ingest by validateApplyUrl.
          applyUrl: job.applyUrl,
          postedAt: job.postedAt.toISOString(),
          visaSponsored: job.visaSponsored,
          score: Math.round(match?.score ?? 0),
          reasoning: match?.reasoning ?? '',
          matchedSkills: match?.matchedSkills ?? [],
          missingSkills: match?.missingSkills ?? [],
          applicationStatus: job.applications[0]?.status ?? null,
        }
      })
      .filter(job => job.score >= minScore)
      .sort((a, b) => b.rank - a.rank || Date.parse(b.postedAt) - Date.parse(a.postedAt))
      .slice(0, limit)
      // `rank` is an internal sort key; the client shows `score`.
      .map(({ rank: _rank, ...job }) => job)

    return NextResponse.json({
      keywords,
      resume: { id: resume.id, title: resume.title },
      jobs,
      poolSize: pool.length,
      refreshed,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch matching jobs'
    console.error('Career-ops resume-jobs error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
