import { JobFetchFilters, RawJob, JobProvider } from '@/types'
import { BaseJobProvider } from './base'

interface RemoteOkJob {
  slug?: string
  id?: string
  position?: string
  company?: string
  /**
   * Free text, and the only location signal in the payload. RemoteOK templates
   * it as "{city}, {region}" and usually leaves the region blank, so most
   * values arrive with a trailing comma and no country: "Jamshedpur, ",
   * "Nassau, ". Stored as-is; `classifyUsJob` does the US/non-US call.
   */
  location?: string
  /** Usually a real array; older payloads used a JSON-encoded string. */
  tags?: string[] | string
  date?: string
  epoch?: number
  description?: string
  apply_url?: string
  url?: string
}

function parseTags(tags: string[] | string | undefined): string[] {
  if (!tags) return []
  if (Array.isArray(tags)) return tags.map(String).filter(Boolean)
  try {
    const parsed = JSON.parse(tags.replace(/'/g, '"'))
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : []
  } catch {
    return []
  }
}

export class RemoteOkProvider extends BaseJobProvider {
  name: JobProvider = 'REMOTEOK'

  async fetchJobs(filters: JobFetchFilters): Promise<RawJob[]> {
    const jobs: RawJob[] = []
    try {
      const response = await fetch('https://remoteok.com/api', {
        headers: { 'User-Agent': 'Prose AI Bot' },
        signal: AbortSignal.timeout(15000),
      })

      if (!response.ok) return jobs

      const data = (await response.json()) as RemoteOkJob[]
      // The API returns an array whose first element is metadata (legal text,
      // last_updated) rather than a job — skip it.
      for (const job of data.slice(1)) {
        if (!job.position || !job.id) continue

        const parsed = this.parseJob({
          id: job.id,
          title: job.position,
          company: job.company,
          location: job.location || 'Remote',
          isRemote: true,
          description: this.stripHtml(job.description || ''),
          requirements: [],
          skills: parseTags(job.tags),
          experienceLevel: '',
          roleType: '',
          applyUrl: job.apply_url || job.url || '',
          postedAt: job.epoch ? new Date(job.epoch * 1000) : new Date(),
        })

        parsed.roleType = this.parseRoleType(job.position)
        if (this.matchesFilters(parsed, filters)) {
          jobs.push(parsed)
        }
      }
    } catch (error) {
      console.error('Error fetching RemoteOK jobs:', error)
    }
    return jobs
  }
}

export const remoteokProvider = new RemoteOkProvider()
