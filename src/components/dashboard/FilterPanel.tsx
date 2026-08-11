'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { X, Filter, MapPin, Briefcase, Globe, Clock, Target, Bookmark, Send, Loader2, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RoleType, AppStatus } from '@/types'
import toast from 'react-hot-toast'

export const roleOptions: { value: RoleType; label: string }[] = [
  { value: 'SDE', label: 'Software Engineer' },
  { value: 'AI_ENGINEER', label: 'AI Engineer' },
  { value: 'ML_ENGINEER', label: 'ML Engineer' },
  { value: 'DATA_SCIENTIST', label: 'Data Scientist' },
  { value: 'DATA_ENGINEER', label: 'Data Engineer' },
  { value: 'DEVOPS', label: 'DevOps' },
  { value: 'SRE', label: 'SRE' },
  { value: 'FULLSTACK', label: 'Full Stack' },
  { value: 'FRONTEND', label: 'Frontend' },
  { value: 'BACKEND', label: 'Backend' },
  { value: 'MOBILE', label: 'Mobile' },
  { value: 'EMBEDDED', label: 'Embedded' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'QA', label: 'QA' },
  { value: 'PM', label: 'Product Manager' },
  { value: 'OTHER', label: 'Other' },
]

export const scoreOptions = [
  { value: '0', label: 'All Scores' },
  { value: '80', label: 'Strong Match (80+)' },
  { value: '60', label: 'Good Match (60+)' },
  { value: '40', label: 'Weak Match (40+)' },
]

const postedOptions = [
  { value: '', label: 'Any time' },
  { value: '24', label: 'Last 24 hours' },
  { value: '48', label: 'Last 2 days' },
  { value: '168', label: 'Last 7 days' },
]

export const statusOptions: { value: AppStatus | ''; label: string; icon?: React.ElementType }[] = [
  { value: '', label: 'All Jobs' },
  { value: 'SAVED', label: 'Saved', icon: Bookmark },
  { value: 'APPLIED', label: 'Applied', icon: Send },
  { value: 'INTERVIEWING', label: 'Interviewing' },
  { value: 'OFFER', label: 'Offer' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
]

interface Filters {
  q: string
  roles: RoleType[]
  loc: string
  remote: boolean
  score: string
  posted: string
  status: AppStatus | ''
  sponsorship: boolean
}

interface FilterPanelProps {
  isOpen: boolean
  onClose: () => void
}

function readParams(searchParams: URLSearchParams): Filters {
  const status = searchParams.get('status') || ''
  return {
    q: searchParams.get('q') || '',
    roles: (searchParams.get('roles')?.split(',').filter(Boolean) as RoleType[]) || [],
    loc: searchParams.get('loc') || '',
    remote: searchParams.get('remote') === '1',
    score: searchParams.get('score') || '0',
    posted: searchParams.get('posted') || '',
    status: (['SAVED', 'APPLIED', 'INTERVIEWING', 'OFFER', 'REJECTED', 'WITHDRAWN'].includes(status) ? status : '') as AppStatus | '',
    sponsorship: searchParams.get('sponsorship') === '1',
  }
}

function toQuery(f: Filters): string {
  const params = new URLSearchParams()
  if (f.q.trim()) params.set('q', f.q.trim())
  if (f.roles.length) params.set('roles', f.roles.join(','))
  if (f.loc.trim()) params.set('loc', f.loc.trim())
  if (f.remote) params.set('remote', '1')
  if (f.score && f.score !== '0') params.set('score', f.score)
  if (f.posted) params.set('posted', f.posted)
  if (f.status) params.set('status', f.status)
  if (f.sponsorship) params.set('sponsorship', '1')
  const s = params.toString()
  return s ? `?${s}` : ''
}

export function FilterPanel({ isOpen, onClose }: FilterPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState<Filters>(() => readParams(new URLSearchParams(searchParams.toString())))
  const [searchInput, setSearchInput] = useState(filters.q)
  const [locationInput, setLocationInput] = useState(filters.loc)
  const [saving, setSaving] = useState(false)

  const activeFiltersCount =
    filters.roles.length +
    (filters.loc ? 1 : 0) +
    (filters.remote ? 1 : 0) +
    (filters.score !== '0' ? 1 : 0) +
    (filters.posted ? 1 : 0) +
    (filters.status ? 1 : 0) +
    (filters.q ? 1 : 0) +
    (filters.sponsorship ? 1 : 0)

  const commit = (next: Filters) => {
    setFilters(next)
    setSearchInput(next.q)
    setLocationInput(next.loc)
    router.replace(`/dashboard${toQuery(next)}`)
  }

  const toggleRole = (role: RoleType) => {
    const roles = filters.roles.includes(role)
      ? filters.roles.filter(r => r !== role)
      : [...filters.roles, role]
    commit({ ...filters, roles })
  }

  const applyTextFilters = () => {
    commit({ ...filters, q: searchInput, loc: locationInput })
  }

  const clearAllFilters = () => {
    const empty: Filters = {
      q: '', roles: [], loc: '', remote: false, score: '0', posted: '', status: '',
      sponsorship: false,
    }
    commit(empty)
  }

  const handleSaveAndRefresh = async () => {
    setSaving(true)
    try {
      // Fetch new jobs — the apply-link guard-rail runs automatically as part
      // of the fetch, so there's no separate check-links step.
      const fetchRes = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch' }),
      })
      const fetchData = await fetchRes.json().catch(() => ({}))

      if (fetchRes.ok) {
        const total = (fetchData?.stats?.activeJobs ?? 0) as number
        toast.success(`Refreshed — ${total.toLocaleString()} active jobs`)
      }
      const deactivated = (fetchData?.linkCheck?.deactivated ?? 0) as number
      if (deactivated > 0) {
        toast.success(`Removed ${deactivated} job${deactivated === 1 ? '' : 's'} with broken links`)
      }
      router.refresh()
    } catch {
      toast.error('Failed to refresh')
    } finally {
      setSaving(false)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed right-0 top-0 z-50 w-full max-w-md max-h-screen bg-white dark:bg-gray-900 shadow-xl slide-in-right flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Advanced Filters</h2>
            {activeFiltersCount > 0 && (
              <span className="badge bg-primary-100 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400">
                {activeFiltersCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close filters"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Search */}
          <div>
            <label className="label flex items-center gap-1.5">
              <Filter className="w-4 h-4" />
              Search
            </label>
            <div className="relative mt-1">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyTextFilters()}
                placeholder="Search jobs by title, company, skills... (press Enter)"
                className="input pl-10"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="label flex items-center gap-1.5">
              <Bookmark className="w-4 h-4" />
              Application Status
            </label>
            <div className="flex flex-wrap gap-2 mt-2">
              {statusOptions.map((opt) => {
                const Icon = opt.icon
                const isActive = filters.status === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => commit({ ...filters, status: opt.value as AppStatus | '' })}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                      isActive
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    )}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Role Filter */}
          <div>
            <label className="label flex items-center gap-1.5">
              <Briefcase className="w-4 h-4" />
              Role Types
            </label>
            <div className="flex flex-wrap gap-2 mt-2">
              {roleOptions.map((role) => (
                <button
                  key={role.value}
                  onClick={() => toggleRole(role.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                    filters.roles.includes(role.value)
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  )}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>

          {/* Location & Remote */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                Location
              </label>
              <input
                type="text"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyTextFilters()}
                placeholder="e.g., San Francisco, NYC, Remote"
                className="input mt-1"
              />
            </div>
            <div>
              <label className="label flex items-center gap-1.5">
                <Globe className="w-4 h-4" />
                Remote Options
              </label>
              <div className="mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.remote}
                    onChange={(e) => commit({ ...filters, remote: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Remote only</span>
                </label>
              </div>
            </div>
          </div>

          {/* Visa Sponsorship */}
          <div>
            <label className="label flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              Visa Sponsorship
            </label>
            <div className="mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.sponsorship}
                  onChange={(e) => commit({ ...filters, sponsorship: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Sponsorship available</span>
              </label>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                AI-detected — only jobs confirmed to sponsor visas
              </p>
            </div>
          </div>

          {/* Posted within + Score */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                Posted Within
              </label>
              <select
                value={filters.posted}
                onChange={(e) => commit({ ...filters, posted: e.target.value })}
                className="input mt-1"
              >
                {postedOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label flex items-center gap-1.5">
                <Target className="w-4 h-4" />
                Minimum Match Score
              </label>
              <select
                value={filters.score}
                onChange={(e) => commit({ ...filters, score: e.target.value })}
                className="input mt-1"
              >
                {scoreOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Clear Filters */}
          {activeFiltersCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="btn-ghost text-danger-500 hover:text-danger-600 w-full justify-center"
            >
              <X className="w-4 h-4" />
              Clear all filters
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveAndRefresh}
            disabled={saving}
            className="btn-primary flex-1"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving & Refreshing...
              </>
            ) : (
              <>
                <Filter className="w-4 h-4" />
                Save & Refresh
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}

export function FilterTrigger({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
        isOpen
          ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
      )}
    >
      <Filter className="w-4 h-4" />
      Advanced Filters
    </button>
  )
}