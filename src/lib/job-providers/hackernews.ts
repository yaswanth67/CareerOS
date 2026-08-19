import { JobFetchFilters, RawJob, JobProvider } from '@/types'
import { BaseJobProvider } from './base'

// Hacker News "Who is hiring?" monthly threads, searched via the free Algolia
// HN Search API (no API key required). Each top-level comment is one job post;
// we pull the monthly hiring thread and parse its comments. This is a rich
// source of US tech / startup roles that rarely appear on the big boards.

interface HNAlgoliaResponse {
  hits?: Array<{
    objectID: string
    story_id?: number
    story_title?: string
    title?: string
    comment_text?: string
    author?: string
    created_at?: string
    url?: string
    parent_id?: number
  }>
  nbHits?: number
}

interface HNStoryResponse {
  hits?: Array<{
    objectID: string
    title: string
    points?: number
  }>
}

export class HackerNewsProvider extends BaseJobProvider {
  name: JobProvider = 'HACKERNEWS'

  async fetchJobs(filters: JobFetchFilters): Promise<RawJob[]> {
    const jobs: RawJob[] = []
    try {
      // Find the most recent "Who is hiring?" story (posted by user whoishiring).
      const storyRes = await fetch(
        'https://hn.algolia.com/api/v1/search_by_date?query=who%20is%20hiring&author=whoishiring&tags=story&hitsPerPage=5',
        { headers: { 'User-Agent': 'Prose AI Bot' }, signal: AbortSignal.timeout(15000) }
      )
      if (!storyRes.ok) return jobs
      const storyData = (await storyRes.json()) as HNStoryResponse
      const story = storyData.hits?.[0]
      if (!story) return jobs

      // Fetch the comments (job posts) for that story.
      const commentsRes = await fetch(
        `https://hn.algolia.com/api/v1/search?tags=comment,story_${story.objectID}&hitsPerPage=100`,
        { headers: { 'User-Agent': 'Prose AI Bot' }, signal: AbortSignal.timeout(15000) }
      )
      if (!commentsRes.ok) return jobs
      const commentsData = (await commentsRes.json()) as HNAlgoliaResponse

      for (const hit of commentsData.hits || []) {
        const text = hit.comment_text || hit.title || ''
        if (!text) continue

        // Strip HTML tags from the comment body.
        const description = text
          .replace(/<[^>]+>/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\s+/g, ' ')
          .trim()

        if (description.length < 40) continue

        // Best-effort company extraction: first line often starts with the
        // company name or "Company | Role".
        const firstLine = description.split('\n')[0].slice(0, 80)
        const companyMatch = firstLine.match(/^([A-Za-z0-9 &.]+?)\s*[\|\-–:]/)
        const company = companyMatch ? companyMatch[1].trim() : 'Unknown'

        // Detect remote signal from the text.
        const isRemote = /remote|work from home|distributed|anywhere/i.test(description)

        const parsed = this.parseJob({
          id: hit.objectID,
          title: firstLine.slice(0, 120),
          company,
          location: isRemote ? 'Remote' : 'United States',
          isRemote,
          description,
          requirements: [],
          skills: await this.extractSkills(description),
          experienceLevel: '',
          roleType: '',
          applyUrl: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
          postedAt: hit.created_at ? new Date(hit.created_at) : new Date(),
        })

        parsed.roleType = this.parseRoleType(description)
        if (this.matchesFilters(parsed, filters)) {
          jobs.push(parsed)
        }
      }
    } catch (error) {
      console.error('Error fetching Hacker News jobs:', error)
    }
    return jobs
  }
}

export const hackerNewsProvider = new HackerNewsProvider()
