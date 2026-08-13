'use client'

import { useMemo } from 'react'
import { TrendingUp, Download, Activity } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { downloadFile } from '@/lib/utils'
import { AppStatus } from '@/types'
import { useToast } from '@/components/ui/Toast'

// Shape-compatible with the Application objects the applications page fetches.
interface InsightsApplication {
  id: string
  status: AppStatus
  appliedAt: string | null
  createdAt: string
  updatedAt: string
  notes: string | null
  job: {
    id: string
    title: string
    company: string
    location: string
    isRemote: boolean
    applyUrl: string
  }
  resume: { id: string; title: string } | null
}

interface ApplicationInsightsProps {
  /** Full application list — drives the funnel and the 14-day activity chart. */
  applications: InsightsApplication[]
  /** Currently filtered list — what the CSV export serializes. */
  visible: InsightsApplication[]
}

const FUNNEL_STAGES: { status: AppStatus; label: string; color: string }[] = [
  { status: 'SAVED', label: 'Saved', color: 'bg-khaki-400 dark:bg-khaki-500' },
  { status: 'APPLIED', label: 'Applied', color: 'bg-primary-500' },
  { status: 'INTERVIEWING', label: 'Interviewing', color: 'bg-gold-500' },
  { status: 'OFFER', label: 'Offer', color: 'bg-success-500' },
]

export function ApplicationInsights({ applications, visible }: ApplicationInsightsProps) {
  const { toast } = useToast()
  const counts = useMemo(() => {
    const c: Record<AppStatus, number> = {
      SAVED: 0, APPLIED: 0, INTERVIEWING: 0, OFFER: 0, REJECTED: 0, WITHDRAWN: 0,
    }
    for (const a of applications) c[a.status] += 1
    return c
  }, [applications])

  const total = FUNNEL_STAGES.reduce((sum, s) => sum + counts[s.status], 0)

  // Applications per calendar day over the last 14 days. Uses the apply date when
  // present, otherwise when the application first entered the pipeline.
  const last14Days = useMemo(() => {
    const today = new Date()
    const days: { key: string; label: string; count: number; isToday: boolean }[] = []
    const index = new Map<string, number>()
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      index.set(key, days.length)
      days.push({
        key,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count: 0,
        isToday: i === 0,
      })
    }
    for (const a of applications) {
      const dateStr = a.appliedAt || a.createdAt
      if (!dateStr) continue
      const idx = index.get(dateStr.slice(0, 10))
      if (idx !== undefined) days[idx].count += 1
    }
    return days
  }, [applications])

  const maxCount = Math.max(1, ...last14Days.map(d => d.count))

  const handleExport = () => {
    if (!visible.length) {
      toast({ type: 'error', message: 'Nothing to export — no applications match the current filters' })
      return
    }
    const headers = ['Company', 'Role', 'Location', 'Status', 'Applied At', 'Updated At', 'Notes', 'Apply URL']
    const rows = visible.map(a => [
      a.job.company,
      a.job.title,
      a.job.isRemote ? 'Remote' : a.job.location,
      a.status,
      a.appliedAt || '',
      a.updatedAt,
      a.notes || '',
      a.job.applyUrl,
    ])
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
    const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n')
    downloadFile('applications.csv', csv, 'text/csv;charset=utf-8')
    toast({ type: 'success', message: `Exported ${visible.length} application${visible.length === 1 ? '' : 's'}` })
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold">
            <TrendingUp className="w-4 h-4 text-primary-500" />
            Pipeline insights
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Funnel */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              Application funnel
            </p>
            <div className="flex h-8 w-full overflow-hidden rounded-lg bg-belgium-200 dark:bg-khaki-800">
              {FUNNEL_STAGES.map(stage => {
                const count = counts[stage.status]
                if (!count) return null
                return (
                  <div
                    key={stage.status}
                    className={`${stage.color} relative transition-all`}
                    style={{ width: `${(count / total) * 100}%` }}
                    title={`${stage.label}: ${count}`}
                  />
                )
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
              {FUNNEL_STAGES.map(stage => (
                <span key={stage.status} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-sm ${stage.color}`} />
                  {stage.label} ({counts[stage.status]})
                </span>
              ))}
            </div>
            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              {FUNNEL_STAGES.slice(0, -1).map((stage, i) => {
                const next = FUNNEL_STAGES[i + 1]
                const from = counts[stage.status]
                const rate = from > 0 ? Math.round((counts[next.status] / from) * 100) : 0
                return (
                  <span key={stage.status} className="mr-3">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{stage.label}</span>
                    {' → '}
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{next.label}</span>
                    {' '}
                    <span className={rate >= 50 ? 'text-success-600 dark:text-success-400 font-semibold' : ''}>{rate}%</span>
                  </span>
                )
              })}
            </div>
          </div>

          {/* 14-day activity */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
              <Activity className="w-3 h-3" />
              Last 14 days of activity
            </p>
            <div className="flex items-end gap-1 h-24">
              {last14Days.map(d => (
                <div
                  key={d.key}
                  className="flex-1 flex flex-col items-center justify-end gap-1 h-full group"
                  title={`${d.label}: ${d.count} application${d.count === 1 ? '' : 's'}`}
                >
                  <span className="text-[10px] leading-none text-gray-500 dark:text-gray-400">
                    {d.count || ''}
                  </span>
                  <div
                    className={`w-full rounded-t transition-colors ${
                      d.isToday
                        ? 'bg-primary-500'
                        : d.count
                          ? 'bg-primary-200 dark:bg-primary-500/40 group-hover:bg-primary-300 dark:group-hover:bg-primary-500/60'
                          : 'bg-gray-100 dark:bg-gray-800'
                    }`}
                    style={{ height: `${d.count ? Math.max(10, (d.count / maxCount) * 100) : 4}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-1 text-[10px] text-gray-400 dark:text-gray-500">
              {last14Days.map((d, i) => (
                <span key={d.key} className="flex-1 text-center truncate">
                  {i === 0 || i === Math.floor(last14Days.length / 2) || i === last14Days.length - 1 ? d.label : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
