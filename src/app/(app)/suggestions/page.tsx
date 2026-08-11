import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { ResumeSuggestions } from '@/components/career-ops/ResumeSuggestions'
import { Wand2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function SuggestionsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  return (
    <div className="space-y-6 animate-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Wand2 className="w-6 h-6 text-primary-500" aria-hidden="true" />
          Suggestions
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Scans your resume and proposes role titles to search for — calibrated to your profile level, so
          senior / 5+ years titles are excluded.
        </p>
      </div>

      <ResumeSuggestions />
    </div>
  )
}
