import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { runEvaluation, isCareerOpsReady } from '@/lib/career-ops'
import { getResumeForUser } from '@/lib/career-ops/resume-select'
import { extractJobFromUrl, ExtractionError } from '@/lib/job-fetcher/url-extract'
import { BaseJobProvider } from '@/lib/job-providers/base'
import { stringifyJsonArray } from '@/lib/utils'

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

    // Classify role/experience from the title (same heuristics the providers
    // use) so the saved job shows proper badges on the Dashboard.
    const classified = new BaseJobProvider().parseJob({
      title: extracted.title,
      location: extracted.location || '',
      description: extracted.description,
    })

    // Upsert into the feed (provider OTHER, keyed by the normalized URL) so the
    // evaluated job shows up on the Dashboard like any other job.
    const externalId = url
    const existing = await prisma.job.findUnique({
      where: { externalId_provider: { externalId, provider: 'OTHER' } },
    })

    let saved: { id: string; isNew: boolean }
    if (existing) {
      await prisma.job.update({
        where: { id: existing.id },
        data: {
          title: extracted.title,
          company: extracted.company,
          location: extracted.location || existing.location,
          description: extracted.description,
          applyUrl: extracted.applyUrl,
          roleType: classified.roleType,
          experienceLevel: classified.experienceLevel,
          isActive: true,
          fetchedAt: new Date(),
        },
      })
      saved = { id: existing.id, isNew: false }
    } else {
      const created = await prisma.job.create({
        data: {
          externalId,
          provider: 'OTHER',
          title: extracted.title,
          company: extracted.company,
          location: extracted.location || 'Remote',
          isRemote: extracted.location?.toLowerCase().includes('remote') || false,
          description: extracted.description,
          requirements: stringifyJsonArray([]),
          skills: stringifyJsonArray([]),
          experienceLevel: classified.experienceLevel,
          roleType: classified.roleType,
          currency: 'USD',
          applyUrl: extracted.applyUrl,
          postedAt: new Date(),
          isActive: true,
        },
      })
      saved = { id: created.id, isNew: true }
    }

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
