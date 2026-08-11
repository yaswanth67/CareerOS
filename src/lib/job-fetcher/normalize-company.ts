/**
 * Canonical form of a company name for matching: accents folded away,
 * lowercased, runs of punctuation and spacing collapsed to a single hyphen.
 * "Anthropic" and "anthropic" both become "anthropic"; "SumUp" and "Sumup"
 * both become "sumup"; "Acme, Inc." and "Acme Inc" both become "acme-inc".
 *
 * Word boundaries are preserved rather than stripped, so "SumUp" ("sumup") and
 * "Sum Up" ("sum-up") stay distinct. Every casing variant actually seen in the
 * job table differs only in case, and dropping separators entirely would start
 * merging names that only look alike.
 *
 * Stored on every Job row as `companySlug` and used for deduplication — see
 * src/lib/job-fetcher/dedup.ts for why a stored column rather than a
 * case-insensitive query.
 *
 * Letters and digits are matched Unicode-aware rather than as [a-z0-9]: an
 * ASCII-only class erases a name written entirely in another script, and every
 * such company would then collide on the empty slug.
 *
 * Kept in its own module (free of any Prisma import) so scripts and the seed
 * can normalize without pulling in the app's database client.
 */
export function normalizeCompany(name: string): string {
  return (name || '')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '') // fold diacritics: "Nestlé" and "Nestle" match
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}
