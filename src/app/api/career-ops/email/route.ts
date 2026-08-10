import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { runApplicationEmail, isCareerOpsReady } from '@/lib/career-ops'
import { getResumeForUser } from '@/lib/career-ops/resume-select'

export const runtime = 'nodejs'

// POST /api/career-ops/email — generate application email drafts
// Uses career-ops email mode methodology against user's resume
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
    const { url, jobId, reportNumber, company, role, customJd, variant } = body

    // Tailor against the resume version the user picked (defaults to latest).
    const resume = await getResumeForUser(user.id, body.resumeId)
    if (!resume) {
      return NextResponse.json(
        { error: 'Upload a resume first — emails are tailored against it.' },
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
        { error: 'Report-based email not yet implemented — use a Dashboard job or paste the JD' },
        { status: 501 }
      )
    } else if (url?.trim()) {
      const { extractJobFromUrl, ExtractionError } = await import('@/lib/job-fetcher/url-extract')
      try {
        const extracted = await extractJobFromUrl(url.trim())
        if (!extracted.description?.trim()) {
          return NextResponse.json(
            { error: 'That page didn\'t yield a job description for the email.' },
            { status: 400 }
          )
        }
        jobData = extracted
      } catch (error) {
        const message = error instanceof ExtractionError ? error.message : 'Couldn\'t read that job link.'
        return NextResponse.json({ error: message }, { status: 400 })
      }
    } else if (company && role) {
      jobData = {
        title: role,
        company,
        description: `Application email for ${role} at ${company}. No full job description available.`,
        applyUrl: body.applyUrl,
      }
    } else {
      return NextResponse.json(
        { error: 'Provide a job URL, jobId, reportNumber, or company+role (with optional customJd)' },
        { status: 400 }
      )
    }

    // Generate email using career-ops mode
    const email = await runApplicationEmail({
      job: jobData,
      resume: { title: resume.title, parsedText: resume.parsedText },
      candidate: { name: user.name, email: user.email },
      options: {
        variant: variant || 'hr_application',
        stuckContext: body.stuckContext,
        noshowContext: body.noshowContext,
      },
    })

    return NextResponse.json({ email, job: jobData })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate email'
    console.error('Application email error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}