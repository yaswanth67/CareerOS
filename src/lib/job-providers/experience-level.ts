import { ExperienceLevel } from '@/types'

/**
 * Seniority of a posting, from an explicit level field when a provider sends
 * one and otherwise from the job title.
 *
 * The title fallback is the important part: hardly any board exposes a
 * seniority field, so without it every posting fell through to MID —
 * "Staff Frontend Engineer" included. That put senior and staff roles at the
 * top of a junior candidate's matches, because nothing downstream could tell
 * them apart.
 *
 * Order matters: STAFF is checked before SENIOR so "Senior Staff Engineer"
 * lands on the higher of the two, and ENTRY last so "Junior" isn't shadowed by
 * a stray match earlier. Matching is word-boundary aware — plain
 * `includes('lead')` also fires on "leadership", and `includes('sr')` on "SRE".
 *
 * Kept free of Prisma imports so the backfill script and the seed can classify
 * without pulling in the database client (same reason as normalize-company.ts).
 */
export function classifyExperienceLevel(level: string | undefined): ExperienceLevel {
  const text = (level || '').toLowerCase()
  if (!text.trim()) return 'MID'

  const has = (pattern: RegExp) => pattern.test(text)

  // Staff/principal IC levels, plus the leadership titles that sit at least as
  // far above a mid-level candidate.
  if (
    has(/\b(staff|principal|distinguished|fellow|architect)\b/) ||
    has(/\b(director|head of|vp|vice president|chief|cto|founding)\b/) ||
    has(/\b(10\+|12\+|15\+)\s*(years?|yrs?)?\b/)
  ) {
    return 'STAFF'
  }

  if (
    has(/\b(senior|sr\.?)\b/) ||
    has(/\blead\b/) ||
    has(/\b(manager|mgr)\b/) ||
    has(/\b(5\+|6\+|7\+|8\+)\s*(years?|yrs?)?\b/)
  ) {
    return 'SENIOR'
  }

  if (
    has(/\b(entry[- ]?level|junior|jr\.?|intern|internship|graduate|new grad|apprentice|trainee|early career)\b/) ||
    has(/\b0-2\b/)
  ) {
    return 'ENTRY'
  }

  return 'MID'
}
