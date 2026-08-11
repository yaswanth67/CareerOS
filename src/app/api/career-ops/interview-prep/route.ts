import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { runInterviewPrep, isCareerOpsReady } from '@/lib/career-ops'
import { getResumeForUser } from '@/lib/career-ops/resume-select'

export const runtime = 'nodejs'

// POST /api/career-ops/interview-prep — generate company-specific interview prep
// Uses career-ops interview-prep mode methodology against user's resume
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
    const { url, jobId, reportNumber, company, role, customJd } = body

    // Tailor against the resume version the user picked (defaults to latest).
    const resume = await getResumeForUser(user.id, body.resumeId)
    if (!resume) {
      return NextResponse.json(
        { error: 'Upload a resume first — interview prep is tailored against it.' },
        { status: 400 }
      )
    }

    // Determine job source
    let jobData: { title: string; company: string; description: string; applyUrl?: string } | null = null

    if (customJd?.trim() && company && role) {
      jobData = {
        title: role,
        company,
        description: customJd.trim(),
        applyUrl: body.applyUrl,
      }
    } else if (jobId) {
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: { title: true, company: true, description: true, applyUrl: true },
      })
      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }
      jobData = job
    } else if (reportNumber) {
      return NextResponse.json(
        { error: 'Report-based interview prep not yet implemented — use a Dashboard job or paste the JD' },
        { status: 501 }
      )
    } else if (url?.trim()) {
      const { extractJobFromUrl, ExtractionError } = await import('@/lib/job-fetcher/url-extract')
      try {
        const extracted = await extractJobFromUrl(url.trim())
        if (!extracted.description?.trim()) {
          return NextResponse.json(
            { error: 'That page didn\'t yield a job description for interview prep.' },
            { status: 400 }
          )
        }
        jobData = extracted
      } catch (error) {
        const message = error instanceof ExtractionError ? error.message : 'Couldn\'t read that job link.'
        return NextResponse.json({ error: message }, { status: 400 })
      }
    } else if (company && role) {
      // Just company + role without full JD - will do company-level prep
      jobData = {
        title: role,
        company,
        description: `Interview preparation for ${role} at ${company}. No full job description available.`,
        applyUrl: body.applyUrl,
      }
    } else {
      return NextResponse.json(
        { error: 'Provide a job URL, jobId, reportNumber, or company+role (with optional customJd)' },
        { status: 400 }
      )
    }

    // Generate interview prep using career-ops mode
    const prep = await runInterviewPrep({
      job: jobData,
      resume: { title: resume.title, parsedText: resume.parsedText },
      candidate: { name: user.name, email: user.email },
      // User can provide additional context
      options: {
        coffeeChatNotes: body.coffeeChatNotes,
        priorStatedComp: body.priorStatedComp,
      },
    })

    return NextResponse.json({ prep, job: jobData })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate interview prep'
    console.error('Interview prep error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}