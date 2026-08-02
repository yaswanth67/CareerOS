import { JobFetchFilters, RawJob, JobProvider } from '@/types'
import { BaseJobProvider } from './base'

// Union of the common response shapes companies' career APIs return: either a
// bare array or an object wrapping the list under one of several keys.
type CompanyJobsPayload =
  | RawCompanyJob[]
  | {
      jobs?: RawCompanyJob[]
      results?: RawCompanyJob[]
      data?: RawCompanyJob[]
      postings?: RawCompanyJob[]
    }

interface RawCompanyJob {
  id?: string | number
  jobId?: string | number
  reqId?: string
  title?: string
  name?: string
  position_title?: string
  description?: string
  descriptionPlain?: string
  content?: string
  body?: string
  location?: string
  locationName?: string
  city?: string
  isRemote?: boolean
  experienceLevel?: string
  seniority?: string
  level?: string
  salaryMin?: number
  minSalary?: number
  compensationMin?: number
  salaryMax?: number
  maxSalary?: number
  compensationMax?: number
  currency?: string
  applyUrl?: string
  url?: string
  applicationUrl?: string
  careerSiteUrl?: string
  postedAt?: Date | string
  createdAt?: Date | string
  datePosted?: Date | string
  expiresAt?: Date | string
  expirationDate?: Date | string
}

export class CompanyDirectProvider extends BaseJobProvider {
  name: JobProvider = 'COMPANY_DIRECT'

  // Top tech companies with known career page APIs or JSON endpoints
  private companies = [
    { name: 'Google', url: 'https://careers.google.com/api/v3/search/?q=&location=&category=&page=1&page_size=100' },
    { name: 'Microsoft', url: 'https://careers.microsoft.com/api/jobs?page=1&pageSize=100' },
    { name: 'Amazon', url: 'https://www.amazon.jobs/en/search.json?category=software-development&result_limit=100' },
    { name: 'Meta', url: 'https://www.metacareers.com/api/v2/jobs?limit=100' },
    { name: 'Apple', url: 'https://jobs-api.apple.com/api/v1/search?limit=100' },
    { name: 'Netflix', url: 'https://explore.jobs.netflix.net/api/jobs?limit=100' },
    { name: 'Uber', url: 'https://www.uber.com/api/jobs/v1/list?limit=100' },
    { name: 'Airbnb', url: 'https://careers.airbnb.com/api/v1/jobs?limit=100' },
    { name: 'Stripe', url: 'https://stripe.com/jobs/api/v1/search?limit=100' },
    { name: 'Shopify', url: 'https://jobs.shopify.com/api/v1/jobs?limit=100' },
    { name: 'Square', url: 'https://squareup.com/api/v1/jobs?limit=100' },
    { name: 'Robinhood', url: 'https://robinhood.com/api/v1/jobs?limit=100' },
    { name: 'Coinbase', url: 'https://coinbase.com/api/v1/jobs?limit=100' },
    { name: 'Databricks', url: 'https://databricks.com/api/v1/jobs?limit=100' },
    { name: 'Snowflake', url: 'https://snowflake.com/api/v1/jobs?limit=100' },
    { name: 'OpenAI', url: 'https://openai.com/api/v1/jobs?limit=100' },
    { name: 'Anthropic', url: 'https://anthropic.com/api/v1/jobs?limit=100' },
    { name: 'NVIDIA', url: 'https://nvidia.com/api/v1/jobs?limit=100' },
    { name: 'Tesla', url: 'https://tesla.com/api/v1/jobs?limit=100' },
    { name: 'SpaceX', url: 'https://spacex.com/api/v1/jobs?limit=100' },
  ]

  async fetchJobs(filters: JobFetchFilters): Promise<RawJob[]> {
    const results = await Promise.all(
      this.companies.map(async company => {
        try {
          const jobs = await this.fetchCompanyJobs(company)
          return jobs.filter(job => this.matchesFilters(job, filters))
        } catch (error) {
          console.error(`Error fetching jobs for ${company.name}:`, error)
          return []
        }
      })
    )
    return results.flat()
  }

  private async fetchCompanyJobs(company: { name: string; url: string }): Promise<RawJob[]> {
    try {
      const response = await fetch(company.url, {
        headers: {
          'User-Agent': 'JobMatch AI Bot',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        console.log(`${company.name}: ${response.status} - skipping`)
        return []
      }

      const data = (await response.json()) as CompanyJobsPayload
      return this.parseCompanyJobs(data, company.name)
    } catch (error) {
      console.error(`Failed to fetch ${company.name}:`, error)
      return []
    }
  }

  private async parseCompanyJobs(data: CompanyJobsPayload, companyName: string): Promise<RawJob[]> {
    // Different companies have different API response structures
    // This is a generic parser - in production, you'd have company-specific parsers
    let jobs: RawCompanyJob[] = []

    if (Array.isArray(data)) {
      jobs = data
    } else if (data.jobs) {
      jobs = data.jobs
    } else if (data.results) {
      jobs = data.results
    } else if (data.data) {
      jobs = data.data
    } else if (data.postings) {
      jobs = data.postings
    }

    const parsedJobs = await Promise.all(
      jobs.map(job => this.parseCompanyJob(job, companyName))
    )

    return parsedJobs.filter((job): job is RawJob => job !== null)
  }

  private async parseCompanyJob(job: RawCompanyJob, companyName: string): Promise<RawJob | null> {
    try {
      const title = job.title || job.name || job.position_title || ''
      if (!title) return null

      const description = job.description || job.descriptionPlain || job.content || job.body || ''

      return this.parseJob({
        id: job.id || job.jobId || job.reqId || Math.random().toString(36).substring(7),
        title,
        company: companyName,
        location: job.location || job.locationName || job.city || 'Remote',
        isRemote: this.isRemote(job),
        description,
        requirements: this.extractRequirements(description),
        skills: await this.extractSkills(description),
        experienceLevel: job.experienceLevel || job.seniority || job.level || '',
        roleType: '',
        salaryMin: job.salaryMin || job.minSalary || job.compensationMin,
        salaryMax: job.salaryMax || job.maxSalary || job.compensationMax,
        currency: job.currency || 'USD',
        applyUrl: job.applyUrl || job.url || job.applicationUrl || job.careerSiteUrl || `https://careers.${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
        postedAt: job.postedAt || job.createdAt || job.datePosted || new Date(),
        expiresAt: job.expiresAt || job.expirationDate,
      })
    } catch {
      return null
    }
  }

  private isRemote(job: RawCompanyJob): boolean {
    const location = (job.location || job.locationName || '').toLowerCase()
    return location.includes('remote') || location.includes('anywhere') || job.isRemote === true
  }
}

export const companyDirectProvider = new CompanyDirectProvider()