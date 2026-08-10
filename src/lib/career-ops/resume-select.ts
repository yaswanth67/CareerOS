import { prisma } from '@/lib/db'

/**
 * Resolve which resume a career-ops run should score/generate against.
 *
 * Every career-ops mode defaults to the user's latest resume. When the caller
 * passes a `resumeId` (from the Evaluate / Evaluated resume-version picker), use
 * that version instead — but only if it actually belongs to the user, so a
 * foreign id falls back to the latest resume rather than failing.
 */
export async function getResumeForUser(userId: string, resumeId?: string | null) {
  if (resumeId) {
    const selected = await prisma.resume.findFirst({
      where: { id: resumeId, userId },
    })
    if (selected) return selected
  }
  return prisma.resume.findFirst({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  })
}
