'use client'

import { useState } from 'react'
import { FilterPanel, FilterTrigger } from './FilterPanel'
import { useTargetFilters } from './useTargetFilters'

/**
 * The dashboard's Advanced Filters entry point: the trigger button plus the
 * drawer.
 *
 * Advanced Filters can be opened regardless of whether the user has saved any
 * target filters yet; the panel supports a blank state and the Preferences tab
 * remains optional for creating saved filters.
 */
export function AdvancedFilters() {
  const [isOpen, setIsOpen] = useState(false)
  const { filters, loading } = useTargetFilters()

  const handleClick = () => {
    if (loading) return
    setIsOpen(true)
  }

  return (
    <>
      <FilterTrigger isOpen={isOpen} onClick={handleClick} />
      <FilterPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        targetFilters={filters}
      />
    </>
  )
}
