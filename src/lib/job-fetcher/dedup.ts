import { prisma } from '@/lib/db'
import { normalizeCompany } from '@/lib/job-fetcher/normalize-company'

export { normalizeCompany }

// Duplicate detection for job rows, shared by every write path (provider
// fetches in job-fetcher, and the pasted-URL evaluation in
// /api/career-ops/evaluate).
//
// Why a normalized column instead of a case-insensitive query: SQLite's default
// collation is case-sensitive (BINARY), and Prisma's `mode: 'insensitive'` is a
// PostgreSQL/MongoDB-only feature — it is silently unavailable on SQLite. So the
// same posting arriving as company "anthropic" (Greenhouse board slug) and
// "Anthropic" (scraped from the page) used to miss each other and land as two
// rows. Every write stores `companySlug` and matching happens on that.

export interface DuplicateQuery {
  title: string
  company: string
  location: string
  applyUrl: string
  /** Row to exclude — the job we're already updating by externalId+provider. */
  excludeId?: string
}

/**
 * Find an active job that is the same posting as `query`, or null.
 *
 * Two signals, strongest first:
 *   1. Identical applyUrl. Apply links are per-posting and already validated at
 *      ingest (see validateApplyUrl), so a match here is conclusive — and it
 *      catches the cross-provider case where the same ATS link was reached
 *      through a different route (e.g. a fetch vs. a pasted URL).
 *   2. companySlug + title + location. The original heuristic, now immune to
 *      company-name casing.
 *
 * Title and location are still compared exactly: loosening them risks merging
 * genuinely distinct postings (same role posted in two cities), and the same
 * posting from two providers usually differs in location text anyway, which no
 * amount of case folding would reconcile.
 */
export async function findDuplicateJob(query: DuplicateQuery) {
  const notClause = query.excludeId ? { id: query.excludeId } : undefined

  const byUrl = await prisma.job.findFirst({
    where: {
      applyUrl: query.applyUrl,
      isActive: true,
      NOT: notClause,
    },
  })
  if (byUrl) return byUrl

  return prisma.job.findFirst({
    where: {
      companySlug: normalizeCompany(query.company),
      title: query.title,
      location: query.location,
      isActive: true,
      NOT: notClause,
    },
  })
}
