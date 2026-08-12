import { NextRequest, NextResponse } from 'next/server'
import { fetchAllJobs, deactivateExpiredJobs, getJobStats } from '@/lib/job-fetcher'
import { checkJobLinks } from '@/lib/job-fetcher/link-checker'
import { autoScoreAllUsers } from '@/lib/job-fetcher/auto-score'
import { classifySponsorshipForJobs } from '@/lib/job-fetcher/sponsorship'

// This endpoint should be called by a cron service (e.g., Vercel Cron, GitHub Actions, etc.)
// It fetches jobs from all providers, deactivates expired ones, and runs the
// apply-link guard-rail so broken links are removed automatically.

export async function GET(request: NextRequest) {
  // Verify the cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('Starting scheduled job fetch...')

    // Fetch jobs from all providers
    const results = await fetchAllJobs()

    // Deactivate expired jobs
    const deactivatedCount = await deactivateExpiredJobs()

    // Guard-rail: deactivate jobs whose apply links are broken/fabricated
    const linkCheck = await checkJobLinks({ deactivate: true })

    // Auto-score jobs for every user with a resume so scores stay fresh (all resumes)
    const scoredByUser = await autoScoreAllUsers()
    const totalScored = scoredByUser.reduce((sum, u) => sum + u.scored, 0)

    // Classify a batch of unclassified jobs for visa sponsorship (keyword + AI).
    // The per-run cap keeps the cron fast; scripts/backfill-sponsorship.ts covers
    // the full backlog locally.
    const sponsorshipClassified = await classifySponsorshipForJobs({ limit: 50 })

    // Get updated stats
    const stats = await getJobStats()

    console.log('Scheduled job fetch completed:', {
      results: results.map(r => ({ provider: r.provider, jobsFetched: r.jobsFetched, jobsNew: r.jobsNew, jobsUpdated: r.jobsUpdated, jobsSkipped: r.jobsSkipped })),
      deactivatedCount,
      linkCheck: { checked: linkCheck.checked, broken: linkCheck.broken, deactivated: linkCheck.deactivated },
      jobsScored: totalScored,
      sponsorshipClassified,
      stats,
    })

    return NextResponse.json({
      success: true,
      results,
      deactivatedCount,
      linkCheck: { checked: linkCheck.checked, broken: linkCheck.broken, deactivated: linkCheck.deactivated },
      jobsScored: totalScored,
      sponsorshipClassified,
      stats,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cron job fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch jobs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}