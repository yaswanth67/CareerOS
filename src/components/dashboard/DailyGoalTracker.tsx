'use client'

import { useEffect, useState } from 'react'
import { Target, Users, BookOpen, CheckCircle, ChevronLeft, ChevronRight, RefreshCw, Minus, Plus, Zap } from 'lucide-react'
import { format, subDays, addDays, startOfDay, isSameDay } from 'date-fns'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'

interface DailyGoal {
  id: string
  date: string
  applicationsTarget: number
  applicationsCompleted: number
  networkingTarget: number
  networkingCompleted: number
  skillLearningTarget: number
  skillLearningCompleted: number
}

type GoalKey = 'applications' | 'networking' | 'skillLearning'

interface DailyGoalTrackerProps {
  initialDate?: Date
}

const GOAL_TYPES = [
  {
    key: 'applications' as const,
    label: 'Applications',
    icon: Target,
    emoji: '🎯',
    targetKey: 'applicationsTarget' as const,
    completedKey: 'applicationsCompleted' as const,
  },
  {
    key: 'networking' as const,
    label: 'Networking',
    icon: Users,
    emoji: '🤝',
    targetKey: 'networkingTarget' as const,
    completedKey: 'networkingCompleted' as const,
  },
  {
    key: 'skillLearning' as const,
    label: 'Skill Learning',
    icon: BookOpen,
    emoji: '📚',
    targetKey: 'skillLearningTarget' as const,
    completedKey: 'skillLearningCompleted' as const,
  },
] as const

// Every class here is a literal string: Tailwind only generates what it can see
// in the source. Building names at runtime (`colors.text.replace('text-','bg-')`)
// produced `bg-purple-700`, which was never compiled — the progress bar fill
// rendered with no background and looked broken.
// All three cards use neutral surfaces with primary (blush/burgundy) progress fill;
// the icon and goal name already identify the card, and the three hues fight the
// status colours elsewhere on the page.
// One neutral treatment for all three goals. The icon and the goal name already
// say which card you're looking at, and three brand-adjacent hues competed with
// the six application-status colours used elsewhere on the page. Every class is
// a literal string — Tailwind only compiles what it can see in the source.
const GOAL_STYLE = {
  chip: 'bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300',
  text: 'text-primary-600 dark:text-primary-300',
  fill: 'bg-primary-500 dark:bg-primary-200',
  border: 'border-primary-200 dark:border-primary-900/50',
  ring: 'focus:ring-primary-500',
}

function GoalCard({
  goal,
  dailyGoal,
  onAdjust,
  onUpdateTarget,
  autoCount,
  busy,
}: {
  goal: typeof GOAL_TYPES[number]
  dailyGoal: DailyGoal
  onAdjust: (type: GoalKey, delta: 1 | -1) => void
  onUpdateTarget: (type: GoalKey, value: number) => void
  /** Applications counted automatically from real applies (applications only). */
  autoCount?: number
  busy?: boolean
}) {
  const target = dailyGoal[goal.targetKey]
  const completed = dailyGoal[goal.completedKey]
  const isAutoTracked = goal.key === 'applications'
  // A target of 0 means "not tracking this today" rather than "impossible goal":
  // without this the card read "0 more to go" at 0% while showing 2 done.
  const hasTarget = target > 0
  const progress = hasTarget
    ? Math.min(100, Math.round((completed / target) * 100))
    : completed > 0 ? 100 : 0
  const isComplete = hasTarget ? completed >= target : completed > 0
  const remaining = Math.max(0, target - completed)

  const Icon = goal.icon
  const colors = GOAL_STYLE

  return (
    <div className={cn('card p-4 relative overflow-hidden', colors.border)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 relative z-10">
          <div className={cn('p-2.5 rounded-xl shrink-0', colors.chip)}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {goal.label} <span className="opacity-60">{goal.emoji}</span>
              </h3>
              {isAutoTracked && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                  title={`${autoCount ?? 0} counted automatically from jobs you marked Applied today`}
                >
                  <Zap className="w-2.5 h-2.5" />
                  Auto
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {!hasTarget
                ? 'No target set for today'
                : isComplete
                  ? 'Goal achieved! 🎉'
                  : `${remaining} more to go`}
            </p>
          </div>
        </div>

        {/* Percentage sits opposite the goal name — the count itself lives in
            the stepper below, so this is the only progress figure up here. */}
        <span
          className={cn(
            'text-xl font-bold leading-none tabular-nums shrink-0',
            isComplete ? 'text-green-600 dark:text-green-400' : colors.text
          )}
        >
          {hasTarget ? `${progress}%` : `${completed}`}
        </span>
      </div>

      {/* Progress bar. No count/percentage labels — the stepper shows the count,
          the target field shows the target, and the percentage is up top. */}
      <div className="mt-3 relative z-10">
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              isComplete ? 'bg-green-500' : colors.fill
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="mt-3 flex items-center justify-between gap-3 relative z-10">
        {/* Stepper. Applications count themselves as you apply; these nudge the
            total for anything done outside Prose. */}
        <div className={cn(
          'flex items-center rounded-lg border bg-white dark:bg-gray-900/60 overflow-hidden',
          colors.border
        )}>
          <button
            onClick={() => onAdjust(goal.key, -1)}
            disabled={busy || completed <= 0}
            className="px-2.5 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label={`Remove one from ${goal.label.toLowerCase()}`}
          >
            <Minus className="w-4 h-4" />
          </button>
          <span
            className={cn('min-w-[2.5rem] text-center text-sm font-semibold tabular-nums', colors.text)}
            aria-live="polite"
          >
            {completed}
          </span>
          <button
            onClick={() => onAdjust(goal.key, 1)}
            disabled={busy}
            className="px-2.5 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label={`Add one to ${goal.label.toLowerCase()}`}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {isComplete && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
              <CheckCircle className="w-3.5 h-3.5" />
              Done
            </span>
          )}
          <label htmlFor={`target-${goal.key}`} className="text-xs text-gray-500 dark:text-gray-400">
            Target
          </label>
          <input
            id={`target-${goal.key}`}
            type="number"
            min="0"
            max="20"
            value={target}
            onChange={(e) => onUpdateTarget(goal.key, parseInt(e.target.value) || 0)}
            className={cn(
              'w-14 px-2 py-1.5 text-center text-sm font-medium border rounded-lg bg-white dark:bg-gray-900/60',
              'focus:outline-none focus:ring-2',
              colors.border,
              colors.text,
              colors.ring
            )}
            aria-label={`${goal.label} target`}
          />
        </div>
      </div>
    </div>
  )
}

export function DailyGoalTracker({ initialDate }: DailyGoalTrackerProps) {
  const [currentDate, setCurrentDate] = useState(() => initialDate ? startOfDay(initialDate) : startOfDay(new Date()))
  const [dailyGoal, setDailyGoal] = useState<DailyGoal | null>(null)
  // Applications counted from real applies — shown as the "Auto" hint.
  const [applicationsAuto, setApplicationsAuto] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [streak, setStreak] = useState(0)
  const { toast } = useToast()

  const fetchDailyGoal = async () => {
    try {
      const dateStr = format(currentDate, 'yyyy-MM-dd')
      const res = await fetch(`/api/daily-goals?date=${dateStr}`)
      const data = await res.json()
      if (res.ok && data.dailyGoal) {
        setDailyGoal(data.dailyGoal)
        setApplicationsAuto(data.applicationsAuto ?? 0)
      }
    } catch (error) {
      console.error('Failed to fetch daily goal:', error)
      toast({ type: 'error', message: 'Failed to load daily goals' })
    } finally {
      setLoading(false)
    }
  }

  const fetchStreak = async () => {
    try {
      const dateStr = format(currentDate, 'yyyy-MM-dd')
      const res = await fetch(`/api/daily-goals?date=${dateStr}&streak=true`)
      const data = await res.json()
      if (res.ok) {
        setStreak(data.streak || 0)
      }
    } catch {
      // Silently fail for streak
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    fetchDailyGoal()
    fetchStreak()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate])

  // Manual nudge in either direction. Applications also count themselves as you
  // mark jobs Applied, so this adjusts on top of that rather than replacing it.
  const handleAdjust = async (type: GoalKey, delta: 1 | -1) => {
    if (!dailyGoal) return
    if (delta === -1 && dailyGoal[`${type}Completed`] <= 0) return

    setSaving(true)
    try {
      const dateStr = format(currentDate, 'yyyy-MM-dd')
      const res = await fetch('/api/daily-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: `${delta === 1 ? 'increment' : 'decrement'}-${type}`,
          date: dateStr,
        }),
      })
      const data = await res.json()
      if (res.ok && data.dailyGoal) {
        setDailyGoal(data.dailyGoal)
        setApplicationsAuto(data.applicationsAuto ?? 0)
        fetchStreak()
      } else {
        toast({ type: 'error', message: 'Failed to update progress' })
      }
    } catch {
      toast({ type: 'error', message: 'Failed to update progress' })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateTarget = async (type: GoalKey, value: number) => {
    if (!dailyGoal) return

    const dateStr = format(currentDate, 'yyyy-MM-dd')
    try {
      const res = await fetch('/api/daily-goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: dateStr,
          [`${type}Target`]: value,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setDailyGoal(data.dailyGoal)
      }
    } catch {
      toast({ type: 'error', message: 'Failed to update target' })
    }
  }

  const goToPreviousDay = () => setCurrentDate(subDays(currentDate, 1))
  const goToNextDay = () => setCurrentDate(addDays(currentDate, 1))
  const goToToday = () => setCurrentDate(startOfDay(new Date()))

  const isToday = isSameDay(currentDate, new Date())

  if (loading) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin dark:border-primary-200" />
        </div>
      </div>
    )
  }

  if (!dailyGoal) {
    return (
      <div className="card p-6 text-center">
        <Target className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-gray-500 dark:text-gray-400">Failed to load daily goals</p>
      </div>
    )
  }

  const totalTarget = dailyGoal.applicationsTarget + dailyGoal.networkingTarget + dailyGoal.skillLearningTarget
  const totalCompleted = dailyGoal.applicationsCompleted + dailyGoal.networkingCompleted + dailyGoal.skillLearningCompleted
  // Capped at 100: overshooting one goal (3 applies against a target of 1) used
  // to render "129%" and a bar that ran past its track.
  const overallProgress = totalTarget > 0 ? Math.min(100, Math.round((totalCompleted / totalTarget) * 100)) : 0
  const allComplete = dailyGoal.applicationsCompleted >= dailyGoal.applicationsTarget &&
    dailyGoal.networkingCompleted >= dailyGoal.networkingTarget &&
    dailyGoal.skillLearningCompleted >= dailyGoal.skillLearningTarget

  return (
    <div className="card">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={goToPreviousDay}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Previous day"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isToday ? 'Today' : format(currentDate, 'EEEE, MMMM d, yyyy')}
              </p>
              {isToday && <span className="badge bg-primary-100 text-primary-600 dark:bg-primary-200/30 dark:text-primary-200 text-xs">Today</span>}
            </div>
            <button
              onClick={goToNextDay}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Next day"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {streak > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full">
                <span className="text-lg">🔥</span>
                <span className="font-bold text-sm">{streak}</span>
                <span className="text-xs">day streak</span>
              </div>
            )}
            <Button
              variant={isToday ? 'primary' : 'secondary'}
              size="sm"
              onClick={goToToday}
            >
              Today
            </Button>
          </div>
        </div>

        {/* Overall Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-gray-900 dark:text-white">Overall Progress</span>
            <span className={cn('font-bold', allComplete ? 'text-green-600 dark:text-green-400' : 'text-primary-600 dark:text-primary-300')}>
              {overallProgress}%
            </span>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                allComplete ? 'bg-green-500' : 'bg-primary-500 dark:bg-primary-200'
              )}
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
            {allComplete ? '🎉 All goals achieved! Great job!' : `${totalCompleted} of ${totalTarget} tasks completed`}
          </p>
        </div>
      </div>

      {/* Goals Grid */}
      <div className="p-4 space-y-4">
        {GOAL_TYPES.map(goal => (
          <GoalCard
            key={goal.key}
            goal={goal}
            dailyGoal={dailyGoal}
            onAdjust={handleAdjust}
            autoCount={goal.key === 'applications' ? applicationsAuto : undefined}
            busy={saving}
            onUpdateTarget={handleUpdateTarget}
          />
        ))}

        {/* Quick Actions */}
        <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => {
              // Reset all completed to 0
              fetch('/api/daily-goals', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  date: format(currentDate, 'yyyy-MM-dd'),
                  applicationsCompleted: 0,
                  networkingCompleted: 0,
                  skillLearningCompleted: 0,
                }),
              }).then(() => {
                fetchDailyGoal()
                toast({ type: 'success', message: 'Progress reset for today' })
              })
            }}
            className="btn-ghost flex-1"
            disabled={saving}
          >
            <RefreshCw className="w-4 h-4" />
            Reset Today
          </button>
          <button
            onClick={() => {
              // Copy today's targets to tomorrow
              const tomorrow = addDays(currentDate, 1)
              fetch('/api/daily-goals', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  date: format(tomorrow, 'yyyy-MM-dd'),
                  applicationsTarget: dailyGoal.applicationsTarget,
                  networkingTarget: dailyGoal.networkingTarget,
                  skillLearningTarget: dailyGoal.skillLearningTarget,
                }),
              }).then(() => toast({ type: 'success', message: 'Targets copied to tomorrow' }))
            }}
            className="btn-secondary flex-1"
          >
            Copy to Tomorrow
          </button>
        </div>
      </div>
    </div>
  )
}