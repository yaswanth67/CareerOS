import { prisma } from '@/lib/db'
import { validateApplyUrl } from '@/lib/job-providers/base'

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'

type LinkVerdict = 'ok' | 'broken' | 'uncertain'

interface CheckDetail {
  id: string
  provider: string
  company: string
  title: string
  applyUrl: string
  verdict: LinkVerdict
  reason: string
}

export interface CheckResult {
  checked: number
  ok: number
  broken: number
  uncertain: number
  deactivated: number
  details: CheckDetail[]
}

// HTTP-check one apply URL. Follows up to 5 redirects manually so we can see
// the final status. Returns a verdict:
//   ok        – final response is 2xx/3xx
//   broken    – 404 / 410 (page gone) — safe to deactivate
//   uncertain – 403/429 (bot-blocked), 5xx, network error, redirect loop —
//               the job may be fine, just unreachable from here
async function checkUrl(url: string): Promise<{ verdict: LinkVerdict; reason: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    let current = url
    for (let hop = 0; hop < 5; hop++) {
      const res = await fetch(current, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/json,*/*',
        },
        redirect: 'manual',
        signal: controller.signal,
      })

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location')
        if (!loc) return { verdict: 'uncertain', reason: `redirect (${res.status}) without location` }
        current = new URL(loc, current).toString()
        continue
      }

      if (res.status === 404 || res.status === 410) {
        return { verdict: 'broken', reason: `HTTP ${res.status}` }
      }
      if (res.status >= 500) {
        return { verdict: 'uncertain', reason: `HTTP ${res.status} (server error)` }
      }
      if (res.status === 403 || res.status === 429) {
        return { verdict: 'uncertain', reason: `HTTP ${res.status} (bot-blocked)` }
      }
      // 2xx or other 4xx — treat as reachable.
      return { verdict: 'ok', reason: `HTTP ${res.status}` }
    }
    return { verdict: 'uncertain', reason: 'too many redirects' }
  } catch {
    return { verdict: 'uncertain', reason: 'network error / timeout' }
  } finally {
    clearTimeout(timer)
  }
}

async function runChecks(details: CheckDetail[]): Promise<{ ok: number; broken: number; uncertain: number }> {
  const counts = { ok: 0, broken: 0, uncertain: 0 }
  let next = 0
  const worker = async () => {
    while (next < details.length) {
      const i = next++
      const { verdict, reason } = await checkUrl(details[i].applyUrl)
      details[i].verdict = verdict
      details[i].reason = reason
      counts[verdict]++
    }
  }
  // 12 concurrent workers keeps the check fast without hammering job sites.
  await Promise.all(Array.from({ length: 12 }, () => worker()))
  return counts
}

/**
 * Shape- and HTTP-check every active job's apply link.
 *
 * - `deactivate` deactivates definitively-broken jobs (fabricated/placeholder
 *   URLs, and HTTP 404/410). Uncertain results (bot-blocked, server error,
 *   timeout) are reported but never removed.
 * - `limit` caps how many jobs are checked (useful for quick smoke runs).
 */
export async function checkJobLinks(options: { deactivate?: boolean; limit?: number } = {}): Promise<CheckResult> {
  const jobs = await prisma.job.findMany({
    where: { isActive: true, applyUrl: { not: '' } },
    select: { id: true, provider: true, company: true, title: true, applyUrl: true },
    // Check the freshest jobs first when a limit is set.
    orderBy: { postedAt: 'desc' },
    take: options.limit,
  })
  const target = jobs

  const details: CheckDetail[] = target.map(j => ({
    id: j.id,
    provider: j.provider,
    company: j.company || '',
    title: j.title || '',
    applyUrl: j.applyUrl,
    verdict: 'ok' as LinkVerdict,
    reason: '',
  }))

  // Pass 1 – local shape check (no network).
  const shapeBroken: string[] = []
  for (const d of details) {
    const reason = validateApplyUrl(d.applyUrl)
    if (reason) {
      d.verdict = 'broken'
      d.reason = `invalid link (${reason})`
      shapeBroken.push(d.id)
    }
  }

  // Pass 2 – HTTP check on everything that passed the shape check.
  const httpDetails = details.filter(d => d.verdict === 'ok')
  const httpCounts = await runChecks(httpDetails)

  const deactivatedIds = details.filter(d => d.verdict === 'broken').map(d => d.id)
  let deactivated = 0
  if (options.deactivate && deactivatedIds.length > 0) {
    const res = await prisma.job.updateMany({
      where: { id: { in: deactivatedIds } },
      data: { isActive: false },
    })
    deactivated = res.count
  }

  const ok = details.length - httpCounts.broken - httpCounts.uncertain - shapeBroken.length
  return {
    checked: details.length,
    ok,
    broken: httpCounts.broken + shapeBroken.length,
    uncertain: httpCounts.uncertain,
    deactivated,
    details,
  }
}
