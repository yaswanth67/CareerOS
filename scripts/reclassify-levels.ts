// Experience-level reclassification and match rescoring.
//
// Two defects left the level field useless and the match ranking wrong:
//
//   1. Providers rarely send a seniority field, and `parseExperienceLevel` was
//      never given the job title as a fallback (unlike `parseRoleType`), so
//      99% of stored jobs defaulted to MID — "Staff Frontend Engineer" too.
//   2. The scorer compared the resume against the *job's* level keywords rather
//      than comparing the candidate's level to the job's, so seniority barely
//      moved the ranking and never penalised an out-of-reach role.
//
// Both are fixed at the source (src/lib/job-providers/base.ts and
// src/lib/ai-matcher). This script repairs rows written before that: it
// re-derives `experienceLevel` from each title, then rescores existing matches,
// which `autoScoreUserJobs` will not do — it only scores jobs with no match yet.
//
// Usage:
//   npm run reclassify:levels                    # dry run, reports only
//   npm run reclassify:levels -- --apply         # write levels
//   npm run reclassify:levels -- --apply --rescore   # …and rescore matches
import { prisma } from '@/lib/db'
import { batchScoreJobsHeuristic } from '@/lib/ai-matcher'
import { parseJsonArray, stringifyJsonArray } from '@/lib/utils'
import { classifyExperienceLevel } from '@/lib/job-providers/experience-level'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const rescore = args.includes('--rescore')

async function reclassify() {
  const jobs = await prisma.job.findMany({
    select: { id: true, title: true, experienceLevel: true },
  })

  const changes = new Map<string, string[]>()
  const updates: Array<{ id: string; level: string }> = []

  for (const job of jobs) {
    const level = classifyExperienceLevel(job.title)
    if (level === job.experienceLevel) continue
    updates.push({ id: job.id, level })
    const key = `${job.experienceLevel} -> ${level}`
    const bucket = changes.get(key) ?? []
    if (bucket.length < 3) bucket.push(job.title)
    changes.set(key, bucket)
  }

  console.log(`Scanned ${jobs.length} jobs; ${updates.length} need a new level.\n`)
  for (const [transition, samples] of [...changes.entries()].sort()) {
    const count = updates.filter(
      u => `${jobs.find(j => j.id === u.id)?.experienceLevel} -> ${u.level}` === transition
    ).length
    console.log(`  ${String(count).padStart(5)}  ${transition}`)
    for (const s of samples) console.log(`           e.g. ${s.slice(0, 70)}`)
  }

  if (!apply) {
    console.log('\nDry run — pass --apply to write these levels.')
    return 0
  }

  // Grouped by target level so this is four updateMany calls, not thousands.
  for (const level of ['ENTRY', 'MID', 'SENIOR', 'STAFF']) {
    const ids = updates.filter(u => u.level === level).map(u => u.id)
    const CHUNK = 500
    for (let i = 0; i < ids.length; i += CHUNK) {
      await prisma.job.updateMany({
        where: { id: { in: ids.slice(i, i + CHUNK) } },
        data: { experienceLevel: level },
      })
    }
  }
  console.log(`\nUpdated ${updates.length} job levels.`)
  return updates.length
}

async function rescoreMatches() {
  const resumes = await prisma.resume.findMany()
  let total = 0

  for (const resume of resumes) {
    const matches = await prisma.match.findMany({
      where: { resumeId: resume.id, job: { isActive: true } },
      include: { job: true },
    })
    if (matches.length === 0) continue

    const results = await batchScoreJobsHeuristic(
      resume.parsedText,
      parseJsonArray<string>(resume.skills),
      matches.map(m => ({
        id: m.job.id,
        title: m.job.title,
        company: m.job.company,
        description: m.job.description,
        skills: parseJsonArray<string>(m.job.skills),
        experienceLevel: m.job.experienceLevel,
        roleType: m.job.roleType,
      }))
    )

    let moved = 0
    for (const match of matches) {
      const next = results.get(match.job.id)
      if (!next || next.score === match.score) continue
      await prisma.match.update({
        where: { id: match.id },
        data: {
          score: next.score,
          reasoning: next.reasoning,
          matchedSkills: stringifyJsonArray(next.matchedSkills),
          missingSkills: stringifyJsonArray(next.missingSkills),
        },
      })
      moved++
    }
    console.log(`  resume "${resume.title}": ${moved} of ${matches.length} scores changed`)
    total += moved
  }
  return total
}

async function main() {
  console.log(apply ? 'Reclassifying experience levels...' : 'Dry run — nothing will be written.\n')
  await reclassify()

  if (rescore) {
    if (!apply) {
      console.log('\n--rescore needs --apply; skipping.')
      return
    }
    console.log('\nRescoring existing matches against the corrected levels...')
    const n = await rescoreMatches()
    console.log(`\nRescored ${n} matches.`)
  }
}

main()
  .catch(error => {
    console.error('Reclassification failed:', error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
