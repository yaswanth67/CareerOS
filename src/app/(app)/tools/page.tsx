'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Link2,
  Loader2,
  MapPin,
  Search,
  Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { CareerOpsToolkit, type ToolkitJob } from '@/components/career-ops/CareerOpsToolkit'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

type Tab = 'search' | 'saved' | 'link'

/** A job as returned by /api/jobs and /api/applications — already ToolkitJob-shaped. */
interface JobResult {
  id: string
  title: string
  company: string
  location: string
  isRemote: boolean
  applyUrl: string | null
  description: string
}

interface SavedApplication {
  id: string
  status: string
  updatedAt: string
  job: JobResult
  resume?: { id: string } | null
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'search', label: 'Search jobs' },
  { id: 'saved', label: 'Saved jobs' },
  { id: 'link', label: 'Paste a link' },
]

/**
 * Tools hub — pick any job (search the feed, a saved application, or a pasted
 * link) and every career-ops tool opens in one drawer: cover letter, cold
 * email, LinkedIn message, follow-up, interview prep, tailor CV, fit report,
 * and upskill. The heavy lifting all lives in <CareerOpsToolkit />.
 */
export default function ToolsPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('search')

  // Search tab
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<JobResult[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Saved jobs tab
  const [saved, setSaved] = useState<SavedApplication[]>([])
  const [savedLoading, setSavedLoading] = useState(false)

  // Paste-link tab
  const [linkUrl, setLinkUrl] = useState('')
  const [resolving, setResolving] = useState(false)

  // The job the toolkit drawer is open for
  const [toolkitJob, setToolkitJob] = useState<ToolkitJob | null>(null)
  const [toolkitResumeId, setToolkitResumeId] = useState<string | undefined>(undefined)

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/jobs?search=${encodeURIComponent(q.trim())}&pageSize=10`)
      const data = await res.json()
      if (res.ok && Array.isArray(data.jobs)) setResults(data.jobs)
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      runSearch(query)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, runSearch])

  const loadSaved = useCallback(async () => {
    setSavedLoading(true)
    try {
      const res = await fetch('/api/applications')
      const data = await res.json()
      if (res.ok && Array.isArray(data.applications)) setSaved(data.applications)
    } catch {
      setSaved([])
    } finally {
      setSavedLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab !== 'saved') return
    // Defer so setState isn't called synchronously inside the effect.
    const timer = setTimeout(loadSaved, 0)
    return () => clearTimeout(timer)
  }, [tab, loadSaved])

  const openToolkit = (job: ToolkitJob, resumeId?: string) => {
    setToolkitResumeId(resumeId)
    setToolkitJob(job)
  }

  const resolveLink = async () => {
    const url = linkUrl.trim()
    if (!url) {
      toast({ type: 'error', message: 'Paste a job posting URL first' })
      return
    }
    setResolving(true)
    try {
      const res = await fetch('/api/tools/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (res.ok && data.job) {
        toast({
          type: 'success',
          message: data.isNew ? 'Job added to your feed' : 'Job found',
        })
        openToolkit(data.job, data.resumeId)
        setLinkUrl('')
      } else {
        toast({ type: 'error', message: data?.error || 'Couldn’t read that link' })
      }
    } catch {
      toast({ type: 'error', message: 'Couldn’t read that link' })
    } finally {
      setResolving(false)
    }
  }

  return (
    <div className="space-y-6 animate-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Wrench className="w-6 h-6 text-primary-500" aria-hidden="true" />
          Advanced AI tools
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Pick any job — search the feed, one you’ve saved, or a pasted link — then run every
          AI tool on it: fit report, cover letter, cold email, LinkedIn message, follow-up,
          interview prep, tailor CV, and upskill.
        </p>
      </div>

      {/* Job source tabs */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-800 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              tab === t.id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search tab */}
      {tab === 'search' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search jobs by title, company, or keyword…"
              className="pl-9"
            />
          </div>

          {searching ? (
            <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400 text-sm">
              <Loader2 className="w-5 h-5 animate-spin text-primary-500 mr-2" />
              Searching…
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
              {query.trim()
                ? 'No jobs found — try different keywords.'
                : 'Start typing to search the job feed.'}
            </div>
          ) : (
            <div className="space-y-2">
              {results.map(job => (
                <JobRow
                  key={job.id}
                  job={job}
                  onClick={() => openToolkit(job)}
                  trailing={job.location || (job.isRemote ? 'Remote' : '')}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Saved jobs tab */}
      {tab === 'saved' && (
        <div className="space-y-3">
          {savedLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400 text-sm">
              <Loader2 className="w-5 h-5 animate-spin text-primary-500 mr-2" />
              Loading saved jobs…
            </div>
          ) : saved.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
              <p>No saved jobs yet.</p>
              <p className="text-xs mt-1">Save jobs from the Dashboard to run tools on them here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {saved.map(app => (
                <JobRow
                  key={app.id}
                  job={app.job}
                  onClick={() => openToolkit(app.job, app.resume?.id)}
                  status={app.status}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Paste link tab */}
      {tab === 'link' && (
        <div className="space-y-3">
          <div>
            <label htmlFor="job-link" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Job posting URL
            </label>
            <div className="mt-1.5 flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="job-link"
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') resolveLink() }}
                  placeholder="https://boards.greenhouse.io/…"
                  className="pl-9"
                  disabled={resolving}
                />
              </div>
              <Button onClick={resolveLink} disabled={resolving || !linkUrl.trim()}>
                {resolving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-1.5" />
                )}
                {resolving ? 'Reading…' : 'Open tools'}
              </Button>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Reads the posting, adds it to your feed, and opens every tool on it. Want the full
              A–G fit report instead?{' '}
              <Link href="/ai?tab=evaluate" className="text-primary-600 dark:text-primary-400 hover:underline">
                Open AI Career → Evaluate
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      {toolkitJob && (
        <CareerOpsToolkit
          job={toolkitJob}
          defaultResumeId={toolkitResumeId}
          onClose={() => setToolkitJob(null)}
        />
      )}
    </div>
  )
}

/** One selectable job row. `status` renders a small badge for the Saved list. */
function JobRow({
  job,
  onClick,
  trailing,
  status,
}: {
  job: JobResult
  onClick: () => void
  trailing?: string
  status?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-900 dark:text-white truncate">{job.title}</p>
            {status && (
              <Badge variant="info" className="text-xs shrink-0">{status}</Badge>
            )}
          </div>
          <p className="text-sm text-primary-600 dark:text-primary-400 truncate">{job.company}</p>
          {(trailing || job.location) && (
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" />
              {trailing || job.location}
            </p>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 shrink-0 text-sm font-medium text-primary-600 dark:text-primary-400">
          Run tools
          <ArrowRight className="w-4 h-4" />
        </span>
      </div>
    </button>
  )
}
