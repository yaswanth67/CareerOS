import { JobFetchFilters, RawJob, JobProvider } from '@/types'
import { BaseJobProvider } from './base'

interface GreenhouseJob {
  id: number
  title: string
  content?: string
  location?: { name?: string }
  metadata?: {
    experience_level?: string
    salary_min?: number
    salary_max?: number
    expiration_date?: string
  }
  absolute_url?: string
  updated_at?: string
}

export class GreenhouseProvider extends BaseJobProvider {
  name: JobProvider = 'GREENHOUSE'

  private boards = [
    'airbnb',
    'stripe',
    'coinbase',
    'databricks',
    'snowflake',
    'reddit',
    'discord',
    'notion',
    'figma',
    'linear',
    'vercel',
    'supabase',
    'planetscale',
    'railway',
    'render',
    'fly.io',
    'temporal',
    'cockroachdb',
    'materialize',
    'timescale',
  ]

  async fetchJobs(filters: JobFetchFilters): Promise<RawJob[]> {
    const results = await Promise.all(
      this.boards.map(board => this.fetchBoard(board, filters))
    )
    return results.flat()
  }

  private async fetchBoard(board: string, filters: JobFetchFilters): Promise<RawJob[]> {
    const jobs: RawJob[] = []
    try {
      const url = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'JobMatch AI Bot',
        },
        // No `next: { revalidate }` here: route handlers can't cache responses
        // over 2MB (some Greenhouse boards exceed this), which throws.
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) return jobs

      const data = (await response.json()) as { jobs?: GreenhouseJob[] }
      const boardJobs = data.jobs || []

      for (const job of boardJobs) {
        const parsed = await this.parseGreenhouseJob(job, board)
        if (this.matchesFilters(parsed, filters)) {
          jobs.push(parsed)
        }
      }
    } catch (error) {
      console.error(`Error fetching Greenhouse jobs for ${board}:`, error)
    }
    return jobs
  }

  private async parseGreenhouseJob(job: GreenhouseJob, board: string): Promise<RawJob> {
    // Greenhouse serves `content` as HTML — strip tags so the description is
    // display-safe and the requirements/skills extractors see real text lines.
    const description = this.stripHtml(job.content || '')
    const parsed = this.parseJob({
      id: job.id.toString(),
      title: job.title,
      company: board,
      location: job.location?.name || 'Remote',
      isRemote: job.location?.name?.toLowerCase().includes('remote') || false,
      description,
      requirements: this.extractRequirements(description),
      skills: await this.extractSkills(description),
      experienceLevel: job.metadata?.experience_level || '',
      roleType: '',
      salaryMin: job.metadata?.salary_min,
      salaryMax: job.metadata?.salary_max,
      currency: 'USD',
      applyUrl: job.absolute_url,
      postedAt: job.updated_at ? new Date(job.updated_at) : new Date(),
      expiresAt: job.metadata?.expiration_date ? new Date(job.metadata.expiration_date) : undefined,
    })

    parsed.roleType = this.parseRoleType(job.title)
    return parsed
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
}

export const greenhouseProvider = new GreenhouseProvider()