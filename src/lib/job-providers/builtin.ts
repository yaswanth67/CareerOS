import { JobFetchFilters, RawJob, JobProvider } from '@/types'
import { BaseJobProvider } from './base'

// BuiltIn (builtin.com) — tech-focused job board with a public API.
// No API key needed; we query the search endpoint for US-based roles.

interface BuiltInJob {
  id: string
  title: string
  company: string
  companyName?: string
  location: string
  remote?: boolean
  description: string
  applyUrl?: string
  url?: string
  postedDate?: string
  category?: string
  salaryMin?: number
  salaryMax?: number
}

interface BuiltInResponse {
  jobs?: BuiltInJob[]
  totalCount?: number
}

export class BuiltInProvider extends BaseJobProvider {
  name: JobProvider = 'BUILTIN'

  async fetchJobs(filters: JobFetchFilters): Promise<RawJob[]> {
    const jobs: RawJob[] = []
    try {
      // BuiltIn search endpoint — use `location` to restrict to US.
      // Categories: software-engineering, data-science, devops, etc.
      const categories = ['software-engineering', 'data-science', 'devops-sysadmin', 'machine-learning', 'ai-ml']
      const rolesParam = categories.join(',')

      const res = await fetch(
        `https://www.builtin.com/api/jobs/search?categories=${rolesParam}&location=United%20States&per_page=100&page=1`,
        { headers: { 'User-Agent': 'Prose AI Bot', Accept: 'application/json' }, signal: AbortSignal.timeout(15000) }
      )
      if (!res.ok) return jobs

      const data = (await res.json()) as BuiltInResponse

      for (const job of data.jobs || []) {
        if (!job.title) continue

        const description = this.stripHtml(job.description || '')
        const parsed = this.parseJob({
          id: job.id,
          title: job.title,
          company: job.companyName || job.company,
          location: job.location || 'United States',
          isRemote: job.remote ?? false,
          description,
          requirements: [],
          skills: await this.extractSkills(`${job.title} ${job.category || ''} ${description}`),
          experienceLevel: '',
          roleType: job.category || '',
          salaryMin: job.salaryMin,
          salaryMax: job.salaryMax,
          currency: 'USD',
          applyUrl: job.applyUrl || job.url || '',
          postedAt: job.postedDate ? new Date(job.postedDate) : new Date(),
        })

        parsed.roleType = this.parseRoleType(job.title)
        if (this.matchesFilters(parsed, filters)) {
          jobs.push(parsed)
        }
      }
    } catch (error) {
      console.error('Error fetching BuiltIn jobs:', error)
    }
    return jobs
  }
}

export const builtinProvider = new BuiltInProvider()