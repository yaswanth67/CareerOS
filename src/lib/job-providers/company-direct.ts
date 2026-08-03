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
  // Amazon's job search.json returns a relative detail path and a direct apply
  // URL on separate fields.
  job_path?: string
  url_next_step?: string
  postedAt?: Date | string
  createdAt?: Date | string
  datePosted?: Date | string
  expiresAt?: Date | string
  expirationDate?: Date | string
}

export class CompanyDirectProvider extends BaseJobProvider {
  name: JobProvider = 'COMPANY_DIRECT'

  // Company career pages with public JSON endpoints that are actually live.
  // The other companies previously listed here returned 404/403/400 — those
  // fabricated apply links were exactly the broken ones users saw. Companies
  // are fetched through the ATS they actually use instead (Greenhouse/Ashby).
  private companies = [
    { name: 'Amazon', url: 'https://www.amazon.jobs/en/search.json?category=software-development&result_limit=100' },
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
        // Build the apply URL from real fields only — never synthesize a
        // careers-homepage fallback. Amazon returns a relative job_path that
        // points at the public detail page (the safe, non-login Apply target).
        applyUrl:
          job.url_next_step ||
          (job.job_path ? `https://www.amazon.jobs${job.job_path}` : '') ||
          job.applyUrl ||
          job.url ||
          job.applicationUrl ||
          job.careerSiteUrl ||
          '',
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