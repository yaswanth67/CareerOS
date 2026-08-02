import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseResume } from '@/lib/resume-parser'
import { parseJsonArray, stringifyJsonArray } from '@/lib/utils'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resumesRaw = await prisma.resume.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    // Normalize JSON-string columns (skills/experience/education) for the client
    const resumes = resumesRaw.map(resume => ({
      ...resume,
      skills: parseJsonArray(resume.skills),
      experience: parseJsonArray(resume.experience),
      education: parseJsonArray(resume.education),
    }))

    return NextResponse.json({ resumes })
  } catch (error) {
    console.error('Get resumes error:', error)
    return NextResponse.json({ error: 'Failed to fetch resumes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      // File upload - parse and return parsed data for review
      const formData = await request.formData()
      const file = formData.get('file') as File

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }

      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const parsed = await parseResume(buffer, file.name)

      // Save file to disk
      const uploadDir = process.env.UPLOAD_DIR || './public/uploads'
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const filePath = path.join(uploadDir, fileName)

      // Ensure upload directory exists
      await mkdir(uploadDir, { recursive: true })
      await writeFile(filePath, buffer)

      return NextResponse.json({
        resume: {
          title: parsed.title || file.name.replace(/\.[^/.]+$/, ''),
          roleType: parsed.roleType || 'SDE',
          fileName: file.name,
          filePath,
          parsedText: parsed.text,
          skills: parsed.skills,
          experience: parsed.experience,
          education: parsed.education,
        },
      })
    } else {
      // JSON - save parsed resume
      const body = await request.json()
      const { title, roleType, fileName, filePath, parsedText, skills, experience, education } = body

      const resume = await prisma.resume.create({
        data: {
          userId: user.id,
          title,
          roleType,
          fileName,
          filePath,
          parsedText,
          skills: stringifyJsonArray(skills),
          experience: stringifyJsonArray(experience),
          education: stringifyJsonArray(education),
        },
      })

      return NextResponse.json({
        resume: {
          ...resume,
          skills: parseJsonArray(resume.skills),
          experience: parseJsonArray(resume.experience),
          education: parseJsonArray(resume.education),
        },
      }, { status: 201 })
    }
  } catch (error) {
    console.error('Create resume error:', error)
    return NextResponse.json({ error: 'Failed to create resume' }, { status: 500 })
  }
}