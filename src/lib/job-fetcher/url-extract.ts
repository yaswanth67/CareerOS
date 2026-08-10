import { htmlToText } from '@/lib/utils'
import { validateApplyUrl } from '@/lib/job-providers/base'

// Turn a single job-posting URL into the fields career-ops needs to evaluate it.
// Strategy, in order of reliability:
//   1. ATS-aware structured fetch — Greenhouse / Lever / Ashby expose public
//      per-posting JSON APIs keyed by the id in the URL.
//   2. Generic HTML scrape — parse JSON-LD (application/ld+json) JobPosting
//      blocks, then fall back to OpenGraph / meta tags / cleaned body text.
// Throws with a clear, user-facing message when the link can't be read (bot
// block, 404, landing page, no description), so the UI can show *why* instead
// of a generic failure.

export interface ExtractedJob {
  title: string
  company: string
  description: string
  location?: string
  applyUrl: string
}

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
const TIMEOUT_MS = 15000
const MAX_DESCRIPTION = 30000

/** User-facing extraction error — message is safe to show in the UI. */
export class ExtractionError extends Error {}

function capitalize(slug: string): string {
  return slug
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
}

async function fetchResponse(url: string, accept: string): Promise<Response> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: accept,
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  return res
}

/** Shared fetch error mapping so every path reports the same clear reasons. */
function throwForHttpStatus(res: Response): never {
  if (res.status === 404 || res.status === 410) {
    throw new ExtractionError('The page returned a 404 — the posting may have been removed or closed.')
  }
  if (res.status === 403 || res.status === 429) {
    throw new ExtractionError(
      'That page blocks automated access. LinkedIn, Indeed and some career sites won’t let a server read them — try the company’s own careers page (Greenhouse, Ashby or Lever links work best).'
    )
  }
  throw new ExtractionError(`Couldn’t read that page (HTTP ${res.status}). It may be temporarily unavailable.`)
}

// ── ATS-specific extractors ────────────────────────────────────────────────

async function tryGreenhouse(url: URL): Promise<ExtractedJob | null> {
  const m = url.pathname.match(/(?:^|\/)v1\/boards\/([^/]+)\/jobs\/(\d+)/) ||
            url.pathname.match(/^\/([^/]+)\/jobs\/(\d+)/)
  if (!m) return null
  const [, board, id] = m
  const res = await fetchResponse(
    `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${id}`,
    'application/json'
  )
  if (res.status === 404) return null // not found via this board — let fallback try
  if (!res.ok) throwForHttpStatus(res)

  const data = (await res.json()) as {
    title?: string
    content?: string
    location?: { name?: string }
    absolute_url?: string
  }
  const description = htmlToText(data.content || '')
  if (!data.title || !description) return null

  return {
    title: data.title,
    company: capitalize(board),
    description,
    location: data.location?.name,
    applyUrl: data.absolute_url || url.toString(),
  }
}

async function tryLever(url: URL): Promise<ExtractedJob | null> {
  const m = url.pathname.match(/^\/([^/]+)\/([^/?#]+)/)
  if (!m) return null
  const [, company, id] = m
  const res = await fetchResponse(`https://api.lever.co/v0/postings/${company}/${id}`, 'application/json')
  if (res.status === 404) return null
  if (!res.ok) throwForHttpStatus(res)

  const data = (await res.json()) as {
    text?: string
    descriptionPlain?: string
    description?: string
    categories?: { location?: string }
    hostedUrl?: string
  }
  const description = htmlToText(data.descriptionPlain || data.description || '')
  if (!data.text || !description) return null

  return {
    title: data.text,
    company: capitalize(company),
    description,
    location: data.categories?.location,
    applyUrl: data.hostedUrl || url.toString(),
  }
}

async function tryAshby(url: URL): Promise<ExtractedJob | null> {
  const m = url.pathname.match(/^\/([^/]+)\/([^/?#]+)/)
  if (!m) return null
  const [, org, id] = m

  const perPost = await fetchResponse(
    `https://api.ashbyhq.com/posting-api/job-board/${org}/${id}`,
    'application/json'
  )
  if (perPost.status === 404) {
    // Older boards don't serve a per-post endpoint — list and match by id/url.
    const listRes = await fetchResponse(
      `https://api.ashbyhq.com/posting-api/job-board/${org}`,
      'application/json'
    )
    if (!listRes.ok) return null
    const list = (await listRes.json()) as { jobs?: AshbyJob[] }
    const found = (list.jobs || []).find(j => j.id === id || (j.applyUrl || j.jobUrl || '').includes(id))
    if (!found) return null
    return parseAshbyJob(found, org, url.toString())
  }
  if (!perPost.ok) return null
  const data = (await perPost.json()) as AshbyJob
  return parseAshbyJob(data, org, url.toString())
}

interface AshbyJob {
  id?: string
  title?: string
  location?: string | null
  isRemote?: boolean
  descriptionHtml?: string | null
  jobUrl?: string | null
  applyUrl?: string | null
}

function parseAshbyJob(job: AshbyJob, org: string, fallbackUrl: string): ExtractedJob | null {
  const description = htmlToText(job.descriptionHtml || '')
  if (!job.title || !description) return null
  return {
    title: job.title,
    company: capitalize(org),
    description,
    location: job.location || undefined,
    applyUrl: job.applyUrl || job.jobUrl || fallbackUrl,
  }
}

// ── Generic HTML fallback ──────────────────────────────────────────────────

/** Walk parsed JSON-LD and return the first JobPosting object, if any. */
function findJobPosting(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findJobPosting(item)
      if (found) return found
    }
    return null
  }
  if (!data || typeof data !== 'object') return null
  const obj = data as Record<string, unknown>
  const type = obj['@type']
  const types = Array.isArray(type) ? type : [type]
  if (types.some(t => typeof t === 'string' && t.toLowerCase() === 'jobposting')) return obj
  if (Array.isArray(obj['@graph'])) {
    const found = findJobPosting(obj['@graph'])
    if (found) return found
  }
  return null
}

function parseJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = []
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(m[1].trim()))
    } catch {
      // Malformed JSON-LD — ignore and keep looking.
    }
  }
  return blocks
}

/** Pull a <meta name/property=... content=...> value out of raw HTML. */
function getMeta(html: string, key: string): string {
  const re = /<meta[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const tag = m[0]
    const keyMatch = tag.match(/\s(?:property|name)=["']([^"']*)["']/i)
    if (!keyMatch || keyMatch[1].toLowerCase() !== key.toLowerCase()) continue
    const content = tag.match(/\scontent=["']([^"']*)["']/i)
    if (content) {
      const value = htmlToText(content[1]).trim()
      if (value) return value
    }
  }
  return ''
}

function getTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!m) return ''
  const title = htmlToText(m[1]).trim()
  // "Job Title | Company Careers" → keep the meaningful first segment.
  return title.split(/\s*[|–—-]\s*/)[0].trim()
}

/** Second-level domain as a readable company name (jobs.workable.com → Workable). */
function domainCompany(hostname: string): string {
  const labels = hostname.replace(/^www\./, '').split('.')
  const meaningful = labels.filter(l => !['jobs', 'careers', 'apply', 'boards', 'talent', 'recruiting'].includes(l))
  return capitalize(meaningful[0] || labels[0])
}

/** Body text minus scripts/styles/nav/footer chrome — the last-resort description. */
function bodyText(html: string): string {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
  return htmlToText(cleaned)
}

async function extractGeneric(url: URL): Promise<ExtractedJob> {
  const res = await fetchResponse(url.toString(), 'text/html,application/xhtml+xml,*/*')
  if (!res.ok) throwForHttpStatus(res)

  const html = await res.text()

  // JSON-LD JobPosting is the most reliable generic source.
  for (const block of parseJsonLdBlocks(html)) {
    const jd = findJobPosting(block)
    if (!jd) continue
    const description = htmlToText(String(jd.description || '')).trim()
    if (!description) continue
    const location = (() => {
      const loc = jd.jobLocation as Record<string, unknown> | undefined
      const addr = (loc?.address ?? loc) as Record<string, unknown> | undefined
      if (!loc) return undefined
      return String(loc.name || (addr && (addr.addressLocality || addr.addressRegion)) || '').trim() || undefined
    })()
    return {
      title: String(jd.title || '').trim(),
      company: String((jd.hiringOrganization as Record<string, unknown> | undefined)?.name || '').trim() || domainCompany(url.hostname),
      description: description.slice(0, MAX_DESCRIPTION),
      location,
      applyUrl: url.toString(),
    }
  }

  // OpenGraph / meta fallback.
  const ogTitle = getMeta(html, 'og:title')
  const title = ogTitle || getTitle(html)
  const ogDescription = getMeta(html, 'og:description')
  const metaDescription = getMeta(html, 'description')
  let description = ogDescription || metaDescription
  if (!description || description.length < 300) {
    description = bodyText(html)
  }
  description = description.trim().slice(0, MAX_DESCRIPTION)

  const company = getMeta(html, 'og:site_name') || domainCompany(url.hostname)

  if (!title) throw new ExtractionError('Couldn’t find the job title on that page.')
  if (!description) throw new ExtractionError('Couldn’t find a job description on that page.')

  return { title, company, description, applyUrl: url.toString() }
}

// ── Entry point ────────────────────────────────────────────────────────────

/**
 * Fetch and parse a single job-posting URL into the fields career-ops needs.
 * Server-side only. Throws {@link ExtractionError} with a user-facing message
 * when the URL isn't a readable posting.
 */
export async function extractJobFromUrl(rawUrl: string): Promise<ExtractedJob> {
  const trimmed = (rawUrl || '').trim()
  if (!trimmed) throw new ExtractionError('Paste a job posting link first.')

  const applyError = validateApplyUrl(trimmed)
  if (applyError) {
    throw new ExtractionError(
      applyError === 'homepage root' || applyError === 'landing page'
        ? 'That link is a careers homepage, not a specific job posting. Open a single job and copy its link.'
        : `That doesn’t look like a valid job link (${applyError}).`
    )
  }

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new ExtractionError('That doesn’t look like a valid URL.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ExtractionError('Only http(s) job links are supported.')
  }

  // ATS JSON APIs first — highest-fidelity descriptions.
  if (url.hostname.includes('greenhouse.io')) {
    const job = await tryGreenhouse(url)
    if (job) return job
  } else if (url.hostname === 'jobs.lever.co') {
    const job = await tryLever(url)
    if (job) return job
  } else if (url.hostname === 'jobs.ashbyhq.com') {
    const job = await tryAshby(url)
    if (job) return job
  }

  // Generic scrape (JSON-LD → og/meta → body) for everything else.
  const job = await extractGeneric(url)

  if (!job.title.trim() || !job.description.trim()) {
    throw new ExtractionError('Couldn’t read the job details from that link.')
  }
  return job
}
