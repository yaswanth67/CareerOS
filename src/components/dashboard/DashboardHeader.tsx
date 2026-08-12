'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, RefreshCw, Loader2, Sparkles, Bookmark, Send } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import { AppStatus } from '@/types'
import { AdvancedFilters } from './AdvancedFilters'

export function DashboardHeader() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [refreshing, setRefreshing] = useState(false)
  const [scoring, setScoring] = useState(false)
  const { toast } = useToast()

  const currentStatus = (searchParams.get('status') || '') as AppStatus | ''

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      // Clear all filters on refresh - show all jobs
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error || 'Failed to refresh jobs')
        return
      }
      const total = (data?.stats?.activeJobs ?? 0) as number
      const scored = (data?.scored ?? 0) as number
      toast.success(
        scored > 0
          ? `Fetched jobs — ${total.toLocaleString()} active, scored ${scored.toLocaleString()}`
          : `Fetched jobs — ${total.toLocaleString()} active now`
      )
      // Link check runs automatically with the fetch — surface any cleanup it did.
      const deactivated = (data?.linkCheck?.deactivated ?? 0) as number
      if (deactivated > 0) {
        toast.success(`Removed ${deactivated} job${deactivated === 1 ? '' : 's'} with broken apply links`)
      }
      router.replace('/dashboard')
    } catch {
      toast.error('Failed to refresh jobs')
    } finally {
      setRefreshing(false)
    }
  }

  const handleScoreMatches = async () => {
    setScoring(true)
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'score' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error || 'Failed to score jobs')
        return
      }

      const scored = (data?.scored ?? 0) as number
      toast.success(scored > 0 ? `Scored ${scored.toLocaleString()} jobs` : 'All jobs are already scored')
      router.refresh()
    } catch {
      toast.error('Failed to score jobs')
    } finally {
      setScoring(false)
    }
  }

  const statusOptions: { value: AppStatus | ''; label: string; icon?: React.ElementType }[] = [
    { value: '', label: 'All Jobs' },
    { value: 'SAVED', label: 'Saved', icon: Bookmark },
    { value: 'APPLIED', label: 'Applied', icon: Send },
  ]

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back, {session?.user?.name?.split(' ')[0] || 'there'}!
        </h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Here are your latest job matches
        </p>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
        {/* Filters Bar - Status, Advanced Filters all aligned */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Status Filter Buttons */}
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden sm:inline-flex self-center">
              Status:
            </span>
            {statusOptions.map((opt) => {
              const Icon = opt.icon
              const isActive = currentStatus === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString())
                    if (opt.value) {
                      params.set('status', opt.value)
                    } else {
                      params.delete('status')
                    }
                    router.replace(`/dashboard?${params.toString()}`)
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                    isActive
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  )}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  {opt.label}
                </button>
              )
            })}

            {/* Advanced Filters — trigger + drawer, built from saved target
                filters (Preferences tab) */}
            <AdvancedFilters />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <Link href="/resumes/new" className="btn-primary">
              <Plus className="w-4 h-4" />
              Upload Resume
            </Link>
            <button
              className="btn-secondary"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {refreshing ? 'Fetching...' : 'Refresh Jobs'}
            </button>
            <button
              className="btn-outline"
              onClick={handleScoreMatches}
              disabled={scoring}
              title="Score the latest jobs against your most recent resume"
            >
              {scoring ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {scoring ? 'Scoring...' : 'Score Matches'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
