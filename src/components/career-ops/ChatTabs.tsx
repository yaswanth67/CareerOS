'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MessageSquare, MessagesSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LinkedInAssistant } from './LinkedInAssistant'
import { ChatAssistant } from './ChatAssistant'

type ChatTabId = 'linkedin' | 'chat'

const CHAT_TABS: { id: ChatTabId; label: string; icon: typeof MessageSquare | typeof MessagesSquare }[] = [
  { id: 'linkedin', label: 'LinkedIn Assistant', icon: MessageSquare },
  { id: 'chat', label: 'Interview Chat', icon: MessagesSquare },
]

/**
 * Standalone tab bar for the chat tools page — LinkedIn Assistant + Interview Chat.
 * The active tab is mirrored in the URL (?tab=chat) so it's shareable and browser-back friendly.
 */
export function ChatTabs() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') as ChatTabId | null) ?? 'linkedin'
  const [tab, setTab] = useState<ChatTabId>(initialTab)

  const select = (id: ChatTabId) => {
    setTab(id)
    router.replace(`/chat?tab=${id}`, { scroll: false })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-800 w-fit">
        {CHAT_TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => select(t.id)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              tab === t.id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            )}
          >
            <t.icon className="w-4 h-4" aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: tab === 'linkedin' ? 'block' : 'none' }}>
        <LinkedInAssistant />
      </div>
      <div style={{ display: tab === 'chat' ? 'block' : 'none' }}>
        <ChatAssistant />
      </div>
    </div>
  )
}