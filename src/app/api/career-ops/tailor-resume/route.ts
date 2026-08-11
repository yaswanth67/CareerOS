import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { runTailoredResume, isCareerOpsReady } from '@/lib/career-ops'
import { getResumeForUser } from '@/lib/career-ops/resume-select'

export const runtime = 'nodejs'

// POST /api/career-ops/tailor-resume — tailor the user's resume to a specific job
// Uses career-ops pdf mode methodology (keyword extraction, skill-gap check,
// summary + bullet rewrite) against the user's latest resume.
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
    const { url, jobId, reportNumber, customJd, title, company, targetRole } = body

    // Tailor the resume version the user picked (defaults to latest).
    const resume = await getResumeForUser(user.id, body.resumeId)
    if (!resume) {
      return NextResponse.json(
        { error: 'Upload a resume first — tailoring works from your existing resume.' },
        { status: 400 }
      )
    }

    // Determine job source: URL, existing job ID, career-ops report, or pasted JD
    let jobData: { title: string; company: string; description: string; applyUrl?: string } | null = null

    if (customJd?.trim()) {
      // Direct JD paste
      jobData = {
        title: title || 'Custom Role',
        company: company || 'Custom Company',
        description: customJd.trim(),
        applyUrl: body.applyUrl,
      }
    } else if (jobId) {
      // Existing Dashboard job
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: { title: true, company: true, description: true, applyUrl: true },
      })
      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }
      jobData = job
    } else if (reportNumber) {
      // Career-ops workspace report — not yet implemented
      return NextResponse.json(
        { error: 'Report-based tailoring not yet implemented — use a Dashboard job or paste the JD' },
        { status: 501 }
      )
    } else if (url?.trim()) {
      // Fetch from URL using existing extractor
      const { extractJobFromUrl, ExtractionError } = await import('@/lib/job-fetcher/url-extract')
      try {
        const extracted = await extractJobFromUrl(url.trim())
        if (!extracted.description?.trim()) {
          return NextResponse.json(
            { error: 'That page didn\'t yield a job description to tailor your resume against.' },
            { status: 400 }
          )
        }
        jobData = extracted
      } catch (error) {
        const message = error instanceof ExtractionError ? error.message : 'Couldn\'t read that job link.'
        return NextResponse.json({ error: message }, { status: 400 })
      }
    } else {
      return NextResponse.json(
        { error: 'Provide a job URL, jobId, reportNumber, or customJd with title/company' },
        { status: 400 }
      )
    }

    // Tailor the resume using career-ops pdf mode methodology
    const tailored = await runTailoredResume({
      job: jobData,
      resume: { title: resume.title, parsedText: resume.parsedText },
      candidate: { name: user.name, email: user.email },
      options: { targetRole },
    })

    return NextResponse.json({ resume: tailored, job: jobData })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to tailor resume'
    console.error('Tailor-resume error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
