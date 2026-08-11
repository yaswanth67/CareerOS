import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { startOfMonth, endOfMonth, format, eachDayOfInterval } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || format(new Date(), 'yyyy'))
    const month = parseInt(searchParams.get('month') || format(new Date(), 'MM'))

    const startDate = startOfMonth(new Date(year, month - 1))
    const endDate = endOfMonth(new Date(year, month - 1))

    // Fetch all applications for the month
    const applications = await prisma.application.findMany({
      where: {
        userId: user.id,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        appliedAt: true,
        job: {
          select: {
            id: true,
            title: true,
            company: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Group by date
    const applicationsByDate: Record<string, typeof applications> = {}

    for (const app of applications) {
      const dateKey = format(app.createdAt, 'yyyy-MM-dd')
      if (!applicationsByDate[dateKey]) {
        applicationsByDate[dateKey] = []
      }
      applicationsByDate[dateKey].push(app)
    }

    // Generate calendar data for the month
    const days = eachDayOfInterval({ start: startDate, end: endDate })
    const calendarData = days.map(day => {
      const dateKey = format(day, 'yyyy-MM-dd')
      const dayApps = applicationsByDate[dateKey] || []

      // Count by status
      const counts = {
        total: dayApps.length,
        SAVED: dayApps.filter(a => a.status === 'SAVED').length,
        APPLIED: dayApps.filter(a => a.status === 'APPLIED').length,
        INTERVIEWING: dayApps.filter(a => a.status === 'INTERVIEWING').length,
        OFFER: dayApps.filter(a => a.status === 'OFFER').length,
        REJECTED: dayApps.filter(a => a.status === 'REJECTED').length,
        WITHDRAWN: dayApps.filter(a => a.status === 'WITHDRAWN').length,
      }

      // Determine the dominant status for color coding
      let dominantStatus: string | null = null
      let maxCount = 0
      for (const [status, count] of Object.entries(counts)) {
        if (status !== 'total' && count > maxCount) {
          maxCount = count
          dominantStatus = status
        }
      }

      return {
        date: dateKey,
        day: day.getDate(),
        isCurrentMonth: day.getMonth() === month - 1,
        isToday: format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'),
        applications: dayApps.map(a => ({
          id: a.id,
          status: a.status,
          title: a.job.title,
          company: a.job.company,
          appliedAt: a.appliedAt ? format(a.appliedAt, 'yyyy-MM-dd') : null,
        })),
        counts,
        dominantStatus,
        hasApplications: dayApps.length > 0,
      }
    })

    // Get monthly summary
    const monthlyCounts = {
      total: applications.length,
      SAVED: applications.filter(a => a.status === 'SAVED').length,
      APPLIED: applications.filter(a => a.status === 'APPLIED').length,
      INTERVIEWING: applications.filter(a => a.status === 'INTERVIEWING').length,
      OFFER: applications.filter(a => a.status === 'OFFER').length,
      REJECTED: applications.filter(a => a.status === 'REJECTED').length,
      WITHDRAWN: applications.filter(a => a.status === 'WITHDRAWN').length,
    }

    return NextResponse.json({
      calendar: calendarData,
      summary: monthlyCounts,
      year,
      month,
    })
  } catch (error) {
    console.error('Error fetching application calendar:', error)
    return NextResponse.json({ error: 'Failed to fetch application calendar' }, { status: 500 })
  }
}