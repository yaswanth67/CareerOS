import { JobFetchFilters, RawJob, JobProvider } from '@/types'
import { BaseJobProvider } from './base'

interface LeverJob {
  id: string
  text: string
  categories?: {
    location?: string
    commitment?: string
  }
  descriptionPlain?: string
  description?: string
  hostedUrl?: string
  applyUrl?: string
  createdAt?: number
}

export class LeverProvider extends BaseJobProvider {
  name: JobProvider = 'LEVER'

  private companies = [
    'netflix',
    'airbnb',
    'quora',
    'pinterest',
    'dropbox',
    'lyft',
    'doordash',
    'instacart',
    'robinhood',
    'coinbase',
    'plaid',
    'stripe',
    'brex',
    'ramp',
    'mercury',
    'wise',
    'revolut',
    'n26',
    'monzo',
    'chime',
  ]

  async fetchJobs(filters: JobFetchFilters): Promise<RawJob[]> {
    const results = await Promise.all(
      this.companies.map(company => this.fetchCompany(company, filters))
    )
    return results.flat()
  }

  private async fetchCompany(company: string, filters: JobFetchFilters): Promise<RawJob[]> {
    const jobs: RawJob[] = []
    try {
      const url = `https://api.lever.co/v0/postings/${company}?mode=json`
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'JobMatch AI Bot',
        },
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) return jobs

      const postings = (await response.json()) as LeverJob[]

      for (const job of postings) {
        const parsed = await this.parseLeverJob(job, company)
        if (this.matchesFilters(parsed, filters)) {
          jobs.push(parsed)
        }
      }
    } catch (error) {
      console.error(`Error fetching Lever jobs for ${company}:`, error)
    }
    return jobs
  }

  private async parseLeverJob(job: LeverJob, company: string): Promise<RawJob> {
    const parsed = this.parseJob({
      id: job.id,
      title: job.text,
      company: company,
      location: job.categories?.location || 'Remote',
      isRemote: job.categories?.location?.toLowerCase().includes('remote') || false,
      description: job.descriptionPlain || job.description || '',
      requirements: this.extractRequirements(job.descriptionPlain || job.description || ''),
      skills: await this.extractSkills(job.descriptionPlain || job.description || ''),
      experienceLevel: job.categories?.commitment || '',
      roleType: '',
      salaryMin: undefined,
      salaryMax: undefined,
      currency: 'USD',
      applyUrl: job.hostedUrl || job.applyUrl || `https://jobs.lever.co/${company}/${job.id}`,
      postedAt: job.createdAt ? new Date(job.createdAt) : new Date(),
      expiresAt: undefined,
    })

    parsed.roleType = this.parseRoleType(job.text)
    return parsed
  }
}

export const leverProvider = new LeverProvider()