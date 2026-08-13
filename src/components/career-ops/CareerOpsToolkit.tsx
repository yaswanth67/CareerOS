'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  Loader2,
  MessageCircle,
  Mail,
  MessageSquare,
  Send,
  Sparkles,
  Target,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { CareerOpsMarkdown } from '@/components/career-ops/CareerOpsReport'
import { downloadFile } from '@/lib/utils'
import { CLIENT_ABORT_MS, CLIENT_TIMEOUT_MESSAGE, TYPICAL_DURATION_LABEL } from '@/lib/career-ops/timeouts'
import { DrawerPortal } from '@/components/ui/DrawerPortal'

export interface ToolkitJob {
  id: string
  title: string
  company: string
  location?: string | null
  isRemote?: boolean
  applyUrl?: string | null
  description?: string | null
}

interface ResumeOption {
  id: string
  title: string
  updatedAt: string
}

/**
 * Email variants career-ops supports. The Evaluate page never sent one, so the
 * API always fell back to `hr_application` and the other four were unreachable
 * from the UI despite being fully implemented.
 */
const EMAIL_VARIANTS = [
  { value: 'hr_application', label: 'Application to HR' },
  { value: 'cold_application', label: 'Cold outreach' },
  { value: 'referral_request', label: 'Referral request' },
  { value: 'process_stuck', label: 'Process stalled' },
  { value: 'confirmed_time_noshow', label: 'Interview no-show' },
] as const

type ModeId =
  | 'description'
  | 'report'
  | 'resume'
  | 'cover'
  | 'email'
  | 'linkedin'
  | 'interview'
  | 'followup'
  | 'upskill'

interface ModeDef {
  id: ModeId
  label: string
  icon: typeof FileText
  blurb: string
  /** Absent for `description`, which is rendered from data already in hand. */
  endpoint?: (job: ToolkitJob) => string
  /** Key holding the result object in the JSON response. */
  resultKey?: string
  body?: (job: ToolkitJob, resumeId: string, variant: string) => Record<string, unknown>
  /** Filename stem for the download button. */
  file?: string
}

const MODES: ModeDef[] = [
  {
    id: 'description',
    label: 'Description',
    icon: BookOpen,
    blurb: 'The full job posting.',
  },
  {
    id: 'report',
    label: 'Fit report',
    icon: Target,
    // runEvaluation persists internally (src/lib/career-ops/index.ts), so this
    // one writes a numbered report and a tracker row into the career-ops
    // workspace. Say so — every other mode here is read-only.
    blurb: 'How well this job fits you, scored 0–5 with the reasoning behind it. Saves a copy you can revisit.',
    endpoint: job => `/api/jobs/${job.id}/career-ops`,
    resultKey: 'report',
    body: (_job, resumeId) => ({ resumeId: resumeId || undefined }),
    file: 'fit-report',
  },
  {
    id: 'resume',
    label: 'Tailor CV',
    icon: FileText,
    blurb: 'Your resume, rewritten for this job. Only reorders and reframes what you already have.',
    endpoint: () => '/api/career-ops/tailor-resume',
    resultKey: 'resume',
    body: (job, resumeId) => ({ jobId: job.id, resumeId: resumeId || undefined }),
    file: 'tailored-resume',
  },
  {
    id: 'cover',
    label: 'Cover letter',
    icon: Sparkles,
    blurb: 'A cover letter for this job, using the words the posting asks for.',
    endpoint: () => '/api/career-ops/cover',
    resultKey: 'coverLetter',
    body: (job, resumeId) => ({ jobId: job.id, resumeId: resumeId || undefined }),
    file: 'cover-letter',
  },
  {
    id: 'email',
    label: 'Email',
    icon: Mail,
    blurb: 'A ready-to-send email. Nothing is sent for you — you copy it.',
    endpoint: () => '/api/career-ops/email',
    resultKey: 'email',
    body: (job, resumeId, variant) => ({
      jobId: job.id,
      resumeId: resumeId || undefined,
      variant,
    }),
    file: 'email',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn message',
    icon: MessageCircle,
    blurb: 'A short LinkedIn note to the recruiter or hiring manager.',
    endpoint: () => '/api/career-ops/email',
    resultKey: 'email',
    body: (job, resumeId) => ({
      jobId: job.id,
      resumeId: resumeId || undefined,
      variant: 'linkedin_message',
    }),
    file: 'linkedin-message',
  },
  {
    id: 'interview',
    label: 'Interview prep',
    icon: MessageSquare,
    blurb: 'What to expect: the rounds, who you meet, and likely questions.',
    endpoint: () => '/api/career-ops/interview-prep',
    resultKey: 'prep',
    body: (job, resumeId) => ({ jobId: job.id, resumeId: resumeId || undefined }),
    file: 'interview-prep',
  },
  {
    id: 'followup',
    label: 'Follow-up',
    icon: Send,
    blurb: 'When to follow up after applying, and what to say.',
    endpoint: () => '/api/career-ops/followup',
    resultKey: 'followup',
    body: (job, resumeId) => ({
      company: job.company,
      role: job.title,
      resumeId: resumeId || undefined,
    }),
    file: 'followup',
  },
  {
    id: 'upskill',
    label: 'Upskill',
    icon: GraduationCap,
    blurb: 'The skills coming up most often in jobs you look at, and what to learn first.',
    endpoint: () => '/api/career-ops/upskill',
    resultKey: 'upskill',
    body: job => ({ targetedUrl: job.applyUrl || undefined }),
    file: 'upskill-plan',
  },
]

interface CareerOpsToolkitProps {
  job: ToolkitJob
  defaultResumeId?: string | null
  onClose: () => void
}

/**
 * Every career-ops capability for one saved job, in one place.
 *
 * Before this, the full methodology (tailor CV, cover letter, the five email
 * variants, interview prep, follow-up, upskill) was reachable only from the
 * Evaluate page, and only by pasting a URL. A job you had already saved could
 * not be run through any of it.
 *
 * Results are cached per mode for the life of the drawer, so switching tabs
 * doesn't re-run a generation that costs a minute of model time.
 */
export function CareerOpsToolkit({ job, defaultResumeId, onClose }: CareerOpsToolkitProps) {
  const { toast } = useToast()
  const [active, setActive] = useState<ModeId>('description')
  const [resumes, setResumes] = useState<ResumeOption[]>([])
  const [resumeId, setResumeId] = useState(defaultResumeId || '')
  const [variant, setVariant] = useState<string>('hr_application')
  const [results, setResults] = useState<Partial<Record<ModeId, string>>>({})
  const [loading, setLoading] = useState<ModeId | null>(null)
  const [errors, setErrors] = useState<Partial<Record<ModeId, string>>>({})
  const [copied, setCopied] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  const mode = useMemo(() => MODES.find(m => m.id === active) ?? MODES[0], [active])

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/resumes/list')
        const data = await res.json().catch(() => ({ resumes: [] }))
        if (res.ok) setResumes(data.resumes || [])
      } catch {
        // The picker is optional — every route falls back to the latest resume.
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  // Escape closes, matching the other drawers in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const run = useCallback(
    async (target: ModeDef, force = false) => {
      if (!target.endpoint) return
      const cacheKey = target.id === 'email' ? (`email:${variant}` as ModeId) : target.id
      if (!force && results[cacheKey]) return

      setLoading(target.id)
      setErrors(prev => ({ ...prev, [target.id]: undefined }))

      // Generations run for minutes against the local router; the shared
      // budget keeps this above the measured worst case so a slow-but-working
      // run is never cut off. See src/lib/career-ops/timeouts.ts.
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), CLIENT_ABORT_MS)
      try {
        const res = await fetch(target.endpoint(job), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(target.body?.(job, resumeId, variant) ?? {}),
          signal: controller.signal,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          const message = data?.error || `Failed to generate ${target.label.toLowerCase()}.`
          setErrors(prev => ({ ...prev, [target.id]: message }))
          toast({ type: 'error', message })
          return
        }
        const payload = target.resultKey ? data[target.resultKey] : data
        const markdown =
          typeof payload === 'string' ? payload : payload?.markdown || payload?.report || ''
        if (!markdown) {
          const message = 'Nothing came back for that — try again.'
          setErrors(prev => ({ ...prev, [target.id]: message }))
          return
        }
        setResults(prev => ({ ...prev, [cacheKey]: markdown }))
        toast({ type: 'success', message: `${target.label} ready` })
      } catch (err) {
        const aborted = err instanceof DOMException && err.name === 'AbortError'
        const message = aborted ? CLIENT_TIMEOUT_MESSAGE : 'Something went wrong. Try again.'
        setErrors(prev => ({ ...prev, [target.id]: message }))
        toast({ type: 'error', message })
      } finally {
        clearTimeout(timeoutId)
        setLoading(null)
      }
    },
    [job, resumeId, variant, results, toast]
  )

  const currentKey: ModeId = active === 'email' ? (`email:${variant}` as ModeId) : active
  const content = active === 'description' ? job.description || '' : results[currentKey] || ''
  const isBusy = loading === active
  const error = errors[active]

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast({ type: 'error', message: 'Could not copy. Select the text manually.' })
    }
  }

  return (
    <DrawerPortal>
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-enter backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Career-ops toolkit for ${job.title}`}
        className="fixed right-0 top-0 z-[60] w-full max-w-2xl h-screen bg-white dark:bg-gray-900 shadow-xl drawer-enter flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-900 dark:text-white truncate">{job.title}</h2>
            <p className="text-sm text-primary-600 dark:text-primary-400 truncate">{job.company}</p>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              {job.location && (
                <Badge variant="gray" className="text-[10px]">
                  {job.isRemote ? `${job.location} · Remote` : job.location}
                </Badge>
              )}
              {job.applyUrl && (
                <a
                  href={job.applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-primary-600 dark:text-gray-400"
                >
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  Official posting
                </a>
              )}
            </div>
          </div>
          <Button ref={closeRef} variant="ghost" size="sm" onClick={onClose} aria-label="Close toolkit">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Mode tabs. They wrap rather than scroll horizontally: eight tabs
            overflow a 672px drawer by ~190px, and with the scrollbar hidden the
            last two ("Follow-up", "Upskill") were simply invisible with nothing
            to suggest they existed. */}
        <div className="flex flex-wrap gap-1 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          {MODES.map(m => {
            const Icon = m.icon
            const isActive = m.id === active
            return (
              <button
                key={m.id}
                onClick={() => setActive(m.id)}
                aria-current={isActive}
                className={`press-scale whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5 inline mr-1.5" aria-hidden="true" />
                {m.label}
              </button>
            )
          })}
        </div>

        {/* Controls */}
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">{mode.blurb}</p>

          <div className="flex flex-wrap items-end gap-2">
            {mode.id !== 'description' && mode.id !== 'upskill' && (
              <label className="text-xs text-gray-500 dark:text-gray-400">
                Resume version
                <select
                  value={resumeId}
                  onChange={e => setResumeId(e.target.value)}
                  className="mt-1 block appearance-none rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">Latest resume</option>
                  {resumes.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.title || 'Untitled'}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {/* The variant selector the Evaluate page never had. */}
            {mode.id === 'email' && (
              <label className="text-xs text-gray-500 dark:text-gray-400">
                Email type
                <select
                  value={variant}
                  onChange={e => setVariant(e.target.value)}
                  className="mt-1 block appearance-none rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  {EMAIL_VARIANTS.map(v => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {mode.id !== 'description' && (
              <Button
                size="sm"
                onClick={() => run(mode, Boolean(content))}
                disabled={isBusy}
                isLoading={isBusy}
              >
                {!isBusy && <Sparkles className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />}
                {isBusy ? 'Generating…' : content ? 'Regenerate' : `Generate ${mode.label.toLowerCase()}`}
              </Button>
            )}

            {content && !isBusy && (
              <>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1.5 text-success-500" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    downloadFile(
                      `${mode.file || mode.id}-${job.company}-${job.title}`
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, '') + '.md',
                      content,
                      'text/markdown'
                    )
                  }
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Download
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Result */}
        <div className="flex-1 overflow-y-auto p-5">
          {isBusy ? (
            <div className="flex items-start gap-3 animate-in">
              <Loader2 className="w-5 h-5 animate-spin text-primary-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-600 dark:text-gray-300">
                <p className="font-medium text-gray-900 dark:text-white">
                  Generating {mode.label.toLowerCase()}…
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  This runs through your local Claude connection, so {TYPICAL_DURATION_LABEL} is
                  normal. Leave the drawer open — the result appears here when it finishes.
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="animate-in rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-300">
              {error}
            </div>
          ) : content ? (
            <div className="animate-in">
              {active === 'description' ? (
                // A stored posting is plain text whose structure lives in single
                // newlines and "•" bullets. Markdown collapses single newlines,
                // which turned every description into one unreadable wall of
                // text, so render it as preformatted prose instead.
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                  {content}
                </p>
              ) : (
                <CareerOpsMarkdown markdown={content} />
              )}
            </div>
          ) : (
            <div className="animate-in text-center py-10 text-gray-500 dark:text-gray-400">
              <mode.icon className="w-10 h-10 mx-auto mb-2 opacity-40" aria-hidden="true" />
              <p className="text-sm">
                {mode.id === 'description'
                  ? 'No description stored for this job.'
                  : `Nothing generated yet — hit “Generate ${mode.label.toLowerCase()}”.`}
              </p>
            </div>
          )}
        </div>
      </div>
    </DrawerPortal>
  )
}
