'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { CheckCircle2, ExternalLink, Link2, Loader2, Search, Sparkles, Filter, X, FileText, Briefcase, TrendingUp, FileCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { CareerOpsReport, CareerOpsReportData } from '@/components/career-ops/CareerOpsReport'
import toast from 'react-hot-toast'

interface EvaluatedJob {
  title: string
  company: string
  description: string
  location?: string
  applyUrl: string
}

interface UnifiedJob {
  id: string
  title: string
  company: string
  location?: string
  applyUrl: string
  source: 'dashboard' | 'career-ops'
  careerOpsScore: number | null
  matchScore: number | null
  reportNumber?: number | null
  reportPath?: string | null
  evaluatedAt: string
}

interface ResumeOption {
  id: string
  title: string
  updatedAt: string
}

interface EvaluateResult {
  job: EvaluatedJob
  report: CareerOpsReportData & { reportPath?: string | null; reportNumber?: number | null }
  saved: { id: string; isNew: boolean }
}

interface JobApiResponse {
  jobs: UnifiedJob[]
  error?: string
}

interface ResumesApiResponse {
  resumes: ResumeOption[]
  error?: string
}

export default function EvaluatePage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<EvaluateResult | null>(null)

  // List view state
  const [showList, setShowList] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const [jobs, setJobs] = useState<UnifiedJob[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [threshold, setThreshold] = useState(0)
  const [resumes, setResumes] = useState<ResumeOption[]>([])
  const [selectedResumeId, setSelectedResumeId] = useState<string | 'all'>('all')
  const [resumesLoading, setResumesLoading] = useState(false)

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) {
      toast.error('Paste a job posting link first.')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/career-ops/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.report) {
        setResult(data)
        toast.success('Evaluation complete!')
      } else {
        setError(data?.error || 'Failed to evaluate that job.')
        toast.error(data?.error || 'Failed to evaluate that job.')
      }
    } catch {
      setError('Something went wrong. Try again.')
      toast.error('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const fetchResumes = useCallback(async () => {
    setResumesLoading(true)
    try {
      const res = await fetch('/api/resumes/list')
      const data: ResumesApiResponse = await res.json().catch(() => ({ resumes: [] }))
      if (res.ok) {
        setResumes(data.resumes || [])
      }
    } catch {
      // silent fail
    } finally {
      setResumesLoading(false)
    }
  }, [])

  const fetchJobs = useCallback(async () => {
    setListLoading(true)
    setListError(null)
    try {
      const resumeParam = selectedResumeId === 'all' ? '' : `&resumeId=${selectedResumeId}`
      const res = await fetch(`/api/career-ops/jobs?minScore=${threshold}${resumeParam}`)
      const data: JobApiResponse = await res.json().catch(() => ({ jobs: [] }))
      if (res.ok) {
        setJobs(data.jobs || [])
      } else {
        setListError(data.error || 'Failed to load jobs')
        toast.error(data.error || 'Failed to load jobs')
      }
    } catch {
      setListError('Something went wrong. Try again.')
      toast.error('Something went wrong. Try again.')
    } finally {
      setListLoading(false)
    }
  }, [selectedResumeId, threshold])

  useEffect(() => {
    if (showList) {
      // Defer to avoid sync setState in effect body
      const timer = setTimeout(() => {
        fetchJobs()
        fetchResumes()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [showList, fetchJobs, fetchResumes])

  const scoreBadge = (score: number | null, label: string) => {
    if (score === null) return null
    return (
      <Badge variant={score >= 3 ? 'success' : score >= 2 ? 'warning' : 'danger'} className="text-xs">
        <TrendingUp className="w-2.5 h-2.5 mr-1" />
        {label}: {score.toFixed(1)}
      </Badge>
    )
  }

  return (
    <div className="space-y-6 animate-in max-w-3xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary-500" aria-hidden="true" />
            Evaluate a job link
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Paste any job posting URL and get a career-ops score (0–5), archetype, legitimacy check, and the
            full A–G report — scored against your latest resume. The job is saved to your Dashboard too.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowList(!showList)}
          className="sm:shrink-0"
        >
          {showList ? (
            <>
              <Briefcase className="w-4 h-4 mr-1.5" />
              Hide evaluated jobs
            </>
          ) : (
            <>
              <Briefcase className="w-4 h-4 mr-1.5" />
              Show evaluated jobs
            </>
          )}
        </Button>
      </div>

      {/* URL form */}
      <form onSubmit={handleEvaluate} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            type="url"
            name="jobUrl"
            placeholder="https://boards.greenhouse.io/acme/jobs/1234567"
            value={url}
            onChange={e => setUrl(e.target.value)}
            aria-label="Job posting URL"
            className="flex-1"
            disabled={loading}
          />
          <Button type="submit" isLoading={loading} disabled={loading} className="sm:shrink-0">
            {!loading && <Search className="w-4 h-4" aria-hidden="true" />}
            {loading ? 'Scoring…' : 'Evaluate'}
          </Button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Works best with Greenhouse, Ashby and Lever links. LinkedIn and Indeed block automated access —
          for those, use the company&apos;s own careers page link.
        </p>
      </form>

      {/* Loading */}
      {loading && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-6 flex items-start gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-600 dark:text-gray-300">
            <p className="font-medium text-gray-900 dark:text-white">Reading the posting and scoring it…</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              This runs the full career-ops A–G evaluation, so it takes about 30 seconds.
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

      {/* Result */}
      {result && !loading && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold leading-snug text-gray-900 dark:text-white">
                    {result.job.title}
                  </h2>
                  <p className="mt-0.5 text-sm text-primary-600 dark:text-primary-400 font-medium">
                    {result.job.company}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant="success">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {result.saved.isNew ? 'Saved to Dashboard' : 'Updated in Dashboard'}
                    </Badge>
                    {result.job.location && <Badge variant="gray">{result.job.location}</Badge>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 border border-gray-300 bg-transparent hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 px-3 py-1.5 text-sm"
                  >
                    <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
                    View in Dashboard
                  </Link>
                  <a href={result.job.applyUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                      Open posting
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {result.report.reportPath && (
            <div className="rounded-lg border border-success-200 dark:border-success-500/30 bg-success-50 dark:bg-success-500/10 px-4 py-3 text-sm text-success-700 dark:text-success-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-medium">
                  Report {result.report.reportNumber != null ? `#${result.report.reportNumber} ` : ''}saved to the
                  career-ops workspace
                </p>
                <p className="mt-0.5 text-xs font-mono break-all">{result.report.reportPath}</p>
              </div>
            </div>
          )}

          <CareerOpsReport report={result.report} />
        </div>
      )}

      {/* List view */}
      {showList && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Filter className="w-5 h-5 text-gray-400" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Score threshold</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Show only jobs with career-ops or match score ≥ {threshold}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={threshold}
                  onChange={e => setThreshold(parseFloat(e.target.value))}
                  className="w-48 h-2 accent-primary-500"
                  aria-label="Minimum score threshold"
                />
                <span className="text-lg font-mono font-semibold text-gray-900 dark:text-white w-10 text-right">
                  {threshold.toFixed(1)}
                </span>
                {threshold > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setThreshold(0)}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Resume filter */}
            {resumes.length > 0 && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <FileCheck className="w-5 h-5 text-gray-400" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Resume filter</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Filter Dashboard jobs by which resume they were scored against
                    </p>
                  </div>
                </div>
                <div className="relative">
                  <select
                    value={selectedResumeId}
                    onChange={e => setSelectedResumeId(e.target.value)}
                    disabled={resumesLoading}
                    className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 pr-10 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent min-w-[200px]"
                  >
                    <option value="all">All resumes</option>
                    {resumes.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.title || 'Untitled resume'} {new Date(r.updatedAt).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                  <FileCheck className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Jobs list */}
            {listLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary-500 mr-2" />
                <span className="text-gray-600 dark:text-gray-300">Loading evaluated jobs…</span>
              </div>
            ) : listError ? (
              <div className="rounded-lg border border-danger-200 dark:border-danger-500/30 bg-danger-50 dark:bg-danger-500/10 p-4 text-sm text-danger-700 dark:text-danger-300">
                {listError}
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No evaluated jobs match the threshold.</p>
                <p className="text-xs mt-1">Try lowering the score threshold or evaluate a new job above.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {jobs.map(job => (
                  <div
                    key={job.id}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">
                          {job.title}
                        </h3>
                        <p className="text-sm text-primary-600 dark:text-primary-400 truncate">
                          {job.company}
                        </p>
                        {job.location && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{job.location}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {scoreBadge(job.careerOpsScore, 'CO')}
                        {scoreBadge(job.matchScore, 'Match')}
                        <Badge variant={job.source === 'career-ops' ? 'info' : 'gray'} className="text-xs">
                          {job.source === 'career-ops' ? (
                            <>
                              <FileText className="w-2.5 h-2.5 mr-1" />
                              career-ops
                            </>
                          ) : (
                            <>
                              <Briefcase className="w-2.5 h-2.5 mr-1" />
                              Dashboard
                            </>
                          )}
                        </Badge>
                        {job.reportPath && (
                          <Link
                            href={`/api/career-ops/report?path=${encodeURIComponent(job.reportPath)}`}
                            className="inline-flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
                            target="_blank"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Report
                          </Link>
                        )}
                        {job.applyUrl && (
                          <a
                            href={job.applyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Open
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}