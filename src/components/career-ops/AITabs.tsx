'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ResumeSuggestions } from './ResumeSuggestions'
import EvaluateJob from './EvaluateJob'

type TabId = 'suggestions' | 'evaluate'

const TABS: { id: TabId; label: string; icon: typeof Search }[] = [
  { id: 'suggestions', label: 'Suggestions', icon: Wand2 },
  { id: 'evaluate', label: 'Evaluate a job', icon: Search },
]

/**
 * Tab bar for the AI Career page — scan your resume for role suggestions, or
 * paste a job posting for a full A–G evaluation. The active tab is mirrored in
 * the URL (?tab=evaluate) so it's shareable and browser-back friendly.
 */
export function AITabs({ initialTab }: { initialTab: TabId }) {
  const router = useRouter()
  const [tab, setTab] = useState<TabId>(initialTab)

  const select = (id: TabId) => {
    setTab(id)
    router.replace(id === 'evaluate' ? '/ai?tab=evaluate' : '/ai', { scroll: false })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-800 w-fit">
        {TABS.map(t => (
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

      {tab === 'suggestions' ? <ResumeSuggestions /> : <EvaluateJob />}
    </div>
  )
}
