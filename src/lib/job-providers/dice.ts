import { JobFetchFilters, RawJob, JobProvider } from '@/types'
import { BaseJobProvider } from './base'

// Dice (dice.com) — tech-focused job board with a public search API.
// No API key required for basic search; we query for US tech roles.

interface DiceJob {
  id: string
  title: string
  company: string
  location: string
  isRemote?: boolean
  description: string
  summary?: string
  detailUrl?: string
  applyUrl?: string
  postedDate?: string
  skills?: string[]
  employmentType?: string
  salary?: string
}

interface DiceResponse {
  data?: Array<{
    data?: DiceJob
  }>
}

export class DiceProvider extends BaseJobProvider {
  name: JobProvider = 'DICE'

  async fetchJobs(filters: JobFetchFilters): Promise<RawJob[]> {
    const jobs: RawJob[] = []
    try {
      // Dice GraphQL-like search endpoint.
      // We search for common tech roles in the US.
      const roles = ['software engineer', 'software developer', 'data scientist', 'devops engineer', 'machine learning engineer', 'backend engineer', 'frontend engineer', 'full stack engineer', 'data engineer', 'ai engineer']
      const roleQuery = roles.map(r => `\"${r}\"`).join(' OR ')

      const query = `(${roleQuery}) AND location:united states`
      const res = await fetch(
        `https://job-search-api.svc.dhigroupinc.com/v1/dice/jobs/search?q=${encodeURIComponent(query)}&countryCode2=US&page=1&pageSize=100&facets=employmentType|workFromHomeAvailability|postedDate&filters.employmentType=CONTRACTS|FULLTIME|PERM`,
        { headers: { 'User-Agent': 'Prose AI Bot', Accept: 'application/json' }, signal: AbortSignal.timeout(15000) }
      )
      if (!res.ok) return jobs

      const data = (await res.json()) as any

      // Dice returns a slightly different shape; handle both shapes.
      const items = data.data?.data || data.data?.hits || data.hits || data.jobs || data.data || []

      for (const item of items) {
        const job = item.data || item
        if (!job.title) continue

        const description = this.stripHtml(job.description || job.summary || '')
        const parsed = this.parseJob({
          id: job.id,
          title: job.title,
          company: job.company,
          location: job.location || 'United States',
          isRemote: job.isRemote || job.workFromHomeAvailability === 'REMOTE',
          description: this.stripHtml(job.description || job.summary || ''),
          requirements: [],
          skills: await this.extractSkills(`${job.title} ${job.skills?.join(' ') || ''} ${description}`),
          experienceLevel: '',
          roleType: '',
          applyUrl: job.detailUrl || job.applyUrl || job.url || '',
          postedAt: job.postedDate ? new Date(job.postedDate) : new Date(),
        })

        parsed.roleType = this.parseRoleType(job.title)
        if (this.matchesFilters(parsed, filters)) {
          jobs.push(parsed)
        }
      }
    } catch (error) {
      console.error('Error fetching Dice jobs:', error)
    }
    return jobs
  }
}

export const diceProvider = new DiceProvider()