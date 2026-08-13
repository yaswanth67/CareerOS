import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { ApplicationCalendar } from '@/components/dashboard/ApplicationCalendar'
import { DailyGoalTracker } from '@/components/dashboard/DailyGoalTracker'
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton'
import { getCurrentUser } from '@/lib/auth'

export default async function AnalyticsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Track your application activity and daily goals
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <Suspense fallback={<DashboardSkeleton />}>
          <ApplicationCalendar />
        </Suspense>
        <Suspense fallback={<DashboardSkeleton />}>
          <DailyGoalTracker />
        </Suspense>
      </div>
    </div>
  )
}