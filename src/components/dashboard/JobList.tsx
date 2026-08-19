import { Suspense } from 'react'
import { Prisma, type Job as PrismaJob } from '@prisma/client'
import { JobCard, type Job } from './JobCard'
import { JobSkeleton } from './JobSkeleton'
import { LoadMoreButton } from './LoadMoreButton'
import { prisma } from '@/lib/db'
import { US_ONLY_WHERE } from '@/lib/geo/us-location'
import { getCurrentUser } from '@/lib/auth'
import { parseJsonArray } from '@/lib/utils'
import { RoleType, ExperienceLevel } from '@/types'

interface JobListFilters {
  q?: string
  roles?: string
  loc?: string
  /** Preferred locations from the target filter, comma-separated (OR-matched). */
  locs?: string
  /** Excluded keywords from the target filter, comma-separated. */
  exclude?: string
  /** Minimum annual salary from the target filter. */
  salary?: string
  remote?: string
  posted?: string
  score?: string
  status?: string
  country?: string
  sponsorship?: string
  experienceLevels?: string
  page?: number
}

const PAGE_SIZE = 25

type MatchWithResume = Prisma.MatchGetPayload<{
  include: { resume: { select: { id: true; userId: true } } }
}>

type JobWithMatches = PrismaJob & {
  matches: MatchWithResume[]
  applications?: { id: string; status: string }[]
}

async function getJobs(filters: JobListFilters) {
  const user = await getCurrentUser()
  if (!user) return { jobs: [], resumeId: undefined }

  // The user's most recent resume is used to save applications from the feed
  const resume = await prisma.resume.findFirst({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  })

  // US-only — see src/lib/geo/us-location. Not user-adjustable.
  const where: Prisma.JobWhereInput = { isActive: true, ...US_ONLY_WHERE }

  const roles = filters.roles?.split(',').filter(Boolean) as RoleType[] | undefined
  const experienceLevels = filters.experienceLevels?.split(',').filter(Boolean) as ExperienceLevel[] | undefined

  // Single country from the top-bar dropdown
  const singleCountry = filters.country

  if (roles?.length) where.roleType = { in: roles }
  if (experienceLevels?.length) where.experienceLevel = { in: experienceLevels }
  if (filters.remote === '1') where.isRemote = true

  // Only jobs confirmed to offer visa sponsorship (AI/keyword detected)
  if (filters.sponsorship === '1') where.visaSponsored = true

  // Single country filter (from top dropdown). "United States" is every stored
  // job, so it adds no condition — filtering on the literal string would drop
  // every "San Francisco, CA" posting and leave only the few that spell the
  // country out.
  if (singleCountry) {
    if (singleCountry === 'Global/Remote') {
      where.isRemote = true
    } else if (singleCountry !== 'United States') {
      where.location = { contains: singleCountry }
    }
  }

  // "Tracked" quick filter: only jobs the user has saved / applied to
  if (filters.status) {
    where.applications = { some: { userId: user.id, status: filters.status } }
  } else {
    // "All Jobs" — hide jobs the user has already applied to, so applied jobs
    // don't reappear in the feed. They stay visible under the "Applied" filter.
    where.applications = { none: { userId: user.id, status: 'APPLIED' } }
  }

  const orConditions: Prisma.JobWhereInput[] = []
  if (filters.loc) {
    orConditions.push({ location: { contains: filters.loc } })
  }
  if (filters.q) {
    orConditions.push(
      { title: { contains: filters.q } },
      { company: { contains: filters.q } },
      { description: { contains: filters.q } },
      { skills: { contains: filters.q } },
    )
  }
  if (orConditions.length) where.OR = orConditions

  // Criteria carried by the selected target filter go into AND so they narrow
  // the feed on top of the free-text OR above instead of widening it.
  const andConditions: Prisma.JobWhereInput[] = []

  // Preferred locations — a job in any one of them qualifies. "Remote" is a
  // work mode rather than a place, so it matches the remote flag too.
  const preferredLocations = filters.locs?.split(',').map(l => l.trim()).filter(Boolean) ?? []
  if (preferredLocations.length) {
    andConditions.push({
      OR: preferredLocations.flatMap(loc =>
        loc.toLowerCase() === 'remote'
          ? [{ isRemote: true }, { location: { contains: loc } }]
          : [{ location: { contains: loc } }]
      ),
    })
  }

  // Excluded keywords are matched against the job title AND experience level.
  // A mid-level posting routinely mentions "senior" engineers you'd work with,
  // so we check title only for general keywords. But for experience level terms
  // (senior, staff, principal, entry, mid), we also filter the experienceLevel field.
  const excluded = filters.exclude?.split(',').map(k => k.trim().toLowerCase()).filter(Boolean) ?? []
  if (excluded.length) {
    const experienceLevelKeywords = ['entry', 'mid', 'senior', 'staff', 'principal']
    const excludedExperienceLevels = excluded.filter(k => experienceLevelKeywords.includes(k))
    const excludedTitleKeywords = excluded.filter(k => !experienceLevelKeywords.includes(k))

    const notConditions: Prisma.JobWhereInput[] = []

    if (excludedTitleKeywords.length) {
      notConditions.push({
        OR: excludedTitleKeywords.map(keyword => ({ title: { contains: keyword } })),
      })
    }

    if (excludedExperienceLevels.length) {
      notConditions.push({
        experienceLevel: { in: excludedExperienceLevels.map(k => k.toUpperCase() as ExperienceLevel) },
      })
    }

    if (notConditions.length) {
      andConditions.push({ NOT: { OR: notConditions } })
    }
  }

  // Minimum salary — a job qualifies when either end of its published range
  // clears the bar. Jobs that don't publish a salary can't be checked, so they
  // drop out while this is set.
  if (filters.salary) {
    const min = parseInt(filters.salary)
    if (!isNaN(min) && min > 0) {
      andConditions.push({
        OR: [{ salaryMin: { gte: min } }, { salaryMax: { gte: min } }],
      })
    }
  }

  if (andConditions.length) where.AND = andConditions

  if (filters.posted) {
    const hours = parseInt(filters.posted)
    if (!isNaN(hours) && hours > 0) {
      where.postedAt = { gte: new Date(Date.now() - hours * 3600 * 1000) }
    }
  }

  // Score filter — moved into SQL so the count below stays exact for pagination
  // (a job counts when any of the user's resumes scored it >= min). Equivalent
  // to the old JS-side "best match >= min" check.
  if (filters.score) {
    const min = parseInt(filters.score)
    if (!isNaN(min) && min > 0) {
      where.matches = { some: { resume: { userId: user.id }, score: { gte: min } } }
    }
  }

  // Pagination: fetch `page * PAGE_SIZE` newest jobs so each "Load More" appends
  // the next batch. Rendering every job at once (all ~11k) was so heavy the page
  // never finished painting — only the first few cards appeared.
  const page = Math.max(1, filters.page || 1)

  const [jobs, total] = (await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { postedAt: 'desc' },
      // Fetch extra jobs so we can diversify by company before slicing to page size
      take: page * PAGE_SIZE * 3,
      include: {
        matches: {
          where: { resume: { userId: user.id } },
          include: { resume: { select: { id: true, userId: true } } },
        },
        applications: {
          where: { userId: user.id },
          select: { id: true, status: true },
          take: 1,
        },
      },
    }),
    prisma.job.count({ where }),
  ])) as [JobWithMatches[], number]

  // Add best match to each job and normalize JSON-string columns
  const jobsWithMatch = jobs.map(job => {
    const userMatches = job.matches.filter(m => m.resume.userId === user.id)
    const bestMatch = userMatches.reduce<{
      score: number
      reasoning: string
      matchedSkills: string | string[]
      missingSkills: string | string[]
    }>(
      (best, current) => (current.score > best.score ? current : best),
      { score: 0, reasoning: '', matchedSkills: [], missingSkills: [] }
    )
    return {
      ...job,
      skills: parseJsonArray<string>(job.skills),
      requirements: parseJsonArray<string>(job.requirements),
      match:
        bestMatch.score > 0
          ? {
              score: bestMatch.score,
              reasoning: bestMatch.reasoning,
              matchedSkills: parseJsonArray<string>(bestMatch.matchedSkills),
              missingSkills: parseJsonArray<string>(bestMatch.missingSkills),
            }
          : undefined,
      matches: undefined,
    } as Job
  })

  // Strong matches first — a user's best fits should surface at the top of the
  // feed rather than being buried by recency. Unscored jobs (no resume match
  // yet) sink to the bottom, newest-first among themselves.
  jobsWithMatch.sort((a, b) => {
    const scoreA = a.match?.score ?? 0
    const scoreB = b.match?.score ?? 0
    if (scoreB !== scoreA) return scoreB - scoreA
    return b.postedAt.getTime() - a.postedAt.getTime()
  })

  // Diversify by company: limit results per company so one company doesn't
  // dominate the feed (e.g., Amazon returning hundreds of recent postings).
  // We interleave companies to give a mixed, balanced view.
  function diversifyByCompany(jobs: typeof jobsWithMatch, maxPerCompany = 3): typeof jobsWithMatch {
    const companyGroups = new Map<string, typeof jobsWithMatch>()
    for (const job of jobs) {
      const key = job.company.toLowerCase()
      const arr = companyGroups.get(key) || []
      arr.push(job)
      companyGroups.set(key, arr)
    }

    const diversified: typeof jobsWithMatch = []
    let anyAdded = true
    while (anyAdded && diversified.length < jobsWithMatch.length) {
      anyAdded = false
      for (const [, companyJobs] of companyGroups) {
        if (companyJobs.length > 0 && diversified.length < jobsWithMatch.length) {
          diversified.push(companyJobs.shift()!)
          anyAdded = true
        }
      }
    }
    // Apply per-company cap
    const companyCount = new Map<string, number>()
    return diversified.filter(job => {
      const key = job.company.toLowerCase()
      const count = (companyCount.get(key) || 0) + 1
      companyCount.set(key, count)
      return count <= maxPerCompany
    })
  }

  const diversifiedJobs = diversifyByCompany(jobsWithMatch, 3)

  return {
    jobs: diversifiedJobs,
    resumeId: resume?.id,
    hasMore: total > jobs.length,
    nextPage: page + 1,
  }
}

// Build the URL for the next page of jobs, preserving every existing filter.
function buildNextUrl(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  page: number
): string {
  const params = new URLSearchParams()
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined) continue
      if (Array.isArray(value)) value.forEach(v => params.append(key, v))
      else params.set(key, value)
    }
  }
  params.set('page', String(page))
  return `/dashboard?${params.toString()}`
}

export async function JobList({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const filters: JobListFilters = {
    q: typeof searchParams?.q === 'string' ? searchParams.q : undefined,
    roles: typeof searchParams?.roles === 'string' ? searchParams.roles : undefined,
    loc: typeof searchParams?.loc === 'string' ? searchParams.loc : undefined,
    locs: typeof searchParams?.locs === 'string' ? searchParams.locs : undefined,
    exclude: typeof searchParams?.exclude === 'string' ? searchParams.exclude : undefined,
    salary: typeof searchParams?.salary === 'string' ? searchParams.salary : undefined,
    remote: typeof searchParams?.remote === 'string' ? searchParams.remote : undefined,
    posted: typeof searchParams?.posted === 'string' ? searchParams.posted : undefined,
    score: typeof searchParams?.score === 'string' ? searchParams.score : undefined,
    status: typeof searchParams?.status === 'string' ? searchParams.status : undefined,
    country: typeof searchParams?.country === 'string' ? searchParams.country : undefined,
    sponsorship: typeof searchParams?.sponsorship === 'string' ? searchParams.sponsorship : undefined,
    experienceLevels: typeof searchParams?.experienceLevels === 'string' ? searchParams.experienceLevels : undefined,
    page: typeof searchParams?.page === 'string' ? parseInt(searchParams.page) || 1 : 1,
  }

  const { jobs, resumeId, hasMore, nextPage } = await getJobs(filters)

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 animate-in">
        <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white animate-in" style={{ animationDelay: '100ms' }}>No jobs found</h3>
        <p className="mt-1 text-gray-500 dark:text-gray-400 animate-in" style={{ animationDelay: '200ms' }}>
          Try adjusting your filters or refresh to fetch new jobs
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 w-full">
      {jobs.map((job, index) => (
        <Suspense key={job.id} fallback={<JobSkeleton />}>
          <JobCard
            job={job}
            defaultResumeId={resumeId}
            savedStatus={job.applications?.[0]?.status ?? null}
            entranceDelay={index * 50}
          />
        </Suspense>
      ))}
      {hasMore && (
        <LoadMoreButton href={buildNextUrl(searchParams, nextPage)} />
      )}
    </div>
  )
}