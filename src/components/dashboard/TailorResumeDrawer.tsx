'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Copy, FileText, Loader2, RefreshCw, X } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CareerOpsMarkdown } from '@/components/career-ops/CareerOpsReport'
import toast from 'react-hot-toast'

interface TailorJob {
  id: string
  title: string
  company: string
}

interface TailorResumeDrawerProps {
  job: TailorJob
  /** The user's resume to tailor (defaults to the latest if omitted) */
  defaultResumeId?: string | null
  onClose: () => void
}

interface TailorResult {
  markdown: string
  keywords?: string[]
  gaps?: string[]
}

/**
 * Slide-in drawer that tailors the user's resume to a specific job using the
 * career-ops PDF methodology, then shows the rewritten CV as markdown. Launched
 * from the "Tailor CV" button on a Dashboard job card.
 */
export function TailorResumeDrawer({ job, defaultResumeId, onClose }: TailorResumeDrawerProps) {
  const [result, setResult] = useState<TailorResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/career-ops/tailor-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, resumeId: defaultResumeId || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.resume?.markdown) {
        setResult(data.resume)
        toast.success('Resume tailored to this job!')
      } else {
        setError(data?.error || 'Failed to tailor resume')
      }
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }, [job.id, defaultResumeId])

  // Tailor immediately on open — no extra click needed. Deferred so setState
  // isn't called synchronously inside the effect.
  useEffect(() => {
    const t = setTimeout(() => generate(), 0)
    return () => clearTimeout(t)
  }, [generate])

  const copyTailored = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.markdown)
      toast.success('Tailored CV copied')
    } catch {
      toast.error('Could not copy — select and copy manually')
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} aria-hidden="true" />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-[60] w-full max-w-2xl max-h-screen bg-white dark:bg-gray-900 shadow-xl slide-in-right flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-snug text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-500 flex-shrink-0" />
              Tailored CV
            </h2>
            <p className="text-sm text-primary-600 dark:text-primary-400 font-medium mt-0.5 truncate">
              {job.title} · {job.company}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors shrink-0"
            aria-label="Close tailored CV"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-6 flex items-start gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-600 dark:text-gray-300">
                <p className="font-medium text-gray-900 dark:text-white">
                  Tailoring your resume to {job.company}…
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  This rewrites your CV against the job description using the career-ops methodology — it
                  takes about 30 seconds.
                </p>
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-danger-100 dark:border-danger-500/30 bg-danger-50 dark:bg-danger-500/10 p-4 text-sm text-danger-600 dark:text-danger-500">
              <p className="font-medium flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Couldn&apos;t tailor your resume
              </p>
              <p className="mt-1">{error}</p>
              <Button variant="outline" size="sm" onClick={generate} className="mt-3">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Try again
              </Button>
            </div>
          )}

          {result && (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Your CV, rewritten for {job.company}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={copyTailored}>
                    <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                  </Button>
                  <Button variant="ghost" size="sm" onClick={generate} disabled={loading}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Regenerate
                  </Button>
                </div>
              </div>

              {result.gaps?.length ? (
                <div className="rounded-lg border border-warning-100 dark:border-warning-500/30 bg-warning-50 dark:bg-warning-500/10 p-4 text-sm">
                  <p className="font-medium text-warning-600 dark:text-warning-500 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Requirements this CV can&apos;t cover
                  </p>
                  <ul className="mt-1.5 list-disc pl-5 text-warning-600 dark:text-warning-500 space-y-0.5">
                    {result.gaps.map(g => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {result.keywords?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {result.keywords.map(k => (
                    <Badge key={k} variant="info">
                      {k}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400">
                  Tailored CV
                </div>
                <div className="p-4">
                  <CareerOpsMarkdown markdown={result.markdown} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
