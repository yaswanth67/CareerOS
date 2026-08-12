import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseJsonArray, stringifyJsonArray } from '@/lib/utils'
import type { Preference } from '@prisma/client'

// A target filter is a named bundle of search criteria. Users can save several
// and pick one from the dashboard's Advanced Filters.
//
// SQLite has no array columns — list fields are stored as JSON strings.
function serialize(filter: Preference) {
  return {
    id: filter.id,
    name: filter.name,
    targetRoles: parseJsonArray<string>(filter.targetRoles),
    locations: parseJsonArray<string>(filter.locations),
    excludedKeywords: parseJsonArray<string>(filter.excludedKeywords),
    remoteOnly: filter.remoteOnly,
    visaRequired: filter.visaRequired,
    minSalary: filter.minSalary,
    createdAt: filter.createdAt,
    updatedAt: filter.updatedAt,
  }
}

interface FilterInput {
  name: string
  targetRoles: string[]
  locations: string[]
  excludedKeywords: string[]
  remoteOnly: boolean
  visaRequired: boolean
  minSalary: number | null
}

/** Validate a filter payload. Only the name is required. */
async function readInput(
  request: NextRequest
): Promise<{ data: FilterInput } | { error: string; status: number }> {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return { error: 'Invalid request body', status: 400 }
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return { error: 'Filter name is required', status: 400 }

  const minSalaryRaw = body.minSalary
  const minSalary =
    minSalaryRaw === null || minSalaryRaw === undefined || minSalaryRaw === ''
      ? null
      : Number(minSalaryRaw)

  return {
    data: {
      name,
      targetRoles: Array.isArray(body.targetRoles) ? body.targetRoles : [],
      locations: Array.isArray(body.locations) ? body.locations : [],
      excludedKeywords: Array.isArray(body.excludedKeywords) ? body.excludedKeywords : [],
      remoteOnly: Boolean(body.remoteOnly),
      visaRequired: Boolean(body.visaRequired),
      minSalary: minSalary !== null && Number.isFinite(minSalary) ? minSalary : null,
    },
  }
}

function toRow(data: FilterInput) {
  return {
    name: data.name,
    targetRoles: stringifyJsonArray(data.targetRoles),
    locations: stringifyJsonArray(data.locations),
    excludedKeywords: stringifyJsonArray(data.excludedKeywords),
    remoteOnly: data.remoteOnly,
    visaRequired: data.visaRequired,
    minSalary: data.minSalary,
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const filters = await prisma.preference.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ filters: filters.map(serialize) })
  } catch (error) {
    console.error('Get target filters error:', error)
    return NextResponse.json({ error: 'Failed to fetch filters' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const input = await readInput(request)
    if ('error' in input) {
      return NextResponse.json({ error: input.error }, { status: input.status })
    }

    const filter = await prisma.preference.create({
      data: { userId: user.id, ...toRow(input.data) },
    })

    return NextResponse.json({ filter: serialize(filter) }, { status: 201 })
  } catch (error) {
    console.error('Create target filter error:', error)
    return NextResponse.json({ error: 'Failed to create filter' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = new URL(request.url).searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Filter id is required' }, { status: 400 })
    }

    const existing = await prisma.preference.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Filter not found' }, { status: 404 })
    }

    const input = await readInput(request)
    if ('error' in input) {
      return NextResponse.json({ error: input.error }, { status: input.status })
    }

    const filter = await prisma.preference.update({
      where: { id },
      data: toRow(input.data),
    })

    return NextResponse.json({ filter: serialize(filter) })
  } catch (error) {
    console.error('Update target filter error:', error)
    return NextResponse.json({ error: 'Failed to update filter' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = new URL(request.url).searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Filter id is required' }, { status: 400 })
    }

    const deleted = await prisma.preference.deleteMany({ where: { id, userId: user.id } })
    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Filter not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete target filter error:', error)
    return NextResponse.json({ error: 'Failed to delete filter' }, { status: 500 })
  }
}
