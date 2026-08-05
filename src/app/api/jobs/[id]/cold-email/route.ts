import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateColdEmail } from '@/lib/ai-assist'
import { parseJsonArray } from '@/lib/utils'

// POST /api/jobs/[id]/cold-email — generate a short cold outreach email to the
// company's recruiting team using the user's most recent resume. AI-powered when
// a key is set, otherwise a solid offline template. Soft-fails to a useful
// message if anything is missing.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const job = await prisma.job.findUnique({ where: { id } })
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const resume = await prisma.resume.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    })
    if (!resume) {
      return NextResponse.json(
        { error: 'Upload a resume first — cold emails are written from it.' },
        { status: 400 }
      )
    }

    const email = await generateColdEmail(
      {
        title: job.title,
        company: job.company,
        description: job.description || '',
        skills: parseJsonArray(job.skills) as string[],
        roleType: job.roleType,
        experienceLevel: job.experienceLevel,
      },
      {
        parsedText: resume.parsedText,
        skills: parseJsonArray(resume.skills) as string[],
      }
    )

    return NextResponse.json({ email })
  } catch (error) {
    console.error('Cold email generation error:', error)
    return NextResponse.json({ error: 'Failed to generate cold email' }, { status: 500 })
  }
}
