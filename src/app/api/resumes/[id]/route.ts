import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseJsonArray } from '@/lib/utils'
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
