import { Suspense } from 'react'
import { Prisma, type Job as PrismaJob } from '@prisma/client'
import { JobCard, type Job } from './JobCard'
import { JobSkeleton } from './JobSkeleton'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { parseJsonArray } from '@/lib/utils'
import { RoleType, ExperienceLevel } from '@/types'

interface JobListFilters {
  q?: string
  roles?: string
  exp?: string
  loc?: string
  remote?: string
  posted?: string
  score?: string
  status?: string
  countries?: string
  country?: string
}

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

  const where: Prisma.JobWhereInput = { isActive: true }

  const roles = filters.roles?.split(',').filter(Boolean) as RoleType[] | undefined
  const exp = filters.exp?.split(',').filter(Boolean) as ExperienceLevel[] | undefined
  const countries = filters.countries?.split(',').filter(Boolean)

  // Also support single country from dropdown
  const singleCountry = filters.country

  if (roles?.length) where.roleType = { in: roles }
  if (exp?.length) where.experienceLevel = { in: exp }
  if (filters.remote === '1') where.isRemote = true

  // Countries filter (multi-select from advanced filters)
  if (countries?.length) {
    const countryConditions: Prisma.JobWhereInput[] = []
    for (const country of countries) {
      if (country === 'Global/Remote') {
        countryConditions.push({ isRemote: true })
      } else {
        countryConditions.push({ location: { contains: country } })
      }
    }
    if (countryConditions.length) {
      where.OR = where.OR ? [...where.OR, ...countryConditions] : countryConditions
    }
  }

  // Single country filter (from top dropdown)
  if (singleCountry) {
    if (singleCountry === 'Global/Remote') {
      where.isRemote = true
    } else {
      where.location = { contains: singleCountry }
    }
  }

  // "Tracked" quick filter: only jobs the user has saved / applied to
  if (filters.status) {
    where.applications = { some: { userId: user.id, status: filters.status } }
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

  if (filters.posted) {
    const hours = parseInt(filters.posted)
    if (!isNaN(hours) && hours > 0) {
      where.postedAt = { gte: new Date(Date.now() - hours * 3600 * 1000) }
    }
  }

  const jobs = (await prisma.job.findMany({
    where,
    orderBy: { postedAt: 'desc' },
    // Show every matching job - no artificial limit
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
  })) as JobWithMatches[]

  // Add best match to each job and normalize JSON-string columns
  let jobsWithMatch = jobs.map(job => {
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

  // Optional minimum match score filter
  if (filters.score) {
    const min = parseInt(filters.score)
    if (!isNaN(min) && min > 0) {
      jobsWithMatch = jobsWithMatch.filter(job => job.match && job.match.score >= min)
    }
  }

  return { jobs: jobsWithMatch, resumeId: resume?.id }
}

export async function JobList({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const filters: JobListFilters = {
    q: typeof searchParams?.q === 'string' ? searchParams.q : undefined,
    roles: typeof searchParams?.roles === 'string' ? searchParams.roles : undefined,
    exp: typeof searchParams?.exp === 'string' ? searchParams.exp : undefined,
    loc: typeof searchParams?.loc === 'string' ? searchParams.loc : undefined,
    remote: typeof searchParams?.remote === 'string' ? searchParams.remote : undefined,
    posted: typeof searchParams?.posted === 'string' ? searchParams.posted : undefined,
    score: typeof searchParams?.score === 'string' ? searchParams.score : undefined,
    status: typeof searchParams?.status === 'string' ? searchParams.status : undefined,
    countries: typeof searchParams?.countries === 'string' ? searchParams.countries : undefined,
    country: typeof searchParams?.country === 'string' ? searchParams.country : undefined,
  }

  const { jobs, resumeId } = await getJobs(filters)

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">No jobs found</h3>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Try adjusting your filters or refresh to fetch new jobs
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 w-full">
      {jobs.map((job) => (
        <Suspense key={job.id} fallback={<JobSkeleton />}>
          <JobCard
            job={job}
            defaultResumeId={resumeId}
            savedStatus={job.applications?.[0]?.status ?? null}
          />
        </Suspense>
      ))}
    </div>
  )
}