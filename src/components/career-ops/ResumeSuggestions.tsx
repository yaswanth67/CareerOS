'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, ChevronDown, Copy, Loader2, Search, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { CareerOpsMarkdown } from '@/components/career-ops/CareerOpsReport'
import { SuggestionJobList } from '@/components/career-ops/SuggestionJobList'

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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<RoleSuggestion[]>([])
  const [markdown, setMarkdown] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  // Which suggestion has its real-job list open. One at a time keeps the page
  // short and means only one query is in flight.
  const [openJobsFor, setOpenJobsFor] = useState<string | null>(null)

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

  const handleScan = async () => {
    setLoading(true)
    setError(null)
    setSuggestions([])
    setMarkdown(null)
    setOpenJobsFor(null)

    // The local Claude proxy is slow (~110 output tokens/sec), and the titles
    // eval sends an ~11k-token prompt plus a long report — 1–3 min is normal.
    // Abort after 240s so a genuinely hung connection still surfaces as a clear
    // error instead of an infinite spinner.
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 240_000)
    try {
      const res = await fetch('/api/career-ops/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId: selectedResumeId || undefined }),
        signal: controller.signal,
      })
      const data: SuggestApiResponse = await res.json().catch(() => ({}))
      if (res.ok && data.markdown) {
        setSuggestions(data.suggestions || [])
        setMarkdown(data.markdown)
        toast({ type: 'success', message: 'Role suggestions ready!' })
      } else {
        setError(data?.error || 'Failed to scan your resume.')
        toast({ type: 'error', message: data?.error || 'Failed to scan your resume.' })
      }
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError'
      const message = aborted
        ? 'Timed out after 4 minutes — your Claude connection (port 20128) is unusually slow or not responding. Check your Claude Code session and retry.'
        : 'Something went wrong. Try again.'
      setError(message)
      toast({ type: 'error', message })
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
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
          <Button onClick={handleScan} isLoading={loading} disabled={loading} className="sm:shrink-0">
            {!loading && <Sparkles className="w-4 h-4 mr-1.5" aria-hidden="true" />}
            {loading ? 'Scanning…' : 'Scan resume & suggest roles'}
          </Button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Scans the resume and proposes role titles. Calibrated to your profile level — senior / 5+
          years titles are excluded. Click{' '}
          <span className="text-gray-600 dark:text-gray-400 font-medium">View jobs</span> on a
          suggestion to see real US postings for it, scored against your resume, each linking to the
          employer&apos;s official application page. Each keyword can also be added to{' '}
          <code>portals.yml</code> <code>title_filter.positive</code> to widen your next scan.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-6 flex items-start gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-600 dark:text-gray-300">
            <p className="font-medium text-gray-900 dark:text-white">Scanning your resume…</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              This runs the career-ops titles evaluation through the local Claude connection, so it
              typically takes 1–3 minutes.
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
                          onClick={() => handleCopyKeyword(s.keyword)}
                          disabled={loading}
                        >
                          {copied === s.keyword ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 mr-1.5 text-success-500" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4 mr-1.5" />
                              Copy keyword
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
                      <SuggestionJobList keyword={s.keyword} resumeId={selectedResumeId || undefined} />
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
