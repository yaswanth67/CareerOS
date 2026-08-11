import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { runEvaluation, isCareerOpsReady } from '@/lib/career-ops'
import { getResumeForUser } from '@/lib/career-ops/resume-select'

// POST /api/jobs/[id]/career-ops — evaluate a job against the user's latest
// resume using career-ops' Claude pipeline, driven through the app's existing
// Claude connection (ANTHROPIC_BASE_URL). It reads from the career-ops
// workspace, so it will not run on Vercel serverless.
export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ready = isCareerOpsReady()
    if (!ready.ok) {
      return NextResponse.json({ error: ready.error }, { status: 400 })
    }

    const job = await prisma.job.findUnique({ where: { id } })
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    if (!job.description?.trim()) {
      return NextResponse.json(
        { error: 'This job has no description to evaluate.' },
        { status: 400 }
      )
    }

    // Honour the caller's resume-version choice (the toolkit has a picker);
    // falls back to the latest resume when none is supplied.
    const body = await request.json().catch(() => ({}))
    const resume = await getResumeForUser(user.id, body?.resumeId)
    if (!resume) {
      return NextResponse.json(
        { error: 'Upload a resume first — evaluations are scored against it.' },
        { status: 400 }
      )
    }

    const report = await runEvaluation({
      job: {
        id: job.id,
        title: job.title,
        company: job.company,
        description: job.description,
        applyUrl: job.applyUrl || undefined,
      },
      resume: { title: resume.title, parsedText: resume.parsedText },
      candidate: { name: user.name, email: user.email },
    })

    return NextResponse.json({ report })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to run career-ops evaluation'
    console.error('Career-ops evaluation error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
