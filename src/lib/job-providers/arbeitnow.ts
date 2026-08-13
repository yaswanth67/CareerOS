import { JobFetchFilters, RawJob, JobProvider } from '@/types'
import { BaseJobProvider } from './base'

interface ArbeitnowJob {
  slug: string
  company_name?: string
  title?: string
  description?: string
  remote?: boolean
  url?: string
  tags?: string[]
  job_types?: string[]
  location?: string
  created_at?: string
}

export class ArbeitnowProvider extends BaseJobProvider {
  name: JobProvider = 'ARBEITNOW'

  async fetchJobs(filters: JobFetchFilters): Promise<RawJob[]> {
    const jobs: RawJob[] = []
    try {
      const response = await fetch('https://www.arbeitnow.com/api/job-board-api', {
        headers: { 'User-Agent': 'Prose AI Bot' },
        signal: AbortSignal.timeout(15000),
      })

      if (!response.ok) return jobs

      const data = (await response.json()) as { data?: ArbeitnowJob[] }

      for (const job of data.data || []) {
        if (!job.title) continue

        // Arbeitnow HTML-encodes its description inside the JSON (&lt;div&gt;…),
        // so stripHtml must decode entities before removing tags — handled in base.
        const description = this.stripHtml(job.description || '')
        const parsed = this.parseJob({
          id: job.slug,
          title: job.title,
          company: job.company_name,
          location: job.location || 'Remote',
          isRemote: job.remote,
          description,
          requirements: [],
          skills: await this.extractSkills(`${job.title} ${job.tags?.join(' ') || ''} ${description}`),
          experienceLevel: '', // job_types are full_time/contract, not seniorities
          roleType: '',
          applyUrl: job.url || '',
          postedAt: job.created_at ? new Date(job.created_at) : new Date(),
        })

        parsed.roleType = this.parseRoleType(job.title)
        if (this.matchesFilters(parsed, filters)) {
          jobs.push(parsed)
        }
      }
    } catch (error) {
      console.error('Error fetching Arbeitnow jobs:', error)
    }
    return jobs
  }
}

export const arbeitnowProvider = new ArbeitnowProvider()
