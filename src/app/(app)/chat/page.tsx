import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { ChatTabs } from '@/components/career-ops/ChatTabs'
import { MessagesSquare } from 'lucide-react'

export const dynamic = 'force-dynamic'

// Chat tools hub: LinkedIn Assistant + Interview Chat on their own page (separate
// from the AI Career evaluate/suggestions tabs) so they're easy to find and use.
export default async function ChatPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <MessagesSquare className="w-6 h-6 text-primary-500" aria-hidden="true" />
          Chat Tools
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Draft a personalized LinkedIn outreach message, or practice interview answers framed for a
          target role using your resume as the source of truth.
        </p>
      </div>

      <ChatTabs />
    </div>
  )
}
