import { JobFetchFilters, RawJob, JobProvider } from '@/types'
import { BaseJobProvider } from './base'

export class WellfoundProvider extends BaseJobProvider {
  name: JobProvider = 'WELLFOUND'

  async fetchJobs(_filters: JobFetchFilters): Promise<RawJob[]> {
    // Wellfound (AngelList) doesn't have a public API
    // This would require either:
    // 1. Official API access (partner program)
    // 2. RSS feeds from company pages
    // 3. Manual curation

    // For now, return empty array - user can add company direct scrapers
    console.log('Wellfound provider: No public API available. Use company-direct provider instead.')
    return []
  }
}

export const wellfoundProvider = new WellfoundProvider()