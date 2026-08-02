'use client'

import { Briefcase, CheckCircle2, TrendingUp, FileText, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Stats {
  totalJobs: number
  jobsToday: number
  strongMatches: number
  matches: number
  applications: number
}

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  sub?: string
  color: string
}

function StatCard({ title, value, icon, sub, color }: StatCardProps) {
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
          {sub && (
            <p className="mt-1 text-sm flex items-center gap-1 text-gray-500 dark:text-gray-400">
              <TrendingUp className="w-3.5 h-3.5" />
              {sub}
            </p>
          )}
        </div>
        <div className={cn('p-3 rounded-xl', color)}>
          {icon}
        </div>
      </div>
    </div>
  )
}

export function StatsCards({ stats }: { stats: Stats }) {
  const cards = [
    {
      title: 'Active Jobs',
      value: stats.totalJobs.toLocaleString(),
      icon: <Briefcase className="w-6 h-6" />,
      sub: `${stats.jobsToday} fetched today`,
      color: 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400',
    },
    {
      title: 'Strong Matches',
      value: stats.strongMatches.toLocaleString(),
      icon: <Target className="w-6 h-6" />,
      sub: `${stats.matches} total matches`,
      color: 'bg-success-100 text-success-600 dark:bg-success-500/20 dark:text-success-400',
    },
    {
      title: 'Applications',
      value: stats.applications.toLocaleString(),
      icon: <FileText className="w-6 h-6" />,
      sub: 'saved & applied',
      color: 'bg-warning-100 text-warning-600 dark:bg-warning-500/20 dark:text-warning-400',
    },
    {
      title: 'Match Rate',
      value: `${stats.totalJobs > 0 ? Math.round((stats.strongMatches / Math.max(1, stats.totalJobs)) * 100) : 0}%`,
      icon: <CheckCircle2 className="w-6 h-6" />,
      sub: 'jobs scored 80+',
      color: 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <StatCard key={card.title} {...card} />
      ))}
    </div>
  )
}
