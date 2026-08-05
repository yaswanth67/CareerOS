import { prisma } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'

// Visa-sponsorship classifier.
//
// Detection is AI-first (the user's choice): a Claude batch call reads each job's
// title/company/description and answers true/false/null. A conservative keyword
// pre-screen runs first so the obvious cases ("we do not provide visa sponsorship",
// "we will sponsor H-1B") never cost an AI round-trip. Rows keep `visaSponsored`
// as NULL until classified, so the "Sponsorship" filter only ever shows confirmed
// positives. Every failure path is soft — an AI error leaves the row NULL and
// never breaks the job fetch.
//
// In practice most postings never mention sponsorship, so the AI correctly
// reports `null` for them and the keyword pre-screen does the heavy lifting
// (it catches the common "we are unable to sponsor" / "we will sponsor" lines
// across the full description). `keywordOnly` runs just that fast pass.

// --- Keyword pre-screen (only fires on unambiguous phrasing) ---

// Checked FIRST so "unable to offer visa sponsorship" classifies false, not true.
const NEGATIVE_PATTERNS = [
  /no\s+(visa\s+|h[- ]?1[- ]?b\s+)?sponsorship/i,
  /without\s+(visa\s+|h[- ]?1[- ]?b\s+)?sponsorship/i,
  /(unable|not\s+able|not)\s+to?\s+(provide|offer|support|grant)?\s*(visa\s+|h[- ]?1[- ]?b\s+)?sponsorship/i,
  /(cannot|can'?t|will\s+not|won'?t|do\s+not|don'?t|does\s+not|no\s+longer)\s+(provide|offer|support|grant)?\s*(visa\s+|h[- ]?1[- ]?b\s+)?sponsorship/i,
  /(does\s+not|do\s+not|don'?t|won'?t|will\s+not)\s+sponsor/i,
  /not\s+eligible\s+for\s+(visa\s+|h[- ]?1[- ]?b\s+)?(sponsorship|work\s+authorization)/i,
  /not\s+eligible\s+for\s+visa/i,
  /no\s+h[- ]?1[- ]?b/i,
  /sponsorship\s+(is\s+)?not\s+(available|provided|offered)/i,
]

// Only clearly-positive statements — never something that can sit inside a
// negated sentence. The negative pass above already rejected those.
const POSITIVE_PATTERNS = [
  /(we|they|this\s+company)\s+(will|do|'ll)\s+sponsor/i,
  /will\s+sponsor\s+(h[- ]?1[- ]?b|visas?|work\s+visas?)/i,
  /sponsorship\s+(is\s+)?(available|provided|offered)/i,
  /(offer|provide|support)\s+(visa\s+|h[- ]?1[- ]?b\s+)?sponsorship/i,
  /h[- ]?1[- ]?b\s+(visa\s+)?sponsorship/i,
  /sponsors\s+visas?/i,
]

/**
 * Synchronous, conservative classifier for a single job text.
 * Returns `true`/`false` on unambiguous phrasing, or `null` when the AI pass
 * should decide (most jobs).
 */
export function detectSponsorshipKeyword(text: string): boolean | null {
  if (!text) return null
  for (const pattern of NEGATIVE_PATTERNS) {
    if (pattern.test(text)) return false
  }
  for (const pattern of POSITIVE_PATTERNS) {
    if (pattern.test(text)) return true
  }
  return null
}

// --- AI batch classification ---

const anthropicApiKey = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY

let anthropic: Anthropic | null = null
if (anthropicApiKey) {
  anthropic = new Anthropic({
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    apiKey: anthropicApiKey,
  })
}

interface Candidate {
  id: string
  title: string
  company: string
  description: string
}

// Large prompts exhaust the local proxy's output budget (it spends it all on a
// thinking block and returns an empty text block), so keep each description
// short, allow plenty of output tokens, and split the batch in half on any
// parse/empty failure and retry.
// IMPORTANT: Sponsorship info is often at the END of job descriptions.
// We concatenate the first 400 chars + last 400 chars to catch both ends.
const AI_DESCRIPTION_LENGTH = 400
const AI_MAX_TOKENS = 4000

export async function classifyBatchWithAI(batch: Candidate[], attempts = 0): Promise<Record<string, boolean | null>> {
  const result: Record<string, boolean | null> = {}
  if (!anthropic || batch.length === 0) return result
  if (attempts > 2) return result

  const lines = batch
    .map((job, i) => {
      const desc = (job.description || '').replace(/\s+/g, ' ')
      // Sponsorship info is often buried — search for keywords and extract context
      const keywords = ['visa sponsorship', 'h-1b', 'h1b', 'sponsor visa', 'sponsorship available', 'sponsor h-1b', 'work authorization']
      let description = desc.slice(0, 800)  // default: first 800 chars

      for (const kw of keywords) {
        const pos = desc.toLowerCase().indexOf(kw)
        if (pos !== -1) {
          // Found keyword — extract 500 chars around it
          const start = Math.max(0, pos - 200)
          const end = Math.min(desc.length, pos + 500)
          description = desc.slice(start, end)
          break
        }
      }

      return `${i + 1}. Title: ${job.title}\n   Company: ${job.company}\n   Description: ${description}`
    })
    .join('\n\n')

  const prompt = `You are classifying whether a job posting offers visa sponsorship to candidates who need it (e.g. international applicants needing H-1B / OPT / work authorization in the US, or work permits elsewhere).

For each job, decide if the posting clearly states visa sponsorship is AVAILABLE (true), clearly states it is NOT available (false), or is unclear/not mentioned (null).

Respond with ONLY a JSON array of objects, one per job, in the same order. No other text:
[{"index":1,"sponsors":true},{"index":2,"sponsors":null},...]

Jobs:
${lines}`

  let text: string | undefined
  try {
    const response = await anthropic!.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307',
      max_tokens: AI_MAX_TOKENS,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    })

    // Local Claude proxies may prepend a "thinking" block, so find the text block.
    text = response.content.find(block => block.type === 'text')?.text
  } catch (error) {
    console.error('AI sponsorship classification failed for batch:', error)
  }

  if (text) {
    try {
      const parsed = JSON.parse(text.trim())
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          const index = entry?.index
          const candidate = batch[Number(index) - 1]
          if (candidate && typeof entry?.sponsors === 'boolean') {
            result[candidate.id] = entry.sponsors
          }
        }
        return result
      }
    } catch {
      // fall through to retry with a smaller batch
    }
  }

  // Empty response or unparseable — retry on half-size batches.
  if (batch.length > 1) {
    const mid = Math.ceil(batch.length / 2)
    const [a, b] = await Promise.all([
      classifyBatchWithAI(batch.slice(0, mid), attempts + 1),
      classifyBatchWithAI(batch.slice(mid), attempts + 1),
    ])
    Object.assign(result, a, b)
  }
  return result
}

/**
 * Classify the next `limit` unclassified active jobs — keyword pre-screen, then
 * AI batches — persisting `visaSponsored` on the Job rows. Returns how many rows
 * were classified. Never throws: AI/parse failures just leave rows NULL.
 *
 * Pass `keywordOnly: true` for an instant sweep of just the obvious
 * "we do / do not sponsor" cases (skips AI entirely).
 */
export async function classifySponsorshipForJobs(options: { limit?: number; batchSize?: number; keywordOnly?: boolean } = {}): Promise<number> {
  const limit = options.limit ?? 50
  const batchSize = options.batchSize ?? 40
  const keywordOnly = options.keywordOnly ?? false

  const pending = await prisma.job.findMany({
    where: { isActive: true, visaSponsored: null },
    select: { id: true, title: true, company: true, description: true },
    take: limit,
  })
  if (pending.length === 0) return 0

  // Keyword pass first — the obvious cases never cost an AI call.
  const toClassify: Candidate[] = []
  let classified = 0
  for (const job of pending) {
    const keyword = detectSponsorshipKeyword(`${job.title} ${job.company} ${job.description}`)
    if (keyword === true || keyword === false) {
      await prisma.job.update({ where: { id: job.id }, data: { visaSponsored: keyword } })
      classified++
    } else {
      toClassify.push(job)
    }
  }

  if (keywordOnly) return classified

  // AI pass over the remainder, in batches.
  for (let i = 0; i < toClassify.length; i += batchSize) {
    const batch = toClassify.slice(i, i + batchSize)
    const verdicts = await classifyBatchWithAI(batch)
    for (const job of batch) {
      const verdict = verdicts[job.id]
      if (verdict === true || verdict === false) {
        await prisma.job.update({ where: { id: job.id }, data: { visaSponsored: verdict } })
        classified++
      }
    }
  }

  return classified
}
