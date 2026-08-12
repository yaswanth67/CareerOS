import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { runEvaluation, isCareerOpsReady } from '@/lib/career-ops'
import { getResumeForUser } from '@/lib/career-ops/resume-select'
import { extractJobFromUrl, ExtractionError } from '@/lib/job-fetcher/url-extract'
import { upsertExtractedJob } from '@/lib/job-fetcher/upsert-extracted-job'

// POST /api/career-ops/evaluate — paste a job-posting URL, get the career-ops
// score. Reads the posting from the link (ATS JSON API → JSON-LD → meta/body
// scrape), saves it to the feed so it shows up on the Dashboard, then runs the
// same Claude evaluation pipeline as /api/jobs/[id]/career-ops.
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
    const url = typeof body.url === 'string' ? body.url.trim() : ''

    // Score against the resume version the user picked (defaults to latest).
    const resume = await getResumeForUser(user.id, body.resumeId)
    if (!resume) {
      return NextResponse.json(
        { error: 'Upload a resume first — evaluations are scored against it.' },
        { status: 400 }
      )
    }

    let extracted
    try {
      extracted = await extractJobFromUrl(url)
    } catch (error) {
      const message = error instanceof ExtractionError ? error.message : 'Couldn’t read that job link.'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    if (!extracted.description?.trim()) {
      return NextResponse.json(
        { error: 'That page didn’t yield a job description to evaluate.' },
        { status: 400 }
      )
    }

    // Classify + upsert into the feed (provider OTHER, keyed by the URL) so the
    // evaluated job shows up on the Dashboard like any other job. Same helper
    // the Tools "Paste link" resolve route uses. Keep the response shape the
    // client already expects ({ id, isNew }).
    const { job: savedJob, isNew } = await upsertExtractedJob(extracted, url)
    const saved = { id: savedJob.id, isNew }

    const report = await runEvaluation({
      job: {
        id: saved.id,
        title: extracted.title,
        company: extracted.company,
        description: extracted.description,
        applyUrl: extracted.applyUrl || url,
      },
      resume: { title: resume.title, parsedText: resume.parsedText },
      candidate: { name: user.name, email: user.email },
    })

    return NextResponse.json({ job: extracted, report, saved })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to run career-ops evaluation'
    console.error('Career-ops evaluate error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
