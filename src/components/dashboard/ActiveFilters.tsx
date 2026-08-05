'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import { roleOptions, experienceOptions, scoreOptions, statusOptions } from './FilterPanel'

// A visible bar of the filters currently applied to the job feed. Each chip can
// be removed individually (or all cleared), so a narrowed list is never a
// mystery — the active filters are always one click from being removed.
interface ActiveFilter {
  key: string
  value: string
  label: string
}

const postedLabels: Record<string, string> = {
  '24': 'Last 24 hours',
  '48': 'Last 2 days',
  '168': 'Last 7 days',
}

export function ActiveFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const chips: ActiveFilter[] = []

  const q = searchParams.get('q')
  if (q) chips.push({ key: 'q', value: q, label: `"${q}"` })

  for (const value of searchParams.get('roles')?.split(',').filter(Boolean) ?? []) {
    chips.push({ key: 'roles', value, label: roleOptions.find(o => o.value === value)?.label ?? value })
  }
  for (const value of searchParams.get('exp')?.split(',').filter(Boolean) ?? []) {
    chips.push({ key: 'exp', value, label: experienceOptions.find(o => o.value === value)?.label ?? value })
  }

  const loc = searchParams.get('loc')
  if (loc) chips.push({ key: 'loc', value: loc, label: `Location: ${loc}` })

  if (searchParams.get('remote') === '1') chips.push({ key: 'remote', value: '1', label: 'Remote only' })

  const posted = searchParams.get('posted')
  if (posted) chips.push({ key: 'posted', value: posted, label: postedLabels[posted] ?? `Posted: ${posted}h` })

  const score = searchParams.get('score')
  if (score && score !== '0') {
    chips.push({ key: 'score', value: score, label: scoreOptions.find(o => o.value === score)?.label ?? `Score: ${score}+` })
  }

  const status = searchParams.get('status')
  if (status) chips.push({ key: 'status', value: status, label: statusOptions.find(o => o.value === status)?.label ?? status })

  const country = searchParams.get('country')
  if (country) chips.push({ key: 'country', value: country, label: country })

  const company = searchParams.get('company')
  if (company) chips.push({ key: 'company', value: company, label: `Company: ${company}` })

  if (searchParams.get('sponsorship') === '1') chips.push({ key: 'sponsorship', value: '1', label: 'Sponsorship available' })

  if (chips.length === 0) return null

  // Remove a single chip. Multi-value params (roles/exp) keep the remaining
  // values; everything else drops the whole param. Changing any filter resets
  // pagination back to page 1.
  const removeFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (key === 'roles' || key === 'exp') {
      const remaining = (params.get(key) || '').split(',').filter(Boolean).filter(v => v !== value)
      if (remaining.length) params.set(key, remaining.join(','))
      else params.delete(key)
    } else {
      params.delete(key)
    }
    params.delete('page')
    const qs = params.toString()
    router.replace(qs ? `/dashboard?${qs}` : '/dashboard')
  }

  const clearAll = () => router.replace('/dashboard')

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Filters:</span>
      {chips.map((chip) => (
        <span
          key={`${chip.key}-${chip.value}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-medium rounded-full"
        >
          {chip.label}
          <button
            onClick={() => removeFilter(chip.key, chip.value)}
            aria-label={`Remove ${chip.label} filter`}
            className="hover:text-primary-900 dark:hover:text-primary-100"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <button
        onClick={clearAll}
        className="text-xs text-gray-500 dark:text-gray-400 underline hover:text-primary-600 dark:hover:text-primary-400"
      >
        Clear all
      </button>
    </div>
  )
}
