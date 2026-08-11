import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { US_ONLY_WHERE } from '@/lib/geo/us-location'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export const runtime = 'nodejs'

interface UnifiedJob {
  id: string
  title: string
  company: string
  location?: string
  applyUrl: string
  source: 'dashboard' | 'career-ops'
  careerOpsScore: number | null
  matchScore: number | null
  reportNumber?: number | null
  reportPath?: string | null
  evaluatedAt: string
}

function parseCareerOpsTracker(trackerPath: string): Array<{
  num: number
  date: string
  company: string
  role: string
  score: number | null
  status: string
  reportPath: string
}> {
  if (!existsSync(trackerPath)) return []
  const content = readFileSync(trackerPath, 'utf-8')
  const lines = content.trim().split('\n')
  if (lines.length < 2) return []

  // Parse header to find column indices
  const header = lines[0]
  const cols = header.split('|').map(c => c.trim()).filter(Boolean)
  const idx = {
    num: cols.indexOf('#'),
    date: cols.indexOf('Date'),
    company: cols.indexOf('Company'),
    role: cols.indexOf('Role'),
    score: cols.indexOf('Score'),
    status: cols.indexOf('Status'),
    report: cols.indexOf('Report'),
  }

  const results = []
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split('|').map(c => c.trim()).filter(Boolean)
    if (cells.length < 7) continue
    const scoreMatch = cells[idx.score]?.match(/(\d+(?:\.\d+)?)\/5/)
    results.push({
      num: parseInt(cells[idx.num], 10) || 0,
      date: cells[idx.date] || '',
      company: cells[idx.company] || '',
      role: cells[idx.role] || '',
      score: scoreMatch ? parseFloat(scoreMatch[1]) : null,
      status: cells[idx.status] || '',
      reportPath: cells[idx.report]?.replace(/^\[.*?\]\(/, '').replace(/\)$/, '') || '',
    })
  }
  return results
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const minScore = searchParams.get('minScore')
    const threshold = minScore ? parseFloat(minScore) : 0
    const resumeId = searchParams.get('resumeId') || undefined

    const careerOpsDir = process.env.CAREER_OPS_DIR || join(process.cwd(), 'career-ops')
    const trackerPath = join(careerOpsDir, 'data', 'applications.md')

    // 1. Fetch Dashboard jobs with career-ops evaluations (from Match table)
    const dashboardJobs = await prisma.job.findMany({
      where: {
        isActive: true,
        ...US_ONLY_WHERE,
        matches: {
          some: {
            resume: { userId: user.id },
            ...(resumeId ? { resumeId } : {})
          }
        }
      },
      include: {
        matches: {
          where: { resume: { userId: user.id }, ...(resumeId ? { resumeId } : {}) },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { score: true, createdAt: true, resumeId: true }
        }
      },
      orderBy: { fetchedAt: 'desc' }
    })

    const dashboardUnified: UnifiedJob[] = dashboardJobs.map(job => ({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location || undefined,
      applyUrl: job.applyUrl,
      source: 'dashboard',
      careerOpsScore: null, // Dashboard jobs don't have career-ops score unless we add it
      matchScore: job.matches[0]?.score || null,
      reportNumber: null,
      reportPath: null,
      evaluatedAt: job.matches[0]?.createdAt.toISOString() || job.fetchedAt.toISOString(),
    }))

    // 2. Fetch career-ops workspace jobs from tracker
    const trackerJobs = parseCareerOpsTracker(trackerPath)
    const careerOpsUnified: UnifiedJob[] = trackerJobs.map(t => ({
      id: `co-${t.num}`,
      title: t.role,
      company: t.company,
      location: undefined,
      applyUrl: '', // Would need to read from report file
      source: 'career-ops',
      careerOpsScore: t.score,
      matchScore: null,
      reportNumber: t.num,
      reportPath: t.reportPath ? join(careerOpsDir, t.reportPath) : null,
      evaluatedAt: t.date,
    }))

    // Merge and filter by threshold (normalize to 0-5 scale)
    const allJobs = [...dashboardUnified, ...careerOpsUnified]
    const filtered = allJobs.filter(job => {
      const rawScore = job.careerOpsScore ?? job.matchScore
      if (rawScore === null) return false
      // matchScore is 0-100, careerOpsScore is 0-5
      const normalized = job.careerOpsScore !== null ? job.careerOpsScore : rawScore / 20
      return normalized >= threshold
    })

    // Sort by normalized score desc, then date desc
    filtered.sort((a, b) => {
      const na = a.careerOpsScore !== null ? a.careerOpsScore : (a.matchScore ?? 0) / 20
      const nb = b.careerOpsScore !== null ? b.careerOpsScore : (b.matchScore ?? 0) / 20
      if (nb !== na) return nb - na
      return new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime()
    })

    return NextResponse.json({ jobs: filtered })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch jobs'
    console.error('Career-ops jobs error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}