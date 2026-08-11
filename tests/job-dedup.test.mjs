/**
 * job-dedup.test.mjs — regression tests for company-name normalization.
 *
 * `companySlug` is what job deduplication matches on (src/lib/job-fetcher/dedup.ts),
 * because SQLite compares strings case-sensitively and Prisma's
 * `mode: 'insensitive'` is not supported on SQLite. Before this normalization
 * the same posting stored as "anthropic" (Greenhouse board slug) and
 * "Anthropic" (scraped from the page) missed each other and landed as two rows.
 *
 * Every casing pair below was observed in the real job table.
 *
 * Run: npx tsx tests/job-dedup.test.mjs
 */

import { normalizeCompany } from '../src/lib/job-fetcher/normalize-company.ts'

let passed = 0
let failed = 0

function check(input, expected, note = '') {
  const actual = normalizeCompany(input)
  if (actual === expected) {
    passed++
  } else {
    failed++
    console.error(`  FAIL ${JSON.stringify(input)} -> ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}${note ? ` (${note})` : ''}`)
  }
}

/** Both spellings must collapse to the same slug, or dedup misses the pair. */
function checkSame(a, b, note = '') {
  const [sa, sb] = [normalizeCompany(a), normalizeCompany(b)]
  if (sa === sb && sa !== '') {
    passed++
  } else {
    failed++
    console.error(`  FAIL ${JSON.stringify(a)} -> ${JSON.stringify(sa)} but ${JSON.stringify(b)} -> ${JSON.stringify(sb)}${note ? ` (${note})` : ''}`)
  }
}

function checkDifferent(a, b, note = '') {
  if (normalizeCompany(a) !== normalizeCompany(b)) {
    passed++
  } else {
    failed++
    console.error(`  FAIL ${JSON.stringify(a)} and ${JSON.stringify(b)} both -> ${JSON.stringify(normalizeCompany(a))}${note ? ` (${note})` : ''}`)
  }
}

console.log('Casing pairs found in the job table')
checkSame('Anthropic', 'anthropic', 'the reported duplicate')
checkSame('OpenAI', 'openai')
checkSame('AlphaSense', 'Alphasense')
checkSame('SumUp', 'Sumup')
checkSame('GitLab', 'gitlab')
checkSame('Cloudflare', 'cloudflare')
checkSame('Vercel', 'vercel')
checkSame('Zscaler', 'zscaler')

console.log('Punctuation and spacing')
check('Anthropic', 'anthropic')
check('  Anthropic  ', 'anthropic', 'surrounding whitespace')
check('Acme, Inc.', 'acme-inc', 'punctuation runs collapse to one hyphen')
checkSame('Acme, Inc.', 'Acme Inc')
checkSame('Hewlett-Packard', 'Hewlett Packard', 'hyphen vs space')
// Word boundaries are kept, so a name that differs by a space is a different
// company. Deliberate: every real variant seen differs only in case, and
// stripping separators would start merging names that merely look alike.
checkDifferent('SumUp', 'Sum Up')

console.log('Accents fold')
checkSame('Nestlé', 'Nestle')
checkSame('Zürich Insurance', 'Zurich Insurance')

console.log('Non-Latin names keep a distinct slug')
// An ASCII-only character class would erase these entirely, and every company
// written in a non-Latin script would then collide on the empty slug.
checkDifferent('软件设计公司', '株式会社テスト')
check('', '', 'empty name is the one legitimate empty slug')

console.log('Distinct companies stay distinct')
checkDifferent('Stripe', 'Stripes')
checkDifferent('Meta', 'Meta Platforms')

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
