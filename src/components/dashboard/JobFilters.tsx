'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Filter, X, ChevronDown, MapPin, Briefcase, Globe, Star, Target, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RoleType, ExperienceLevel } from '@/types'

const roleOptions: { value: RoleType; label: string }[] = [
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
]

const experienceOptions: { value: ExperienceLevel; label: string }[] = [
  { value: 'ENTRY', label: 'Entry Level' },
  { value: 'MID', label: 'Mid Level' },
  { value: 'SENIOR', label: 'Senior' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'PRINCIPAL', label: 'Principal' },
]

const scoreOptions = [
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

interface Filters {
  q: string
  roles: RoleType[]
  exp: ExperienceLevel[]
  loc: string
  remote: boolean
  score: string
  posted: string
}

function readParams(): Filters {
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  return {
    q: params.get('q') || '',
    roles: (params.get('roles')?.split(',').filter(Boolean) as RoleType[]) || [],
    exp: (params.get('exp')?.split(',').filter(Boolean) as ExperienceLevel[]) || [],
    loc: params.get('loc') || '',
    remote: params.get('remote') === '1',
    score: params.get('score') || '0',
    posted: params.get('posted') || '',
  }
}

function toQuery(f: Filters): string {
  const params = new URLSearchParams()
  if (f.q.trim()) params.set('q', f.q.trim())
  if (f.roles.length) params.set('roles', f.roles.join(','))
  if (f.exp.length) params.set('exp', f.exp.join(','))
  if (f.loc.trim()) params.set('loc', f.loc.trim())
  if (f.remote) params.set('remote', '1')
  if (f.score && f.score !== '0') params.set('score', f.score)
  if (f.posted) params.set('posted', f.posted)
  const s = params.toString()
  return s ? `?${s}` : ''
}

export function JobFilters() {
  const router = useRouter()
  const [filters, setFilters] = useState<Filters>(readParams)
  const [searchInput, setSearchInput] = useState(filters.q)
  const [locationInput, setLocationInput] = useState(filters.loc)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const commit = (next: Filters) => {
    setFilters(next)
    setSearchInput(next.q)
    setLocationInput(next.loc)
    router.replace(`/dashboard${toQuery(next)}`)
  }

  const activeFiltersCount =
    filters.roles.length +
    filters.exp.length +
    (filters.loc ? 1 : 0) +
    (filters.remote ? 1 : 0) +
    (filters.score !== '0' ? 1 : 0) +
    (filters.posted ? 1 : 0) +
    (filters.q ? 1 : 0)

  const toggleRole = (role: RoleType) => {
    const roles = filters.roles.includes(role)
      ? filters.roles.filter(r => r !== role)
      : [...filters.roles, role]
    commit({ ...filters, roles })
  }

  const toggleExperience = (exp: ExperienceLevel) => {
    const next = filters.exp.includes(exp)
      ? filters.exp.filter(e => e !== exp)
      : [...filters.exp, exp]
    commit({ ...filters, exp: next })
  }

  const applyTextFilters = () => {
    commit({ ...filters, q: searchInput, loc: locationInput })
  }

  const clearAllFilters = () => {
    const empty: Filters = { q: '', roles: [], exp: [], loc: '', remote: false, score: '0', posted: '' }
    commit(empty)
  }

  return (
    <div className="card p-4">
      {/* Basic Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyTextFilters()}
          placeholder="Search jobs by title, company, skills... (press Enter)"
          className="input pl-10"
        />
      </div>

      {/* Advanced Filters Toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className={cn(
          'mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
          showAdvanced
            ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
        )}
      >
        <Filter className="w-4 h-4" />
        Advanced Filters
        {activeFiltersCount > 0 && (
          <span className="badge bg-primary-100 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400">
            {activeFiltersCount}
          </span>
        )}
        <ChevronDown className={cn('w-4 h-4 transition-transform', showAdvanced && 'rotate-180')} />
      </button>

      {showAdvanced && (
        <div className="mt-4 space-y-4 animate-in">
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

          {/* Experience Level */}
          <div>
            <label className="label flex items-center gap-1.5">
              <Star className="w-4 h-4" />
              Experience Level
            </label>
            <div className="flex flex-wrap gap-2 mt-2">
              {experienceOptions.map((exp) => (
                <button
                  key={exp.value}
                  onClick={() => toggleExperience(exp.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                    filters.exp.includes(exp.value)
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  )}
                >
                  {exp.label}
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
              className="btn-ghost text-danger-500 hover:text-danger-600"
            >
              <X className="w-4 h-4" />
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}
