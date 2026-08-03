import { RawJob, JobProvider, JobFetchFilters } from '@/types'
import { prisma } from '@/lib/db'
import { greenhouseProvider } from '@/lib/job-providers/greenhouse'
import { ashbyProvider } from '@/lib/job-providers/ashby'
import { leverProvider } from '@/lib/job-providers/lever'
import { wellfoundProvider } from '@/lib/job-providers/wellfound'
import { companyDirectProvider } from '@/lib/job-providers/company-direct'
import { validateApplyUrl } from '@/lib/job-providers/base'

export const providers = [
  greenhouseProvider,
  ashbyProvider,
  leverProvider,
  wellfoundProvider,
  companyDirectProvider,
]

export interface FetchResult {
  provider: JobProvider
  jobsFetched: number
  jobsNew: number
  jobsUpdated: number
  jobsSkipped: number
  errors: string[]
}

export async function fetchAllJobs(filters: JobFetchFilters = {}): Promise<FetchResult[]> {
  const results: FetchResult[] = []

  for (const provider of providers) {
    const result = await fetchFromProvider(provider, filters)
    results.push(result)
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
    errors: [],
  }

  try {
    console.log(`Fetching jobs from ${provider.name}...`)
    const rawJobs = await provider.fetchJobs(filters)
    result.jobsFetched = rawJobs.length

    for (const rawJob of rawJobs) {
      try {
        const saved = await saveJob(rawJob, provider.name)
        if (saved.skipped) {
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
    `${result.jobsUpdated} updated, ${result.jobsSkipped} skipped`
  )
  return result
}

async function saveJob(rawJob: RawJob, provider: JobProvider) {
  // SQLite has no array type — store lists as JSON strings
  const requirements = JSON.stringify(rawJob.requirements ?? [])
  const skills = JSON.stringify(rawJob.skills ?? [])

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
    return { isNew: false, job: null, skipped: true }
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

  // Deduplication: check for similar jobs by title + company + location
  const similar = await prisma.job.findFirst({
    where: {
      title: rawJob.title,
      company: rawJob.company,
      location: rawJob.location,
      isActive: true,
      NOT: existing ? { id: existing.id } : undefined,
    },
  })

  if (similar) {
    // Update existing similar job with latest info
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
        fetchedAt: new Date(),
      },
    })
    return { isNew: false, job: similar, skipped: false }
  }

  if (existing) {
    // Update existing job
    const updated = await prisma.job.update({
      where: { id: existing.id },
      data: {
        title: rawJob.title,
        company: rawJob.company,
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
        fetchedAt: new Date(),
      },
    })
    return { isNew: false, job: updated, skipped: false }
  }

  // Create new job
  const created = await prisma.job.create({
    data: {
      externalId: rawJob.externalId,
      provider: provider,
      title: rawJob.title,
      company: rawJob.company,
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
    },
  })
  return { isNew: true, job: created, skipped: false }
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
  const where: { isActive: boolean; location?: { contains: string }; isRemote?: boolean } = { isActive: true }

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