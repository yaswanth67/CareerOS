import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseJsonArray } from '@/lib/utils'

// GET /api/jobs/[id]/similar — up to 5 other active jobs of the same role type,
// ranked by skill overlap with this one, excluding the job itself and anything
// the user already applied to. Includes the user's match score so the drawer can
// show how well each similar job fits.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const job = await prisma.job.findUnique({ where: { id } })
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const jobSkills = (parseJsonArray(job.skills) as string[]).map(s => s.trim().toLowerCase()).filter(Boolean)

    // Exclude the current job and anything already applied to.
    const appliedJobs = await prisma.application.findMany({
      where: { userId: user.id },
      select: { jobId: true },
    })
    const excluded = new Set([job.id, ...appliedJobs.map(a => a.jobId)])

    // Same role type, active, newest pool first; overlap is computed in JS below.
    const candidates = await prisma.job.findMany({
      where: {
        roleType: job.roleType,
        isActive: true,
        id: { notIn: Array.from(excluded) },
      },
      orderBy: { postedAt: 'desc' },
      take: 300,
      include: {
        matches: { where: { resume: { userId: user.id } }, select: { score: true } },
      },
    })

    // Rank by how many skills the candidate shares with this job — absolute
    // shared count first (a job covering 7 of the same skills is a real match,
    // even if its list is long), then by ratio so a tight overlap wins ties,
    // then newest. Exclude jobs that share nothing.
    const similar = candidates
      .map(c => {
        const cSkills = (parseJsonArray(c.skills) as string[]).map(s => s.trim().toLowerCase()).filter(Boolean)
        const shared = cSkills.filter(s =>
          jobSkills.some(js => js === s || js.includes(s) || s.includes(js))
        ).length
        return {
          id: c.id,
          title: c.title,
          company: c.company,
          location: c.location,
          isRemote: c.isRemote,
          salaryMin: c.salaryMin,
          salaryMax: c.salaryMax,
          postedAt: c.postedAt,
          roleType: c.roleType,
          experienceLevel: c.experienceLevel,
          matchScore: c.matches[0]?.score ?? null,
          overlap: cSkills.length ? shared / cSkills.length : 0,
          shared,
        }
      })
      .filter(c => c.shared > 0)
      .sort(
        (a, b) =>
          b.shared - a.shared ||
          b.overlap - a.overlap ||
          new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
      )
      .slice(0, 5)
      .map(({ shared: _shared, ...rest }) => rest)

    return NextResponse.json({ similar })
  } catch (error) {
    console.error('Similar jobs error:', error)
    return NextResponse.json({ error: 'Failed to find similar jobs' }, { status: 500 })
  }
}
