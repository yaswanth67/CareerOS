import { NextRequest, NextResponse } from 'next/server'
import { fetchAllJobs, deactivateExpiredJobs, type FetchResult } from '@/lib/job-fetcher'
import { autoScoreUserJobs } from '@/lib/job-fetcher/auto-score'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type OnboardingEvent =
  | { type: 'phase'; phase: 'fetch' | 'deactivate' | 'score'; message: string; provider?: string; result?: FetchResult }
  | { type: 'done'; summary: { providers: number; newJobs: number; updatedJobs: number; deactivated: number; scored: number; durationMs: number } }
  | { type: 'error'; message: string }

/**
 * Post-login onboarding refresh. Fetches fresh jobs from every provider,
 * deactivates expired ones, and scores matches for the signed-in user against
 * their latest resume. Progress is streamed as NDJSON so the onboarding screen
 * can report live status while the fetch runs (typically 30-120s).
 *
 * Heavy steps the cron handles — link checking and sponsorship classification —
 * are intentionally not run here to keep logins fast.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hasResume = (await prisma.resume.count({ where: { userId: user.id } })) > 0
  if (!hasResume) {
    return NextResponse.json({ error: 'No resume on file' }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: OnboardingEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
        } catch {
          // Client disconnected mid-write — nothing to do.
        }
      }

      const started = Date.now()

      try {
        send({ type: 'phase', phase: 'fetch', message: 'Fetching fresh jobs from providers…' })
        const results = await fetchAllJobs({}, (result) =>
          send({
            type: 'phase',
            phase: 'fetch',
            provider: result.provider,
            result,
            message: `${result.provider}: ${result.jobsFetched} fetched, ${result.jobsNew} new`,
          })
        )
        if (request.signal.aborted) return

        send({ type: 'phase', phase: 'deactivate', message: 'Deactivating expired jobs…' })
        const deactivated = await deactivateExpiredJobs()
        if (request.signal.aborted) return

        send({ type: 'phase', phase: 'score', message: 'Scoring matches against your resume…' })
        const scored = await autoScoreUserJobs(user.id)

        send({
          type: 'done',
          summary: {
            providers: results.length,
            newJobs: results.reduce((a, r) => a + r.jobsNew, 0),
            updatedJobs: results.reduce((a, r) => a + r.jobsUpdated, 0),
            deactivated,
            scored,
            durationMs: Date.now() - started,
          },
        })
      } catch (error) {
        send({ type: 'error', message: error instanceof Error ? error.message : 'Unexpected error' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
