import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { AITabs } from '@/components/career-ops/AITabs'
import { Sparkles } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AIPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const params = await searchParams
  const initialTab = params.tab === 'evaluate' ? 'evaluate' : 'suggestions'

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary-500" aria-hidden="true" />
          AI Career
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Scan your resume to discover which roles to target, or paste a job posting and get the full
          A–G evaluation against your resume — all in one place.
        </p>
      </div>

      <AITabs initialTab={initialTab} />
    </div>
  )
}
