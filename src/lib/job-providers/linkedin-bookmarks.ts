import { RawJob, JobProvider } from '@/types'

// Simple in-memory + localStorage store for LinkedIn saved-search bookmarks.
// Users paste a LinkedIn job-search URL (from their saved searches) and we
// store it as a tracked bookmark. The UI polls it like a provider.
// No scraping — we just record the URL + query for the user to open.

export interface LinkedInBookmark {
  id: string
  label: string            // user-friendly name, e.g. "SWE Bay Area"
  searchUrl: string        // full LinkedIn jobs search URL
  createdAt: Date
  lastOpenedAt?: Date
}

const STORAGE_KEY = 'linkedin-bookmarks'

function readBookmarks(): LinkedInBookmark[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as LinkedInBookmark[]
    return parsed.map(b => ({ ...b, createdAt: new Date(b.createdAt), lastOpenedAt: b.lastOpenedAt ? new Date(b.lastOpenedAt) : undefined }))
  } catch {
    return []
  }
}

function writeBookmarks(bookmarks: LinkedInBookmark[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks))
}

// Convert a bookmark into a RawJob-like shape so the dashboard can render it
// alongside real fetched jobs. The "applyUrl" is the LinkedIn search URL.
export function bookmarkToJob(b: LinkedInBookmark): RawJob {
  return {
    externalId: `bookmark-${b.id}`,
    title: b.label,
    company: 'LinkedIn Saved Search',
    location: 'United States',
    isRemote: false,
    description: `LinkedIn saved search: ${b.label}\n\nOpen to view current results.`,
    requirements: [],
    skills: [],
    experienceLevel: 'MID',
    roleType: 'SDE',
    currency: 'USD',
    applyUrl: b.searchUrl,
    postedAt: b.createdAt,
  }
}

export function getLinkedInBookmarks(): LinkedInBookmark[] {
  return readBookmarks().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

export function addLinkedInBookmark(label: string, searchUrl: string): LinkedInBookmark {
  const bookmarks = readBookmarks()
  const newBookmark: LinkedInBookmark = {
    id: Math.random().toString(36).substring(2, 10),
    label: label.trim() || 'Untitled search',
    searchUrl: searchUrl.trim(),
    createdAt: new Date(),
  }
  writeBookmarks([newBookmark, ...bookmarks])
  return newBookmark
}

export function removeLinkedInBookmark(id: string): void {
  const bookmarks = readBookmarks().filter(b => b.id !== id)
  writeBookmarks(bookmarks)
}

export function recordBookmarkOpened(id: string): void {
  const bookmarks = readBookmarks().map(b =>
    b.id === id ? { ...b, lastOpenedAt: new Date() } : b
  )
  writeBookmarks(bookmarks)
}

// Provider name used in the fetcher UI — not a real fetcher, just a label.
export const LINKEDIN_BOOKMARK_PROVIDER: JobProvider = 'OTHER' // displays as "Other"