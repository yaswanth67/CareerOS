'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, Copy, Loader2, Search, Sparkles, Share2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { CareerOpsMarkdown } from '@/components/career-ops/CareerOpsReport'
import { SuggestionJobList, type SuggestionJob } from '@/components/career-ops/SuggestionJobList'
import {
  CLIENT_ABORT_MS,
  CLIENT_TIMEOUT_MESSAGE,
  TYPICAL_DURATION_LABEL,
} from '@/lib/career-ops/timeouts'
import {
  activeScanElapsed,
  cancelActiveScan,
  getActiveScan,
  startOrAdoptScan,
} from '@/lib/career-ops/scan-registry'

interface RoleSuggestion {
  title: string
  axis: 'Lateral' | 'Stretch' | 'Pivot'
  cvEvidence: string
  gapNote: string
  marketNote: string
  keyword: string
}

interface ResumeOption {
  id: string
  title: string
  updatedAt: string
}

interface SuggestApiResponse {
  suggestions?: RoleSuggestion[]
  markdown?: string
  error?: string
}

interface ResumesApiResponse {
  resumes: ResumeOption[]
  error?: string
}

const AXIS_STYLE: Record<RoleSuggestion['axis'], { badge: 'success' | 'warning' | 'info'; label: string }> = {
  Lateral: { badge: 'success', label: 'Lateral — same work, new label' },
  Stretch: { badge: 'warning', label: 'Stretch — one level up' },
  Pivot: { badge: 'info', label: 'Pivot — adjacent function' },
}

/**
 * Scan the user's resume and propose adjacent job titles at their recorded
 * level (career-ops `titles` mode). Level-calibrated: senior / 5+ years titles
 * are excluded, so suggestions match a Junior/Mid candidate.
 */
export function ResumeSuggestions() {
  const { toast } = useToast()
  const [resumes, setResumes] = useState<ResumeOption[]>([])
  const [selectedResumeId, setSelectedResumeId] = useState('')
  const [resumesLoading, setResumesLoading] = useState(false)
  // Seeded from the registry: if a scan is already running when this mounts
  // (you navigated away and came back), render straight into the loading state
  // rather than writing it from an effect.
  const [loading, setLoading] = useState(() => Boolean(getActiveScan()))
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<RoleSuggestion[]>([])
  const [markdown, setMarkdown] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  // Which suggestion has its real-job list open. One at a time keeps the page
  // short and means only one query is in flight.
  const [openJobsFor, setOpenJobsFor] = useState<string | null>(null)
  // Track if auto-scan has been triggered
  const [hasAutoScanned, setHasAutoScanned] = useState(false)
  // Track if scan is running in background (persisted to sessionStorage)
  const [isScanningInBackground, setIsScanningInBackground] = useState(false)
  // Track if a manual scan is in progress (persisted to sessionStorage)
  const [isManualScanActive, setIsManualScanActive] = useState(false)

  // Scan state keys for sessionStorage
  const SCAN_STATE_KEY = 'career-ops-scan-state'

  // Cache fetched jobs per (keyword + resumeId) so switching tabs or reopening doesn't refetch.
  const [jobsCache, setJobsCache] = useState<Map<string, SuggestionJob[]>>(new Map())
  // Live scan controls: the elapsed counter turns a multi-minute wait into
  // visible progress, and the ref lets the Cancel button abort the same request.
  const [elapsed, setElapsed] = useState(() => activeScanElapsed())
  const scanControllerRef = useRef<AbortController | null>(null)
  const cancelledRef = useRef(false)
  const cacheRef = useRef(jobsCache)
  cacheRef.current = jobsCache

  const cacheKey = (keyword: string, resumeId?: string) => `${resumeId || 'latest'}::${keyword}`

  // Load cached suggestions from localStorage on mount
  useEffect(() => {
    const cached = localStorage.getItem('career-ops-suggestions')
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        // Only restore if it's for the same user (we could add userId check)
        if (parsed.suggestions && parsed.suggestions.length > 0) {
          setSuggestions(parsed.suggestions)
          setMarkdown(parsed.markdown)
          setSelectedResumeId(parsed.resumeId || '')
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, [])

  // Load scan state from sessionStorage on mount
  useEffect(() => {
    const scanState = sessionStorage.getItem(SCAN_STATE_KEY)
    if (scanState) {
      try {
        const parsed = JSON.parse(scanState)
        if (parsed.isScanningInBackground) {
          setIsScanningInBackground(true)
        }
        if (parsed.isManualScanActive) {
          setIsManualScanActive(true)
          setLoading(true)
        }
        if (parsed.hasAutoScanned) {
          setHasAutoScanned(true)
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, [])

  // Save scan state to sessionStorage when it changes
  useEffect(() => {
    const state = {
      isScanningInBackground,
      isManualScanActive,
      hasAutoScanned,
      timestamp: Date.now()
    }
    sessionStorage.setItem(SCAN_STATE_KEY, JSON.stringify(state))
  }, [isScanningInBackground, isManualScanActive, hasAutoScanned])

  // Save suggestions to localStorage when they change
  useEffect(() => {
    if (suggestions.length > 0) {
      localStorage.setItem('career-ops-suggestions', JSON.stringify({
        suggestions,
        markdown,
        resumeId: selectedResumeId,
        timestamp: Date.now()
      }))
    }
  }, [suggestions, markdown, selectedResumeId])

  // Clear cache when resume selection changes
  useEffect(() => {
    setJobsCache(new Map())
  }, [selectedResumeId])

  const fetchResumes = useCallback(async () => {
    setResumesLoading(true)
    try {
      const res = await fetch('/api/resumes/list')
      const data: ResumesApiResponse = await res.json().catch(() => ({ resumes: [] }))
      if (res.ok) setResumes(data.resumes || [])
    } catch {
      // silent fail — the picker is optional; the API defaults to the latest resume
    } finally {
      setResumesLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(fetchResumes, 0)
    return () => clearTimeout(timer)
  }, [fetchResumes])

  // Count up only while a scan is in flight. The reset lives in the scan
  // handler rather than here — writing state synchronously on the !loading
  // branch of an effect is a cascading render.
  useEffect(() => {
    if (!loading) return
    // Seeded from the registry, not from now: after a remount the scan has
    // already been running for a while, and restarting the count at 0:00 would
    // suggest the work restarted too.
    const id = setInterval(() => setElapsed(activeScanElapsed()), 1000)
    return () => clearInterval(id)
  }, [loading])

  /** Abort the in-flight scan at the user's request (not a failure). */
  const cancelScan = () => {
    cancelledRef.current = true
    cancelActiveScan()
    setLoading(false)
    setError(null)
  }

  // On mount: rejoin a scan that is already running, and only start a new one
  // when nothing is in flight and there is nothing cached to show. Without the
  // first branch, navigating away and back abandoned the running scan and
  // kicked off a fresh one — so a 4–6 minute scan could never finish if you
  // looked at another page while waiting.
  useEffect(() => {
    const running = getActiveScan()
    if (running) {
      let cancelled = false
      running.promise
        .then(data => {
          if (cancelled) return
          setSuggestions((data.suggestions as RoleSuggestion[]) || [])
          setMarkdown(data.markdown)
        })
        .catch(() => {
          // The mount that started the scan owns error reporting.
        })
        .finally(() => {
          if (cancelled) return
          setLoading(false)
          // These are cleared in handleScan's `finally`, which this mount never
          // ran — without clearing them here the "scan running in background"
          // banner outlived the scan it described.
          setIsManualScanActive(false)
          setIsScanningInBackground(false)
          setHasAutoScanned(true)
        })
      return () => {
        cancelled = true
      }
    }

    const timer = setTimeout(() => {
      if (!hasAutoScanned && suggestions.length === 0) {
        handleScan(true) // true = isAutoScan
      }
    }, 100)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAutoScanned, suggestions.length])

  // Clear job cache when resume selection changes, since different resumes yield different results
  useEffect(() => {
    setJobsCache(new Map())
  }, [selectedResumeId])

  const handleScan = async (isAutoScan = false) => {
    if (!isAutoScan) {
      setLoading(true)
      setIsManualScanActive(true)
      setElapsed(0)
      setError(null)
      setSuggestions([])
      setMarkdown(null)
      setOpenJobsFor(null)
      setJobsCache(new Map()) // Clear job cache for new scan
    } else {
      setIsScanningInBackground(true)
    }

    // The request is registered module-side rather than owned by this
    // component: a scan runs for minutes, and leaving the page used to orphan
    // it and start a fresh one on return. `startOrAdoptScan` hands back the run
    // already in progress for this resume, so remounting joins it instead.
    // Budget lives in src/lib/career-ops/timeouts.ts.
    const scan = startOrAdoptScan(selectedResumeId || 'latest', signal => {
      const timeoutId = setTimeout(() => scanControllerRef.current?.abort(), CLIENT_ABORT_MS)
      return fetch('/api/career-ops/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId: selectedResumeId || undefined }),
        signal,
      })
        .then(async res => {
          const data: SuggestApiResponse = await res.json().catch(() => ({}))
          if (!res.ok || !data.markdown) {
            throw new Error(data?.error || 'Failed to scan your resume.')
          }
          return { suggestions: data.suggestions || [], markdown: data.markdown }
        })
        .finally(() => clearTimeout(timeoutId))
    })
    scanControllerRef.current = scan.controller

    try {
      const data = await scan.promise
      setSuggestions((data.suggestions as RoleSuggestion[]) || [])
      setMarkdown(data.markdown)
      if (!isAutoScan) {
        toast({ type: 'success', message: 'Role suggestions ready!' })
      }
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError'
      // A user-initiated cancel is not a failure — say nothing and reset.
      if (aborted && cancelledRef.current) {
        cancelledRef.current = false
        return
      }
      const message = aborted
        ? CLIENT_TIMEOUT_MESSAGE
        : err instanceof Error && err.message
          ? err.message
          : 'Something went wrong. Try again.'
      setError(message)
      if (!isAutoScan) {
        toast({ type: 'error', message })
      }
    } finally {
      if (!isAutoScan) {
        setLoading(false)
        setIsManualScanActive(false)
      } else {
        setIsScanningInBackground(false)
      }
      setHasAutoScanned(true)
    }
  }

  const handleCopyKeyword = async (keyword: string) => {
    try {
      await navigator.clipboard.writeText(keyword)
      setCopied(keyword)
      setTimeout(() => setCopied(null), 1500)
      toast({ type: 'success', message: `Keyword copied: ${keyword}` })
    } catch {
      toast({ type: 'error', message: 'Could not copy. Select and copy manually.' })
    }
  }

  const handleRefer = async (suggestion: RoleSuggestion) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const referUrl = `${baseUrl}/ai?tab=evaluate&keyword=${encodeURIComponent(suggestion.keyword)}&title=${encodeURIComponent(suggestion.title)}`
    try {
      await navigator.clipboard.writeText(referUrl)
      setCopied(suggestion.keyword)
      setTimeout(() => setCopied(null), 1500)
      toast({ type: 'success', message: 'Referral link copied!' })
    } catch {
      toast({ type: 'error', message: 'Could not copy. Select and copy manually.' })
    }
  }

  return (
    <div className="space-y-4">
      {/* Scanner controls */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 min-w-0">
            <label
              htmlFor="suggestResume"
              className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide"
            >
              Resume version
            </label>
            <select
              id="suggestResume"
              value={selectedResumeId}
              onChange={e => setSelectedResumeId(e.target.value)}
              disabled={resumesLoading || loading}
              className="mt-1.5 appearance-none w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 pr-8 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Latest resume</option>
              {resumes.map(r => (
                <option key={r.id} value={r.id}>
                  {r.title || 'Untitled resume'} — {new Date(r.updatedAt).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={() => handleScan(false)} isLoading={loading} disabled={loading} className="sm:shrink-0">
            {!loading && <Sparkles className="w-4 h-4 mr-1.5" aria-hidden="true" />}
            {loading ? 'Scanning…' : 'Scan resume & suggest roles'}
          </Button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Job titles worth searching for, based on your resume — matched to your level, so senior
          roles are left out.
        </p>
      </div>

      {/* Background scan indicator (persists across tab switches) */}
      {isScanningInBackground && !loading && (
        <div className="rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20 p-4 flex items-center gap-3 animate-in">
          <Loader2 className="w-5 h-5 animate-spin text-primary-500 flex-shrink-0" />
          <div className="text-sm text-primary-900 dark:text-primary-100">
            <p className="font-medium">Scan running in background…</p>
            <p className="mt-1 text-xs text-primary-700 dark:text-primary-300">
              You can switch tabs — the scan will continue and results will appear here when ready.
            </p>
          </div>
        </div>
      )}

      {/* Loading. The elapsed counter matters: this legitimately runs for
          minutes, and a bare spinner is indistinguishable from a hang. */}
      {loading && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-6 flex items-start gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 text-sm text-gray-600 dark:text-gray-300">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="font-medium text-gray-900 dark:text-white">
                Scanning your resume…{' '}
                <span className="tabular-nums text-gray-500 dark:text-gray-400">
                  {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
                </span>
              </p>
              <Button variant="ghost" size="sm" onClick={cancelScan}>
                Cancel
              </Button>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              This runs the career-ops titles evaluation through your local Claude connection.
              It normally takes {TYPICAL_DURATION_LABEL} — the results appear here when it finishes,
              so you can leave this page open.
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-lg border border-danger-200 dark:border-danger-500/30 bg-danger-50 dark:bg-danger-500/10 p-4 text-sm text-danger-700 dark:text-danger-300">
          {error}
        </div>
      )}

      {/* No resume yet */}
      {!loading && !error && resumes.length === 0 && suggestions.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-50" aria-hidden="true" />
          <p>Upload a resume first — suggestions are generated from it.</p>
          <p className="text-xs mt-1">Head to the Resumes tab to add one.</p>
        </div>
      )}

      {/* Results */}
      {!loading && (suggestions.length > 0 || markdown) && (
        <>
          {suggestions.length > 0 ? (
            <div className="space-y-2">
              {suggestions.map((s, i) => {
                const axis = AXIS_STYLE[s.axis] || AXIS_STYLE.Lateral
                const jobsOpen = openJobsFor === s.title
                return (
                  <div
                    key={s.title}
                    className="animate-in rounded-lg border border-gray-200 dark:border-gray-700 p-4 transition-colors hover:border-gray-300 dark:hover:border-gray-600"
                    // Cards cascade in rather than all appearing at once.
                    style={{ animationDelay: `${Math.min(i * 60, 360)}ms` }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-gray-900 dark:text-white">{s.title}</h3>
                        <Badge variant={axis.badge}>{axis.label}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant={jobsOpen ? 'primary' : 'outline'}
                          size="sm"
                          className="press-scale"
                          onClick={() => setOpenJobsFor(jobsOpen ? null : s.title)}
                          aria-expanded={jobsOpen}
                          aria-label={`${jobsOpen ? 'Hide' : 'Show'} real US job postings for ${s.title}`}
                        >
                          <Search className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                          {jobsOpen ? 'Hide jobs' : 'View jobs'}
                          <ChevronDown
                            className={`w-3.5 h-3.5 ml-1 transition-transform duration-300 ${
                              jobsOpen ? 'rotate-180' : ''
                            }`}
                            aria-hidden="true"
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRefer(s)}
                          disabled={loading}
                        >
                          {copied === s.keyword ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 mr-1.5 text-success-500" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Share2 className="w-4 h-4 mr-1.5" />
                              Refer
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    {s.cvEvidence && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">
                        CV evidence: “{s.cvEvidence}”
                      </p>
                    )}
                    <div className="mt-2 grid sm:grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300">
                      {s.gapNote && (
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white">Gap note: </span>
                          {s.gapNote}
                        </div>
                      )}
                      {s.marketNote && (
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white">Market: </span>
                          {s.marketNote}
                        </div>
                      )}
                    </div>

                    {/* Real US postings for this role, with official apply links. */}
                    {jobsOpen && (
                      <SuggestionJobList
                        keyword={s.keyword}
                        resumeId={selectedResumeId || undefined}
                        initialJobs={jobsCache.get(cacheKey(s.keyword, selectedResumeId)) || []}
                        onJobsFetched={(jobs) => {
                          setJobsCache((prev) => {
                            const next = new Map(prev)
                            next.set(cacheKey(s.keyword, selectedResumeId), jobs)
                            return next
                          })
                        }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Suggestions generated — showing the full output below.
              </p>
            </div>
          )}

          {/* Full markdown output */}
          {markdown && (
            <details className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <summary className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white cursor-pointer select-none bg-gray-50 dark:bg-gray-800">
                Full report
              </summary>
              <div className="p-4">
                <CareerOpsMarkdown markdown={markdown} />
              </div>
            </details>
          )}
        </>
      )}
    </div>
  )
}
