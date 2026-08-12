'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { Loader2 } from 'lucide-react'

interface OnboardingFlowProps {
  hasResume: boolean
  nextPath: string
}

type Status = 'idle' | 'fetch' | 'deactivate' | 'score' | 'done' | 'error'

interface StreamEvent {
  type: string
  phase?: 'fetch' | 'deactivate' | 'score'
  provider?: string
  message?: string
}

const PROVIDER_COUNT = 9

const steps = [
  { key: 'fetch', label: `Fetching jobs from ${PROVIDER_COUNT} providers` },
  { key: 'deactivate', label: 'Deactivating expired jobs' },
  { key: 'score', label: 'Scoring new matches against your resume' },
] as const

export function OnboardingFlow({ hasResume, nextPath }: OnboardingFlowProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [status, setStatus] = useState<Status>('idle')
  const [providers, setProviders] = useState<string[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!hasResume) return

    let cancelled = false

    const run = async () => {
      try {
        const res = await fetch('/api/onboarding/run', { method: 'POST' })
        if (!res.ok) {
          throw new Error(
            res.status === 401 ? 'Session expired — please sign in again.' : 'Refresh failed to start'
          )
        }
        if (!res.body) throw new Error('Streaming not supported')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let finished = false

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.trim()) continue

            let event: StreamEvent
            try {
              event = JSON.parse(line)
            } catch {
              continue
            }

            if (cancelled) return

            if (event.type === 'phase') {
              setStatus(event.phase ?? 'fetch')
              if (event.phase === 'fetch' && event.provider) {
                setProviders((prev) => (prev.includes(event.provider) ? prev : [...prev, event.provider]))
              }
            } else if (event.type === 'error') {
              finished = true
              setStatus('error')
              setError(event.message ?? 'Something went wrong')
            } else if (event.type === 'done') {
              finished = true
              setStatus('done')
              toast({ type: 'success', message: 'Your matches are ready!' })
              router.push(nextPath)
              router.refresh()
              return
            }
          }
        }

        // Stream ended without a done/error event (server crashed mid-write).
        if (!finished && !cancelled) {
          setStatus('error')
          setError('The refresh ended unexpectedly. Your jobs are still saved.')
        }
      } catch (e) {
        if (!cancelled) {
          setStatus('error')
          setError(e instanceof Error ? e.message : 'Connection lost')
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [hasResume, nextPath, router, toast])

  if (!hasResume) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Upload your resume to see matches</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Your resume powers the match scores. Upload it and we&apos;ll fetch fresh jobs and score them for you.
        </p>
        <Link href="/resumes/new?next=/onboarding" className="mt-6 inline-block">
          <Button size="lg">Upload Resume</Button>
        </Link>
      </div>
    )
  }

  const currentIndex =
    status === 'fetch' || status === 'deactivate' || status === 'score'
      ? steps.findIndex((s) => s.key === status)
      : status === 'done'
        ? steps.length
        : -1

  return (
    <div className="mx-auto max-w-xl py-16">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {status === 'error'
          ? 'Something went wrong'
          : status === 'done'
            ? 'Redirecting…'
            : 'Refreshing your matches'}
      </h1>

      <ul className="mt-6 space-y-3">
        {steps.map((step, index) => {
          const isActive = status !== 'error' && currentIndex === index
          const isComplete = currentIndex > index
          return (
            <li key={step.key} className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              {isActive ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
              ) : isComplete ? (
                <span className="text-success-500">✓</span>
              ) : (
                <span className="w-4 h-4 text-gray-300 dark:text-gray-600">•</span>
              )}
              <span className={status === 'error' ? 'text-gray-400' : ''}>{step.label}</span>
            </li>
          )
        })}
        {providers.length > 0 && status !== 'error' && (
          <li className="text-sm text-gray-500 dark:text-gray-400">
            {providers.length} of {PROVIDER_COUNT} providers checked
          </li>
        )}
      </ul>

      {status === 'error' && (
        <div className="mt-8 space-y-3">
          <p className="text-sm text-danger-600 dark:text-danger-400">{error}</p>
          <Button onClick={() => router.push('/dashboard')}>Go to dashboard</Button>
        </div>
      )}
    </div>
  )
}
