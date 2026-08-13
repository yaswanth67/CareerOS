'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { cn } from '@/lib/utils'

// The API sends day keys as `yyyy-MM-dd`. `new Date('2026-08-12')` parses that
// as UTC midnight, which lands on the *previous* local day in any negative-offset
// timezone — clicking Aug 12 rendered the heading "Tuesday, August 11". Parse it
// as a local midnight instead. Mirrors parseLocalDate in the daily-goals route.
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

interface ApplicationCalendarProps {
  year?: number
  month?: number
  onDateClick?: (date: string, applications: Array<{ id: string; status: string; title: string; company: string }>) => void
}

const STATUS_COLORS: Record<string, string> = {
  SAVED: 'bg-blue-400',
  APPLIED: 'bg-green-400',
  INTERVIEWING: 'bg-yellow-400',
  OFFER: 'bg-purple-400',
  REJECTED: 'bg-red-400',
  WITHDRAWN: 'bg-gray-400',
}

const STATUS_LABELS: Record<string, string> = {
  SAVED: 'Saved',
  APPLIED: 'Applied',
  INTERVIEWING: 'Interviewing',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
}

const STATUS_EMOJIS: Record<string, string> = {
  SAVED: '💾',
  APPLIED: '📤',
  INTERVIEWING: '💬',
  OFFER: '🎉',
  REJECTED: '😔',
  WITHDRAWN: '↩️',
}

interface CalendarDay {
  date: string
  day: number
  isCurrentMonth: boolean
  isToday: boolean
  applications: Array<{ id: string; status: string; title: string; company: string; appliedAt: string | null }>
  counts: Record<string, number>
  dominantStatus: string | null
  hasApplications: boolean
}

interface CalendarData {
  calendar: CalendarDay[]
  summary: Record<string, number>
  year: number
  month: number
}

export function ApplicationCalendar({ year: initialYear, month: initialMonth, onDateClick }: ApplicationCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date(initialYear || new Date().getFullYear(), (initialMonth || new Date().getMonth() + 1) - 1))
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedApps, setSelectedApps] = useState<Array<{ id: string; status: string; title: string; company: string }>>([])

  const fetchCalendar = useCallback(async () => {
    try {
      const res = await fetch(`/api/applications/calendar?year=${currentDate.getFullYear()}&month=${currentDate.getMonth() + 1}`)
      const data = await res.json()
      if (res.ok) {
        setCalendarData(data)
      }
    } catch (error) {
      console.error('Failed to fetch calendar:', error)
    } finally {
      setLoading(false)
    }
  }, [currentDate])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    fetchCalendar()
  }, [fetchCalendar])

  const goToPreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1))
    setSelectedDate(null)
    setSelectedApps([])
  }

  const goToNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1))
    setSelectedDate(null)
    setSelectedApps([])
  }

  const goToCurrentMonth = () => {
    setCurrentDate(new Date())
    setSelectedDate(null)
    setSelectedApps([])
  }

  const handleDayClick = (dayData: CalendarDay) => {
    if (!dayData.isCurrentMonth) return
    if (selectedDate === dayData.date) {
      setSelectedDate(null)
      setSelectedApps([])
    } else {
      setSelectedDate(dayData.date)
      setSelectedApps(dayData.applications)
      onDateClick?.(dayData.date, dayData.applications)
    }
  }

  const getIntensityColor = (count: number): string => {
    if (count === 0) return 'bg-gray-100 dark:bg-gray-800'
    if (count === 1) return 'bg-green-100 dark:bg-green-900/30'
    if (count === 2) return 'bg-green-200 dark:bg-green-900/50'
    if (count === 3) return 'bg-green-300 dark:bg-green-900/70'
    return 'bg-green-400 dark:bg-green-900'
  }

  if (loading && !calendarData) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!calendarData) {
    return (
      <div className="card p-6">
        <p className="text-center text-gray-500 dark:text-gray-400">Failed to load calendar</p>
      </div>
    )
  }

  const monthName = format(currentDate, 'MMMM yyyy')
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="card">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousMonth}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="font-semibold text-gray-900 dark:text-white text-lg min-w-[160px] text-center">
              {monthName}
            </h2>
            <button
              onClick={goToNextMonth}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={goToCurrentMonth}
            className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
          >
            Today
          </button>
        </div>
      </div>

      {/* Monthly summary + intensity legend. Above the grid so the month's
          numbers and the dot key are read before the days they describe —
          below the grid they sat under the fold once a day was selected. */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 space-y-2">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {(['SAVED', 'APPLIED', 'INTERVIEWING', 'OFFER', 'REJECTED', 'WITHDRAWN'] as const).map(status => {
            const count = calendarData.summary[status] || 0
            if (count === 0) return null
            return (
              <span
                key={status}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                  STATUS_COLORS[status] + '/20 text-' + STATUS_COLORS[status].replace('bg-', '') + '-700 dark:text-' + STATUS_COLORS[status].replace('bg-', '') + '-300'
                )}
              >
                <span className="text-base">{STATUS_EMOJIS[status]}</span>
                {STATUS_LABELS[status]}: {count}
              </span>
            )
          })}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Total this month: <span className="font-medium text-gray-900 dark:text-white">{calendarData.summary.total}</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700" />
            <span>No activity</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-100 dark:bg-green-900/30" />
            <span>1</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-200 dark:bg-green-900/50" />
            <span>2</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-300 dark:bg-green-900/70" />
            <span>3</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-400 dark:bg-green-900" />
            <span>4+</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-4">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {calendarData.calendar.map((day) => (
            <button
              key={day.date}
              onClick={() => handleDayClick(day)}
              className={cn(
                'relative h-11 rounded-lg transition-all',
                'flex flex-col items-center justify-center',
                day.isCurrentMonth
                  ? 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700'
                  : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800',
                day.isToday && 'ring-2 ring-primary-500',
                selectedDate === day.date && 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-gray-900',
                day.hasApplications && 'cursor-pointer hover:border-primary-300 dark:hover:border-primary-700',
                !day.isCurrentMonth && 'text-gray-300 dark:text-gray-600'
              )}
              disabled={!day.isCurrentMonth}
              aria-label={`${day.date}: ${day.counts.total} application${day.counts.total !== 1 ? 's' : ''}`}
            >
              <span className={cn(
                'text-sm font-medium leading-none -mt-0.5',
                day.isToday ? 'text-primary-600 dark:text-primary-400' : 'text-gray-900 dark:text-white',
                !day.isCurrentMonth && 'text-gray-300 dark:text-gray-600'
              )}>
                {day.day}
              </span>

              {/* Contribution indicator - GitHub style */}
              {day.isCurrentMonth && day.counts.total > 0 && (
                <div
                  className={cn(
                    'absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full',
                    getIntensityColor(day.counts.total)
                  )}
                  title={`${day.counts.total} application${day.counts.total !== 1 ? 's' : ''}`}
                />
              )}

              {/* Status indicator dot */}
              {day.isCurrentMonth && day.dominantStatus && day.counts.total > 0 && (
                <div
                  className={cn(
                    'absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full',
                    STATUS_COLORS[day.dominantStatus]
                  )}
                  title={STATUS_LABELS[day.dominantStatus]}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Day Details */}
      {selectedDate && selectedApps.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900 dark:text-white">
              {format(parseLocalDate(selectedDate), 'EEEE, MMMM d, yyyy')}
            </h3>
            <button
              onClick={() => { setSelectedDate(null); setSelectedApps([]) }}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Close
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {selectedApps.map(app => (
              <div
                key={app.id}
                className="flex items-center gap-2 p-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <span className={cn(
                  'w-2 h-2 rounded-full flex-shrink-0',
                  STATUS_COLORS[app.status]
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{app.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{app.company}</p>
                </div>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full font-medium',
                  STATUS_COLORS[app.status] + '/20 text-' + STATUS_COLORS[app.status].replace('bg-', '') + '-700 dark:text-' + STATUS_COLORS[app.status].replace('bg-', '') + '-300'
                )}>
                  {STATUS_EMOJIS[app.status]} {STATUS_LABELS[app.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}