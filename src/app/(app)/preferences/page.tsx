'use client'

import { useCallback, useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { RoleType } from '@/types'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  Loader2, MapPin, Globe, Ban, DollarSign, X, Plus, Briefcase, Save, Sparkles,
} from 'lucide-react'

const preferencesSchema = z.object({
  targetRoles: z.array(z.string()),
  locations: z.array(z.string()),
  remoteOnly: z.boolean(),
  visaRequired: z.boolean(),
  minSalary: z.number().optional(),
  excludedKeywords: z.array(z.string()),
})

type PreferencesForm = z.infer<typeof preferencesSchema>

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
        checked ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
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

function SummaryChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: number | string
}) {
  return (
    <div className="card p-3 flex items-center gap-2.5">
      <span className="p-2 rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
        <Icon className="w-4.5 h-4.5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
        <p className="text-base font-bold text-gray-900 dark:text-white leading-tight">{value}</p>
      </div>
    </div>
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
      <span className="p-2 rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
        <Icon className="w-4.5 h-4.5" />
      </span>
      <div>
        <h2 className="font-semibold text-gray-900 dark:text-white text-sm">{title}</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
    </div>
  )
}

function ChipGroup({
  items,
  onRemove,
  variant = 'gray',
  emptyMessage = 'None added yet',
}: {
  items: string[]
  onRemove: (item: string) => void
  variant?: 'gray' | 'danger'
  emptyMessage?: string
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge key={item} variant={variant} className="flex items-center gap-1.5">
          {item}
          <button
            type="button"
            onClick={() => onRemove(item)}
            className="hover:opacity-70"
            aria-label={`Remove ${item}`}
          >
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}
      {items.length === 0 && (
        <span className="text-xs text-gray-400">{emptyMessage}</span>
      )}
    </div>
  )
}

function AddInput({
  value,
  onChange,
  placeholder,
  onAdd,
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  onAdd: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAdd(); } }}
        placeholder={placeholder}
        className="flex-1"
        disabled={disabled}
      />
      <Button type="button" variant="secondary" size="sm" onClick={onAdd} disabled={disabled || !value.trim()}>
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline">Add</span>
      </Button>
    </div>
  )
}

export default function PreferencesPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [locationInput, setLocationInput] = useState('')
  const [keywordInput, setKeywordInput] = useState('')

  const {
    register,
    handleSubmit,
    control,
    setValue,
  } = useForm<PreferencesForm>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      targetRoles: [],
      locations: [],
      remoteOnly: false,
      visaRequired: false,
      minSalary: undefined,
      excludedKeywords: [],
    },
  })

  const targetRoles = useWatch({ control, name: 'targetRoles' })
  const locations = useWatch({ control, name: 'locations' })
  const excludedKeywords = useWatch({ control, name: 'excludedKeywords' })
  const remoteOnly = useWatch({ control, name: 'remoteOnly' })
  const visaRequired = useWatch({ control, name: 'visaRequired' })

  const fetchPreferences = useCallback(async () => {
    try {
      const res = await fetch('/api/preferences')
      const data = await res.json()
      if (res.ok && data.preferences) {
        setValue('targetRoles', data.preferences.targetRoles || [])
        setValue('locations', data.preferences.locations || [])
        setValue('remoteOnly', data.preferences.remoteOnly || false)
        setValue('visaRequired', data.preferences.visaRequired || false)
        setValue('minSalary', data.preferences.minSalary)
        setValue('excludedKeywords', data.preferences.excludedKeywords || [])
      }
    } catch {
      toast.error('Failed to load preferences')
    } finally {
      setIsLoading(false)
    }
  }, [setValue])

  useEffect(() => {
    fetchPreferences()
  }, [fetchPreferences])

  const onSubmit = async (data: PreferencesForm) => {
    setSaving(true)
    try {
      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        toast.success('Preferences saved!')
      } else {
        toast.error('Failed to save preferences')
      }
    } catch {
      toast.error('Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  const addLocation = () => {
    if (locationInput.trim() && !locations.includes(locationInput.trim())) {
      setValue('locations', [...locations, locationInput.trim()])
      setLocationInput('')
    }
  }

  const removeLocation = (loc: string) => {
    setValue('locations', locations.filter(l => l !== loc))
  }

  const addKeyword = () => {
    if (keywordInput.trim() && !excludedKeywords.includes(keywordInput.trim())) {
      setValue('excludedKeywords', [...excludedKeywords, keywordInput.trim()])
      setKeywordInput('')
    }
  }

  const removeKeyword = (kw: string) => {
    setValue('excludedKeywords', excludedKeywords.filter(k => k !== kw))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-5">
        {/* Compact header */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-700 p-5 sm:p-6 text-white shadow-lg">
          <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute right-16 bottom-0 w-20 h-20 bg-white/5 rounded-full blur-xl" />
          <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 text-primary-100 text-sm font-medium mb-1">
                <Sparkles className="w-4 h-4" />
                Personalize your search
              </div>
              <h1 className="text-xl sm:text-2xl font-bold">Job Preferences</h1>
              <p className="mt-0.5 text-primary-100 text-sm max-w-xl">
                Tune how MatchIQ finds, filters, and scores jobs for you
              </p>
            </div>
          </div>
        </div>

        {/* Live summary - more compact */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <SummaryChip icon={Briefcase} label="Target roles" value={targetRoles.length} />
          <SummaryChip icon={MapPin} label="Locations" value={locations.length} />
          <SummaryChip icon={Globe} label="Remote only" value={remoteOnly ? 'On' : 'Off'} />
          <SummaryChip icon={Ban} label="Excluded words" value={excludedKeywords.length} />
        </div>

        {/* Main content - single column on mobile, two columns on lg */}
        <div className="grid lg:grid-cols-2 gap-5 items-start">
          {/* Left column: Roles & Work Preferences */}
          <div className="space-y-4">
            {/* Target Roles - compact */}
            <Card className="p-4">
              <SectionHeader
                icon={Briefcase}
                title="Target Roles"
                description="Role types you're interested in"
              />
              <div className="flex flex-wrap gap-2 mt-3">
                {roleOptions.map((role) => {
                  const selected = targetRoles.includes(role.value)
                  return (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => {
                        const next = selected
                          ? targetRoles.filter(r => r !== role.value)
                          : [...targetRoles, role.value]
                        setValue('targetRoles', next)
                      }}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                        selected
                          ? 'bg-primary-600 text-white shadow-md shadow-primary-600/25'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      )}
                    >
                      {role.label}
                    </button>
                  )
                })}
              </div>
            </Card>

            {/* Work Preferences - compact */}
            <Card className="p-4">
              <SectionHeader
                icon={Globe}
                title="Work Preferences"
                description="Remote, visa, and salary requirements"
              />
              <div className="space-y-3.5 mt-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">Remote only</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Only show remote positions</p>
                  </div>
                  <Toggle
                    id="remoteOnly"
                    checked={remoteOnly}
                    onChange={(v) => setValue('remoteOnly', v)}
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">Visa sponsorship</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Prioritize companies that sponsor visas</p>
                  </div>
                  <Toggle
                    id="visaRequired"
                    checked={visaRequired}
                    onChange={(v) => setValue('visaRequired', v)}
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
                    {...register('minSalary', { valueAsNumber: true })}
                    placeholder="e.g., 120000"
                    className="mt-1.5"
                  />
                </div>
              </div>
            </Card>
          </div>

          {/* Right column: Locations & Excluded Keywords */}
          <div className="space-y-4">
            {/* Preferred Locations - compact */}
            <Card className="p-4">
              <SectionHeader
                icon={MapPin}
                title="Preferred Locations"
                description="Cities or regions you'd like to work in"
              />
              <div className="mt-3 space-y-3">
                <ChipGroup
                  items={locations}
                  onRemove={removeLocation}
                  variant="gray"
                  emptyMessage="No locations added yet"
                />
                <AddInput
                  value={locationInput}
                  onChange={setLocationInput}
                  placeholder="e.g., San Francisco, New York, Austin"
                  onAdd={addLocation}
                />
              </div>
            </Card>

            {/* Excluded Keywords - compact */}
            <Card className="p-4">
              <SectionHeader
                icon={Ban}
                title="Excluded Keywords"
                description="Filter out jobs containing these words"
              />
              <div className="mt-3 space-y-3">
                <ChipGroup
                  items={excludedKeywords}
                  onRemove={removeKeyword}
                  variant="danger"
                  emptyMessage="No exclusions set"
                />
                <AddInput
                  value={keywordInput}
                  onChange={setKeywordInput}
                  placeholder="e.g., senior, lead, principal, manager"
                  onAdd={addKeyword}
                />
              </div>
            </Card>
          </div>
        </div>

        {/* Fixed save bar at bottom - fixed indentation */}
        <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-3 max-w-4xl mx-auto">
            <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
              Preferences affect new matches and job filtering
            </p>
            <div className="flex items-center gap-2 ml-auto">
              <Button type="submit" disabled={saving} className="w-auto sm:w-[160px]">
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span className="hidden sm:inline">Save Preferences</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}