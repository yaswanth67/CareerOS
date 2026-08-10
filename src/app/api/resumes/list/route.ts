import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resumes = await prisma.resume.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, updatedAt: true }
    })

    return NextResponse.json({ resumes })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch resumes'
    console.error('Resumes error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}