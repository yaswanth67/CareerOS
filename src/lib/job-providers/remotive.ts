import { JobFetchFilters, RawJob, JobProvider } from '@/types'
import { BaseJobProvider } from './base'

interface RemotiveJob {
  id: number
  title: string
  company_name?: string
  category?: string
  tags?: string[]
  job_type?: string
  publication_date?: string
  candidate_required_location?: string
  salary?: string
  description?: string
  url?: string
}

// Remotive reports salary as a display string like "$70k - $90k" or "70k USD".
// Pull the min/max numbers out (x1000 for the trailing "k"), or undefined if it
// doesn't look like a numeric range.
function parseSalaryRange(salary: string | undefined): { salaryMin?: number; salaryMax?: number } {
  if (!salary) return {}
  const matches = [...salary.matchAll(/(\d+)\s*(k|k usd)?/gi)].map(m => {
    const n = parseInt(m[1], 10)
    return /k/i.test(m[2] || '') ? n * 1000 : n
  })
  if (matches.length === 0) return {}
  if (matches.length === 1) return { salaryMin: matches[0] }
  const [a, b] = matches.slice(0, 2).sort((x, y) => x - y)
  return { salaryMin: a, salaryMax: b }
}

export class RemotiveProvider extends BaseJobProvider {
  name: JobProvider = 'REMOTIVE'

  async fetchJobs(filters: JobFetchFilters): Promise<RawJob[]> {
    const jobs: RawJob[] = []
    try {
      const response = await fetch('https://remotive.com/api/remote-jobs', {
        headers: { 'User-Agent': 'JobMatch AI Bot' },
        signal: AbortSignal.timeout(15000),
      })

      if (!response.ok) return jobs

      const data = (await response.json()) as { jobs?: RemotiveJob[] }

      for (const job of data.jobs || []) {
        if (!job.title) continue

        const description = this.stripHtml(job.description || '')
        const salary = parseSalaryRange(job.salary)
        const parsed = this.parseJob({
          id: job.id,
          title: job.title,
          company: job.company_name,
          location: job.candidate_required_location || 'Remote',
          isRemote: true,
          description,
          requirements: [],
          skills: await this.extractSkills(`${job.title} ${job.tags?.join(' ') || ''} ${description}`),
          experienceLevel: job.job_type || '',
          roleType: job.category || '',
          salaryMin: salary.salaryMin,
          salaryMax: salary.salaryMax,
          currency: 'USD',
          applyUrl: job.url || '',
          postedAt: job.publication_date ? new Date(job.publication_date) : new Date(),
        })

        parsed.roleType = this.parseRoleType(job.title)
        if (this.matchesFilters(parsed, filters)) {
          jobs.push(parsed)
        }
      }
    } catch (error) {
      console.error('Error fetching Remotive jobs:', error)
    }
    return jobs
  }
}

export const remotiveProvider = new RemotiveProvider()
