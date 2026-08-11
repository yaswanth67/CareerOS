'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Bookmark,
  BookmarkCheck,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  MapPin,
  RefreshCw,
  TrendingUp,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { getScoreColor } from '@/lib/utils'

export interface SuggestionJob {
  id: string
  title: string
  company: string
  location: string
  isRemote: boolean
  provider: string
  applyUrl: string
  postedAt: string
  visaSponsored: boolean | null
  score: number
  matchedSkills: string[]
  applicationStatus: string | null
}

interface ResumeJobsResponse {
  jobs?: SuggestionJob[]
  keywords?: string[]
  poolSize?: number
  refreshed?: { jobsNew: number; jobsSkippedNonUs: number }
  error?: string
}

interface SuggestionJobListProps {
  /** Keyword from the suggestion card that opened this list. */
  keyword: string
  resumeId?: string
}

/** Where a posting lives, so the user can see it is the company's own board. */
function applyHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'apply link'
  }
}

function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)
  if (!Number.isFinite(days) || days < 0) return 'recently'
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

/**
 * Real US job postings for one suggested role, with the employer's official
 * apply link.
 *
 * Replaces what this used to be — a link to a Google search for the keyword,
 * which never showed a posting and never produced an apply URL.
 */
export function SuggestionJobList({ keyword, resumeId }: SuggestionJobListProps) {
  const { toast } = useToast()
  const [jobs, setJobs] = useState<SuggestionJob[]>([])
  // Jobs saved during this session, so the button can confirm without a refetch.
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [savingId, setSavingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // Bumped once per fetch and folded into each row's key, so the entrance
  // animation replays on new results but not on an incidental re-render.
  const [fetchCount, setFetchCount] = useState(0)

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError(null)
      setNotice(null)

      // A live provider sweep pulls whole job boards, so it needs a long
      // ceiling; the plain DB query returns in milliseconds.
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), refresh ? 300_000 : 30_000)
      try {
        const res = await fetch('/api/career-ops/resume-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keywords: [keyword], resumeId, limit: 10, refresh }),
          signal: controller.signal,
        })
        const data: ResumeJobsResponse = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(data.error || 'Could not load jobs for this role.')
          return
        }
        setFetchCount(n => n + 1)
        setJobs(data.jobs || [])
        if (data.refreshed) {
          setNotice(
            `Live refresh: ${data.refreshed.jobsNew} new US postings added, ` +
            `${data.refreshed.jobsSkippedNonUs} non-US postings skipped.`
          )
        }
      } catch (err) {
        const aborted = err instanceof DOMException && err.name === 'AbortError'
        setError(aborted ? 'Timed out while fetching jobs. Try again.' : 'Something went wrong.')
      } finally {
        clearTimeout(timeoutId)
        setLoading(false)
        setRefreshing(false)
      }
    },
    [keyword, resumeId]
  )

  useEffect(() => {
    const timer = setTimeout(() => load(false), 0)
    return () => clearTimeout(timer)
  }, [load])

  /**
   * Save a posting to the tracker as SAVED, which is what puts it on the
   * Applications page and behind the career-ops toolkit. `resumeId` is
   * optional — the API falls back to the newest resume.
   */
  const save = async (job: SuggestionJob) => {
    setSavingId(job.id)
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, resumeId, status: 'SAVED' }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setSavedIds(prev => new Set(prev).add(job.id))
        toast({ type: 'success', message: `Saved — open it from Applications for the toolkit.` })
      } else {
        toast({ type: 'error', message: data?.error || 'Could not save this job.' })
      }
    } catch {
      toast({ type: 'error', message: 'Could not save this job.' })
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return (
      <div className="mt-3 space-y-2" aria-busy="true" aria-label="Loading jobs">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="animate-in rounded-lg border border-gray-200 dark:border-gray-700 p-3"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <div className="animate-pulse space-y-2">
              <div className="h-3.5 w-2/5 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-3 w-1/4 rounded bg-gray-100 dark:bg-gray-800" />
              <div className="h-3 w-1/3 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="mt-3 animate-in rounded-lg border border-danger-200 dark:border-danger-500/30 bg-danger-50 dark:bg-danger-500/10 p-3 text-sm text-danger-700 dark:text-danger-300">
        {error}
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      {notice && (
        <p className="animate-in text-xs text-success-600 dark:text-success-500">{notice}</p>
      )}

      {jobs.length === 0 ? (
        <div className="animate-in rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-4 text-center">
          <Briefcase className="w-6 h-6 mx-auto mb-1.5 text-gray-400" aria-hidden="true" />
          <p className="text-sm text-gray-600 dark:text-gray-300">
            No US postings stored for this role yet.
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Pull fresh listings from the job boards below.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {jobs.map((job, i) => (
            <li
              key={`${fetchCount}-${job.id}`}
              className="animate-in hover-lift rounded-lg border border-gray-200 dark:border-gray-700 p-3 transition-colors hover:border-primary-300 dark:hover:border-primary-700"
              // Staggered entrance: each row trails the one above it, capped so
              // the tenth row doesn't wait most of a second to appear.
              style={{ animationDelay: `${Math.min(i * 55, 400)}ms` }}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-sm text-gray-900 dark:text-white">
                      {job.title}
                    </h4>
                    <span
                      className="inline-flex items-center gap-1 text-xs font-semibold"
                      style={{ color: getScoreColor(job.score) }}
                    >
                      <TrendingUp className="w-3 h-3" aria-hidden="true" />
                      {job.score}%
                    </span>
                    {job.visaSponsored && (
                      <Badge variant="info" className="text-[10px]">
                        Sponsors visas
                      </Badge>
                    )}
                    {job.applicationStatus && (
                      <Badge variant="gray" className="text-[10px]">
                        {job.applicationStatus}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="w-3 h-3" aria-hidden="true" />
                      {job.company}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3" aria-hidden="true" />
                      {job.isRemote && job.location ? `${job.location} · Remote` : job.location || 'US'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" aria-hidden="true" />
                      {daysAgo(job.postedAt)}
                    </span>
                  </div>

                  {job.matchedSkills.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {job.matchedSkills.slice(0, 5).map(skill => (
                        <Badge key={skill} variant="success" className="text-[10px]">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Saving is what makes the career-ops toolkit reachable for
                      this job, from the Applications page. */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => save(job)}
                    disabled={savingId === job.id || savedIds.has(job.id) || Boolean(job.applicationStatus)}
                    title={
                      savedIds.has(job.id) || job.applicationStatus
                        ? 'Already in your Applications — open it there for the toolkit'
                        : 'Save to Applications to tailor your CV, draft emails and more'
                    }
                  >
                    {savedIds.has(job.id) || job.applicationStatus ? (
                      <>
                        <BookmarkCheck className="w-3.5 h-3.5 mr-1.5 text-success-500" aria-hidden="true" />
                        Saved
                      </>
                    ) : (
                      <>
                        <Bookmark className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                        {savingId === job.id ? 'Saving…' : 'Save'}
                      </>
                    )}
                  </Button>
                  <a
                    href={job.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="press-scale inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-500 text-white transition-colors hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                    title={`Opens the official posting on ${applyHost(job.applyUrl)}`}
                  >
                    Apply
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                </div>
              </div>

              {/* The employer's own board, so it is clear this is not a mirror. */}
              <p className="mt-2 flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
                <CheckCircle2 className="w-3 h-3 text-success-500" aria-hidden="true" />
                Official posting on {applyHost(job.applyUrl)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          US postings only, scored against your resume.
        </p>
        <Button variant="ghost" size="sm" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw
            className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          {refreshing ? 'Fetching from job boards…' : 'Fetch fresh listings'}
        </Button>
      </div>
    </div>
  )
}
