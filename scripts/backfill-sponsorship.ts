// Visa-sponsorship backfill.
//
// Classifies every active job whose sponsorship status is still unknown
// (visaSponsored IS NULL) — keyword pre-screen first, then batched Claude calls.
// Run this once locally to cover the existing job backlog; the cron and the
// dashboard fetch also classify a small batch on every run.
//
// Usage:
//   npm run backfill:sponsorship
//   npm run backfill:sponsorship -- --limit=200      # stop after classifying ~200
//   npm run backfill:sponsorship -- --keyword-only   # only the obvious cases, no AI
import { classifySponsorshipForJobs } from '@/lib/job-fetcher/sponsorship'
import { prisma } from '@/lib/db'

const args = process.argv.slice(2)
const limitArg = args.find(a => a.startsWith('--limit='))
const hardLimit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined
const keywordOnly = args.includes('--keyword-only')

async function main() {
  console.log(
    keywordOnly
      ? 'Classifying visa sponsorship (keyword-only sweep)...'
      : 'Classifying visa sponsorship for unclassified active jobs...'
  )
  const started = Date.now()

  let total = 0
  let passes = 0

  if (keywordOnly) {
    // Keyword detection is instant, so one pass can cover the entire backlog.
    // (A pass that classifies 0 then really means no obvious cases are left.)
    total = await classifySponsorshipForJobs({ limit: hardLimit ?? 100000, keywordOnly: true })
    console.log(`  keyword sweep: classified ${total}`)
  } else {
    while (hardLimit === undefined || total < hardLimit) {
      passes++
      if (passes > 200) {
        console.log('Stopping after 200 passes (safety cap).')
        break
      }
      const pending = await prisma.job.count({ where: { isActive: true, visaSponsored: null } })
      if (pending === 0) break
      const batch = Math.min(100, hardLimit ? hardLimit - total : 100, pending)
      const classified = await classifySponsorshipForJobs({ limit: batch, batchSize: 40 })
      total += classified
      console.log(`  pass ${passes}: classified ${classified} (running total ${total}, ${pending - classified} still pending)`)
    }
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  console.log('='.repeat(64))
  console.log(`Done — classified ${total} jobs in ${seconds}s`)
  console.log('Jobs left NULL are ambiguous, or the AI was unreachable; re-run to retry them.')
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => process.exit(0))
