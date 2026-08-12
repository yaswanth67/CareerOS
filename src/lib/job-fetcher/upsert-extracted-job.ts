import { prisma } from '@/lib/db'
import { BaseJobProvider } from '@/lib/job-providers/base'
import { findDuplicateJob, normalizeCompany } from '@/lib/job-fetcher/dedup'
import { stringifyJsonArray } from '@/lib/utils'
import { type ExtractedJob } from '@/lib/job-fetcher/url-extract'
import { type Job } from '@prisma/client'

/**
 * Classify and persist a posting pulled from a URL. Shared by the Evaluate
 * route (full fit report) and the Tools "Paste link" resolve route, so both
 * entry points save a URL-pasted job to the feed the exact same way.
 *
 * Returns the saved row (so callers can hand it to the toolkit) plus whether
 * it was newly created.
 */
export async function upsertExtractedJob(
  extracted: ExtractedJob,
  externalId: string
): Promise<{ job: Job; isNew: boolean }> {
  // Classify role/experience from the title (same heuristics the providers
  // use) so the saved job shows proper badges on the Dashboard.
  const classified = new BaseJobProvider().parseJob({
    title: extracted.title,
    location: extracted.location || '',
    description: extracted.description,
  })

  // Upsert into the feed (provider OTHER, keyed by the normalized URL) so the
  // job shows up on the Dashboard like any other job.
  const existing = await prisma.job.findUnique({
    where: { externalId_provider: { externalId, provider: 'OTHER' } },
  })

  // A posting a provider fetches already stores is the *same* job, just reached
  // a different way — refresh that row instead of adding a second one under
  // provider OTHER. Without this the same posting appeared twice, since the
  // externalId+provider key can never match a GREENHOUSE/ASHBY/… row.
  const duplicate =
    existing ??
    (await findDuplicateJob({
      title: extracted.title,
      company: extracted.company,
      location: extracted.location || 'Remote',
      applyUrl: extracted.applyUrl,
    }))

  if (duplicate) {
    const job = await prisma.job.update({
      where: { id: duplicate.id },
      data: {
        title: extracted.title,
        company: extracted.company,
        companySlug: normalizeCompany(extracted.company),
        location: extracted.location || duplicate.location,
        description: extracted.description,
        applyUrl: extracted.applyUrl,
        roleType: classified.roleType,
        experienceLevel: classified.experienceLevel,
        isActive: true,
        fetchedAt: new Date(),
      },
    })
    return { job, isNew: false }
  }

  const job = await prisma.job.create({
    data: {
      externalId,
      provider: 'OTHER',
      title: extracted.title,
      company: extracted.company,
      companySlug: normalizeCompany(extracted.company),
      location: extracted.location || 'Remote',
      isRemote: extracted.location?.toLowerCase().includes('remote') || false,
      description: extracted.description,
      requirements: stringifyJsonArray([]),
      skills: stringifyJsonArray([]),
      experienceLevel: classified.experienceLevel,
      roleType: classified.roleType,
      currency: 'USD',
      applyUrl: extracted.applyUrl,
      postedAt: new Date(),
      isActive: true,
    },
  })
  return { job, isNew: true }
}
