import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { suggestRoles, isCareerOpsReady } from '@/lib/career-ops'
import { getResumeForUser } from '@/lib/career-ops/resume-select'

// POST /api/career-ops/suggest — scan the user's resume and propose adjacent
// job titles at their recorded level (career-ops `titles` mode). No job needed:
// this is a CV-driven feature. Runs through the same Claude connection as the
// rest of career-ops.
export const runtime = 'nodejs'

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
    const resume = await getResumeForUser(user.id, body.resumeId)
    if (!resume) {
      return NextResponse.json(
        { error: 'Upload a resume first — suggestions are generated from it.' },
        { status: 400 }
      )
    }

    const result = await suggestRoles({
      resume: { title: resume.title, parsedText: resume.parsedText },
      candidate: { name: user.name, email: user.email },
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate role suggestions'
    console.error('Career-ops suggest error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
