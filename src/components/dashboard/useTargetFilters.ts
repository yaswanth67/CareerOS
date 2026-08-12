'use client'

import { useCallback, useEffect, useState } from 'react'
import type { RoleType } from '@/types'

export interface TargetFilter {
  id: string
  name: string
  targetRoles: RoleType[]
  locations: string[]
  excludedKeywords: string[]
  remoteOnly: boolean
  visaRequired: boolean
  minSalary: number | null
}

// Offline / transient failures resolve to an empty list rather than blocking
// the dashboard.
async function fetchTargetFilters(): Promise<TargetFilter[]> {
  try {
    const res = await fetch('/api/preferences')
    if (!res.ok) return []
    const data = await res.json()
    return data.filters || []
  } catch {
    return []
  }
}

/**
 * The user's saved target filters (Preferences tab). The dashboard's Advanced
 * Filters offers them as a dropdown, and sends the user to Preferences to
 * create one when the list is empty.
 */
export function useTargetFilters() {
  const [filters, setFilters] = useState<TargetFilter[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchTargetFilters()
      .then(next => {
        if (!cancelled) setFilters(next)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const reload = useCallback(() => fetchTargetFilters().then(setFilters), [])

  return { filters, loading, reload }
}
