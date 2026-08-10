import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { runUpskill, isCareerOpsReady } from '@/lib/career-ops'
import { getResumeForUser } from '@/lib/career-ops/resume-select'

export const runtime = 'nodejs'

// POST /api/career-ops/upskill — generate aggregate skill-gap analysis
// Uses career-ops upskill mode methodology against user's resume and evaluation history
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
    const { targetedUrl } = body

    // Tailor against the resume version the user picked (defaults to latest).
    const resume = await getResumeForUser(user.id, body.resumeId)
    if (!resume) {
      return NextResponse.json(
        { error: 'Upload a resume first — upskill analysis is tailored against it.' },
        { status: 400 }
      )
    }

    // Generate upskill analysis using career-ops mode
    const upskill = await runUpskill({
      resume: { title: resume.title, parsedText: resume.parsedText },
      candidate: { name: user.name, email: user.email },
      options: { targetedUrl },
    })

    return NextResponse.json({ upskill })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate upskill analysis'
    console.error('Upskill error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}