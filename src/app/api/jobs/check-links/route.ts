import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { checkJobLinks } from '@/lib/job-fetcher/link-checker'

// Runs the apply-link guard-rail: shape-checks job URLs and HTTP-checks the
// rest, deactivating definitively-broken links. Called from the dashboard
// "Check Links" button.
//
// HTTP-checking every job takes minutes, so by default only the most recent
// 500 are checked on demand; the 6-hourly cron sweeps the full database.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limitParam = request.nextUrl.searchParams.get('limit')
  const limit = limitParam
    ? Math.max(1, Math.min(parseInt(limitParam, 10) || 500, 5000))
    : 500

  const result = await checkJobLinks({ deactivate: true, limit })

  return NextResponse.json({
    success: true,
    checked: result.checked,
    ok: result.ok,
    broken: result.broken,
    uncertain: result.uncertain,
    deactivated: result.deactivated,
  })
}
