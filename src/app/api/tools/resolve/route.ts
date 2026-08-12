import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { extractJobFromUrl, ExtractionError } from '@/lib/job-fetcher/url-extract'
import { upsertExtractedJob } from '@/lib/job-fetcher/upsert-extracted-job'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/tools/resolve — paste a job-posting URL from the Tools hub and get
// it saved to the feed, so every AI tool can be run against it. Reads the
// posting from the link (ATS JSON API → JSON-LD → meta/body scrape), upserts it
// via the same helper the Evaluate route uses, and returns the job plus the
// user's latest resume id (the toolkit falls back to it server-side anyway).
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const url = typeof body.url === 'string' ? body.url.trim() : ''
    if (!url) {
      return NextResponse.json({ error: 'Paste a job posting URL' }, { status: 400 })
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
        { error: 'That page didn’t yield a job description to work with.' },
        { status: 400 }
      )
    }

    const { job, isNew } = await upsertExtractedJob(extracted, url)

    // Latest resume so the drawer's resume picker can be pre-selected.
    const latestResume = await prisma.resume.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    })

    return NextResponse.json({
      job,
      resumeId: latestResume?.id ?? undefined,
      isNew,
    })
  } catch (error) {
    console.error('Resolve job error:', error)
    return NextResponse.json({ error: 'Failed to read that job link' }, { status: 500 })
  }
}
