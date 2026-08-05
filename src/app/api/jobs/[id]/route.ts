import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseJsonArray } from '@/lib/utils'

// GET /api/jobs/[id] — one job with the user's match (best score across their
// resumes) and application status, shaped like the feed's Job type so the detail
// drawer can render it directly (used to swap to a similar job).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        applications: { where: { userId: user.id }, select: { id: true, status: true } },
        matches: {
          where: { resume: { userId: user.id } },
          orderBy: { score: 'desc' },
          take: 1,
        },
      },
    })
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const match = job.matches[0]

    return NextResponse.json({
      job: {
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        isRemote: job.isRemote,
        description: job.description,
        skills: parseJsonArray(job.skills) as string[],
        experienceLevel: job.experienceLevel,
        roleType: job.roleType,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        applyUrl: job.applyUrl,
        postedAt: job.postedAt,
        provider: job.provider,
        visaSponsored: job.visaSponsored,
        match: match
          ? {
              score: match.score,
              reasoning: match.reasoning,
              matchedSkills: parseJsonArray(match.matchedSkills) as string[],
              missingSkills: parseJsonArray(match.missingSkills) as string[],
            }
          : undefined,
        applications: job.applications,
      },
    })
  } catch (error) {
    console.error('Get job error:', error)
    return NextResponse.json({ error: 'Failed to fetch job' }, { status: 500 })
  }
}
