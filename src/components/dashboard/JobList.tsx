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
}

type MatchWithResume = Prisma.MatchGetPayload<{
  include: { resume: { select: { id: true; userId: true } } }
}>

type JobWithMatches = PrismaJob & { matches: MatchWithResume[] }

async function getJobs(filters: JobListFilters) {
  const user = await getCurrentUser()
  if (!user) return []

  const where: Prisma.JobWhereInput = { isActive: true }

  const roles = filters.roles?.split(',').filter(Boolean) as RoleType[] | undefined
  const exp = filters.exp?.split(',').filter(Boolean) as ExperienceLevel[] | undefined

  if (roles?.length) where.roleType = { in: roles }
  if (exp?.length) where.experienceLevel = { in: exp }
  if (filters.remote === '1') where.isRemote = true

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
    take: 24,
    include: {
      matches: {
        where: { resume: { userId: user.id } },
        include: { resume: { select: { id: true, userId: true } } },
      },
    },
  })) as JobWithMatches[]

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

  // Optional minimum match score filter
  if (filters.score) {
    const min = parseInt(filters.score)
    if (!isNaN(min) && min > 0) {
      return jobsWithMatch.filter(job => job.match && job.match.score >= min)
    }
  }

  return jobsWithMatch
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
  }

  const jobs = await getJobs(filters)

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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {jobs.map((job) => (
        <Suspense key={job.id} fallback={<JobSkeleton />}>
          <JobCard job={job} />
        </Suspense>
      ))}
    </div>
  )
}