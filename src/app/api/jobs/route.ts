import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { fetchAllJobs, getJobStats } from '@/lib/job-fetcher'
import { parseJsonArray, extractCountry } from '@/lib/utils'
import { RoleType, ExperienceLevel, JobProvider } from '@/types'
import { Prisma, type Job } from '@prisma/client'

type MatchWithResume = Prisma.MatchGetPayload<{
  include: {
    resume: { select: { id: true; userId: true; title: true; roleType: true } }
  }
}>

type JobWithMatches = Job & { matches?: MatchWithResume[] }

// Shape returned to the client: JSON-string columns normalized to arrays,
// plus the best match against the current user's resumes when requested.
type EnrichedJob = Omit<Job, 'skills' | 'requirements'> & {
  skills: string[]
  requirements: string[]
  matches?: MatchWithResume[]
  bestMatch?: {
    score: number
    reasoning: string
    matchedSkills: string[]
    missingSkills: string[]
  } | null
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const roleTypes = searchParams.get('roleTypes')?.split(',') as RoleType[] | undefined
    const experienceLevels = searchParams.get('experienceLevels')?.split(',') as ExperienceLevel[] | undefined
    const locations = searchParams.get('locations')?.split(',').filter(Boolean)
    const countries = searchParams.get('countries')?.split(',').filter(Boolean)
    const remoteOnly = searchParams.get('remoteOnly') === 'true'
    const minScore = parseInt(searchParams.get('minScore') || '0')
    const search = searchParams.get('search')
    const provider = searchParams.get('provider') as JobProvider | undefined
    const includeMatches = searchParams.get('includeMatches') === 'true'
    const postedWithin = searchParams.get('postedWithin') // hours, e.g. 24, 48, 168

    // Build where clause
    const where: Prisma.JobWhereInput = { isActive: true }

    if (roleTypes?.length) where.roleType = { in: roleTypes }
    if (experienceLevels?.length) where.experienceLevel = { in: experienceLevels }

    // Combine location + keyword conditions into a single OR
    const orConditions: Prisma.JobWhereInput[] = []
    if (locations?.length) {
      orConditions.push(
        ...locations.map(loc => ({
          location: { contains: loc },
        }))
      )
    }
    if (search) {
      orConditions.push(
        { title: { contains: search } },
        { company: { contains: search } },
        { description: { contains: search } },
        // skills is stored as a JSON string, so a plain contains works
        { skills: { contains: search } },
      )
    }
    if (orConditions.length) where.OR = orConditions

    if (remoteOnly) where.isRemote = true
    if (provider) where.provider = provider

    // Countries filter - extract country from location field
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

    // "Posted within" filter (hours) — e.g. ?postedWithin=24 for last day, 48 for 2 days
    if (postedWithin) {
      const hours = parseInt(postedWithin)
      if (!isNaN(hours) && hours > 0) {
        where.postedAt = { gte: new Date(Date.now() - hours * 3600 * 1000) }
      }
    }

    const [jobsRaw, total] = (await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: { postedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: includeMatches ? {
          matches: {
            where: { resume: { userId: user.id } },
            include: { resume: { select: { id: true, userId: true, title: true, roleType: true } } },
          },
        } : undefined,
      }),
      prisma.job.count({ where }),
    ])) as [JobWithMatches[], number]

    // SQLite stores array columns as JSON strings — normalize for the client
    const jobs: EnrichedJob[] = jobsRaw.map(job => ({
      ...job,
      skills: parseJsonArray<string>(job.skills),
      requirements: parseJsonArray<string>(job.requirements),
    }))

    // If includeMatches, we need to add best match score to each job
    let jobsWithMatches = jobs
    if (includeMatches) {
      jobsWithMatches = jobs.map(job => {
        const userMatches = (job.matches ?? []).filter(m => m.resume?.userId === user.id)
        const bestMatch = userMatches.reduce<{
          score: number
          reasoning: string
          matchedSkills: string
          missingSkills: string
        }>(
          (best, current) => (current.score > best.score ? current : best),
          { score: 0, reasoning: '', matchedSkills: '', missingSkills: '' }
        )
        return {
          ...job,
          bestMatch:
            bestMatch.score > 0
              ? {
                  score: bestMatch.score,
                  reasoning: bestMatch.reasoning,
                  matchedSkills: parseJsonArray<string>(bestMatch.matchedSkills),
                  missingSkills: parseJsonArray<string>(bestMatch.missingSkills),
                }
              : null,
          matches: undefined,
        }
      })

      // Filter by minScore if provided
      if (minScore > 0) {
        jobsWithMatches = jobsWithMatches.filter(job =>
          job.bestMatch && job.bestMatch.score >= minScore
        )
      }

      // Sort by best match score descending
      jobsWithMatches.sort((a, b) => (b.bestMatch?.score || 0) - (a.bestMatch?.score || 0))
    }

    return NextResponse.json({
      jobs: jobsWithMatches,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      // Include available countries for filter dropdown
      countries: await getAvailableCountries(),
    })
  } catch (error) {
    console.error('Get jobs error:', error)
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
  }
}

// Helper to get all available countries from active jobs
async function getAvailableCountries(): Promise<string[]> {
  const jobs = await prisma.job.findMany({
    where: { isActive: true },
    select: { location: true, isRemote: true },
  })
  const countries = new Set<string>()
  for (const job of jobs) {
    const country = extractCountry(job.location)
    if (country) {
      countries.add(country)
    } else if (job.isRemote) {
      countries.add('Global/Remote')
    }
  }
  return Array.from(countries).sort()
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    if (action === 'fetch') {
      const results = await fetchAllJobs()
      const stats = await getJobStats()
      return NextResponse.json({ results, stats })
    }

    if (action === 'stats') {
      const stats = await getJobStats()
      return NextResponse.json({ stats })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Jobs POST error:', error)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}