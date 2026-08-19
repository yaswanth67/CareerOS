import { RawJob, JobProvider, JobFetchFilters } from '@/types'
import { prisma } from '@/lib/db'
import { greenhouseProvider } from '@/lib/job-providers/greenhouse'
import { ashbyProvider } from '@/lib/job-providers/ashby'
import { leverProvider } from '@/lib/job-providers/lever'
import { wellfoundProvider } from '@/lib/job-providers/wellfound'
import { companyDirectProvider } from '@/lib/job-providers/company-direct'
import { remotiveProvider } from '@/lib/job-providers/remotive'
import { remoteokProvider } from '@/lib/job-providers/remoteok'
import { arbeitnowProvider } from '@/lib/job-providers/arbeitnow'
import { jobicyProvider } from '@/lib/job-providers/jobicy'
import { hackerNewsProvider } from '@/lib/job-providers/hackernews'
import { builtinProvider } from '@/lib/job-providers/builtin'
import { diceProvider } from '@/lib/job-providers/dice'
import { validateApplyUrl } from '@/lib/job-providers/base'
import { findDuplicateJob, normalizeCompany } from '@/lib/job-fetcher/dedup'
import { isUsJob, US_ONLY_WHERE } from '@/lib/geo/us-location'

export const providers = [
  greenhouseProvider,
  ashbyProvider,
  leverProvider,
  wellfoundProvider,
  companyDirectProvider,
  remotiveProvider,
  remoteokProvider,
  arbeitnowProvider,
  jobicyProvider,
  hackerNewsProvider,
  builtinProvider,
  diceProvider,
]

export interface FetchResult {
  provider: JobProvider
  jobsFetched: number
  jobsNew: number
  jobsUpdated: number
  jobsSkipped: number
  /** Rejected by the US-only gate — reported separately from broken links. */
  jobsSkippedNonUs: number
  errors: string[]
}

export async function fetchAllJobs(
  filters: JobFetchFilters = {},
  onProviderResult?: (result: FetchResult) => void
): Promise<FetchResult[]> {
  const results: FetchResult[] = []

  for (const provider of providers) {
    const result = await fetchFromProvider(provider, filters)
    results.push(result)
    // Optional per-provider progress callback — lets streaming callers (e.g.
    // the post-login onboarding refresh) report progress to the client.
    onProviderResult?.(result)
  }

  return results
}

async function fetchFromProvider(
  provider: { name: JobProvider; fetchJobs: (filters: JobFetchFilters) => Promise<RawJob[]> },
  filters: JobFetchFilters
): Promise<FetchResult> {
  const result: FetchResult = {
    provider: provider.name,
    jobsFetched: 0,
    jobsNew: 0,
    jobsUpdated: 0,
    jobsSkipped: 0,
    jobsSkippedNonUs: 0,
    errors: [],
  }

  try {
    console.log(`Fetching jobs from ${provider.name}...`)
    const rawJobs = await provider.fetchJobs(filters)
    result.jobsFetched = rawJobs.length

    for (const rawJob of rawJobs) {
      try {
        const saved = await saveJob(rawJob, provider.name)
        if (saved.skippedNonUs) {
          result.jobsSkippedNonUs++
        } else if (saved.skipped) {
          result.jobsSkipped++
        } else if (saved.isNew) {
          result.jobsNew++
        } else {
          result.jobsUpdated++
        }
      } catch (error) {
        result.errors.push(`Failed to save job ${rawJob.externalId}: ${error}`)
      }
    }
  } catch (error) {
    result.errors.push(`Fetch failed: ${error}`)
  }

  console.log(
    `${provider.name}: ${result.jobsFetched} fetched, ${result.jobsNew} new, ` +
    `${result.jobsUpdated} updated, ${result.jobsSkipped} skipped, ` +
    `${result.jobsSkippedNonUs} non-US`
  )
  return result
}

async function saveJob(rawJob: RawJob, provider: JobProvider) {
  // SQLite has no array type — store lists as JSON strings
  const requirements = JSON.stringify(rawJob.requirements ?? [])
  const skills = JSON.stringify(rawJob.skills ?? [])

  // US-only gate: this app targets the US market, so a non-US posting never
  // enters the database. A job already stored whose location has since moved
  // abroad is deactivated rather than refreshed with data we would not show.
  // Jobs whose location names no country at all are rejected too — see
  // isUsJob's `allowUnknown` note.
  if (!isUsJob({ location: rawJob.location, title: rawJob.title, provider })) {
    const existing = await prisma.job.findUnique({
      where: {
        externalId_provider: { externalId: rawJob.externalId, provider: provider },
      },
    })
    if (existing?.isActive) {
      await prisma.job.update({
        where: { id: existing.id },
        data: { isActive: false, isUs: false },
      })
    }
    return { isNew: false, job: null, skipped: true, skippedNonUs: true }
  }

  // Guard-rail: reject jobs whose apply link is missing or fabricated so broken
  // links never reach the feed. If an existing job's link turned invalid, we
  // deactivate it instead of updating it with more bad data.
  const applyUrlError = validateApplyUrl(rawJob.applyUrl)
  if (applyUrlError) {
    const existing = await prisma.job.findUnique({
      where: {
        externalId_provider: {
          externalId: rawJob.externalId,
          provider: provider,
        },
      },
    })
    if (existing) {
      await prisma.job.update({
        where: { id: existing.id },
        data: { isActive: false },
      })
    }
    return { isNew: false, job: null, skipped: true, skippedNonUs: false }
  }

  // Check if job already exists
  const existing = await prisma.job.findUnique({
    where: {
      externalId_provider: {
        externalId: rawJob.externalId,
        provider: provider,
      },
    },
  })

  // Deduplication: same apply link, or same company (case-insensitively) +
  // title + location. See src/lib/job-fetcher/dedup.ts.
  const similar = await findDuplicateJob({
    title: rawJob.title,
    company: rawJob.company,
    location: rawJob.location,
    applyUrl: rawJob.applyUrl,
    excludeId: existing?.id,
  })

  // When this posting already has its own row (matched on the provider's stable
  // externalId) *and* a separate row looks like the same posting, that second
  // row is the duplicate — retire it rather than refreshing it and leaving two
  // active rows for one job. The externalId-keyed row wins because it is the
  // row for this exact posting, where `similar` is only a heuristic match.
  // Deactivating keeps the record intact for any Application/Match pointing at it.
  if (similar && existing) {
    await prisma.job.update({
      where: { id: similar.id },
      data: { isActive: false },
    })
  } else if (similar) {
    // Same posting reached under a different externalId/provider — fold this
    // fetch into the row that already exists instead of adding a second one.
    // Title/company/location are left as stored: they are the identity we
    // matched on, and the incoming spelling is not more authoritative.
    await prisma.job.update({
      where: { id: similar.id },
      data: {
        description: rawJob.description,
        requirements,
        skills,
        experienceLevel: rawJob.experienceLevel,
        roleType: rawJob.roleType,
        salaryMin: rawJob.salaryMin,
        salaryMax: rawJob.salaryMax,
        applyUrl: rawJob.applyUrl,
        expiresAt: rawJob.expiresAt,
        isUs: true,
        fetchedAt: new Date(),
      },
    })
    return { isNew: false, job: similar, skipped: false, skippedNonUs: false }
  }

  if (existing) {
    // Update existing job
    const updated = await prisma.job.update({
      where: { id: existing.id },
      data: {
        title: rawJob.title,
        company: rawJob.company,
        companySlug: normalizeCompany(rawJob.company),
        location: rawJob.location,
        isRemote: rawJob.isRemote,
        description: rawJob.description,
        requirements,
        skills,
        experienceLevel: rawJob.experienceLevel,
        roleType: rawJob.roleType,
        salaryMin: rawJob.salaryMin,
        salaryMax: rawJob.salaryMax,
        currency: rawJob.currency,
        applyUrl: rawJob.applyUrl,
        postedAt: rawJob.postedAt,
        expiresAt: rawJob.expiresAt,
        isActive: true,
        isUs: true,
        fetchedAt: new Date(),
      },
    })
    return { isNew: false, job: updated, skipped: false, skippedNonUs: false }
  }

  // Create new job
  const created = await prisma.job.create({
    data: {
      externalId: rawJob.externalId,
      provider: provider,
      title: rawJob.title,
      company: rawJob.company,
      companySlug: normalizeCompany(rawJob.company),
      location: rawJob.location,
      isRemote: rawJob.isRemote,
      description: rawJob.description,
      requirements,
      skills,
      experienceLevel: rawJob.experienceLevel,
      roleType: rawJob.roleType,
      salaryMin: rawJob.salaryMin,
      salaryMax: rawJob.salaryMax,
      currency: rawJob.currency,
      applyUrl: rawJob.applyUrl,
      postedAt: rawJob.postedAt,
      expiresAt: rawJob.expiresAt,
      isActive: true,
      isUs: true,
    },
  })
  return { isNew: true, job: created, skipped: false, skippedNonUs: false }
}

export async function deactivateExpiredJobs(): Promise<number> {
  const result = await prisma.job.updateMany({
    where: {
      isActive: true,
      OR: [
        { expiresAt: { lt: new Date() } },
        { postedAt: { lt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) } }, // Older than 60 days
      ],
    },
    data: { isActive: false },
  })
  return result.count
}

export async function getJobStats(country?: string) {
  const where: {
    isActive: boolean
    isUs?: boolean
    location?: { contains: string }
    isRemote?: boolean
  } = { isActive: true, ...US_ONLY_WHERE }

  if (country) {
    if (country === 'Global/Remote') {
      where.isRemote = true
    } else {
      where.location = { contains: country }
    }
  }

  const [
    totalJobs,
    activeJobs,
    jobsToday,
    jobsByProvider,
    jobsByRole,
    jobsByExperience,
  ] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.count({ where }),
    prisma.job.count({
      where: {
        ...where,
        fetchedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.job.groupBy({
      by: ['provider'],
      where: { isActive: true },
      _count: true,
    }),
    prisma.job.groupBy({
      by: ['roleType'],
      where: { isActive: true },
      _count: true,
    }),
    prisma.job.groupBy({
      by: ['experienceLevel'],
      where: { isActive: true },
      _count: true,
    }),
  ])

  return {
    totalJobs,
    activeJobs,
    jobsToday,
    jobsByProvider: jobsByProvider.reduce((acc, item) => {
      acc[item.provider as JobProvider] = item._count
      return acc
    }, {} as Record<JobProvider, number>),
    jobsByRole: jobsByRole.reduce((acc, item) => {
      acc[item.roleType] = item._count
      return acc
    }, {} as Record<string, number>),
    jobsByExperience: jobsByExperience.reduce((acc, item) => {
      acc[item.experienceLevel] = item._count
      return acc
    }, {} as Record<string, number>),
  }
}