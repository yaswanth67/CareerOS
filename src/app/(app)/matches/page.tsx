import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { BestMatchedJobsList } from '@/components/career-ops/BestMatchedJobsList'
import { Star } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function BestMatchesPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  return (
    <div className="space-y-6 animate-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Star className="w-6 h-6 text-primary-500" aria-hidden="true" />
          Best Matches
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Your jobs ranked by how well they match your resume — best first — with a threshold slider and a
          resume-version picker so you can compare how different resumes rank the same jobs.
        </p>
      </div>

      <BestMatchedJobsList />
    </div>
  )
}
