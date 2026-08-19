'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ExternalLink, FileCheck, FileText, Loader2, MapPin, Star, Target, TrendingUp, X, Briefcase } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { TailorResumeDrawer } from '@/components/dashboard/TailorResumeDrawer'
import { useToast } from '@/components/ui/Toast'
import { getScoreColor } from '@/lib/utils'
import { useApplyPrompt } from '@/hooks/useApplyPrompt'
import { ApplyPromptPortal } from '@/components/ui/ApplyPromptPortal'

interface BestMatch {
  id: string
  score: number
  reasoning: string
  matchedSkills: string[]
  missingSkills: string[]
  job: {
    id: string
    title: string
    company: string
    location?: string | null
    isRemote?: boolean
    applyUrl: string | null
    applicationStatus?: string | null
  }
  resume?: { id: string; title: string; roleType: string } | null
}

interface ResumeOption {
  id: string
  title: string
  updatedAt: string
}

interface MatchesApiResponse {
  matches: BestMatch[]
  error?: string
}

interface ResumesApiResponse {
  resumes: ResumeOption[]
  error?: string
}

/**
 * Best-matched jobs: the user's matches sorted by score, best first, with a
 * score threshold and a resume-version filter. Powering the Best Matches tab.
 */
export function BestMatchedJobsList() {
  const router = useRouter()
  const { toast } = useToast()
  const [threshold, setThreshold] = useState(0)
  const [resumes, setResumes] = useState<ResumeOption[]>([])
  const [selectedResumeId, setSelectedResumeId] = useState<string | 'all'>('all')
  const [resumesLoading, setResumesLoading] = useState(false)
  const [matches, setMatches] = useState<BestMatch[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [tailorJob, setTailorJob] = useState<{ id: string; title: string; company: string } | null>(null)
  // The job the user clicked "Apply" on — used to show the "Have you applied?" popup
  const [promptJobId, setPromptJobId] = useState<string | null>(null)
  const [markingId, setMarkingId] = useState<string | null>(null)

  const fetchResumes = useCallback(async () => {
    setResumesLoading(true)
    try {
      const res = await fetch('/api/resumes/list')
      const data: ResumesApiResponse = await res.json().catch(() => ({ resumes: [] }))
      if (res.ok) setResumes(data.resumes || [])
    } catch {
      // silent fail — the filter is optional
    } finally {
      setResumesLoading(false)
    }
  }, [])

  const fetchMatches = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resumeParam = selectedResumeId === 'all' ? '' : `&resumeId=${selectedResumeId}`
      const res = await fetch(`/api/matches?minScore=${threshold}&limit=100${resumeParam}`)
      const data: MatchesApiResponse = await res.json().catch(() => ({ matches: [] }))
      if (res.ok) {
        setMatches(data.matches || [])
      } else {
        setError(data.error || 'Failed to load matches')
      }
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }, [selectedResumeId, threshold])

  // Trigger scoring when resume filter changes (if not 'all')
  useEffect(() => {
    if (selectedResumeId !== 'all') {
      // Fire and forget - score jobs against this resume
      fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId: selectedResumeId }),
      }).catch(() => {}) // Silently fail, matches will be fetched again on next render
    }
  }, [selectedResumeId])

  useEffect(() => {
    // Defer so setState isn't called synchronously inside the effect.
    const timer = setTimeout(() => {
      fetchMatches()
      fetchResumes()
    }, 0)
    return () => clearTimeout(timer)
  }, [fetchMatches, fetchResumes])

  // Save the job so it's tracked under Applications. Uses the resume this match
  // was scored against, falling back to the most recent upload.
  // Track the job that had "Apply" clicked for the "Have you applied?" prompt
  const { rememberPendingApply, clearPendingApply } = useApplyPrompt(promptJobId ?? '')

  const handleSave = async (match: BestMatch) => {
    const resumeId = match.resume?.id ?? resumes[0]?.id
    if (!resumeId) {
      toast({ type: 'error', message: 'Upload a resume first to save jobs' })
      return
    }
    setSavingId(match.id)
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: match.job.id, resumeId, status: 'SAVED' }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast({ type: 'success', message: 'Job saved — track it under Applications' })
        router.refresh()
      } else {
        toast({ type: 'error', message: data?.error || 'Failed to save job' })
      }
    } catch {
      toast({ type: 'error', message: 'Failed to save job' })
    } finally {
      setSavingId(null)
    }
  }

  const handleApplyClick = (jobId: string, title: string, company: string) => {
    // Remember this job so we can show the prompt when user returns
    rememberPendingApply(jobId)
    setPromptJobId(jobId)
  }

  // Close the "Have you applied?" popup. The prompt is rendered from the
  // parent's `promptJobId` state (not the hook's internal flag), so clearing
  // sessionStorage alone leaves it open — reset both here.
  // Memoized so the portal always receives a stable reference.
  const handleClosePrompt = useCallback(() => {
    clearPendingApply()
    setPromptJobId(null)
  }, [clearPendingApply])

  const handleMarkApplied = async (match: BestMatch) => {
    const resumeId = match.resume?.id ?? resumes[0]?.id
    if (!resumeId) {
      toast({ type: 'error', message: 'Upload a resume first to track applications' })
      return
    }
    setMarkingId(match.id)
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: match.job.id, resumeId, status: 'APPLIED' }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast({ type: 'success', message: 'Marked as applied — tracking under Applications' })
        clearPendingApply()
        setPromptJobId(null)
        router.refresh()
      } else {
        toast({ type: 'error', message: data?.error || 'Failed to mark as applied' })
      }
    } catch {
      toast({ type: 'error', message: 'Failed to mark as applied' })
    } finally {
      setMarkingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Target className="w-5 h-5 text-gray-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Match threshold</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Show only jobs scoring at least {threshold}% against your resume
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={threshold}
              onChange={e => setThreshold(parseInt(e.target.value, 10))}
              className="w-48 h-2 accent-primary-500"
              aria-label="Minimum match score"
            />
            <span className="text-lg font-mono font-semibold text-gray-900 dark:text-white w-10 text-right">
              {threshold}%
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
                  Compare matches across your resume versions
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
                    {r.title || 'Untitled resume'} — {new Date(r.updatedAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
              <FileCheck className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        )}
      </div>

      {/* Matches list — best score first */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500 mr-2" />
          <span className="text-gray-600 dark:text-gray-300">Scoring your best matches…</span>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-danger-200 dark:border-danger-500/30 bg-danger-50 dark:bg-danger-500/10 p-4 text-sm text-danger-700 dark:text-danger-300">
          {error}
        </div>
      ) : matches.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Star className="w-10 h-10 mx-auto mb-2 opacity-50" aria-hidden="true" />
          <p>No matches above the threshold yet.</p>
          <p className="text-xs mt-1">Lower the threshold or score jobs from the Dashboard / Evaluate tab.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {matches.map(match => (
            <div
              key={match.id}
              className="flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate">{match.job.title}</h3>
                    <span
                      className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded"
                      style={{ color: getScoreColor(match.score) }}
                    >
                      <TrendingUp className="w-3 h-3" />
                      {match.score}% match
                    </span>
                    {match.job.applicationStatus && (
                      <Badge variant="gray" className="text-xs">
                        <Briefcase className="w-3 h-3 mr-1" />
                        {match.job.applicationStatus}
                      </Badge>
                    )}
                  </div>
                  {match.resume && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <FileText className="w-3 h-3" aria-hidden="true" />
                      Matched against <span className="font-medium text-gray-700 dark:text-gray-300">{match.resume.title}</span> ({match.resume.roleType})
                    </p>
                  )}
                  <p className="text-sm text-primary-600 dark:text-primary-400 truncate">{match.job.company}</p>
                  {(match.job.location || match.job.isRemote) && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {match.job.isRemote ? 'Remote' : match.job.location}
                    </p>
                  )}
                  {match.reasoning && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{match.reasoning}</p>
                  )}
                  {match.matchedSkills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {match.matchedSkills.slice(0, 6).map(skill => (
                        <Badge key={skill} variant="success" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                {/* Full-width action bar — buttons share the space evenly so the
                    row reads as one clean, centered control strip. */}
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2">
                  <Button
                    variant={match.job.applicationStatus ? 'outline' : 'primary'}
                    size="sm"
                    className="flex-1"
                    onClick={() => handleSave(match)}
                    disabled={savingId === match.id || Boolean(match.job.applicationStatus)}
                    title={match.job.applicationStatus ? `Already ${match.job.applicationStatus.toLowerCase()} — track it under Applications` : 'Save to Applications'}
                  >
                    {savingId === match.id ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : match.job.applicationStatus ? (
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-success-500" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {savingId === match.id ? 'Saving...' : match.job.applicationStatus ? 'Applied' : 'Save'}
                  </Button>
                  {match.job.applyUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        handleApplyClick(match.job.id, match.job.title, match.job.company)
                        window.open(match.job.applyUrl ?? '', '_blank', 'noopener,noreferrer')
                      }}
                      title="Open application page"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                      Apply
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() =>
                      setTailorJob({
                        id: match.job.id,
                        title: match.job.title,
                        company: match.job.company,
                      })
                    }
                    title="Tailor your resume to this job"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1.5" />
                    Tailor CV
                  </Button>
                </div>
              </div>
          ))}
        </div>
      )}

      {/* Tailor CV drawer — rewrites the user's resume against the selected job */}
      {tailorJob && (
        <TailorResumeDrawer
          job={tailorJob}
          defaultResumeId={selectedResumeId === 'all' ? undefined : selectedResumeId}
          onClose={() => setTailorJob(null)}
        />
      )}

      {/* "Have you applied?" popup — shown when the user returns from the apply link on Best Matches */}
      {promptJobId && (
        <ApplyPromptPortal
          isOpen={true}
          jobTitle={matches.find(m => m.job.id === promptJobId)?.job.title ?? ''}
          jobCompany={matches.find(m => m.job.id === promptJobId)?.job.company ?? ''}
          onClose={handleClosePrompt}
          onConfirm={() => {
            const match = matches.find(m => m.job.id === promptJobId)
            if (match) handleMarkApplied(match)
          }}
          confirming={markingId === promptJobId}
        />
      )}
    </div>
  )
}
