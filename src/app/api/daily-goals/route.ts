import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { startOfDay, endOfDay, format, subDays } from 'date-fns'

// `new Date('2026-08-12')` parses as UTC midnight, which rolls back to the
// *previous* local day in any negative-offset timezone — so "today" was being
// stored and read as yesterday. Parse `yyyy-MM-dd` as a local midnight instead.
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd')
    const date = parseLocalDate(dateParam)

    // Check if this is a streak request
    if (searchParams.get('streak') === 'true') {
      const streak = await calculateStreak(user.id)
      return NextResponse.json({ streak })
    }

    let dailyGoal = await prisma.dailyGoal.findUnique({
      where: {
        userId_date: {
          userId: user.id,
          date: startOfDay(date),
        },
      },
    })

    // If no daily goal exists for this date, create a default one
    if (!dailyGoal) {
      dailyGoal = await prisma.dailyGoal.create({
        data: {
          userId: user.id,
          date: startOfDay(date),
          applicationsTarget: 3,
          applicationsCompleted: 0,
          networkingTarget: 1,
          networkingCompleted: 0,
          skillLearningTarget: 1,
          skillLearningCompleted: 0,
        },
      })
    }

    // Also get application count for today
    const applicationsToday = await prisma.application.count({
      where: {
        userId: user.id,
        createdAt: {
          gte: startOfDay(date),
          lte: endOfDay(date),
        },
      },
    })

    // Update completed count based on actual applications
    if (applicationsToday !== dailyGoal.applicationsCompleted) {
      dailyGoal = await prisma.dailyGoal.update({
        where: { id: dailyGoal.id },
        data: { applicationsCompleted: applicationsToday },
      })
    }

    return NextResponse.json({
      dailyGoal: {
        ...dailyGoal,
        date: format(dailyGoal.date, 'yyyy-MM-dd'),
      },
    })
  } catch (error) {
    console.error('Error fetching daily goal:', error)
    return NextResponse.json({ error: 'Failed to fetch daily goal' }, { status: 500 })
  }
}

async function calculateStreak(userId: string): Promise<number> {
  try {
    // Get all daily goals for the user, ordered by date descending
    const dailyGoals = await prisma.dailyGoal.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      select: {
        date: true,
        applicationsCompleted: true,
        applicationsTarget: true,
        networkingCompleted: true,
        networkingTarget: true,
        skillLearningCompleted: true,
        skillLearningTarget: true,
      },
    })

    if (dailyGoals.length === 0) return 0

    let streak = 0
    const today = startOfDay(new Date())
    let checkDate = today

    // Check if today has any progress (or if we should start from yesterday)
    const todayGoal = dailyGoals.find(g => format(g.date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'))
    const hasTodayProgress = todayGoal && (
      todayGoal.applicationsCompleted > 0 ||
      todayGoal.networkingCompleted > 0 ||
      todayGoal.skillLearningCompleted > 0
    )

    if (!hasTodayProgress) {
      checkDate = subDays(today, 1)
    }

    // Count consecutive days with at least some progress
    for (const goal of dailyGoals) {
      const goalDate = startOfDay(goal.date)
      if (goalDate.getTime() !== checkDate.getTime()) {
        // Gap in dates - streak broken
        break
      }

      const hasProgress = goal.applicationsCompleted > 0 ||
        goal.networkingCompleted > 0 ||
        goal.skillLearningCompleted > 0

      if (hasProgress) {
        streak++
        checkDate = subDays(checkDate, 1)
      } else {
        break
      }
    }

    return streak
  } catch {
    return 0
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { date, applicationsTarget, applicationsCompleted, networkingTarget, networkingCompleted, skillLearningTarget, skillLearningCompleted } = body

    const targetDate = date ? parseLocalDate(date) : new Date()

    const dailyGoal = await prisma.dailyGoal.upsert({
      where: {
        userId_date: {
          userId: user.id,
          date: startOfDay(targetDate),
        },
      },
      update: {
        applicationsTarget: applicationsTarget ?? undefined,
        applicationsCompleted: applicationsCompleted ?? undefined,
        networkingTarget: networkingTarget ?? undefined,
        networkingCompleted: networkingCompleted ?? undefined,
        skillLearningTarget: skillLearningTarget ?? undefined,
        skillLearningCompleted: skillLearningCompleted ?? undefined,
      },
      create: {
        userId: user.id,
        date: startOfDay(targetDate),
        applicationsTarget: applicationsTarget ?? 3,
        applicationsCompleted: applicationsCompleted ?? 0,
        networkingTarget: networkingTarget ?? 1,
        networkingCompleted: networkingCompleted ?? 0,
        skillLearningTarget: skillLearningTarget ?? 1,
        skillLearningCompleted: skillLearningCompleted ?? 0,
      },
    })

    return NextResponse.json({
      dailyGoal: {
        ...dailyGoal,
        date: format(dailyGoal.date, 'yyyy-MM-dd'),
      },
    })
  } catch (error) {
    console.error('Error updating daily goal:', error)
    return NextResponse.json({ error: 'Failed to update daily goal' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, date } = body

    const targetDate = date ? parseLocalDate(date) : new Date()

    // The client sends `increment-${type}` where skill learning's type is
    // camelCase (`increment-skillLearning`). Normalize to the kebab-case the
    // handlers below check against, so the button works for all three goals.
    const normalizedAction = String(action ?? '').replace('skillLearning', 'skill-learning')

    if (normalizedAction === 'increment-applications') {
      const dailyGoal = await prisma.dailyGoal.upsert({
        where: {
          userId_date: {
            userId: user.id,
            date: startOfDay(targetDate),
          },
        },
        update: {
          applicationsCompleted: { increment: 1 },
        },
        create: {
          userId: user.id,
          date: startOfDay(targetDate),
          applicationsTarget: 3,
          applicationsCompleted: 1,
          networkingTarget: 1,
          networkingCompleted: 0,
          skillLearningTarget: 1,
          skillLearningCompleted: 0,
        },
      })

      return NextResponse.json({
        dailyGoal: {
          ...dailyGoal,
          date: format(dailyGoal.date, 'yyyy-MM-dd'),
        },
      })
    }

    if (normalizedAction === 'increment-networking') {
      const dailyGoal = await prisma.dailyGoal.upsert({
        where: {
          userId_date: {
            userId: user.id,
            date: startOfDay(targetDate),
          },
        },
        update: {
          networkingCompleted: { increment: 1 },
        },
        create: {
          userId: user.id,
          date: startOfDay(targetDate),
          applicationsTarget: 3,
          applicationsCompleted: 0,
          networkingTarget: 1,
          networkingCompleted: 1,
          skillLearningTarget: 1,
          skillLearningCompleted: 0,
        },
      })

      return NextResponse.json({
        dailyGoal: {
          ...dailyGoal,
          date: format(dailyGoal.date, 'yyyy-MM-dd'),
        },
      })
    }

    if (normalizedAction === 'increment-skill-learning') {
      const dailyGoal = await prisma.dailyGoal.upsert({
        where: {
          userId_date: {
            userId: user.id,
            date: startOfDay(targetDate),
          },
        },
        update: {
          skillLearningCompleted: { increment: 1 },
        },
        create: {
          userId: user.id,
          date: startOfDay(targetDate),
          applicationsTarget: 3,
          applicationsCompleted: 0,
          networkingTarget: 1,
          networkingCompleted: 0,
          skillLearningTarget: 1,
          skillLearningCompleted: 1,
        },
      })

      return NextResponse.json({
        dailyGoal: {
          ...dailyGoal,
          date: format(dailyGoal.date, 'yyyy-MM-dd'),
        },
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error incrementing daily goal:', error)
    return NextResponse.json({ error: 'Failed to increment daily goal' }, { status: 500 })
  }
}