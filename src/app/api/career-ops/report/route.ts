import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { getCurrentUser } from '@/lib/auth'
import { careerOpsDir } from '@/lib/career-ops'

export const runtime = 'nodejs'

// GET /api/career-ops/report?path=... — serve a career-ops report file (markdown)
// from the workspace. The path comes from the app's own tracker reader, but it is
// user-influenced data, so it is validated to resolve inside the workspace and to
// a .md file before anything is read.
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const raw = request.nextUrl.searchParams.get('path')
    if (!raw) {
      return NextResponse.json({ error: 'Missing path' }, { status: 400 })
    }

    const root = resolve(careerOpsDir())
    const target = resolve(root, raw)
    const rel = relative(root, target)
    // Block traversal outside the workspace, and non-report files.
    if (rel === '' || rel.startsWith('..') || rel.startsWith('/')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }
    if (!rel.toLowerCase().endsWith('.md')) {
      return NextResponse.json({ error: 'Invalid file' }, { status: 400 })
    }
    if (!existsSync(target) || !statSync(target).isFile()) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const content = readFileSync(target, 'utf-8')
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to read report'
    console.error('Career-ops report error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
