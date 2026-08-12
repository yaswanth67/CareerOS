'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { FilterPanel, FilterTrigger } from './FilterPanel'
import { useTargetFilters } from './useTargetFilters'

/**
 * The dashboard's Advanced Filters entry point: the trigger button plus the
 * drawer.
 *
 * Advanced Filters are built from the target filters saved in the Preferences
 * tab, so with none saved there's nothing to open — the click sends the user to
 * Preferences to create their first one instead.
 */
export function AdvancedFilters() {
  const [isOpen, setIsOpen] = useState(false)
  const { filters, loading } = useTargetFilters()
  const router = useRouter()
  const { toast } = useToast()

  const handleClick = () => {
    if (loading) return
    if (filters.length === 0) {
      toast({
        type: 'info',
        message: 'Create a target filter first — roles, locations, and the resume to score against',
      })
      router.push('/preferences')
      return
    }
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
