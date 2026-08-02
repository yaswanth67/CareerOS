import { NextRequest, NextResponse } from 'next/server'
import { fetchAllJobs, deactivateExpiredJobs, getJobStats } from '@/lib/job-fetcher'

// This endpoint should be called by a cron service (e.g., Vercel Cron, GitHub Actions, etc.)
// It fetches jobs from all providers and deactivates expired ones

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

    // Get updated stats
    const stats = await getJobStats()

    console.log('Scheduled job fetch completed:', {
      results: results.map(r => ({ provider: r.provider, jobsFetched: r.jobsFetched, jobsNew: r.jobsNew, jobsUpdated: r.jobsUpdated })),
      deactivatedCount,
      stats,
    })

    return NextResponse.json({
      success: true,
      results,
      deactivatedCount,
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