'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ArrowRight, Building2, CheckCircle2, Clock, DollarSign, ExternalLink, FileText, Loader2, MapPin, ShieldCheck, Sparkles, Star, Target, X } from 'lucide-react'
import { formatRelativeTime, getScoreColor, getScoreLabel, getRoleLabel, getExperienceLabel } from '@/lib/utils'
import { RoleType, ExperienceLevel } from '@/types'
import { JobDetailDrawer } from './JobDetailDrawer'
import { TailorResumeDrawer } from './TailorResumeDrawer'
import { CareerOpsToolkit } from '@/components/career-ops/CareerOpsToolkit'
import { useToast } from '@/components/ui/Toast'

const STATUS_META: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gray' }> = {
  SAVED: { label: 'Saved', variant: 'gray' },
  APPLIED: { label: 'Applied', variant: 'info' },
  INTERVIEWING: { label: 'Interviewing', variant: 'warning' },
  OFFER: { label: 'Offer', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  WITHDRAWN: { label: 'Withdrawn', variant: 'gray' },
}

// Session-storage key used to remember the job the user opened an apply link for,
// so we can ask "Have you applied?" when they come back to the dashboard tab.
const PENDING_APPLY_KEY = 'pendingApplyCheck'

export interface Job {
  id: string
  title: string
  company: string
  location: string
  isRemote: boolean
  description: string
  skills: string[]
  experienceLevel: ExperienceLevel
  roleType: RoleType
  salaryMin?: number
  salaryMax?: number
  applyUrl: string
  postedAt: Date
  provider: string
  match?: {
    score: number
    reasoning: string
    matchedSkills: string[]
    missingSkills: string[]
  }
  applications?: { id: string; status: string }[]
  /** true = confirmed to offer visa sponsorship (AI/keyword detected) */
  visaSponsored?: boolean | null
}

interface JobCardProps {
  job: Job
  /** The user's most recent resume — required to save an application */
  defaultResumeId?: string | null
  /** Current application status for this job, if the user has saved it */
  savedStatus?: string | null
  /** Delay in milliseconds for staggered entrance animation */
  entranceDelay?: number
}

export function JobCard({ job, defaultResumeId, savedStatus, entranceDelay }: JobCardProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [applying, setApplying] = useState(false)
  const [reverting, setReverting] = useState(false)
  const [showAppliedPrompt, setShowAppliedPrompt] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [tailorOpen, setTailorOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const score = job.match?.score ?? 0
  const hasMatch = !!job.match && score > 0
  const hasMatchDetails = Boolean(job.match) && (
    (job.match?.reasoning?.trim()?.length ?? 0) > 0 ||
    (job.match?.matchedSkills?.length ?? 0) > 0 ||
    (job.match?.missingSkills?.length ?? 0) > 0
  )

  // Remember the job the user is applying to, then ask "Have you applied?" when
  // they come back to this tab.
  const rememberPendingApply = () => {
    try {
      sessionStorage.setItem(
        PENDING_APPLY_KEY,
        JSON.stringify({ jobId: job.id, title: job.title, company: job.company })
      )
    } catch {
      // sessionStorage unavailable — the prompt just won't fire on return
    }
  }

  const clearPendingApply = () => {
    try {
      sessionStorage.removeItem(PENDING_APPLY_KEY)
    } catch {
      // ignore
    }
    setShowAppliedPrompt(false)
  }

  // Check for a pending apply for THIS job on mount and whenever the tab regains
  // focus (i.e. the user comes back from the external application page).
  useEffect(() => {
    const checkPendingApply = () => {
      if (savedStatus === 'APPLIED') return
      try {
        const raw = sessionStorage.getItem(PENDING_APPLY_KEY)
        if (!raw) return
        const pending = JSON.parse(raw)
        if (pending && pending.jobId === job.id) {
          setShowAppliedPrompt(true)
        }
      } catch {
        // ignore malformed/blocked storage
      }
    }

    checkPendingApply()
    window.addEventListener('focus', checkPendingApply)
    return () => window.removeEventListener('focus', checkPendingApply)
  }, [job.id, savedStatus])

  const handleApplyClick = () => {
    if (job.applyUrl) {
      window.open(job.applyUrl, '_blank', 'noopener,noreferrer')
    }
    rememberPendingApply()
    // Show the "Have you applied?" prompt right away so it's waiting for them
    // when they come back from the application page. The new tab opens on top,
    // so the user only sees this popup once they return to the dashboard.
    setShowAppliedPrompt(true)
  }

  const handleSave = async () => {
    if (!defaultResumeId) {
      toast({ type: 'error', message: 'Upload a resume first to save jobs' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, resumeId: defaultResumeId, status: 'SAVED' }),
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
      setSaving(false)
    }
  }

  // Mark the job as applied so it's tracked under Applications with an appliedAt date.
  const handleMarkApplied = async () => {
    if (!defaultResumeId) {
      toast({ type: 'error', message: 'Upload a resume first to track applications' })
      return
    }
    setApplying(true)
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, resumeId: defaultResumeId, status: 'APPLIED' }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast({ type: 'success', message: 'Marked as applied — tracking under Applications' })
        clearPendingApply()
        router.refresh()
      } else {
        toast({ type: 'error', message: data?.error || 'Failed to mark as applied' })
      }
    } catch {
      toast({ type: 'error', message: 'Failed to mark as applied' })
    } finally {
      setApplying(false)
    }
  }

  // Undo an "Applied" — deletes the application so the job shows in the feed again.
  const handleRevertApplied = async () => {
    const appId = job.applications?.[0]?.id
    if (!appId) return
    setReverting(true)
    try {
      const res = await fetch(`/api/applications/${appId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast({ type: 'success', message: 'Marked as not applied' })
        router.refresh()
      } else {
        toast({ type: 'error', message: data?.error || 'Failed to mark as not applied' })
      }
    } catch {
      toast({ type: 'error', message: 'Failed to mark as not applied' })
    } finally {
      setReverting(false)
    }
  }

  return (
    <>
      <Card
        className="card-hover overflow-hidden"
        animated={true}
        delay={entranceDelay || 0}
      >
        <CardContent className="p-5">
          {/* Header — title first so the role is always visible; clicking opens the detail drawer */}
          <div className="flex items-start justify-between gap-4 mb-1">
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              className="flex-1 min-w-0 text-left group"
              title="Open full details, AI assists, and similar jobs"
            >
              <h3 className="text-lg font-semibold leading-snug text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {job.title}
              </h3>
              <p className="text-sm text-primary-600 dark:text-primary-400 font-medium mt-0.5 group-hover:underline">
                {job.company}
              </p>
            </button>
            {job.provider && (
              <Badge variant="gray" className="flex-shrink-0">
                {job.provider}
              </Badge>
            )}
          </div>

          {/* Tags below the title — role, match score, application status */}
          <div className="flex flex-wrap items-center gap-2 mt-2 mb-3">
            <Badge variant="gray" className="flex-shrink-0">
              <Building2 className="w-3 h-3 mr-1" />
              {getRoleLabel(job.roleType)}
            </Badge>
            {hasMatch ? (
              <Badge className={getScoreColor(score)} title={getScoreLabel(score)}>
                <Target className="w-3 h-3 mr-1" />
                {score}% match
              </Badge>
            ) : (
              <Badge variant="gray" className="flex-shrink-0">
                <Target className="w-3 h-3 mr-1" />
                No match
              </Badge>
            )}
            {job.visaSponsored === true && (
              <Badge variant="success" className="flex-shrink-0" title="This company is confirmed to sponsor visas">
                <ShieldCheck className="w-3 h-3 mr-1" />
                Visa sponsorship
              </Badge>
            )}
            {savedStatus && (
              <Badge
                variant={STATUS_META[savedStatus]?.variant ?? 'gray'}
                className="flex-shrink-0"
                title={`This job is ${(STATUS_META[savedStatus]?.label ?? savedStatus).toLowerCase()} — manage it under Applications`}
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {STATUS_META[savedStatus]?.label ?? savedStatus.toLowerCase()}
              </Badge>
            )}
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {job.isRemote ? 'Remote' : job.location}
            </span>
            <span className="flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5" />
              {getExperienceLabel(job.experienceLevel)}
            </span>
            {job.salaryMin || job.salaryMax ? (
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" />
                ${job.salaryMin ? `${(job.salaryMin / 1000).toFixed(0)}k` : '?'} - ${job.salaryMax ? `${(job.salaryMax / 1000).toFixed(0)}k` : '?'}
              </span>
            ) : null}
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {formatRelativeTime(job.postedAt)}
            </span>
          </div>

          {/* Match Details */}
          {hasMatch && hasMatchDetails && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              {job.match?.reasoning?.trim() && (
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {job.match.reasoning}
                </p>
              )}
              {job.match && job.match.matchedSkills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {job.match.matchedSkills.slice(0, 6).map((skill) => (
                    <Badge key={skill} variant="success" className="text-xs">
                      <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                      {skill}
                    </Badge>
                  ))}
                  {job.match.matchedSkills.length > 6 && (
                    <Badge variant="gray" className="text-xs">
                      +{job.match.matchedSkills.length - 6} more
                    </Badge>
                  )}
                </div>
              )}
              {job.match && job.match.missingSkills.length > 0 && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Missing: {job.match.missingSkills.slice(0, 4).join(', ')}
                  {job.match.missingSkills.length > 4 && '...'}
                </p>
              )}
            </div>
          )}

          {/* Skills */}
          {job.skills.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {job.skills.slice(0, 8).map((skill) => (
                <Badge key={skill} variant="gray" className="text-xs">
                  {skill}
                </Badge>
              ))}
              {job.skills.length > 8 && (
                <Badge variant="gray" className="text-xs">
                  +{job.skills.length - 8} more
                </Badge>
              )}
            </div>
          )}

          {/* Actions — every button flex-1 so the row reads as one clean,
              centered strip that shares the card width evenly (2, 3, or 4
              buttons depending on state), on mobile and desktop alike. */}
          <div className="flex items-stretch gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              size="sm"
              onClick={handleApplyClick}
              className="flex-1"
              disabled={!job.applyUrl}
              title={job.applyUrl ? 'Open application page' : 'No application link available'}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Apply
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTailorOpen(true)}
              className="flex-1"
              title="Tailor your resume to this job"
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Tailor CV
            </Button>
            {defaultResumeId &&
              !savedStatus && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              )}
            {savedStatus === 'APPLIED' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRevertApplied}
                disabled={reverting}
                className="flex-1"
                title="Mark this job as not applied so it shows in the feed again"
              >
                {reverting ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <X className="w-3.5 h-3.5 mr-1.5" />
                )}
                {reverting ? 'Removing...' : 'Not applied'}
              </Button>
            )}
          </div>

          {/* Advanced AI tools — opens the full career-ops pipeline for this
              job: fit report, tailored CV, cover letter, the email variants,
              LinkedIn message, interview prep, follow-up, and upskill. */}
          <button
            type="button"
            onClick={() => setToolsOpen(true)}
            className="group mt-3 w-full rounded-lg border border-primary-200 bg-primary-50/60 px-4 py-2.5 text-left transition-colors hover:bg-primary-100/70 dark:border-primary-500/30 dark:bg-primary-500/10 dark:hover:bg-primary-500/20"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary-500 dark:text-primary-400" aria-hidden="true" />
              <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">
                Advanced AI tools
              </span>
              <ArrowRight className="w-4 h-4 ml-auto text-primary-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
            <span className="mt-0.5 block pl-6 text-xs text-gray-500 dark:text-gray-400">
              Cover letter · Cold email · LinkedIn · Interview prep
            </span>
          </button>
        </CardContent>
      </Card>

      {/* "Have you applied?" popup — shown when the user returns from the apply link.
          Rendered through a portal to <body> so no parent card/layout CSS can ever
          clip or hide it. */}
      {showAppliedPrompt &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={clearPendingApply}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl p-6 shadow-xl">
            <button
              onClick={clearPendingApply}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
              Have you applied?
            </h4>
            <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
              Did you submit an application for{' '}
              <span className="font-medium text-gray-900 dark:text-white">{job.title}</span>{' '}
              at <span className="font-medium text-gray-900 dark:text-white">{job.company}</span>?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={clearPendingApply}>
                Not yet
              </Button>
              <Button variant="primary" size="sm" onClick={handleMarkApplied} disabled={applying}>
                {applying ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                )}
                {applying ? 'Adding...' : 'Yes, I applied'}
              </Button>
            </div>
            </div>
            </div>,
            document.body
          )}

      {/* Job detail drawer — full description, AI assists, and similar jobs */}
      {detailsOpen && (
        <JobDetailDrawer
          job={job}
          defaultResumeId={defaultResumeId}
          savedStatus={savedStatus}
          onClose={() => setDetailsOpen(false)}
        />
      )}

      {/* Tailor CV drawer — rewrites the user's resume against this job */}
      {tailorOpen && (
        <TailorResumeDrawer
          job={job}
          defaultResumeId={defaultResumeId}
          onClose={() => setTailorOpen(false)}
        />
      )}

      {/* Advanced AI tools drawer — the full career-ops toolkit for this job */}
      {toolsOpen && (
        <CareerOpsToolkit
          job={{
            id: job.id,
            title: job.title,
            company: job.company,
            location: job.location,
            isRemote: job.isRemote,
            applyUrl: job.applyUrl || null,
            description: job.description,
          }}
          defaultResumeId={defaultResumeId}
          onClose={() => setToolsOpen(false)}
        />
      )}
    </>
  )
}
