import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Every company that has active jobs, each with its active-job count, sorted
// alphabetically — feeds the dashboard Company dropdown (and the filter panel's
// autocomplete). Mirrors the getAvailableCountries helper in /api/jobs.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const jobs = await prisma.job.findMany({
    where: { isActive: true },
    select: { company: true },
  })

  const counts = new Map<string, number>()
  for (const job of jobs) {
    const name = job.company.trim()
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  const companies = Array.from(counts, ([name, count]) => ({ name, count })).sort(
    (a, b) => a.name.localeCompare(b.name)
  )

  return NextResponse.json({ companies })
}
