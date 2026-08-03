'use client'

import { useEffect, useState } from 'react'
import { Target, Users, BookOpen, CheckCircle, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { format, subDays, addDays, startOfDay, isSameDay } from 'date-fns'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

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

interface DailyGoalTrackerProps {
  initialDate?: Date
}

const GOAL_TYPES = [
  {
    key: 'applications' as const,
    label: 'Applications',
    icon: Target,
    emoji: '🎯',
    color: 'blue',
    targetKey: 'applicationsTarget' as const,
    completedKey: 'applicationsCompleted' as const,
  },
  {
    key: 'networking' as const,
    label: 'Networking',
    icon: Users,
    emoji: '🤝',
    color: 'green',
    targetKey: 'networkingTarget' as const,
    completedKey: 'networkingCompleted' as const,
  },
  {
    key: 'skillLearning' as const,
    label: 'Skill Learning',
    icon: BookOpen,
    emoji: '📚',
    color: 'purple',
    targetKey: 'skillLearningTarget' as const,
    completedKey: 'skillLearningCompleted' as const,
  },
] as const

const COLOR_CLASSES: Record<string, { bg: string; text: string; border: string; ring: string }> = {
  blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800', ring: 'focus:ring-blue-500' },
  green: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', border: 'border-green-200 dark:border-green-800', ring: 'focus:ring-green-500' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800', ring: 'focus:ring-purple-500' },
}

function ProgressRing({
  progress,
  size = 60,
  strokeWidth = 6,
  color = 'blue',
}: {
  progress: number
  size?: number
  strokeWidth?: number
  color?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (progress / 100) * circumference

  const colorClasses: Record<string, string> = {
    blue: 'stroke-blue-500',
    green: 'stroke-green-500',
    purple: 'stroke-purple-500',
    orange: 'stroke-orange-500',
    red: 'stroke-red-500',
  }

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className={cn('text-gray-200 dark:text-gray-700', colorClasses[color] || 'stroke-blue-500')}
        style={{ strokeDasharray: circumference, strokeDashoffset: offset, transition: 'stroke-dashoffset 0.5s ease' }}
      />
    </svg>
  )
}

function GoalCard({
  goal,
  dailyGoal,
  onIncrement,
  onUpdateTarget,
}: {
  goal: typeof GOAL_TYPES[number]
  dailyGoal: DailyGoal
  onIncrement: (type: 'applications' | 'networking' | 'skillLearning') => void
  onUpdateTarget: (type: 'applications' | 'networking' | 'skillLearning', value: number) => void
}) {
  const target = dailyGoal[goal.targetKey]
  const completed = dailyGoal[goal.completedKey]
  const progress = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0
  const isComplete = completed >= target && target > 0
  const remaining = Math.max(0, target - completed)

  const Icon = goal.icon
  const colors = COLOR_CLASSES[goal.color]

  return (
    <div className={cn('card p-4 relative overflow-hidden', colors.bg, colors.border)}>
      {/* Emoji indicator */}
      <div className="absolute top-3 right-3 text-3xl opacity-20">
        {goal.emoji}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 relative z-10">
          <div className={cn('p-2.5 rounded-xl', colors.bg.replace('50', '100').replace('20', '30'), colors.text)}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{goal.label}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isComplete ? 'Goal achieved! 🎉' : `${remaining} more to go`}
            </p>
          </div>
        </div>

        {/* Progress Ring */}
        <div className="relative flex-shrink-0">
          <ProgressRing
            progress={progress}
            size={56}
            strokeWidth={5}
            color={isComplete ? 'green' : goal.color}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn('text-lg font-bold', isComplete ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white')}>
              {progress}%
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4 relative z-10">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className={cn('font-medium', colors.text)}>{completed} / {target}</span>
          <span className="text-gray-500 dark:text-gray-400">{isComplete ? '✓ Complete' : `${progress}%`}</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              isComplete ? 'bg-green-500' : colors.text.replace('text-', 'bg-')
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="mt-3 flex items-center justify-between gap-2 relative z-10">
        <button
          onClick={() => onIncrement(goal.key)}
          disabled={isComplete}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            isComplete
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 cursor-not-allowed'
              : `${colors.bg.replace('50', '100').replace('20', '30')} ${colors.text} hover:${colors.bg.replace('50', '200').replace('20', '40')}`
          )}
          aria-label={isComplete ? `${goal.label} goal completed` : `Increment ${goal.label.toLowerCase()}`}
        >
          {isComplete ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Done
            </>
          ) : (
            <>
              <span className="text-lg">{goal.emoji}</span>
              <span className="hidden sm:inline">+1</span>
            </>
          )}
        </button>

        <div className="flex items-center gap-1.5">
          <label htmlFor={`target-${goal.key}`} className="sr-only">
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
              'w-16 px-2 py-1.5 text-center text-sm border rounded-lg bg-white dark:bg-gray-800',
              colors.border,
              colors.text,
              colors.ring
            )}
            aria-label={`${goal.label} target`}
          />
          <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">target</span>
        </div>
      </div>
    </div>
  )
}

export function DailyGoalTracker({ initialDate }: DailyGoalTrackerProps) {
  const [currentDate, setCurrentDate] = useState(() => initialDate ? startOfDay(initialDate) : startOfDay(new Date()))
  const [dailyGoal, setDailyGoal] = useState<DailyGoal | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [streak, setStreak] = useState(0)

  const fetchDailyGoal = async () => {
    try {
      const dateStr = format(currentDate, 'yyyy-MM-dd')
      const res = await fetch(`/api/daily-goals?date=${dateStr}`)
      const data = await res.json()
      if (res.ok && data.dailyGoal) {
        setDailyGoal(data.dailyGoal)
      }
    } catch (error) {
      console.error('Failed to fetch daily goal:', error)
      toast.error('Failed to load daily goals')
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

  const handleIncrement = async (type: 'applications' | 'networking' | 'skillLearning') => {
    if (!dailyGoal) return
    if (dailyGoal[`${type}Completed`] >= dailyGoal[`${type}Target`] && dailyGoal[`${type}Target`] > 0) return

    setSaving(true)
    try {
      const dateStr = format(currentDate, 'yyyy-MM-dd')
      const res = await fetch('/api/daily-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: `increment-${type}`, date: dateStr }),
      })
      const data = await res.json()
      if (res.ok && data.dailyGoal) {
        setDailyGoal(data.dailyGoal)
        toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} progress updated!`)
        fetchStreak()
      } else {
        toast.error('Failed to update progress')
      }
    } catch {
      toast.error('Failed to update progress')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateTarget = async (type: 'applications' | 'networking' | 'skillLearning', value: number) => {
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
      toast.error('Failed to update target')
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
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
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
  const overallProgress = totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : 0
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
              {isToday && <span className="badge bg-primary-100 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400 text-xs">Today</span>}
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
            <button
              onClick={goToToday}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                isToday
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
              )}
            >
              Today
            </button>
          </div>
        </div>

        {/* Overall Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-gray-900 dark:text-white">Overall Progress</span>
            <span className={cn('font-bold', allComplete ? 'text-green-600 dark:text-green-400' : 'text-primary-600 dark:text-primary-400')}>
              {overallProgress}%
            </span>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                allComplete ? 'bg-green-500' : 'bg-primary-500'
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
            onIncrement={handleIncrement}
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
                toast.success('Progress reset for today')
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
              }).then(() => toast.success('Targets copied to tomorrow'))
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