import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseJsonArray, stringifyJsonArray } from '@/lib/utils'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const preferences = await prisma.preference.findUnique({
      where: { userId: user.id },
    })

    if (!preferences) {
      return NextResponse.json({ preferences: null })
    }

    // Normalize JSON-string columns for the client
    return NextResponse.json({
      preferences: {
        ...preferences,
        targetRoles: parseJsonArray(preferences.targetRoles),
        locations: parseJsonArray(preferences.locations),
        excludedKeywords: parseJsonArray(preferences.excludedKeywords),
      },
    })
  } catch (error) {
    console.error('Get preferences error:', error)
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      targetRoles,
      locations,
      remoteOnly,
      visaRequired,
      minSalary,
      excludedKeywords,
    } = body

    // SQLite has no array type — store list fields as JSON strings.
    const preferences = await prisma.preference.upsert({
      where: { userId: user.id },
      update: {
        targetRoles: stringifyJsonArray(targetRoles),
        locations: stringifyJsonArray(locations),
        remoteOnly,
        visaRequired,
        minSalary,
        excludedKeywords: stringifyJsonArray(excludedKeywords),
      },
      create: {
        userId: user.id,
        targetRoles: stringifyJsonArray(targetRoles),
        locations: stringifyJsonArray(locations),
        remoteOnly: remoteOnly || false,
        visaRequired: visaRequired || false,
        minSalary,
        excludedKeywords: stringifyJsonArray(excludedKeywords),
      },
    })

    // Normalize for the client
    return NextResponse.json({
      preferences: {
        ...preferences,
        targetRoles: parseJsonArray(preferences.targetRoles),
        locations: parseJsonArray(preferences.locations),
        excludedKeywords: parseJsonArray(preferences.excludedKeywords),
      },
    })
  } catch (error) {
    console.error('Update preferences error:', error)
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
  }
}