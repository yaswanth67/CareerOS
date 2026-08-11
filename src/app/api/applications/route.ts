import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getResumeForUser } from '@/lib/career-ops/resume-select'
import { parseJsonArray } from '@/lib/utils'
import { AppStatus } from '@/types'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as AppStatus | null

    const where: Prisma.ApplicationWhereInput = { userId: user.id }
    if (status) where.status = status

    const applicationsRaw = await prisma.application.findMany({
      where,
      include: {
        job: true,
        resume: { select: { id: true, title: true, roleType: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    // Normalize the nested job's JSON-string columns for the client
    const applications = applicationsRaw.map(app => ({
      ...app,
      job: {
        ...app.job,
        skills: parseJsonArray(app.job.skills),
        requirements: parseJsonArray(app.job.requirements),
      },
    }))

    return NextResponse.json({ applications })
  } catch (error) {
    console.error('Get applications error:', error)
    return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { jobId, resumeId, status = 'SAVED', notes } = body

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
    }

    // Verify job exists
    const job = await prisma.job.findUnique({ where: { id: jobId } })
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // `resumeId` is optional: saving a job from a list (the suggestion feed,
    // for one) has no resume picker in reach, so fall back to the user's
    // latest resume the same way every career-ops route does. A supplied id
    // still has to belong to the caller.
    const resume = await getResumeForUser(user.id, resumeId)
    if (!resume) {
      return NextResponse.json(
        { error: 'Upload a resume first — applications are tracked against one.' },
        { status: 400 }
      )
    }

    const application = await prisma.application.upsert({
      where: {
        userId_jobId: { userId: user.id, jobId },
      },
      update: {
        resumeId: resume.id,
        status,
        notes,
        appliedAt: status === 'APPLIED' ? new Date() : undefined,
      },
      create: {
        userId: user.id,
        jobId,
        resumeId: resume.id,
        status,
        notes,
        appliedAt: status === 'APPLIED' ? new Date() : undefined,
      },
      include: {
        job: true,
        resume: { select: { id: true, title: true, roleType: true } },
      },
    })

    return NextResponse.json({ application }, { status: 201 })
  } catch (error) {
    console.error('Create application error:', error)
    return NextResponse.json({ error: 'Failed to create application' }, { status: 500 })
  }
}