// companySlug backfill.
//
// `companySlug` is the normalized company name that deduplication matches on
// (see src/lib/job-fetcher/dedup.ts). Rows written before the column existed
// default to "", which would make them invisible to the dedup lookup. Run this
// once after `npm run db:push` to populate them; every write path fills the
// column on its own from then on.
//
// Also reports jobs that are duplicates of each other under the new matching,
// so an existing pair created by the old case-sensitive check can be cleaned up.
//
// Usage:
//   npm run backfill:company-slug
//   npm run backfill:company-slug -- --dry-run   # report only, write nothing
import { prisma } from '@/lib/db'
import { normalizeCompany } from '@/lib/job-fetcher/normalize-company'

const dryRun = process.argv.slice(2).includes('--dry-run')

async function main() {
  const jobs = await prisma.job.findMany({
    select: { id: true, company: true, companySlug: true, title: true, location: true, isActive: true },
  })
  console.log(`Scanning ${jobs.length} jobs...`)

  let updated = 0
  for (const job of jobs) {
    const slug = normalizeCompany(job.company)
    if (slug === job.companySlug) continue
    if (!dryRun) {
      await prisma.job.update({ where: { id: job.id }, data: { companySlug: slug } })
    }
    updated++
  }
  console.log(
    dryRun ? `${updated} jobs would get a companySlug` : `Backfilled companySlug on ${updated} jobs`
  )

  // Duplicate report: active rows that now collide on slug + title + location.
  const seen = new Map<string, string[]>()
  for (const job of jobs) {
    if (!job.isActive) continue
    const key = `${normalizeCompany(job.company)}|${job.title}|${job.location}`
    seen.set(key, [...(seen.get(key) ?? []), job.id])
  }
  const collisions = Array.from(seen.entries()).filter(([, ids]) => ids.length > 1)

  if (collisions.length === 0) {
    console.log('No duplicate active jobs under the new matching.')
  } else {
    console.log(`\n${collisions.length} duplicate group(s) — same company/title/location:`)
    for (const [key, ids] of collisions) {
      console.log(`  ${key} → ${ids.length} rows: ${ids.join(', ')}`)
    }
    console.log('\nDeactivate the extra rows by hand, or re-run the fetch — the next')
    console.log('save of each posting now folds them into a single row.')
  }
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
