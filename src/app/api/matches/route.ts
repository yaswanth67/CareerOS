import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { US_ONLY_WHERE } from '@/lib/geo/us-location'
import { batchScoreJobs } from '@/lib/ai-matcher'
import { parseJsonArray, stringifyJsonArray } from '@/lib/utils'
import { Prisma, type Job } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { resumeId, jobIds } = body

    if (!resumeId) {
      return NextResponse.json({ error: 'Resume ID required' }, { status: 400 })
    }

    // Get the resume
    const resume = await prisma.resume.findFirst({
      where: { id: resumeId, userId: user.id },
    })

    if (!resume) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
    }

    // Get jobs to score
    let jobs: Job[]
    if (jobIds?.length) {
      jobs = await prisma.job.findMany({
        where: { id: { in: jobIds }, isActive: true, ...US_ONLY_WHERE },
      })
    } else {
      // Score against all active jobs that don't have a match for this resume yet
      jobs = await prisma.job.findMany({
        where: {
          isActive: true,
          ...US_ONLY_WHERE,
          matches: { none: { resumeId } },
        },
        take: 100, // Cap for responsive heuristic scoring
        orderBy: { postedAt: 'desc' },
      })
    }

    if (jobs.length === 0) {
      // If no new jobs to score, return existing matches
      const existingMatches = await prisma.match.findMany({
        where: { resumeId, job: { isActive: true, ...US_ONLY_WHERE } },
        include: { job: true },
        orderBy: { score: 'desc' },
        take: 100,
      })
      return NextResponse.json({
        matches: existingMatches.map(m => ({
          jobId: m.jobId,
          score: m.score,
          reasoning: m.reasoning,
          matchedSkills: parseJsonArray(m.matchedSkills),
          missingSkills: parseJsonArray(m.missingSkills),
        }))
      })
    }

    // Score jobs against resume (skills/requirements are stored as JSON strings)
    const results = await batchScoreJobs(
      resume.parsedText,
      parseJsonArray(resume.skills) as string[],
      jobs.map(job => ({
        id: job.id,
        title: job.title,
        company: job.company,
        description: job.description,
        skills: parseJsonArray(job.skills) as string[],
        experienceLevel: job.experienceLevel,
        roleType: job.roleType,
      }))
    )

    // Save matches to database
    const savedMatches = []
    for (const job of jobs) {
      const matchResult = results.get(job.id)
      if (matchResult) {
        await prisma.match.upsert({
          where: {
            jobId_resumeId: { jobId: job.id, resumeId },
          },
          update: {
            score: matchResult.score,
            reasoning: matchResult.reasoning,
            matchedSkills: stringifyJsonArray(matchResult.matchedSkills),
            missingSkills: stringifyJsonArray(matchResult.missingSkills),
          },
          create: {
            jobId: job.id,
            resumeId,
            score: matchResult.score,
            reasoning: matchResult.reasoning,
            matchedSkills: stringifyJsonArray(matchResult.matchedSkills),
            missingSkills: stringifyJsonArray(matchResult.missingSkills),
          },
        })
        savedMatches.push({ jobId: job.id, ...matchResult })
      }
    }

    return NextResponse.json({ matches: savedMatches })
  } catch (error) {
    console.error('Score jobs error:', error)
    return NextResponse.json({ error: 'Failed to score jobs' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const resumeId = searchParams.get('resumeId')
    const minScore = parseFloat(searchParams.get('minScore') || '0')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Prisma.MatchWhereInput = {
      resume: { userId: user.id },
      score: { gte: minScore },
      // A match outlives the job it scored, so filter on the job itself, not
      // just on the match: a match made before the US-only gate can still point
      // at a foreign job, and one whose job was later deactivated (dead apply
      // link, or expired) would otherwise keep surfacing here with an "Open"
      // button that goes nowhere.
      job: { isActive: true, ...US_ONLY_WHERE },
    }

    if (resumeId) where.resumeId = resumeId

    const matchesRaw = await prisma.match.findMany({
      where,
      include: {
        job: true,
        resume: { select: { id: true, title: true, roleType: true } },
      },
      orderBy: { score: 'desc' },
      take: limit,
    })

    // Get application statuses for these jobs for this user
    const jobIds = matchesRaw.map(m => m.job.id)
    const applications = await prisma.application.findMany({
      where: {
        userId: user.id,
        jobId: { in: jobIds },
      },
      select: { jobId: true, status: true },
    })
    const applicationStatusMap = new Map(applications.map(a => [a.jobId, a.status]))

    // Filter out jobs that have been applied to (APPLIED status)
    // These should only appear in the Applications page under "Applied"
    const filteredMatches = matchesRaw.filter(match => applicationStatusMap.get(match.job.id) !== 'APPLIED')

    // Normalize JSON-string columns for the client
    const matches = filteredMatches.map(match => ({
      ...match,
      matchedSkills: parseJsonArray(match.matchedSkills),
      missingSkills: parseJsonArray(match.missingSkills),
      job: {
        ...match.job,
        skills: parseJsonArray(match.job.skills),
        requirements: parseJsonArray(match.job.requirements),
        applicationStatus: applicationStatusMap.get(match.job.id) || null,
      },
    }))

    return NextResponse.json({ matches })
  } catch (error) {
    console.error('Get matches error:', error)
    return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 })
  }
}