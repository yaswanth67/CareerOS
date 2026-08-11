import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { US_ONLY_WHERE } from '@/lib/geo/us-location'

// Every company that has active jobs, each with its active-job count, sorted
// alphabetically — feeds the dashboard Company dropdown (and the filter panel's
// autocomplete). Mirrors the getAvailableCountries helper in /api/jobs.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const jobs = await prisma.job.findMany({
    where: { isActive: true, ...US_ONLY_WHERE },
    select: { company: true, companySlug: true },
  })

  // Group on the normalized slug so a company whose name reaches us with
  // different casing from different providers ("anthropic" from the Greenhouse
  // board slug, "Anthropic" scraped from the page) is one dropdown entry, not
  // two. The label shown is the spelling most rows use.
  const groups = new Map<string, { count: number; labels: Map<string, number> }>()
  for (const job of jobs) {
    const name = job.company.trim()
    if (!name) continue
    const key = job.companySlug || name.toLowerCase()
    let group = groups.get(key)
    if (!group) {
      group = { count: 0, labels: new Map() }
      groups.set(key, group)
    }
    group.count++
    group.labels.set(name, (group.labels.get(name) ?? 0) + 1)
  }

  const companies = Array.from(groups.values(), group => {
    const [name] = Array.from(group.labels).sort((a, b) => b[1] - a[1])[0]
    return { name, count: group.count }
  }).sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json({ companies })
}
