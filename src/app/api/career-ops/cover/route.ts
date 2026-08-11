import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { runCoverLetter, isCareerOpsReady } from '@/lib/career-ops'
import { getResumeForUser } from '@/lib/career-ops/resume-select'

export const runtime = 'nodejs'

// POST /api/career-ops/cover — generate a tailored cover letter for a job
// Uses career-ops cover mode methodology against user's resume
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

    // Body is read before the resume so the caller's resume-version choice
    // applies here too — this route used to ignore it and always take the
    // latest, unlike every other career-ops route.
    const body = await request.json().catch(() => ({}))
    const resume = await getResumeForUser(user.id, body.resumeId)
    if (!resume) {
      return NextResponse.json(
        { error: 'Upload a resume first — cover letters are tailored against it.' },
        { status: 400 }
      )
    }

    const { url, jobId, reportNumber, customJd } = body

    // Determine job source: URL, existing job ID, career-ops report, or pasted JD
    let jobData: { title: string; company: string; description: string; applyUrl?: string } | null = null

    if (customJd?.trim()) {
      // Direct JD paste
      jobData = {
        title: body.title || 'Custom Role',
        company: body.company || 'Custom Company',
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
      // Career-ops workspace report — would need to read from reports/
      return NextResponse.json(
        { error: 'Report-based cover letter not yet implemented — use a Dashboard job or paste the JD' },
        { status: 501 }
      )
    } else if (url?.trim()) {
      // Fetch from URL using existing extractor
      const { extractJobFromUrl, ExtractionError } = await import('@/lib/job-fetcher/url-extract')
      try {
        const extracted = await extractJobFromUrl(url.trim())
        if (!extracted.description?.trim()) {
          return NextResponse.json(
            { error: 'That page didn\'t yield a job description to write a cover letter for.' },
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

    // Generate cover letter using career-ops mode
    const coverLetter = await runCoverLetter({
      job: jobData,
      resume: { title: resume.title, parsedText: resume.parsedText },
      candidate: { name: user.name, email: user.email },
      options: {
        // User preferences from request
        tone: body.tone,
        whyThisRole: body.whyThisRole,
        problemToSolve: body.problemToSolve,
        approach: body.approach,
        gapResponses: body.gapResponses,
      },
    })

    return NextResponse.json({ coverLetter, job: jobData })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate cover letter'
    console.error('Cover letter error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}