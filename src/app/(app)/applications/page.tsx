'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  Briefcase, MapPin, ExternalLink, Trash2, Loader2, CheckCircle2, Clock, Inbox, Search,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { AppStatus } from '@/types'
import toast from 'react-hot-toast'

const STATUS_META: Record<AppStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gray' }> = {
  SAVED: { label: 'Saved', variant: 'gray' },
  APPLIED: { label: 'Applied', variant: 'info' },
  INTERVIEWING: { label: 'Interviewing', variant: 'warning' },
  OFFER: { label: 'Offer', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  WITHDRAWN: { label: 'Withdrawn', variant: 'gray' },
}

const STATUS_ORDER: AppStatus[] = ['SAVED', 'APPLIED', 'INTERVIEWING', 'OFFER', 'REJECTED', 'WITHDRAWN']

interface Application {
  id: string
  status: AppStatus
  notes: string | null
  appliedAt: string | null
  updatedAt: string
  createdAt: string
  job: {
    id: string
    title: string
    company: string
    location: string
    isRemote: boolean
    applyUrl: string
    provider: string
  }
  resume: { id: string; title: string; roleType: string } | null
}

export default function ApplicationsPage() {
  const { data: session } = useSession()
  const [applications, setApplications] = useState<Application[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<AppStatus | 'ALL'>('ALL')
  const [position, setPosition] = useState('')
  const [location, setLocation] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return

    let cancelled = false
    fetch('/api/applications')
      .then(res => (res.ok ? res.json() : Promise.reject(new Error('Failed to load applications'))))
      .then(data => {
        if (!cancelled) setApplications(data.applications || [])
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load applications')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [session])

  const updateStatus = async (app: Application, status: AppStatus) => {
    setBusyId(app.id)
    try {
      const res = await fetch(`/api/applications/${app.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        setApplications(applications.map(a => (a.id === app.id ? { ...a, status } : a)))
        toast.success(status === 'APPLIED' ? 'Marked as applied!' : `Status updated to ${STATUS_META[status].label}`)
      } else {
        toast.error('Failed to update status')
      }
    } catch {
      toast.error('Failed to update status')
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (app: Application) => {
    if (!confirm(`Remove "${app.job.title}" from your applications?`)) return
    setBusyId(app.id)
    try {
      const res = await fetch(`/api/applications/${app.id}`, { method: 'DELETE' })
      if (res.ok) {
        setApplications(applications.filter(a => a.id !== app.id))
        toast.success('Application removed')
      } else {
        toast.error('Failed to remove application')
      }
    } catch {
      toast.error('Failed to remove application')
    } finally {
      setBusyId(null)
    }
  }

  const q = position.trim().toLowerCase()
  const loc = location.trim().toLowerCase()

  // Optional, combined filters: status + job position/company + location.
  const visible = applications.filter(a => {
    if (filter !== 'ALL' && a.status !== filter) return false
    if (q && !`${a.job.title} ${a.job.company}`.toLowerCase().includes(q)) return false
    if (loc && !a.job.location.toLowerCase().includes(loc)) return false
    return true
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Applications</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Track every job you&apos;ve saved or applied to — from initial save to offer
        </p>
      </div>

      {/* Position + location filters (both optional) */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={position}
            onChange={e => setPosition(e.target.value)}
            placeholder="Filter by job position or company…"
            className="input pl-9"
            aria-label="Filter by position or company"
          />
        </div>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="Filter by location (e.g. Remote, SF)…"
            className="input pl-9"
            aria-label="Filter by location"
          />
        </div>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter('ALL')}
          className={cn(
            'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
            filter === 'ALL'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          )}
        >
          All ({applications.length})
        </button>
        {STATUS_ORDER.map(status => {
          const count = applications.filter(a => a.status === status).length
          return (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                filter === status
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              )}
            >
              {STATUS_META[status].label} ({count})
            </button>
          )
        })}
      </div>

      {visible.length === 0 ? (
        <Card className="text-center py-12">
          <Inbox className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {applications.length === 0
              ? 'No applications yet'
              : q || loc
                ? 'No applications match your filters'
                : 'Nothing in this status'}
          </h3>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            {applications.length === 0
              ? 'Click "Save" on any job card in the dashboard to start tracking it here'
              : q || loc
                ? 'Try different keywords, a location, or clear the filters'
                : 'Try another status filter'}
          </p>
          {applications.length === 0 && (
            <Link href="/dashboard" className="mt-4 inline-block">
              <Button>
                <Briefcase className="w-4 h-4" />
                Browse Jobs
              </Button>
            </Link>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map(app => {
            const meta = STATUS_META[app.status]
            return (
              <Card key={app.id} className="card-hover">
                <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {app.job.title}
                      </h3>
                      <Badge variant={meta.variant}>
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        {meta.label}
                      </Badge>
                    </div>
                    <p className="text-primary-600 dark:text-primary-400 font-medium text-sm mt-0.5">
                      {app.job.company}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {app.job.isRemote ? 'Remote' : app.job.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {app.status === 'APPLIED' && app.appliedAt
                          ? `Applied ${formatDate(app.appliedAt)}`
                          : `Updated ${formatDate(app.updatedAt)}`}
                      </span>
                      {app.resume && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />
                          Resume: {app.resume.title}
                        </span>
                      )}
                    </div>
                    {app.notes && (
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{app.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select
                      value={app.status}
                      onChange={e => updateStatus(app, e.target.value as AppStatus)}
                      disabled={busyId === app.id}
                      className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500/40 disabled:opacity-50"
                      aria-label={`Status for ${app.job.title}`}
                    >
                      {STATUS_ORDER.map(s => (
                        <option key={s} value={s}>{STATUS_META[s].label}</option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(app.job.applyUrl, '_blank', 'noopener,noreferrer')}
                      disabled={!app.job.applyUrl}
                      title={app.job.applyUrl ? 'Open application page' : 'No application link available'}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Apply
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(app)}
                      disabled={busyId === app.id}
                      className="text-danger-500 hover:text-danger-600"
                      title="Remove application"
                    >
                      {busyId === app.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
