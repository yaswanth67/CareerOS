import { JobFetchFilters, RawJob, JobProvider, ExperienceLevel, RoleType } from '@/types'
import Anthropic from '@anthropic-ai/sdk'

// Guard-rail for apply links: every URL stored on a Job must look like a real,
// job-specific posting. Fabricated fallbacks (homepage roots, careers landing
// pages, placeholder ids) are rejected here so they never reach the feed, and
// the link-checker uses the same helper to flag stale rows already in the DB.
//
// Returns a short reason string when the URL should be rejected, or null when
// it is acceptable.
export function validateApplyUrl(url: string): string | null {
  const trimmed = (url || '').trim()
  if (!trimmed) return 'missing'
  if (trimmed.length > 2048) return 'too long'
  // Placeholder / broken-format signals.
  if (/[\s<>{}\[\]"']|undefined|null|\bNaN\b/i.test(trimmed)) return 'placeholder'

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return 'not a valid URL'
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return 'unsupported protocol'

  const segments = parsed.pathname.replace(/\/+/g, '/').split('/').filter(Boolean)
  if (segments.length === 0) return 'homepage root'

  const tail = segments[segments.length - 1].toLowerCase()
  // A short bare numeric id at the end (e.g. /jobs/123, /careers/456) is a
  // placeholder — real postings carry a descriptive slug or a longer id.
  if (/^\d{1,6}$/.test(tail)) return 'placeholder id'

  // Landing pages that are not a specific posting.
  if (
    segments.length === 1 &&
    ['jobs', 'job', 'careers', 'career', 'apply', 'about', 'c', 'search', 'positions', 'openings', 'roles'].includes(
      segments[0].toLowerCase()
    )
  ) {
    return 'landing page'
  }
  if (segments.length === 2) {
    const [a, b] = segments.map(s => s.toLowerCase())
    if (
      (a === 'careers' || a === 'about' || a === 'company' || a === 'jobs') &&
      ['jobs', 'roles', 'careers', 'positions', 'openings'].includes(b)
    ) {
      return 'landing page'
    }
  }

  return null
}

// Initialize Anthropic client only if an API key/token is available.
// ANTHROPIC_AUTH_TOKEN is used when talking to a local Claude Code connection.
const anthropicApiKey = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY

let anthropic: Anthropic | null = null

if (anthropicApiKey) {
  anthropic = new Anthropic({
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    apiKey: anthropicApiKey,
  })
}

const TECH_KEYWORDS = [
  'Python', 'Java', 'JavaScript', 'TypeScript', 'Go', 'Rust', 'C++', 'C#', 'Ruby', 'PHP', 'Swift', 'Kotlin',
  'React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Node.js', 'Django', 'Flask', 'FastAPI', 'Spring Boot',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'DynamoDB', 'Cassandra', 'Elasticsearch',
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform', 'Ansible',
  'TensorFlow', 'PyTorch', 'Keras', 'Scikit-learn', 'Transformers', 'LangChain',
  'Kafka', 'Spark', 'Airflow', 'dbt', 'Snowflake', 'BigQuery',
  'Git', 'Linux', 'GraphQL', 'REST', 'gRPC', 'CI/CD',
]

// Flexible shape accepted by parseJob. Different job APIs use different
// field names, so each field is optional and mapped into RawJob.
export interface RawProviderJob {
  id?: string | number
  externalId?: string
  title?: string
  name?: string
  company?: string
  companyName?: string
  location?: string
  locationName?: string
  isRemote?: boolean
  remote?: boolean
  description?: string
  content?: string
  requirements?: string[]
  skills?: string[]
  tags?: string[]
  experienceLevel?: string
  seniority?: string
  roleType?: string
  category?: string
  salaryMin?: number
  minSalary?: number
  salaryMax?: number
  maxSalary?: number
  currency?: string
  applyUrl?: string
  url?: string
  applicationUrl?: string
  postedAt?: Date | string
  createdAt?: Date | string
  expiresAt?: Date | string
  expirationDate?: Date | string
}

export interface JobProviderAdapter {
  name: JobProvider
  fetchJobs(filters: JobFetchFilters): Promise<RawJob[]>
  parseJob(raw: RawProviderJob): RawJob
  getApplyUrl(job: RawJob): string
}

export class BaseJobProvider implements JobProviderAdapter {
  name: JobProvider = 'OTHER'

  async fetchJobs(_filters: JobFetchFilters): Promise<RawJob[]> {
    throw new Error('Not implemented')
  }

  parseJob(raw: RawProviderJob): RawJob {
    const expiresAt = raw.expiresAt || raw.expirationDate
    return {
      externalId: String(raw.id || raw.externalId || Math.random().toString(36).substring(7)),
      title: raw.title || raw.name || '',
      company: raw.company || raw.companyName || '',
      location: raw.location || raw.locationName || '',
      isRemote: raw.isRemote || raw.remote || false,
      description: raw.description || raw.content || '',
      requirements: raw.requirements || [],
      skills: raw.skills || raw.tags || [],
      experienceLevel: this.parseExperienceLevel(raw.experienceLevel || raw.seniority),
      roleType: this.parseRoleType(raw.roleType || raw.category || raw.title),
      salaryMin: raw.salaryMin || raw.minSalary,
      salaryMax: raw.salaryMax || raw.maxSalary,
      currency: raw.currency || 'USD',
      applyUrl: raw.applyUrl || raw.url || raw.applicationUrl || '',
      postedAt: new Date(raw.postedAt || raw.createdAt || new Date()),
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    }
  }

  getApplyUrl(job: RawJob): string {
    return job.applyUrl
  }

  protected parseExperienceLevel(level: string | undefined): ExperienceLevel {
    const lower = (level || '').toLowerCase()
    if (lower.includes('entry') || lower.includes('junior') || lower.includes('new grad') || lower.includes('0-2')) {
      return 'ENTRY'
    }
    if (lower.includes('senior') || lower.includes('lead') || lower.includes('principal') || lower.includes('5+') || lower.includes('6+')) {
      return 'SENIOR'
    }
    if (lower.includes('staff') || lower.includes('architect')) {
      return 'STAFF'
    }
    return 'MID'
  }

  protected parseRoleType(text: string | undefined): RoleType {
    const lower = (text || '').toLowerCase()

    if (lower.includes('ai engineer') || lower.includes('ml engineer') || lower.includes('machine learning engineer')) {
      return 'AI_ENGINEER'
    }
    if (lower.includes('data scientist')) {
      return 'DATA_SCIENTIST'
    }
    if (lower.includes('data engineer')) {
      return 'DATA_ENGINEER'
    }
    if (lower.includes('devops') || lower.includes('sre') || lower.includes('site reliability')) {
      return 'DEVOPS'
    }
    if (lower.includes('frontend') || lower.includes('front end') || lower.includes('ui engineer')) {
      return 'FRONTEND'
    }
    if (lower.includes('backend') || lower.includes('back end') || lower.includes('server engineer')) {
      return 'BACKEND'
    }
    if (lower.includes('full stack') || lower.includes('fullstack')) {
      return 'FULLSTACK'
    }
    if (lower.includes('mobile') || lower.includes('ios') || lower.includes('android')) {
      return 'MOBILE'
    }
    if (lower.includes('embedded') || lower.includes('firmware')) {
      return 'EMBEDDED'
    }
    if (lower.includes('security') || lower.includes('secops')) {
      return 'SECURITY'
    }
    if (lower.includes('qa') || lower.includes('quality') || lower.includes('test engineer')) {
      return 'QA'
    }
    if (lower.includes('product manager') || lower.includes('pm ') || lower.includes('product owner')) {
      return 'PM'
    }

    return 'SDE'
  }

  protected extractRequirements(content: string): string[] {
    const requirements: string[] = []
    const lines = content.split('\n')
    let inRequirements = false

    for (const line of lines) {
      const lower = line.toLowerCase()
      if (lower.includes('requirement') || lower.includes('qualification') || lower.includes('must have') || lower.includes('you have') || lower.includes('you will')) {
        inRequirements = true
        continue
      }
      if (inRequirements && (lower.includes('preferred') || lower.includes('bonus') || lower.includes('nice to have') || lower.includes('benefit') || lower.includes('benefits'))) {
        break
      }
      if (inRequirements && (line.startsWith('•') || line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line))) {
        requirements.push(line.replace(/^[•\-*\d.]\s*/, '').trim())
      }
    }

    return requirements.slice(0, 10)
  }

  protected async extractSkills(content: string): Promise<string[]> {
    // Keyword-based extraction for bulk job feeds. Fetching runs hundreds of
    // jobs at once, so a per-job AI round-trip is far too slow (and through a
    // local Claude connection the extraction prompts tend to return empty).
    // AI skill extraction is used on demand in the resume flow instead.
    return this.extractSkillsFallback(content)
  }

  private async extractSkillsWithAI(content: string): Promise<string[]> {
    const prompt = `Extract all technical skills from this job description. Return ONLY a JSON array of skill names.

Job description:
${content.slice(0, 5000)}

Return format: ["Skill1", "Skill2", "Skill3", ...]
Include: programming languages, frameworks, databases, cloud platforms, tools, methodologies, etc.
Be specific (e.g., "React" not "Frontend", "PostgreSQL" not "Databases").`

    try {
      const response = await anthropic!.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307',
        max_tokens: 1000,
        temperature: 0.1,
        messages: [{ role: 'user', content: prompt }],
      })

      // Local Claude proxies may prepend a "thinking" block, so find the text block.
      const textBlock = response.content.find(block => block.type === 'text')
      if (textBlock) {
        const skills = JSON.parse(textBlock.text)
        if (Array.isArray(skills)) {
          return skills.map(s => s.trim()).filter(Boolean)
        }
      }
    } catch (error) {
      console.error('AI skill extraction failed, falling back:', error)
    }

    return this.extractSkillsFallback(content)
  }

  protected extractSkillsFallback(content: string): string[] {
    const skills = new Set<string>()

    for (const keyword of TECH_KEYWORDS) {
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (regex.test(content)) {
        skills.add(keyword)
      }
    }

    return Array.from(skills)
  }

  protected matchesFilters(job: RawJob, filters: JobFetchFilters): boolean {
    if (filters.roleTypes?.length && !filters.roleTypes.includes(job.roleType)) {
      return false
    }
    if (filters.experienceLevels?.length && !filters.experienceLevels.includes(job.experienceLevel)) {
      return false
    }
    if (filters.remoteOnly && !job.isRemote) {
      return false
    }
    if (filters.locations?.length) {
      const locationMatch = filters.locations.some(loc =>
        job.location.toLowerCase().includes(loc.toLowerCase())
      )
      if (!locationMatch && !job.isRemote) {
        return false
      }
    }
    if (filters.keywords?.length) {
      const searchText = `${job.title} ${job.description} ${job.skills.join(' ')}`.toLowerCase()
      const keywordMatch = filters.keywords.some(kw => searchText.includes(kw.toLowerCase()))
      if (!keywordMatch) {
        return false
      }
    }
    return true
  }
}