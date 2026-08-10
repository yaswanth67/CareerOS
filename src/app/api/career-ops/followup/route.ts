import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { runFollowup, isCareerOpsReady } from '@/lib/career-ops'
import { getResumeForUser } from '@/lib/career-ops/resume-select'

export const runtime = 'nodejs'

// POST /api/career-ops/followup — generate follow-up cadence and drafts
// Uses career-ops followup mode methodology against user's resume and application history
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ready = isCareerOpsReady()
    if (!ready.ok) {
      return NextResponse.json({ error: ready.error }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const { applicationContext, company, role } = body

    // Tailor against the resume version the user picked (defaults to latest).
    const resume = await getResumeForUser(user.id, body.resumeId)
    if (!resume) {
      return NextResponse.json(
        { error: 'Upload a resume first — follow-ups are tailored against it.' },
        { status: 400 }
      )
    }

    // Generate followup analysis using career-ops mode
    const followup = await runFollowup({
      resume: { title: resume.title, parsedText: resume.parsedText },
      candidate: { name: user.name, email: user.email },
      options: {
        ...(applicationContext ? { applicationContext } : {}),
        ...(company ? { company } : {}),
        ...(role ? { role } : {}),
      },
    })

    return NextResponse.json({ followup })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate follow-up analysis'
    console.error('Followup error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}