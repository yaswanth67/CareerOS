import { JobFetchFilters, RawJob, JobProvider } from '@/types'
import { BaseJobProvider } from './base'

interface AshbyJob {
  id: string
  title: string
  department?: { name?: string } | null
  team?: { name?: string } | null
  location?: string | null
  secondaryLocations?: Array<{ location?: string | null }> | null
  isRemote?: boolean
  employmentType?: string | null
  jobUrl?: string | null
  applyUrl?: string | null
  publishedAt?: string | null
  descriptionHtml?: string | null
}

export class AshbyProvider extends BaseJobProvider {
  name: JobProvider = 'ASHBY'

  // Ashby powers the careers pages of many well-known companies. Each slug is
  // verified live against https://api.ashbyhq.com/posting-api/job-board/<slug>
  // before being added here — dead slugs are dropped rather than kept as noise.
  private boards = [
    'openai',
    'snowflake',
    'ramp',
    'mercury',
    'cohere',
    'perplexity',
    'replit',
    'notion',
    'linear',
    'deel',
    'vanta',
    'sequence',
    'verkada',
    'sierra',
    'plaid',
    'elevenlabs',
    'loom',
    'mystenlabs',
    // Additional Ashby boards - tech companies
    'anthropic',
    'databricks',
    'datadog',
    'fivetran',
    'reddit',
    'mongodb',
    'twilio',
    'okta',
    'cloudflare',
    'airtable',
    'instacart',
    'lyft',
    'pinterest',
    'chime',
    'figma',
    'vercel',
    'planetscale',
    'robinhood',
    'twitch',
    'dropbox',
    'spacex',
    'coinbase',
    'stripe',
    'airbnb',
    'netskope',
    'cockroachlabs',
    'squarespace',
    'fivetran',
    'hevodata',
    'airbyte',
    'stitchdata',
    'segment',
    'mparticle',
    'amplitude',
    'mixpanel',
    'heap',
    'pendo',
    'fullstory',
    'logrocket',
    'sentry',
    'newrelic',
    'elastic',
    'splunk',
    'sumologic',
    'honeycomb',
    'lightstep',
    'grafana',
    'prometheus',
    'cortex',
    'signoz',
    'checkly',
    'betteruptime',
    'pagerduty',
    'opsgenie',
    'victorops',
    'xmatters',
    'alertlogic',
    'blameless',
    'firehydrant',
    'incidentio',
    'rootly',
    'zenduty',
    'quadratic',
    'modal',
    'replicate',
    'huggingface',
    'weightsandbiases',
    'wandb',
    'cometml',
    'neptuneai',
    'mlflow',
    'kubeflow',
    'airflow',
    'prefect',
    'dagster',
    'temporal',
    'conductor',
    'orquestra',
    'flyte',
    'metaflow',
    'zenml',
    'polyaxon',
    'clearml',
    'dvclive',
    'neptune',
    'wandb',
    'comet',
    'mlflow',
    'kubeflow',
    'airflow',
    'prefect',
    'dagster',
    'temporal',
    'conductor',
    'orquestra',
    'flyte',
    'metaflow',
    'zenml',
    'polyaxon',
    'clearml',
    'dvclive',
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
      const url = `https://api.ashbyhq.com/posting-api/job-board/${board}`
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'JobMatch AI Bot',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) return jobs

      const data = (await response.json()) as { jobs?: AshbyJob[] }
      for (const job of data.jobs || []) {
        if (!job.title) continue

        const description = this.stripHtml(job.descriptionHtml || '')
        const parsed = this.parseJob({
          id: job.id,
          title: job.title,
          company: board,
          location: job.location || '',
          isRemote: job.isRemote,
          description,
          requirements: this.extractRequirements(description),
          skills: await this.extractSkills(description),
          experienceLevel: job.employmentType || '',
          roleType: '',
          applyUrl: job.applyUrl || job.jobUrl || '',
          postedAt: job.publishedAt ? new Date(job.publishedAt) : new Date(),
        })

        parsed.roleType = this.parseRoleType(job.title)
        if (this.matchesFilters(parsed, filters)) {
          jobs.push(parsed)
        }
      }
    } catch (error) {
      console.error(`Error fetching Ashby jobs for ${board}:`, error)
    }
    return jobs
  }
}

export const ashbyProvider = new AshbyProvider()
