'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Building2, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// One entry in the dropdown: a company name plus how many active jobs it has.
export interface CompanyOption {
  name: string
  count: number
}

// A searchable company picker shown right on the dashboard, so you can browse
// every company that has jobs (not just the ones at the top of the feed) and
// filter the feed to one company. Writes the same `company` URL param the
// Advanced Filters field uses, so the ActiveFilters chip stays in sync.
export function CompanyDropdown({ companies }: { companies: CompanyOption[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selected = searchParams.get('company') || ''
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return companies
    return companies.filter(c => c.name.toLowerCase().includes(q))
  }, [companies, query])

  const applyCompany = (name: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (name) params.set('company', name)
    else params.delete('company')
    params.delete('page')
    router.replace(`/dashboard?${params.toString()}`)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors max-w-[220px]',
          selected
            ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
        )}
        title={selected ? `Filtering by ${selected}` : 'Filter by company'}
      >
        <Building2 className="w-4 h-4 shrink-0" />
        <span className="truncate">{selected || 'All Companies'}</span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
          {/* Search box */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search companies..."
                autoFocus
                className="input pl-9"
              />
            </div>
          </div>

          {/* Company list */}
          <div className="max-h-72 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="text-sm text-gray-400 dark:text-gray-500 p-3">
                No companies match &ldquo;{query}&rdquo;
              </div>
            ) : (
              filtered.map(c => (
                <button
                  key={c.name}
                  onClick={() => applyCompany(c.name)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors',
                    selected === c.name
                      ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                  )}
                >
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                    {c.count.toLocaleString()}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Clear selection */}
          {selected && (
            <div className="p-2 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => applyCompany(null)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Clear company filter
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
