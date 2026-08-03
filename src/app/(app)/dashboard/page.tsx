import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { JobList } from '@/components/dashboard/JobList'
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton'
import { getJobStats } from '@/lib/job-fetcher'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const selectedCountry = params.country as string | undefined

  const [jobStats, matchesCount, strongMatches, applicationsCount] = await Promise.all([
    getJobStats(selectedCountry),
    prisma.match.count({ where: { resume: { userId: user.id } } }),
    prisma.match.count({ where: { resume: { userId: user.id }, score: { gte: 80 } } }),
    prisma.application.count({ where: { userId: user.id } }),
  ])

  return (
    <div className="space-y-6 animate-in">
      <DashboardHeader />
      <StatsCards
        stats={{
          totalJobs: jobStats.activeJobs,
          jobsToday: jobStats.jobsToday,
          strongMatches,
          matches: matchesCount,
          applications: applicationsCount,
        }}
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <JobList searchParams={params} />
      </Suspense>
    </div>
  )
}