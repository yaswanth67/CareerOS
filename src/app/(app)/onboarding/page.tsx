import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow'

// Only accept internal paths as a post-refresh destination — blocks open
// redirects and protocol-relative URLs.
const isSafeInternalPath = (p: string | undefined): boolean =>
  !!p && p.startsWith('/') && !p.startsWith('//') && !p.startsWith('/_') && !p.includes('..')

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const params = await searchParams
  const next = typeof params.next === 'string' && isSafeInternalPath(params.next) ? params.next : '/dashboard'

  const resumeCount = await prisma.resume.count({ where: { userId: user.id } })

  return (
    <Suspense fallback={null}>
      <OnboardingFlow hasResume={resumeCount > 0} nextPath={next} />
    </Suspense>
  )
}
