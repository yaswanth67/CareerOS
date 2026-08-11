import { fetchAllJobs } from '@/lib/job-fetcher'
import { classifySponsorshipForJobs } from '@/lib/job-fetcher/sponsorship'

async function main() {
  const started = Date.now()
  const results = await fetchAllJobs()
  console.log('=== FETCH ===')
  for (const r of results) {
    console.log(
      `${r.provider.padEnd(16)} fetched=${r.jobsFetched} new=${r.jobsNew} updated=${r.jobsUpdated} skipped=${r.jobsSkipped} errors=${r.errors.length}`
    )
  }
  console.log(`fetch took ${((Date.now() - started) / 1000).toFixed(1)}s`)

  const classified = await classifySponsorshipForJobs({ limit: 50, batchSize: 40 })
  console.log(`\n=== SPONSORSHIP ===\nclassified ${classified} jobs`)
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => process.exit(0))
