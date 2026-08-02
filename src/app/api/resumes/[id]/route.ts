import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseJsonArray, stringifyJsonArray } from '@/lib/utils'
import { Prisma } from '@prisma/client'
import { unlink } from 'fs/promises'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resume = await prisma.resume.findFirst({
      where: { id, userId: user.id },
    })

    if (!resume) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
    }

    return NextResponse.json({
      resume: {
        ...resume,
        skills: parseJsonArray(resume.skills),
        experience: parseJsonArray(resume.experience),
        education: parseJsonArray(resume.education),
      },
    })
  } catch (error) {
    console.error('Get resume error:', error)
    return NextResponse.json({ error: 'Failed to fetch resume' }, { status: 500 })
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

    const resume = await prisma.resume.findFirst({
      where: { id, userId: user.id },
    })

    if (!resume) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
    }

    // Delete the uploaded file if it exists on disk (ignore failures)
    if (resume.filePath && resume.filePath.startsWith('/uploads/')) {
      try {
        const fullPath = path.join(process.cwd(), 'public', resume.filePath)
        await unlink(fullPath)
      } catch {
        // File may already be gone — continue with the DB delete
      }
    }

    // Cascade deletes matches & applications via the Resume relation
    await prisma.resume.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete resume error:', error)
    return NextResponse.json({ error: 'Failed to delete resume' }, { status: 500 })
  }
}

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

    const resume = await prisma.resume.findFirst({
      where: { id, userId: user.id },
    })

    if (!resume) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
    }

    const body = await request.json()
    const data: Prisma.ResumeUpdateInput = {}

    if (typeof body.title === 'string' && body.title.trim()) {
      data.title = body.title.trim()
    }
    if (typeof body.roleType === 'string') {
      data.roleType = body.roleType
    }
    // Array fields are stored as JSON strings (SQLite has no array columns)
    if (Array.isArray(body.skills)) data.skills = stringifyJsonArray(body.skills)
    if (Array.isArray(body.experience)) data.experience = stringifyJsonArray(body.experience)
    if (Array.isArray(body.education)) data.education = stringifyJsonArray(body.education)

    const updated = await prisma.resume.update({
      where: { id },
      data,
    })

    return NextResponse.json({
      resume: {
        ...updated,
        skills: parseJsonArray(updated.skills),
        experience: parseJsonArray(updated.experience),
        education: parseJsonArray(updated.education),
      },
    })
  } catch (error) {
    console.error('Update resume error:', error)
    return NextResponse.json({ error: 'Failed to update resume' }, { status: 500 })
  }
}
