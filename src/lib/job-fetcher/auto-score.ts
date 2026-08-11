import { prisma } from '@/lib/db'
import { US_ONLY_WHERE } from '@/lib/geo/us-location'
import { batchScoreJobsHeuristic } from '@/lib/ai-matcher'
import { parseJsonArray, stringifyJsonArray } from '@/lib/utils'

/**
 * Automatically score the user's jobs against their most recent resume using
 * the fast heuristic scorer (no LLM calls). Only scores jobs that don't have a
 * match yet, so repeated fetches stay cheap and incremental.
 *
 * Matches are written with a single bulk createMany (SQLite doesn't support
 * skipDuplicates, so callers are expected to be serialized per user).
 *
 * Returns the number of jobs newly scored.
 */
export async function autoScoreUserJobs(userId: string): Promise<number> {
  const resume = await prisma.resume.findFirst({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  })
  if (!resume) return 0

  const unscoredJobs = await prisma.job.findMany({
    where: {
      isActive: true,
      // No point spending scoring passes on jobs the app will never show.
      ...US_ONLY_WHERE,
      matches: { none: { resumeId: resume.id } },
    },
    orderBy: { postedAt: 'desc' },
  })

  if (unscoredJobs.length === 0) return 0

  const results = await batchScoreJobsHeuristic(
    resume.parsedText,
    parseJsonArray(resume.skills) as string[],
    unscoredJobs.map(job => ({
      id: job.id,
      title: job.title,
      company: job.company,
      description: job.description,
      skills: parseJsonArray(job.skills) as string[],
      experienceLevel: job.experienceLevel,
      roleType: job.roleType,
    }))
  )

  const rows = []
  for (const job of unscoredJobs) {
    const result = results.get(job.id)
    if (!result) continue
    rows.push({
      jobId: job.id,
      resumeId: resume.id,
      score: result.score,
      reasoning: result.reasoning,
      matchedSkills: stringifyJsonArray(result.matchedSkills),
      missingSkills: stringifyJsonArray(result.missingSkills),
    })
  }

  if (rows.length === 0) return 0

  // Insert in chunks to keep the single SQLite writer happy.
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    await prisma.match.createMany({ data: rows.slice(i, i + CHUNK) })
  }

  return rows.length
}

/**
 * Auto-score for every user that has a resume. Used by the cron job so
 * background fetches keep everyone's job scores fresh.
 */
export async function autoScoreAllUsers(): Promise<{ userId: string; scored: number }[]> {
  const usersWithResumes = await prisma.user.findMany({
    where: { resumes: { some: {} } },
    select: { id: true },
  })

  const results: { userId: string; scored: number }[] = []
  for (const user of usersWithResumes) {
    const scored = await autoScoreUserJobs(user.id)
    results.push({ userId: user.id, scored })
  }
  return results
}
