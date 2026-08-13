'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { MultiSelectDropdown } from '@/components/ui/MultiSelectDropdown'
import { RoleType } from '@/types'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import {
  Loader2, MapPin, Globe, Ban, DollarSign, Briefcase, Save, Sparkles,
  Filter, Plus, Pencil, Trash2, X, AlertTriangle,
} from 'lucide-react'

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

interface FilterDraft {
  name: string
  targetRoles: RoleType[]
  locations: string[]
  excludedKeywords: string[]
  remoteOnly: boolean
  visaRequired: boolean
  minSalary: string
}

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
  { value: 'OTHER', label: 'Other' },
]

const roleLabel = (value: string) => roleOptions.find(o => o.value === value)?.label ?? value

// Common US metros to pick from — the app is US-only, so this list covers the
// biggest engineering hubs. The dropdown also accepts any custom value typed
// in the search box, so nothing is hard-blocked.
const locationOptions = [
  'Remote', 'San Francisco', 'New York', 'Seattle', 'Austin', 'Boston',
  'Los Angeles', 'Chicago', 'Denver', 'Atlanta', 'Washington DC', 'San Diego',
  'Dallas', 'Portland', 'Raleigh', 'Phoenix', 'Miami', 'Minneapolis',
  'Philadelphia', 'Houston', 'Nashville', 'Charlotte', 'Pittsburgh', 'Salt Lake City',
]

// Common exclusions for filtering job titles/descriptions.
const keywordOptions = [
  'senior', 'lead', 'principal', 'manager', 'director', 'staff', 'head',
  '5+ years', '10+ years', '15+ years', 'PhD', 'clearance', 'contract',
  'C2C', 'commission', 'part-time',
]

const emptyDraft = (): FilterDraft => ({
  name: '',
  targetRoles: [],
  locations: [],
  excludedKeywords: [],
  remoteOnly: false,
  visaRequired: false,
  minSalary: '',
})

async function loadFilters(): Promise<TargetFilter[]> {
  const res = await fetch('/api/preferences')
  if (!res.ok) return []
  const data = await res.json()
  return data.filters || []
}

const toDraft = (filter: TargetFilter): FilterDraft => ({
  name: filter.name,
  targetRoles: filter.targetRoles,
  locations: filter.locations,
  excludedKeywords: filter.excludedKeywords,
  remoteOnly: filter.remoteOnly,
  visaRequired: filter.visaRequired,
  minSalary: filter.minSalary != null ? String(filter.minSalary) : '',
})

function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  id: string
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/40',
        checked ? 'bg-primary-600' : 'bg-belgium-200'
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  )
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="p-2 rounded-lg bg-primary-50 text-primary-600">
        <Icon className="w-4.5 h-4.5" />
      </span>
      <div>
        <h2 className="font-semibold text-khaki-900 text-sm">{title}</h2>
        <p className="text-xs text-khaki-500">{description}</p>
      </div>
    </div>
  )
}

function SummaryChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-belgium-100 text-khaki-700 text-xs font-medium">
      {label}
    </span>
  )
}

export default function PreferencesPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [filters, setFilters] = useState<TargetFilter[]>([])
  // null = editor closed, '' = creating a new filter, id = editing that filter
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<FilterDraft>(emptyDraft())
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    let cancelled = false

    loadFilters()
      .then(loaded => {
        if (!cancelled) setFilters(loaded)
      })
      .catch(() => {
        if (!cancelled) toast({ type: 'error', message: 'Failed to load your filters' })
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const startCreate = () => {
    setError(null)
    setDraft(emptyDraft())
    setEditingId('')
  }

  const startEdit = (filter: TargetFilter) => {
    setError(null)
    setDraft(toDraft(filter))
    setEditingId(filter.id)
  }

  const closeEditor = () => {
    setEditingId(null)
    setError(null)
  }

  const update = <K extends keyof FilterDraft>(key: K, value: FilterDraft[K]) =>
    setDraft(prev => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    if (!draft.name.trim()) {
      setError('Give your filter a name so you can pick it from the dashboard.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const isNew = editingId === ''
      const res = await fetch(isNew ? '/api/preferences' : `/api/preferences?id=${editingId}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          name: draft.name.trim(),
          // SQLite stores NULL for "no minimum" — clear it when the field is emptied
          minSalary: draft.minSalary === '' ? null : Number(draft.minSalary),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Failed to save filter')
        return
      }

      setFilters(prev =>
        isNew ? [...prev, data.filter] : prev.map(f => (f.id === data.filter.id ? data.filter : f))
      )
      toast({ type: 'success', message: isNew ? 'Filter created!' : 'Filter updated!' })
      closeEditor()
    } catch {
      setError('Failed to save filter')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (filter: TargetFilter) => {
    if (!confirm(`Delete the "${filter.name}" filter?`)) return

    setDeletingId(filter.id)
    try {
      const res = await fetch(`/api/preferences?id=${filter.id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast({ type: 'error', message: 'Failed to delete filter' })
        return
      }
      setFilters(prev => prev.filter(f => f.id !== filter.id))
      if (editingId === filter.id) closeEditor()
      toast({ type: 'success', message: 'Filter deleted' })
    } catch {
      toast({ type: 'error', message: 'Failed to delete filter' })
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  const editorOpen = editingId !== null

  return (
    <div className="space-y-5">
      {/* Compact header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 p-5 sm:p-6 text-white shadow-lg">
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute right-16 bottom-0 w-20 h-20 bg-white/5 rounded-full blur-xl" />
        <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-primary-100 text-sm font-medium mb-1">
              <Sparkles className="w-4 h-4" />
              Personalize your search
            </div>
            <h1 className="text-xl sm:text-2xl font-bold">Target Filters</h1>
            <p className="mt-0.5 text-primary-100 text-sm max-w-xl">
              Save a filter per role you&apos;re targeting — roles, locations, excluded keywords and
              work preferences. Pick one from Advanced Filters on the dashboard.
            </p>
          </div>
          {(
            <Button
              type="button"
              onClick={startCreate}
              className="shrink-0 bg-white text-primary-600 hover:bg-primary-50 focus:ring-white/60"
            >
              <Plus className="w-4 h-4" />
              New Filter
            </Button>
          )}
        </div>
      </div>

      {/* Editor. A dialog rather than a panel above the list: inline, the card
          being edited stayed visible and unchanged below the form, so there was
          nothing tying the two together — you couldn't tell whether you were
          editing that filter or making another one. Same shell as the resume
          dialogs. */}
          {editorOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
              onClick={closeEditor}
              role="dialog"
              aria-modal="true"
            >
            <div
              className="w-full max-w-3xl card shadow-2xl animate-in flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 p-5 border-b border-gray-200 border-belgium-200">
                <div className="flex items-center gap-2 min-w-0">
                  <Filter className="w-5 h-5 text-primary-600 shrink-0" />
                  <h2 className="text-lg font-semibold text-khaki-900 truncate">
                    {editingId === ''
                      ? 'New target filter'
                      : `Editing "${filters.find(f => f.id === editingId)?.name ?? draft.name}"`}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeEditor}
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:bg-belgium-300 shrink-0"
                  aria-label="Close editor"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto p-5 space-y-5">
              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-danger-50 p-3 text-sm text-danger-600">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <Label htmlFor="filterName" className="label text-sm">
                  Filter name <span className="text-danger-500">*</span>
                </Label>
                <Input
                  id="filterName"
                  value={draft.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="e.g., New Grad AI roles"
                  className="mt-1.5 sm:max-w-md"
                />
              </div>

              <div className="grid lg:grid-cols-2 gap-5 items-start">
                {/* Left column: Roles & Work Preferences */}
                <div className="space-y-4">
                  <div>
                    <SectionHeader
                      icon={Briefcase}
                      title="Target Roles"
                      description="Role types you're interested in"
                    />
                    <div className="flex flex-wrap gap-2 mt-3">
                      {roleOptions.map((role) => {
                        const selected = draft.targetRoles.includes(role.value)
                        return (
                          <button
                            key={role.value}
                            type="button"
                            onClick={() =>
                              update(
                                'targetRoles',
                                selected
                                  ? draft.targetRoles.filter(r => r !== role.value)
                                  : [...draft.targetRoles, role.value]
                              )
                            }
                            className={cn(
                              'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                              selected
                                ? 'bg-primary-600 text-white shadow-md shadow-primary-600/25'
                                : 'bg-belgium-100 text-khaki-700 hover:bg-belgium-200'
                            )}
                          >
                            {role.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <SectionHeader
                      icon={Globe}
                      title="Work Preferences"
                      description="Remote, visa, and salary requirements"
                    />
                    <div className="space-y-3.5 mt-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-khaki-900 text-sm">Remote only</p>
                          <p className="text-xs text-khaki-500">Only show remote positions</p>
                        </div>
                        <Toggle
                          id="remoteOnly"
                          checked={draft.remoteOnly}
                          onChange={(v) => update('remoteOnly', v)}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-khaki-900 text-sm">Visa sponsorship</p>
                          <p className="text-xs text-khaki-500">Only companies confirmed to sponsor visas</p>
                        </div>
                        <Toggle
                          id="visaRequired"
                          checked={draft.visaRequired}
                          onChange={(v) => update('visaRequired', v)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="minSalary" className="label flex items-center gap-1.5 text-sm">
                          <DollarSign className="w-4 h-4" />
                          Minimum Annual Salary (USD)
                        </Label>
                        <Input
                          id="minSalary"
                          type="number"
                          value={draft.minSalary}
                          onChange={(e) => update('minSalary', e.target.value)}
                          placeholder="e.g., 120000"
                          className="mt-1.5"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right column: Locations & Excluded Keywords */}
                <div className="space-y-4">
                  <div>
                    <SectionHeader
                      icon={MapPin}
                      title="Preferred Locations"
                      description="Cities or regions you'd like to work in"
                    />
                    <div className="mt-3">
                      <MultiSelectDropdown
                        options={locationOptions}
                        selected={draft.locations}
                        onChange={(next) => update('locations', next)}
                        placeholder="Select locations…"
                        searchPlaceholder="Search cities or type to add…"
                        emptyMessage="No matching cities"
                      />
                    </div>
                  </div>

                  <div>
                    <SectionHeader
                      icon={Ban}
                      title="Excluded Keywords"
                      description="Skip jobs whose title contains these words"
                    />
                    <div className="mt-3">
                      <MultiSelectDropdown
                        options={keywordOptions}
                        selected={draft.excludedKeywords}
                        onChange={(next) => update('excludedKeywords', next)}
                        placeholder="Select keywords to exclude…"
                        searchPlaceholder="Search or type to add…"
                        emptyMessage="No matching keywords"
                        chipVariant="danger"
                      />
                    </div>
                  </div>
                </div>
              </div>

              </div>

              <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 border-belgium-200">
                <Button type="button" variant="secondary" onClick={closeEditor}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editingId === '' ? 'Create Filter' : 'Save Filter'}
                    </>
                  )}
                </Button>
              </div>
            </div>
            </div>
          )}

          {/* Saved filters */}
          {filters.length === 0 ? (
            <Card className="text-center py-12">
              <Filter className="w-16 h-16 text-belgium-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-khaki-900">No target filters yet</h3>
              <p className="mt-1 text-khaki-500 max-w-md mx-auto">
                Create your first filter to narrow the job feed to the roles and locations you
                actually want.
              </p>
              <Button type="button" onClick={startCreate} className="mt-4">
                <Plus className="w-4 h-4" />
                Create Filter
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filters.map((filter) => (
                <Card key={filter.id} className="p-4 card-hover">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-khaki-900 truncate">
                        {filter.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(filter)} title="Edit filter">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(filter)}
                        disabled={deletingId === filter.id}
                        className="text-danger-500 hover:text-danger-600"
                        title="Delete filter"
                      >
                        {deletingId === filter.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {filter.targetRoles.slice(0, 3).map(role => (
                      <SummaryChip key={role} label={roleLabel(role)} />
                    ))}
                    {filter.targetRoles.length > 3 && (
                      <SummaryChip label={`+${filter.targetRoles.length - 3} roles`} />
                    )}
                    {filter.locations.length > 0 && (
                      <SummaryChip label={`${filter.locations.length} location${filter.locations.length === 1 ? '' : 's'}`} />
                    )}
                    {filter.excludedKeywords.length > 0 && (
                      <SummaryChip label={`${filter.excludedKeywords.length} excluded`} />
                    )}
                    {filter.remoteOnly && <SummaryChip label="Remote only" />}
                    {filter.visaRequired && <SummaryChip label="Sponsorship" />}
                    {filter.minSalary != null && (
                      <SummaryChip label={`$${filter.minSalary.toLocaleString()}+`} />
                    )}
                    {filter.targetRoles.length === 0 &&
                      filter.locations.length === 0 &&
                      filter.excludedKeywords.length === 0 &&
                      !filter.remoteOnly &&
                      !filter.visaRequired &&
                      filter.minSalary == null && (
                        <span className="text-xs text-khaki-400">
                          No criteria — matches every job
                        </span>
                      )}
                  </div>
                </Card>
              ))}
            </div>
          )}
    </div>
  )
}
