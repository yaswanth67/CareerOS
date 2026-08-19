'use client'

import { useState, FormEvent } from 'react'
import { Plus, Link2, Trash2, ExternalLink, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { getLinkedInBookmarks, addLinkedInBookmark, removeLinkedInBookmark, recordBookmarkOpened, LinkedInBookmark } from '@/lib/job-providers/linkedin-bookmarks'
import { useToast } from '@/components/ui/Toast'

/**
 * Small panel to manage LinkedIn saved-search bookmarks.
 * Pasted search URLs are stored locally and rendered alongside fetched jobs.
 */
export function LinkedInBookmarks() {
  const [bookmarks, setBookmarks] = useState<LinkedInBookmark[]>([])
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const { toast } = useToast()

  const refresh = () => setBookmarks(getLinkedInBookmarks())

  const handleAdd = (e: FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    const b = addLinkedInBookmark(label.trim() || 'Untitled search', url.trim())
    setBookmarks(prev => [b, ...prev])
    setLabel('')
    setUrl('')
    setAdding(false)
    toast({ type: 'success', message: 'LinkedIn search bookmarked' })
  }

  const handleRemove = (id: string) => {
    removeLinkedInBookmark(id)
    setBookmarks(prev => prev.filter(b => b.id !== id))
    toast({ type: 'info', message: 'Bookmark removed' })
  }

  const handleOpen = (b: LinkedInBookmark) => {
    recordBookmarkOpened(b.id)
    window.open(b.searchUrl, '_blank', 'noopener,noreferrer')
    toast({ type: 'success', message: `Opened "${b.label}" on LinkedIn` })
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Search className="w-4 h-4 text-primary-500" />
          LinkedIn Saved Searches
        </h3>
        <Button variant="ghost" size="sm" onClick={() => setAdding(!adding)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add
        </Button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="space-y-3 mb-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Label</label>
            <Input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. SWE Bay Area, ML Remote, Frontend NYC"
              className="text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">LinkedIn Search URL</label>
            <Input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://www.linkedin.com/jobs/search/?keywords=...&location=United%20States"
              className="text-sm"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm"><Plus className="w-3.5 h-3.5 mr-1" /> Save</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setAdding(false); setLabel(''); setUrl(''); }}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </form>
      )}

      {bookmarks.length === 0 && !adding && (
        <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
          <p className="mb-2">No LinkedIn searches bookmarked yet.</p>
          <p className="text-xs">Click "Add" → paste a LinkedIn Jobs search URL from your saved searches.</p>
        </div>
      )}

      <ul className="space-y-2" role="list">
        {bookmarks.map(b => (
          <li key={b.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <Link2 className="w-4 h-4 text-primary-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{b.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{b.searchUrl}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => handleOpen(b)} aria-label={`Open ${b.label} on LinkedIn`}>
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleRemove(b.id)} aria-label={`Remove ${b.label}`}>
              <Trash2 className="w-3.5 h-3.5 text-danger-500" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}