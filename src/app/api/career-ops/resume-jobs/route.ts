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
 * Progressive keyword fallback matching for job titles.
 *
 * The AI suggests titles like "Data Pipeline Engineer" or "ETL Developer" that
 * don't appear verbatim in job postings. This builds a ladder of matching
 * strategies so those suggestions still find relevant jobs.
 *
 * Strategy ladder (in order, first match wins):
 * 1. Exact phrase — "Data Engineer" finds 45 jobs
 * 2. Word-pair (first + last) — "Data Pipeline Engineer" → "Data Engineer" finds 45 jobs
 * 3. Distinctive words (3+ chars, non-generic) — "ETL Developer" → "ETL" finds 3 jobs
 * 4. Original keyword — fallback to original behavior
 */
function expandKeywordForMatching(keyword: string): string[] {
  const lower = keyword.toLowerCase().trim()
  const words = lower.split(/\s+/).filter(w => w.length > 2)
  const expanded: string[] = []

  // Level 1: Exact phrase (always first)
  expanded.push(lower)

  // Level 2: Word-pair fallback — first word + last word
  // "Data Pipeline Engineer" → "Data Engineer"
  if (words.length >= 3) {
    const firstLast = `${words[0]} ${words[words.length - 1]}`
    if (firstLast !== lower) expanded.push(firstLast)
  }

  // Level 3: Distinctive words — filter out generic tech words
  const genericWords = new Set([
    'engineer', 'engineering', 'developer', 'development', 'software',
    'senior', 'junior', 'lead', 'principal', 'staff', 'architect',
    'manager', 'director', 'head', 'analyst', 'specialist', 'scientist',
    'data', 'machine', 'learning', 'artificial', 'intelligence',
    'full', 'stack', 'front', 'back', 'end', 'mobile', 'web',
    'cloud', 'devops', 'platform', 'system', 'systems',
    'new', 'grad', 'entry', 'level', 'associate', 'intern'
  ])

  const distinctive = words.filter(w => !genericWords.has(w) && w.length >= 3)
  for (const dw of distinctive) {
    if (!expanded.includes(dw)) expanded.push(dw)
  }

  // Deduplicate while preserving order
  return [...new Set(expanded)]
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

    // Candidate pool: active US jobs whose title or skills mention a keyword.
    // `skills` is a JSON string column, so `contains` searches it directly.
    // Use progressive fallback matching: each keyword expands to [exact, word-pair, distinctive words]
    const allSearchTerms = keywords.flatMap(kw => expandKeywordForMatching(kw))
    const keywordConditions: Prisma.JobWhereInput[] = allSearchTerms.flatMap(kw => [
      { title: { contains: kw } },
      { skills: { contains: kw } },
    ])

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

    const resumeInfo = { id: resume.id, title: resume.title, roleType: resume.roleType }

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
    const expandedSearchTerms = allSearchTerms.map(k => k.toLowerCase())
    const relevanceBonus = (title: string, roleType: string) => {
      const lowerTitle = title.toLowerCase()
      // Check both original keywords and expanded search terms for title hits
      const titleHit = (lowerKeywords.some(kw => lowerTitle.includes(kw)) ||
                       expandedSearchTerms.some(kw => lowerTitle.includes(kw))) ? 15 : 0
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
          resume: resumeInfo,
        }
      })
      // Filter out jobs the user has already applied to — they belong in Applications
      .filter(job => job.applicationStatus !== 'APPLIED')
      .filter(job => job.score >= minScore)
      .sort((a, b) => b.rank - a.rank || Date.parse(b.postedAt) - Date.parse(a.postedAt))
      .slice(0, limit)
      // `rank` is an internal sort key; the client shows `score`.
      .map(({ rank: _rank, ...job }) => job)

    return NextResponse.json({
      keywords,
      resume: { id: resume.id, title: resume.title, roleType: resume.roleType },
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
