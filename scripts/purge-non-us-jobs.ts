// Non-US job purge.
//
// The app targets the US market, and the ingest gate in src/lib/job-fetcher
// now rejects non-US postings. This script cleans up the backlog that was
// stored before that gate existed.
//
// Jobs are DEACTIVATED (isActive = false), never deleted: Match and
// Application rows point at them, and a job whose location string later
// resolves to the US can simply be reactivated by the next fetch.
//
// Usage:
//   npm run purge:non-us                 # dry run — reports, changes nothing
//   npm run purge:non-us -- --apply      # commit the deactivation
//   npm run purge:non-us -- --apply --allow-unknown
//                                        # keep postings that name no country
//   npm run purge:non-us -- --verbose    # list every affected location
import { prisma } from '@/lib/db'
import { classifyUsJob, type UsVerdict } from '@/lib/geo/us-location'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const allowUnknown = args.includes('--allow-unknown')
const verbose = args.includes('--verbose')

async function main() {
  console.log(
    apply
      ? 'Purging non-US jobs (deactivating)...'
      : 'Dry run — no changes will be written. Pass --apply to commit.'
  )
  if (allowUnknown) {
    console.log('Keeping jobs whose location names no country (--allow-unknown).')
  }

  // Every row is classified, not just the active ones: `isUs` is the column the
  // read paths filter on, so it has to be correct for inactive rows too — one
  // of them may be reactivated by a later fetch.
  const jobs = await prisma.job.findMany({
    select: { id: true, location: true, title: true, provider: true, isActive: true },
  })

  const counts: Record<UsVerdict, number> = { US: 0, NON_US: 0, UNKNOWN: 0 }
  const byLocation = new Map<string, { verdict: UsVerdict; count: number }>()
  const doomed: string[] = []
  const flagUs: string[] = []
  const flagNonUs: string[] = []

  for (const job of jobs) {
    const verdict = classifyUsJob(job)
    const keep = verdict === 'US' || (verdict === 'UNKNOWN' && allowUnknown)
    ;(keep ? flagUs : flagNonUs).push(job.id)

    if (!job.isActive) continue
    counts[verdict]++

    if (!keep) {
      doomed.push(job.id)
      const key = job.location || '(empty)'
      const entry = byLocation.get(key) || { verdict, count: 0 }
      entry.count++
      byLocation.set(key, entry)
    }
  }

  const activeScanned = counts.US + counts.NON_US + counts.UNKNOWN
  console.log(
    `\nScanned ${activeScanned} active jobs: ` +
    `${counts.US} US, ${counts.NON_US} non-US, ${counts.UNKNOWN} unknown`
  )

  console.log(
    `Flag backfill: ${flagUs.length} rows isUs=true, ${flagNonUs.length} isUs=false ` +
    `(across all ${jobs.length} rows, active or not)`
  )

  const sorted = [...byLocation.entries()].sort((a, b) => b[1].count - a[1].count)
  const preview = verbose ? sorted : sorted.slice(0, 25)
  console.log(`\nTop locations to deactivate (${sorted.length} distinct):`)
  for (const [location, { verdict, count }] of preview) {
    console.log(`  ${String(count).padStart(5)}  [${verdict}] ${location}`)
  }
  if (!verbose && sorted.length > preview.length) {
    console.log(`  ... +${sorted.length - preview.length} more (pass --verbose to see all)`)
  }

  if (!apply) {
    console.log(`\nWould deactivate ${doomed.length} jobs. Re-run with --apply to commit.`)
    return
  }

  // Chunked: SQLite caps the number of variables in a single statement.
  const CHUNK = 500
  const updateInChunks = async (ids: string[], data: { isActive?: boolean; isUs?: boolean }) => {
    let n = 0
    for (let i = 0; i < ids.length; i += CHUNK) {
      const result = await prisma.job.updateMany({
        where: { id: { in: ids.slice(i, i + CHUNK) } },
        data,
      })
      n += result.count
    }
    return n
  }

  await updateInChunks(flagUs, { isUs: true })
  await updateInChunks(flagNonUs, { isUs: false })
  const updated = await updateInChunks(doomed, { isActive: false })

  const remaining = await prisma.job.count({ where: { isActive: true } })
  console.log(`\nDeactivated ${updated} non-US jobs. ${remaining} active jobs remain.`)
}

main()
  .catch(error => {
    console.error('Purge failed:', error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
