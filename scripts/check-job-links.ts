// Guard-rail link checker.
//
// Checks every active job's apply link — first with a local shape check
// (rejects homepage/placeholder/fabricated URLs), then with a real HTTP
// request (rejects 404/410). Prints a summary and a sample of the bad links.
//
// Usage:
//   npm run check-links              # report only
//   npm run check-links -- --deactivate   # report + deactivate broken jobs
//   npm run check-links -- --limit=200    # only check the first 200 jobs
import { checkJobLinks } from '@/lib/job-fetcher/link-checker'

const args = process.argv.slice(2)
const deactivate = args.includes('--deactivate')
const limitArg = args.find(a => a.startsWith('--limit='))
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined

async function main() {
  console.log(`Checking job apply links${deactivate ? ' (deactivate broken)' : ''}...`)
  const started = Date.now()
  const result = await checkJobLinks({ deactivate, limit })
  const seconds = ((Date.now() - started) / 1000).toFixed(1)

  console.log('\n' + '='.repeat(64))
  console.log(`Checked ${result.checked} links in ${seconds}s`)
  console.log(`  OK          ${result.ok}`)
  console.log(`  Broken      ${result.broken}${deactivate ? `  (deactivated ${result.deactivated})` : ''}`)
  console.log(`  Uncertain   ${result.uncertain}  (left active)`)
  console.log('='.repeat(64))

  const byProvider = result.details.reduce<Record<string, { broken: number; uncertain: number; total: number }>>(
    (acc, d) => {
      const entry = (acc[d.provider] ??= { broken: 0, uncertain: 0, total: 0 })
      entry.total++
      if (d.verdict === 'broken') entry.broken++
      if (d.verdict === 'uncertain') entry.uncertain++
      return acc
    },
    {}
  )
  console.log('\nBy provider:')
  for (const [provider, c] of Object.entries(byProvider)) {
    console.log(`  ${provider.padEnd(14)} total=${String(c.total).padStart(5)}  broken=${String(c.broken).padStart(5)}  uncertain=${String(c.uncertain).padStart(5)}`)
  }

  const broken = result.details.filter(d => d.verdict === 'broken')
  if (broken.length) {
    console.log(`\nSample of broken links (${broken.length} total):`)
    for (const b of broken.slice(0, 12)) {
      console.log(`  [${b.provider}] ${(b.company || '').slice(0, 18).padEnd(18)} ${b.applyUrl.slice(0, 74)}  — ${b.reason}`)
    }
  }

  const uncertain = result.details.filter(d => d.verdict === 'uncertain')
  if (uncertain.length) {
    console.log(`\nUncertain (${uncertain.length} — not deactivated):`)
    for (const u of uncertain.slice(0, 8)) {
      console.log(`  [${u.provider}] ${(u.company || '').slice(0, 18).padEnd(18)} ${u.applyUrl.slice(0, 74)}  — ${u.reason}`)
    }
  }

  if (deactivate) {
    console.log(`\nDeactivated ${result.deactivated} jobs with broken apply links.`)
  }
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => process.exit(0))
