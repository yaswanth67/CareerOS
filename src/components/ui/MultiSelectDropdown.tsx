'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronDown, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MultiSelectDropdownProps {
  /** Suggested options shown in the list — user can also add a custom value. */
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  /** Chip color for the selected values shown in the trigger. */
  chipVariant?: 'gray' | 'danger'
  /** Max chips rendered in the trigger before collapsing into "+N more". */
  maxVisibleChips?: number
}

/**
 * Multi-select dropdown with a searchable list of common options plus the
 * ability to add a custom value that isn't in the list. Used on the
 * Preferences page for preferred locations and excluded keywords, replacing
 * the old "type + Add" input.
 */
export function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search or type to add…',
  emptyMessage = 'No matching options',
  chipVariant = 'gray',
  maxVisibleChips = 3,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')

  const query = search.trim().toLowerCase()

  const filteredOptions = useMemo(() => {
    return options.filter(o => o.toLowerCase().includes(query))
  }, [options, query])

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter(v => v !== value)
        : [...selected, value]
    )
  }

  const addCustom = () => {
    const value = search.trim()
    if (value && !selected.includes(value)) {
      onChange([...selected, value])
    }
    setSearch('')
  }

  // A free-text match isn't one of the suggestions yet — offer it as a custom add.
  const canAddCustom = query.length > 0 && !filteredOptions.includes(search.trim())

  const visibleChips = selected.slice(0, maxVisibleChips)
  const hiddenCount = selected.length - visibleChips.length

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full min-h-[42px] px-3 py-2 text-left rounded-lg border bg-white dark:bg-gray-800',
          'text-sm transition-colors',
          'border-gray-300 dark:border-gray-600',
          'hover:border-primary-500 dark:hover:border-primary-500',
          'focus:outline-none focus:ring-2 focus:ring-primary-500/20'
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="pr-7 block">
          {selected.length === 0 ? (
            <span className="text-gray-400">{placeholder}</span>
          ) : (
            <span className="flex flex-wrap gap-1.5">
              {visibleChips.map(value => (
                <span
                  key={value}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                    chipVariant === 'danger'
                      ? 'bg-danger-100 text-danger-600 dark:bg-danger-500/20 dark:text-danger-400'
                      : 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                  )}
                >
                  {value}
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Remove ${value}`}
                    onClick={e => {
                      e.stopPropagation()
                      toggle(value)
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.stopPropagation()
                        toggle(value)
                      }
                    }}
                    className="hover:opacity-70"
                  >
                    <X className="w-3 h-3" />
                  </span>
                </span>
              ))}
              {hiddenCount > 0 && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                >
                  +{hiddenCount} more
                </span>
              )}
            </span>
          )}
        </span>
        <ChevronDown className={cn(
          'absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden max-h-96">
            {/* Search input */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  e.stopPropagation()
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (canAddCustom) addCustom()
                    else if (filteredOptions.length > 0) toggle(filteredOptions[0])
                  }
                }}
                placeholder={searchPlaceholder}
                className="input pl-8"
                autoFocus
              />
            </div>

            {/* Suggested options */}
            <div className="max-h-72 overflow-y-auto">
              {filteredOptions.map(option => {
                const checked = selected.includes(option)
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggle(option)}
                    className={cn(
                      'w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center gap-2.5',
                      checked
                        ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    )}
                    role="option"
                    aria-selected={checked}
                  >
                    <span
                      className={cn(
                        'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                        checked
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'border-gray-300 dark:border-gray-600'
                      )}
                    >
                      {checked && <Check className="w-3 h-3" />}
                    </span>
                    <span className="flex-1 truncate">{option}</span>
                  </button>
                )
              })}

              {/* Custom add */}
              {canAddCustom && (
                <button
                  type="button"
                  onClick={addCustom}
                  className="w-full px-4 py-2.5 text-left text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors flex items-center gap-2.5"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  Add “{search.trim()}”
                </button>
              )}

              {filteredOptions.length === 0 && !canAddCustom && (
                <div className="px-4 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  {emptyMessage}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400 px-2">
                {selected.length} selected
              </span>
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="px-3 py-1.5 text-xs font-medium text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10 rounded-lg transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
