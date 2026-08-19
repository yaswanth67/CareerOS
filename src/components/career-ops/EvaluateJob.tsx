'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Copy, CheckCircle2, ExternalLink, Link2, Loader2, Search, FileText, FilePen, MessageSquare, Lightbulb, Mail, Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { CareerOpsMarkdown, CareerOpsReport, CareerOpsReportData } from '@/components/career-ops/CareerOpsReport'
import { useToast } from '@/components/ui/Toast'
import { useApplyPrompt } from '@/hooks/useApplyPrompt'
import { ApplyPromptPortal } from '@/components/ui/ApplyPromptPortal'

interface EvaluatedJob {
  title: string
  company: string
  description: string
  location?: string
  applyUrl: string
}

interface ResumeOption {
  id: string
  title: string
  updatedAt: string
}

interface EvaluateResult {
  job: EvaluatedJob
  report: CareerOpsReportData & { reportPath?: string | null; reportNumber?: number | null }
  saved: { id: string; isNew: boolean; resume?: { title: string; roleType: string } | null }
}

interface ResumesApiResponse {
  resumes: ResumeOption[]
  error?: string
}

/**
 * Evaluate a job posting URL against the user's resume: full career-ops A–G
 * report, then per-mode generations (cover letter, interview prep, email,
 * upskill, follow-up, tailored CV). Shared between the /ai page's "Evaluate a
 * job" tab and any future entry point — the page header lives on the host.
 */
export default function EvaluateJob() {
  const { toast } = useToast()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<EvaluateResult | null>(null)

  // Career-ops mode state
  const [activeMode, setActiveMode] = useState<'report' | 'cover' | 'interview' | 'email' | 'upskill' | 'followup' | 'resume'>('report')
  const [coverLoading, setCoverLoading] = useState(false)
  const [coverResult, setCoverResult] = useState<string | null>(null)
  const [interviewLoading, setInterviewLoading] = useState(false)
  const [interviewResult, setInterviewResult] = useState<string | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailResult, setEmailResult] = useState<string | null>(null)
  const [upskillLoading, setUpskillLoading] = useState(false)
  const [upskillResult, setUpskillResult] = useState<string | null>(null)
  const [followupLoading, setFollowupLoading] = useState(false)
  const [followupResult, setFollowupResult] = useState<string | null>(null)
  const [resumeLoading, setResumeLoading] = useState(false)
  const [resumeResult, setResumeResult] = useState<string | null>(null)

  // Resume-version picker — which resume to score/generate against. '' = latest.
  const [resumes, setResumes] = useState<ResumeOption[]>([])
  const [selectedResumeId, setSelectedResumeId] = useState('')
  const [resumesLoading, setResumesLoading] = useState(false)

  // "Have you applied?" prompt state — tracks the job that was opened.
  const [promptJobId, setPromptJobId] = useState<string | null>(null)
  const [markingApplied, setMarkingApplied] = useState(false)
  const { rememberPendingApply, clearPendingApply } = useApplyPrompt(result?.saved.id ?? '')

  const handleClosePrompt = useCallback(() => {
    clearPendingApply()
    setPromptJobId(null)
  }, [clearPendingApply])

  const handleOpenPosting = () => {
    rememberPendingApply()
    setPromptJobId(result?.saved.id ?? '')
  }
  const handleMarkApplied = async () => {
    if (!result) return
    const resumeId = selectedResumeId || undefined
    setMarkingApplied(true)
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: result.saved.id, resumeId, status: 'APPLIED' }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast({ type: 'success', message: 'Marked as applied — tracking under Applications' })
        clearPendingApply()
        setPromptJobId(null)
      } else {
        toast({ type: 'error', message: data?.error || 'Failed to mark as applied' })
      }
    } catch {
      toast({ type: 'error', message: 'Failed to mark as applied' })
    } finally {
      setMarkingApplied(false)
    }
  }

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) {
      toast({ type: 'error', message: 'Paste a job posting link first.' })
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    // Reset mode results when evaluating a new job
    setCoverResult(null)
    setInterviewResult(null)
    setEmailResult(null)
    setUpskillResult(null)
    setFollowupResult(null)
    setResumeResult(null)
    setActiveMode('report')
    try {
      const res = await fetch('/api/career-ops/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed, resumeId: selectedResumeId || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.report) {
        setResult(data)
        toast({ type: 'success', message: 'Evaluation complete!' })
      } else {
        setError(data?.error || 'Failed to evaluate that job.')
        toast({ type: 'error', message: data?.error || 'Failed to evaluate that job.' })
      }
    } catch {
      setError('Something went wrong. Try again.')
      toast({ type: 'error', message: 'Something went wrong. Try again.' })
    } finally {
      setLoading(false)
    }
  }

  // Career-ops mode handlers
  const handleCoverLetter = async () => {
    if (!result) return
    setCoverLoading(true)
    setCoverResult(null)
    try {
      const res = await fetch('/api/career-ops/cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: result.saved.id,
          url: result.job.applyUrl,
          resumeId: selectedResumeId || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.coverLetter?.markdown) {
        setCoverResult(data.coverLetter.markdown)
        toast({ type: 'success', message: 'Cover letter generated!' })
      } else {
        toast({ type: 'error', message: data?.error || 'Failed to generate cover letter' })
      }
    } catch {
      toast({ type: 'error', message: 'Something went wrong. Try again.' })
    } finally {
      setCoverLoading(false)
    }
  }

  const handleInterviewPrep = async () => {
    if (!result) return
    setInterviewLoading(true)
    setInterviewResult(null)
    try {
      const res = await fetch('/api/career-ops/interview-prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: result.saved.id,
          url: result.job.applyUrl,
          resumeId: selectedResumeId || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.prep?.markdown) {
        setInterviewResult(data.prep.markdown)
        toast({ type: 'success', message: 'Interview prep generated!' })
      } else {
        toast({ type: 'error', message: data?.error || 'Failed to generate interview prep' })
      }
    } catch {
      toast({ type: 'error', message: 'Something went wrong. Try again.' })
    } finally {
      setInterviewLoading(false)
    }
  }

  const handleEmail = async () => {
    if (!result) return
    setEmailLoading(true)
    setEmailResult(null)
    try {
      const res = await fetch('/api/career-ops/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: result.saved.id,
          url: result.job.applyUrl,
          resumeId: selectedResumeId || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.email?.markdown) {
        setEmailResult(data.email.markdown)
        toast({ type: 'success', message: 'Email draft generated!' })
      } else {
        toast({ type: 'error', message: data?.error || 'Failed to generate email' })
      }
    } catch {
      toast({ type: 'error', message: 'Something went wrong. Try again.' })
    } finally {
      setEmailLoading(false)
    }
  }

  const handleUpskill = async () => {
    if (!result) return
    setUpskillLoading(true)
    setUpskillResult(null)
    try {
      const res = await fetch('/api/career-ops/upskill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetedUrl: result.job.applyUrl,
          resumeId: selectedResumeId || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.upskill?.markdown) {
        setUpskillResult(data.upskill.markdown)
        toast({ type: 'success', message: 'Upskill analysis generated!' })
      } else {
        toast({ type: 'error', message: data?.error || 'Failed to generate upskill analysis' })
      }
    } catch {
      toast({ type: 'error', message: 'Something went wrong. Try again.' })
    } finally {
      setUpskillLoading(false)
    }
  }

  const handleFollowup = async () => {
    if (!result) return
    setFollowupLoading(true)
    setFollowupResult(null)
    try {
      const res = await fetch('/api/career-ops/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationContext: `Applied to ${result.job.title} at ${result.job.company}`,
          resumeId: selectedResumeId || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.followup?.markdown) {
        setFollowupResult(data.followup.markdown)
        toast({ type: 'success', message: 'Follow-up strategy generated!' })
      } else {
        toast({ type: 'error', message: data?.error || 'Failed to generate follow-up' })
      }
    } catch {
      toast({ type: 'error', message: 'Something went wrong. Try again.' })
    } finally {
      setFollowupLoading(false)
    }
  }

  const handleTailorResume = async () => {
    if (!result) return
    setResumeLoading(true)
    setResumeResult(null)
    try {
      const res = await fetch('/api/career-ops/tailor-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: result.saved.id,
          url: result.job.applyUrl,
          resumeId: selectedResumeId || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.resume?.markdown) {
        setResumeResult(data.resume.markdown)
        toast({ type: 'success', message: 'Tailored resume generated!' })
      } else {
        toast({ type: 'error', message: data?.error || 'Failed to tailor resume' })
      }
    } catch {
      toast({ type: 'error', message: 'Something went wrong. Try again.' })
    } finally {
      setResumeLoading(false)
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

  useEffect(() => {
    // Load resume versions for the picker on mount. Deferred so setState isn't
    // called synchronously inside the effect.
    const timer = setTimeout(fetchResumes, 0)
    return () => clearTimeout(timer)
  }, [fetchResumes])

  return (
    <div className="space-y-4">
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

        {/* Resume-version picker — which resume to score/generate against */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label
            htmlFor="resumeVersion"
            className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide sm:w-40 sm:self-center"
          >
            Resume version
          </label>
          <select
            id="resumeVersion"
            value={selectedResumeId}
            onChange={e => setSelectedResumeId(e.target.value)}
            disabled={resumesLoading}
            className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 pr-8 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent flex-1 sm:max-w-xs"
          >
            <option value="">Latest resume</option>
            {resumes.map(r => (
              <option key={r.id} value={r.id}>
                {r.title || 'Untitled resume'} — {new Date(r.updatedAt).toLocaleDateString()}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400 dark:text-gray-500 sm:ml-auto">
            Score, cover letters and tailoring all use this version.
          </p>
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
              This runs the full career-ops A–G evaluation, so it takes about a minute or two.
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
                  {result.saved.resume && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <FileText className="w-3 h-3" aria-hidden="true" />
                      Evaluated against <span className="font-medium text-gray-700 dark:text-gray-300">{result.saved.resume.title}</span> ({result.saved.resume.roleType})
                    </p>
                  )}
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
                  <a href={result.job.applyUrl} target="_blank" rel="noopener noreferrer" onClick={handleOpenPosting}>
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
                  Report {result.report.reportNumber != null ? `#${result.report.reportNumber} ` : ''}saved
                </p>
                <p className="mt-0.5 text-xs font-mono break-all opacity-75">{result.report.reportPath}</p>
              </div>
            </div>
          )}

          <CareerOpsReport report={result.report} />

          {/* Career-ops Mode Tabs */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveMode('report')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeMode === 'report'
                    ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500 bg-gray-50 dark:bg-gray-800'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                Report
              </button>
              <button
                onClick={() => setActiveMode('cover')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeMode === 'cover'
                    ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500 bg-gray-50 dark:bg-gray-800'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                <FilePen className="w-3.5 h-3.5 inline mr-1.5" /> Cover Letter
              </button>
              <button
                onClick={() => setActiveMode('interview')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeMode === 'interview'
                    ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500 bg-gray-50 dark:bg-gray-800'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 inline mr-1.5" /> Interview Prep
              </button>
              <button
                onClick={() => setActiveMode('email')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeMode === 'email'
                    ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500 bg-gray-50 dark:bg-gray-800'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                <Mail className="w-3.5 h-3.5 inline mr-1.5" /> Email
              </button>
              <button
                onClick={() => setActiveMode('upskill')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeMode === 'upskill'
                    ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500 bg-gray-50 dark:bg-gray-800'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5 inline mr-1.5" /> Upskill
              </button>
              <button
                onClick={() => setActiveMode('followup')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeMode === 'followup'
                    ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500 bg-gray-50 dark:bg-gray-800'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                <Send className="w-3.5 h-3.5 inline mr-1.5" /> Follow-up
              </button>
              <button
                onClick={() => setActiveMode('resume')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeMode === 'resume'
                    ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500 bg-gray-50 dark:bg-gray-800'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5 inline mr-1.5" /> Tailored CV
              </button>
            </div>

            <div className="p-4">
              {/* Cover Letter Mode */}
              {activeMode === 'cover' && (
                <div className="space-y-3">
                  <Button
                    onClick={handleCoverLetter}
                    isLoading={coverLoading}
                    disabled={coverLoading || coverResult !== null}
                    className="w-full sm:w-auto"
                  >
                    {coverLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    {coverResult ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Cover Letter Generated
                      </>
                    ) : (
                      <>
                        <FilePen className="w-4 h-4 mr-2" />
                        Generate Cover Letter
                      </>
                    )}
                  </Button>
                  {coverResult && (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Tailored Cover Letter</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(coverResult)}
                        >
                          <Copy className="w-4 h-4 mr-1.5" />
                          Copy
                        </Button>
                      </div>
                      <CareerOpsMarkdown markdown={coverResult} />
                    </div>
                  )}
                </div>
              )}

              {/* Interview Prep Mode */}
              {activeMode === 'interview' && (
                <div className="space-y-3">
                  <Button
                    onClick={handleInterviewPrep}
                    isLoading={interviewLoading}
                    disabled={interviewLoading || interviewResult !== null}
                    className="w-full sm:w-auto"
                  >
                    {interviewLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    {interviewResult ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Interview Prep Generated
                      </>
                    ) : (
                      <>
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Generate Interview Prep
                      </>
                    )}
                  </Button>
                  {interviewResult && (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Interview Preparation</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(interviewResult)}
                        >
                          <Copy className="w-4 h-4 mr-1.5" />
                          Copy
                        </Button>
                      </div>
                      <CareerOpsMarkdown markdown={interviewResult} />
                    </div>
                  )}
                </div>
              )}

              {/* Email Mode */}
              {activeMode === 'email' && (
                <div className="space-y-3">
                  <Button
                    onClick={handleEmail}
                    isLoading={emailLoading}
                    disabled={emailLoading || emailResult !== null}
                    className="w-full sm:w-auto"
                  >
                    {emailLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    {emailResult ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Email Draft Generated
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Generate Email Draft
                      </>
                    )}
                  </Button>
                  {emailResult && (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Application Email Draft</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(emailResult)}
                        >
                          <Copy className="w-4 h-4 mr-1.5" />
                          Copy
                        </Button>
                      </div>
                      <CareerOpsMarkdown markdown={emailResult} />
                    </div>
                  )}
                </div>
              )}

              {/* Upskill Mode */}
              {activeMode === 'upskill' && (
                <div className="space-y-3">
                  <Button
                    onClick={handleUpskill}
                    isLoading={upskillLoading}
                    disabled={upskillLoading || upskillResult !== null}
                    className="w-full sm:w-auto"
                  >
                    {upskillLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    {upskillResult ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Upskill Analysis Generated
                      </>
                    ) : (
                      <>
                        <Lightbulb className="w-4 h-4 mr-2" />
                        Generate Upskill Analysis
                      </>
                    )}
                  </Button>
                  {upskillResult && (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Skill Gap Analysis</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(upskillResult)}
                        >
                          <Copy className="w-4 h-4 mr-1.5" />
                          Copy
                        </Button>
                      </div>
                      <CareerOpsMarkdown markdown={upskillResult} />
                    </div>
                  )}
                </div>
              )}

              {/* Follow-up Mode */}
              {activeMode === 'followup' && (
                <div className="space-y-3">
                  <Button
                    onClick={handleFollowup}
                    isLoading={followupLoading}
                    disabled={followupLoading || followupResult !== null}
                    className="w-full sm:w-auto"
                  >
                    {followupLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    {followupResult ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Follow-up Strategy Generated
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Generate Follow-up Strategy
                      </>
                    )}
                  </Button>
                  {followupResult && (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Follow-up Cadence & Drafts</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(followupResult)}
                        >
                          <Copy className="w-4 h-4 mr-1.5" />
                          Copy
                        </Button>
                      </div>
                      <CareerOpsMarkdown markdown={followupResult} />
                    </div>
                  )}
                </div>
              )}

              {/* Tailored CV Mode */}
              {activeMode === 'resume' && (
                <div className="space-y-3">
                  <Button
                    onClick={handleTailorResume}
                    isLoading={resumeLoading}
                    disabled={resumeLoading || resumeResult !== null}
                    className="w-full sm:w-auto"
                  >
                    {resumeLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    {resumeResult ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Tailored CV Generated
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4 mr-2" />
                        Tailor My CV to This Job
                      </>
                    )}
                  </Button>
                  {resumeResult && (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Tailored CV</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(resumeResult)}
                        >
                          <Copy className="w-4 h-4 mr-1.5" />
                          Copy
                        </Button>
                      </div>
                      <CareerOpsMarkdown markdown={resumeResult} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* "Have you applied?" popup — shown when the user returns from the apply link on Evaluate Job */}
      {promptJobId && result && (
        <ApplyPromptPortal
          isOpen={true}
          jobTitle={result.job.title}
          jobCompany={result.job.company}
          onClose={handleClosePrompt}
          onConfirm={handleMarkApplied}
          confirming={markingApplied}
        />
      )}
    </div>
  )
}
