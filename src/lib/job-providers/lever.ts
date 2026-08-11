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

  // Most companies moved off Lever — only slugs that still respond to
  // api.lever.co/v0/postings/<company>?mode=json are kept. The rest returned
  // 404 during verification and produced stale/fabricated links.
  private companies = [
    'plaid',
    // Additional Lever companies that still use Lever
    'braze',
    'mixpanel',
    'amplitude',
    'segment',
    'sendgrid',
    'twilio',
    'digitalocean',
    'netlify',
    'cloudflare',
    'intercom',
    'zendesk',
    'hubspot',
    'atlassian',
    'shopify',
    'square',
    'stripe',
    'coinbase',
    'robinhood',
    'affirm',
    'chime',
    'brex',
    'mercury',
    'ramp',
    'sardine',
    'unit',
    'column',
    'lithic',
    'modern-treasury',
    'increase',
    'lead-bank',
    'thread-bank',
    'cross-river',
    'evolve',
    'web-bank',
    'piermont',
    'first-electronic',
    'celtic-bank',
    'sutton-bank',
    'meta-bank',
    'pathward',
    'american-express',
    'capital-one',
    'discover',
    'synchrony',
    'ally',
    'marcus',
    'sofi',
    'upstart',
    'lendingclub',
    'prosper',
    'avant',
    'marlette',
    'best-egg',
    'freedomplus',
    'payoff',
    'lightstream',
    'rocket-loans',
    'one-main',
    'springleaf',
    'onemain',
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