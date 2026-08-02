import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { AppStatus } from '@/types'

const VALID_STATUSES: AppStatus[] = ['SAVED', 'APPLIED', 'INTERVIEWING', 'OFFER', 'REJECTED', 'WITHDRAWN']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the application belongs to this user
    const existing = await prisma.application.findFirst({
      where: { id, userId: user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const body = await request.json()
    const data: { status?: string; notes?: string | null } = {}

    if (typeof body.status === 'string') {
      if (!VALID_STATUSES.includes(body.status as AppStatus)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      data.status = body.status
      // Record the moment they applied if the status moved to APPLIED
      if (body.status === 'APPLIED' && !existing.appliedAt) {
        data.notes = existing.notes // keep notes; appliedAt handled below via raw update
      }
    }
    if (typeof body.notes === 'string') {
      data.notes = body.notes
    }

    // appliedAt is set on transition to APPLIED (only the first time)
    const appliedAt =
      data.status === 'APPLIED' && !existing.appliedAt ? new Date() : existing.appliedAt

    const updated = await prisma.application.update({
      where: { id },
      data: { ...data, appliedAt },
      include: {
        job: true,
        resume: { select: { id: true, title: true, roleType: true } },
      },
    })

    return NextResponse.json({ application: updated })
  } catch (error) {
    console.error('Update application error:', error)
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership before deleting
    const existing = await prisma.application.findFirst({
      where: { id, userId: user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    await prisma.application.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete application error:', error)
    return NextResponse.json({ error: 'Failed to delete application' }, { status: 500 })
  }
}
