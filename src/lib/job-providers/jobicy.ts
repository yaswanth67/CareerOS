import { JobFetchFilters, RawJob, JobProvider } from '@/types'
import { BaseJobProvider } from './base'

interface JobicyJob {
  id: number
  url?: string
  jobTitle?: string
  companyName?: string
  jobIndustry?: string[]
  jobType?: string[]
  jobGeo?: string
  jobLevel?: string
  jobDescription?: string
  pubDate?: string
}

export class JobicyProvider extends BaseJobProvider {
  name: JobProvider = 'JOBICY'

  async fetchJobs(filters: JobFetchFilters): Promise<RawJob[]> {
    const jobs: RawJob[] = []
    try {
      const response = await fetch('https://jobicy.com/api/v2/remote-jobs?count=100', {
        headers: { 'User-Agent': 'Prose AI Bot' },
        signal: AbortSignal.timeout(15000),
      })

      if (!response.ok) return jobs

      const data = (await response.json()) as { jobs?: JobicyJob[] }

      for (const job of data.jobs || []) {
        if (!job.jobTitle) continue

        const description = this.stripHtml(job.jobDescription || '')
        const parsed = this.parseJob({
          id: job.id,
          title: job.jobTitle,
          company: job.companyName,
          location: job.jobGeo || 'Remote',
          isRemote: true,
          description,
          requirements: [],
          skills: await this.extractSkills(`${job.jobTitle} ${job.jobIndustry?.join(' ') || ''} ${description}`),
          experienceLevel: job.jobLevel || '',
          roleType: job.jobIndustry?.join(' ') || '',
          applyUrl: job.url || '',
          postedAt: job.pubDate ? new Date(job.pubDate) : new Date(),
        })

        parsed.roleType = this.parseRoleType(job.jobTitle)
        if (this.matchesFilters(parsed, filters)) {
          jobs.push(parsed)
        }
      }
    } catch (error) {
      console.error('Error fetching Jobicy jobs:', error)
    }
    return jobs
  }
}

export const jobicyProvider = new JobicyProvider()
