'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  X, MapPin, Building2, DollarSign, Clock, ExternalLink, Loader2, CheckCircle2,
  Target, ShieldCheck, FileText, MessagesSquare, Copy, Download, ChevronRight,
  Sparkles, Briefcase, Mail,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { getRoleLabel, getExperienceLabel, formatRelativeTime, downloadFile, cn, htmlToText } from '@/lib/utils'
import type { InterviewQuestionSet } from '@/types'
import toast from 'react-hot-toast'

// PENDING_APPLY_KEY must match JobCard so its "Have you applied?" portal fires
// when the user returns from an apply link opened from this drawer.
const PENDING_APPLY_KEY = 'pendingApplyCheck'

export interface Job {
  id: string
  title: string
  company: string
  location: string
  isRemote: boolean
  description: string
  skills: string[]
  experienceLevel: string
  roleType: string
  salaryMin?: number | null
  salaryMax?: number | null
  applyUrl?: string
  postedAt: Date | string
  provider?: string
  visaSponsored?: boolean | null
  match?: {
    score: number
    reasoning: string
    matchedSkills: string[]
    missingSkills: string[]
  }
  applications?: { id: string; status: string }[]
}

interface SimilarJob {
  id: string
  title: string
  company: string
  location: string
  isRemote: boolean
  salaryMin?: number | null
  salaryMax?: number | null
  postedAt: string
  roleType: string
  experienceLevel: string
  matchScore: number | null
  overlap: number
}

interface JobDetailDrawerProps {
  job: Job
  defaultResumeId?: string | null
  savedStatus?: string | null
  onClose: () => void
}

const STATUS_META: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gray' }> = {
  SAVED: { label: 'Saved', variant: 'gray' },
  APPLIED: { label: 'Applied', variant: 'info' },
  INTERVIEWING: { label: 'Interviewing', variant: 'warning' },
  OFFER: { label: 'Offer', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  WITHDRAWN: { label: 'Withdrawn', variant: 'gray' },
}

function scoreTextColor(score: number): string {
  if (score >= 80) return 'text-success-600 dark:text-success-400'
  if (score >= 60) return 'text-warning-600 dark:text-warning-400'
  if (score >= 40) return 'text-amber-600 dark:text-amber-400'
  return 'text-danger-600 dark:text-danger-400'
}

function scoreBarColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 60) return 'bg-sky-500'
  if (score >= 40) return 'bg-amber-500'
  return 'bg-gray-400'
}

function formatSalary(job: Job): string | null {
  if (!job.salaryMin && !job.salaryMax) return null
  const lo = job.salaryMin ? `${(job.salaryMin / 1000).toFixed(0)}k` : '?'
  const hi = job.salaryMax ? `${(job.salaryMax / 1000).toFixed(0)}k` : '?'
  return `$${lo} – $${hi}`
}

// Render a description with every matched skill wrapped in a highlight so the
// user can see at a glance where their experience lines up with the posting.
function HighlightedDescription({ text, skills }: { text: string; skills: string[] }) {
  if (!skills.length) {
    return <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{text}</p>
  }
  const sorted = [...skills].sort((a, b) => b.length - a.length)
  const pattern = new RegExp(`(${sorted.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  const parts = text.split(pattern)
  return (
    <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
      {parts.map((part, i) => {
        const hit = sorted.find(s => s.toLowerCase() === part.toLowerCase())
        return hit ? (
          <mark key={i} className="bg-amber-100 dark:bg-amber-500/20 text-inherit rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      })}
    </p>
  )
}

export function JobDetailDrawer({ job, defaultResumeId, savedStatus, onClose }: JobDetailDrawerProps) {
  const router = useRouter()
  const [currentJob, setCurrentJob] = useState<Job>(job)
  const [status, setStatus] = useState<string | null>(savedStatus ?? job.applications?.[0]?.status ?? null)
  const [saving, setSaving] = useState(false)
  const [applying, setApplying] = useState(false)
  const [letter, setLetter] = useState('')
  const [letterLoading, setLetterLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [questions, setQuestions] = useState<InterviewQuestionSet | null>(null)
  const [questionsLoading, setQuestionsLoading] = useState(false)
  const [similar, setSimilar] = useState<SimilarJob[]>([])
  const [similarLoading, setSimilarLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const score = currentJob.match?.score || 0
  const hasMatch = !!currentJob.match

  const loadSimilar = useCallback(async (jobId: string) => {
    setSimilarLoading(true)
    try {
      const res = await fetch(`/api/jobs/${jobId}/similar`)
      const data = await res.json().catch(() => ({}))
      if (res.ok) setSimilar(data?.similar ?? [])
    } catch {
      setSimilar([])
    } finally {
      setSimilarLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSimilar(currentJob.id)
  }, [currentJob.id, loadSimilar])

  const handleApply = () => {
    if (currentJob.applyUrl) {
      window.open(currentJob.applyUrl, '_blank', 'noopener,noreferrer')
    }
    try {
      sessionStorage.setItem(
        PENDING_APPLY_KEY,
        JSON.stringify({ jobId: currentJob.id, title: currentJob.title, company: currentJob.company })
      )
    } catch {
      // storage unavailable — the prompt just won't fire on return
    }
    setApplying(true)
    setTimeout(() => setApplying(false), 800)
  }

  const handleSave = async () => {
    if (!defaultResumeId) {
      toast.error('Upload a resume first to save jobs')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: currentJob.id, resumeId: defaultResumeId, status: 'SAVED' }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setStatus('SAVED')
        toast.success('Job saved — track it under Applications')
        router.refresh()
      } else {
        toast.error(data?.error || 'Failed to save job')
      }
    } catch {
      toast.error('Failed to save job')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateLetter = async () => {
    setLetterLoading(true)
    setLetter('')
    try {
      const res = await fetch(`/api/jobs/${currentJob.id}/cover-letter`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.letter) {
        setLetter(data.letter)
      } else {
        toast.error(data?.error || 'Failed to generate cover letter')
      }
    } catch {
      toast.error('Failed to generate cover letter')
    } finally {
      setLetterLoading(false)
    }
  }

  const handleGenerateEmail = async () => {
    setEmailLoading(true)
    setEmail('')
    try {
      const res = await fetch(`/api/jobs/${currentJob.id}/cold-email`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.email) {
        setEmail(data.email)
      } else {
        toast.error(data?.error || 'Failed to generate cold email')
      }
    } catch {
      toast.error('Failed to generate cold email')
    } finally {
      setEmailLoading(false)
    }
  }

  const handleGenerateQuestions = async () => {
    setQuestionsLoading(true)
    setQuestions(null)
    try {
      const res = await fetch(`/api/jobs/${currentJob.id}/interview-questions`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.questions) {
        setQuestions(data.questions)
      } else {
        toast.error(data?.error || 'Failed to generate interview questions')
      }
    } catch {
      toast.error('Failed to generate interview questions')
    } finally {
      setQuestionsLoading(false)
    }
  }

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied`)
    } catch {
      toast.error('Could not copy — select and copy manually')
    }
  }

  // Swap the drawer to a similar job: fetch its full detail, reset AI output,
  // reload the similar list, and scroll back to the top.
  const swapToJob = async (id: string) => {
    if (id === currentJob.id) return
    setSimilarLoading(true)
    try {
      const res = await fetch(`/api/jobs/${id}`)
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.job) {
        setCurrentJob(data.job)
        setStatus(data.job.applications?.[0]?.status ?? null)
        setLetter('')
        setEmail('')
        setQuestions(null)
        scrollRef.current?.scrollTo({ top: 0 })
        loadSimilar(id)
      } else {
        toast.error(data?.error || 'Could not open that job')
      }
    } catch {
      toast.error('Could not open that job')
    } finally {
      setSimilarLoading(false)
    }
  }

  const questionsText = questions
    ? questions.groups
        .map(group => `${group.category}\n${group.questions.map(q => `- ${q.question}${q.why ? ` (${q.why})` : ''}`).join('\n')}`)
        .join('\n\n')
    : ''

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} aria-hidden="true" />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-[60] w-full max-w-2xl max-h-screen bg-white dark:bg-gray-900 shadow-xl slide-in-right flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-snug text-gray-900 dark:text-white">
              {currentJob.title}
            </h2>
            <p className="text-sm text-primary-600 dark:text-primary-400 font-medium mt-0.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              {currentJob.company}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors shrink-0"
            aria-label="Close job details"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="gray" className="flex-shrink-0">
              <Briefcase className="w-3 h-3 mr-1" />
              {getRoleLabel(currentJob.roleType)}
            </Badge>
            <Badge variant="gray" className="flex-shrink-0">
              <Target className="w-3 h-3 mr-1" />
              {getExperienceLabel(currentJob.experienceLevel)}
            </Badge>
            {currentJob.visaSponsored === true && (
              <Badge variant="success" className="flex-shrink-0">
                <ShieldCheck className="w-3 h-3 mr-1" />
                Visa sponsorship
              </Badge>
            )}
            {currentJob.provider && (
              <Badge variant="gray" className="flex-shrink-0">{currentJob.provider}</Badge>
            )}
            {status && (
              <Badge variant={STATUS_META[status]?.variant ?? 'gray'} className="flex-shrink-0">
                {STATUS_META[status]?.label ?? status.toLowerCase()}
              </Badge>
            )}
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {currentJob.isRemote ? 'Remote' : currentJob.location}
            </span>
            {formatSalary(currentJob) && (
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" />
                {formatSalary(currentJob)}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Posted {formatRelativeTime(currentJob.postedAt)}
            </span>
          </div>

          {/* Match panel */}
          {hasMatch && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Resume match</span>
                    <span className={cn('text-xl font-bold', scoreTextColor(score))}>
                      {score}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', scoreBarColor(score))}
                      style={{ width: `${Math.min(100, Math.max(2, score))}%` }}
                    />
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">{currentJob.match?.reasoning}</p>
              {!!currentJob.match?.matchedSkills.length && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    You match on these skills
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {currentJob.match.matchedSkills.map(skill => (
                      <Badge key={skill} variant="success" className="text-xs">{skill}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {!!currentJob.match?.missingSkills.length && (
                <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-500/10 rounded-lg">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1.5">
                    Gaps worth addressing before applying
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {currentJob.match.missingSkills.map(skill => (
                      <Badge key={skill} variant="warning" className="text-xs">{skill}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI assists */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Sparkles className="w-4 h-4 text-primary-500" />
              Career assists
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleGenerateLetter} isLoading={letterLoading}>
                <FileText className="w-3.5 h-3.5 mr-1.5" />
                {letterLoading ? 'Writing...' : 'Generate cover letter'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleGenerateEmail} isLoading={emailLoading}>
                <Mail className="w-3.5 h-3.5 mr-1.5" />
                {emailLoading ? 'Drafting...' : 'Write cold email'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleGenerateQuestions} isLoading={questionsLoading}>
                <MessagesSquare className="w-3.5 h-3.5 mr-1.5" />
                {questionsLoading ? 'Preparing...' : 'Prep for interview'}
              </Button>
            </div>

            {letter && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Cover letter</span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => copyText(letter, 'Cover letter')}>
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadFile(`cover-letter-${currentJob.company.replace(/\s+/g, '-').toLowerCase()}.txt`, letter)}
                    >
                      <Download className="w-3.5 h-3.5 mr-1" /> Download
                    </Button>
                  </div>
                </div>
                <div className="p-4">
                  <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{letter}</p>
                </div>
              </div>
            )}

            {email && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Cold email</span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => copyText(email, 'Cold email')}>
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadFile(`cold-email-${currentJob.company.replace(/\s+/g, '-').toLowerCase()}.txt`, email)}
                    >
                      <Download className="w-3.5 h-3.5 mr-1" /> Download
                    </Button>
                  </div>
                </div>
                <div className="p-4">
                  <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{email}</p>
                </div>
              </div>
            )}

            {questions && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Interview prep</span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => copyText(questionsText, 'Interview prep')}>
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadFile(`interview-prep-${currentJob.company.replace(/\s+/g, '-').toLowerCase()}.txt`, questionsText)}
                    >
                      <Download className="w-3.5 h-3.5 mr-1" /> Download
                    </Button>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  {questions.groups.map(group => (
                    <div key={group.category}>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{group.category}</p>
                      <ul className="space-y-2">
                        {group.questions.map((q, i) => (
                          <li key={i} className="text-sm">
                            <p className="text-gray-800 dark:text-gray-200 font-medium">{q.question}</p>
                            {q.why && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{q.why}</p>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Full description */}
          <div>
            <p className="label mb-2">Job description</p>
            <HighlightedDescription
              text={htmlToText(currentJob.description)}
              skills={currentJob.match?.matchedSkills ?? []}
            />
          </div>

          {/* Similar jobs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="label flex items-center gap-1.5">
                <Briefcase className="w-4 h-4" />
                Similar jobs
              </p>
              {similarLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            </div>
            {similar.length === 0 && !similarLoading && (
              <p className="text-sm text-gray-500 dark:text-gray-400">No similar active jobs found.</p>
            )}
            <div className="space-y-2">
              {similar.map(s => (
                <button
                  key={s.id}
                  onClick={() => swapToJob(s.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{s.company}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {s.isRemote ? 'Remote' : s.location}
                      {s.matchScore !== null && ` · ${s.matchScore}% match`}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <Button
            variant="outline"
            size="md"
            onClick={handleApply}
            disabled={!currentJob.applyUrl}
            className="flex-1"
            title={currentJob.applyUrl ? 'Open application page' : 'No application link available'}
          >
            {applying ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-1.5" />}
            Apply
          </Button>
          {!status ? (
            <Button variant="primary" size="md" onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
              Save
            </Button>
          ) : (
            <div className="flex-1 text-center text-sm text-gray-500 dark:text-gray-400">
              {STATUS_META[status]?.label ?? status} — manage under Applications
            </div>
          )}
        </div>
      </div>
    </>
  )
}
