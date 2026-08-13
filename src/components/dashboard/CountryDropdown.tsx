'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, Check, X as XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CountryDropdownProps {
  availableCountries?: string[]
  selectedCountry?: string
  className?: string
  onChange?: (country: string) => void
}

const COMMON_COUNTRIES = [
  'United States', 'Canada', 'United Kingdom', 'Germany', 'France', 'India',
  'Australia', 'Singapore', 'Japan', 'Ireland', 'Netherlands', 'Switzerland',
  'Sweden', 'Spain', 'Poland', 'Brazil', 'Mexico', 'Israel', 'United Arab Emirates',
  'South Korea', 'China', 'New Zealand', 'Denmark', 'Norway', 'Belgium',
  'Austria', 'Portugal', 'Italy', 'Finland', 'Malaysia', 'Philippines',
  'Thailand', 'Vietnam', 'Indonesia', 'Hong Kong', 'Taiwan', 'South Africa',
  'Argentina', 'Chile', 'Colombia', 'Costa Rica', 'Peru', 'Nigeria', 'Kenya',
  'Egypt', 'Global/Remote',
]

export function CountryDropdown({ availableCountries = [], selectedCountry: controlledCountry, className, onChange }: CountryDropdownProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Use controlled value if provided, otherwise read from URL
  const selectedCountry = controlledCountry !== undefined ? controlledCountry : searchParams.get('country') || ''

  // Debounced search for filtering the dropdown list
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchInput)
    }, 150)
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [searchInput])

  const countriesToShow = (availableCountries.length > 0 ? availableCountries : COMMON_COUNTRIES)
    .filter(c => c.toLowerCase().includes(debouncedSearch.toLowerCase()))

  const handleSelect = (country: string) => {
    setSearchInput(country)
    setIsOpen(false)

    // If onChange is provided, use it (global header mode)
    // Otherwise use router (dashboard header mode)
    if (onChange) {
      onChange(country)
    } else {
      const params = new URLSearchParams(searchParams.toString())
      if (country) {
        params.set('country', country)
      } else {
        params.delete('country')
      }

      router.replace(`/dashboard?${params.toString()}`)
    }
  }

  const clearCountry = (e: React.MouseEvent) => {
    e.stopPropagation()
    handleSelect('')
  }

  return (
    <div className={cn("relative", className)}>
      <div className="flex items-center gap-2">
        <label className="label hidden sm:block">Country</label>
        <div className="relative flex-1 sm:w-56">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              'w-full pl-4 pr-10 py-2.5 text-left rounded-lg border bg-white dark:bg-gray-800',
              'text-sm font-medium transition-colors',
              'border-gray-300 dark:border-gray-600',
              'hover:border-primary-500 dark:hover:border-primary-500',
              'focus:outline-none focus:ring-2 focus:ring-primary-500/20',
              'text-khaki-700 dark:text-gray-200'
            )}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
          >
            <span className="truncate block text-khaki-700 dark:text-gray-200">
              {selectedCountry || 'All Countries'}
            </span>
            <ChevronDown className={cn(
              'absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-transform',
              isOpen && 'rotate-180',
              'text-khaki-700 dark:text-gray-300'
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
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder="Search countries..."
                    className="input pl-8"
                    autoFocus
                  />
                </div>

                {/* Country list */}
                <div className="max-h-80 overflow-y-auto">
                  {/* All Countries option */}
                  <button
                    type="button"
                    onClick={() => handleSelect('')}
                    className={cn(
                      'w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center gap-2',
                      !selectedCountry
                        ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    )}
                    role="option"
                    aria-selected={!selectedCountry}
                  >
                    <span className="flex-1">All Countries</span>
                    {!selectedCountry && <Check className="w-4 h-4 text-primary-600" />}
                  </button>

                  {countriesToShow.map((country) => (
                    <button
                      key={country}
                      type="button"
                      onClick={() => handleSelect(country)}
                      className={cn(
                        'w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center gap-2',
                        selectedCountry === country
                          ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      )}
                      role="option"
                      aria-selected={selectedCountry === country}
                    >
                      <span className="flex-1 truncate">{country}</span>
                      {selectedCountry === country && <Check className="w-4 h-4 text-primary-600" />}
                    </button>
                  ))}

                  {countriesToShow.length === 0 && (
                    <div className="px-4 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      No countries found
                    </div>
                  )}
                </div>

                {selectedCountry && (
                  <div className="p-2 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={clearCountry}
                      className="w-full px-4 py-2 text-sm text-danger-500 hover:bg-danger-50 dark:bg-danger-500/10 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <XIcon className="w-4 h-4" />
                      Clear selection
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}