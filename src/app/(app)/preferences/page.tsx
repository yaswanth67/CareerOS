'use client'

import { useCallback, useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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

export default function PreferencesPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

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
      toast({ type: 'error', message: 'Failed to load preferences' })
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
        body: JSON.stringify({
          ...data,
          // SQLite stores NULL for "no minimum" — clear it when the field is emptied
          minSalary: data.minSalary ?? null,
        }),
      })
      if (res.ok) {
        toast({ type: 'success', message: 'Preferences saved!' })
      } else {
        toast({ type: 'error', message: 'Failed to save preferences' })
      }
    } catch {
      toast({ type: 'error', message: 'Failed to save preferences' })
    } finally {
      setSaving(false)
    }
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
            <Button
              type="submit"
              disabled={saving}
              className="shrink-0 bg-white text-primary-600 hover:bg-primary-50 focus:ring-white/60"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Preferences
                </>
              )}
            </Button>
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
                    {...register('minSalary', {
                      // Empty input → undefined (not NaN), so clearing the field
                      // passes validation instead of silently blocking the save.
                      setValueAs: (v) =>
                        v === '' || v === undefined || v === null ? undefined : Number(v),
                    })}
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
              <div className="mt-3">
                <MultiSelectDropdown
                  options={locationOptions}
                  selected={locations}
                  onChange={(next) => setValue('locations', next)}
                  placeholder="Select locations…"
                  searchPlaceholder="Search cities or type to add…"
                  emptyMessage="No matching cities"
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
              <div className="mt-3">
                <MultiSelectDropdown
                  options={keywordOptions}
                  selected={excludedKeywords}
                  onChange={(next) => setValue('excludedKeywords', next)}
                  placeholder="Select keywords to exclude…"
                  searchPlaceholder="Search or type to add…"
                  emptyMessage="No matching keywords"
                  chipVariant="danger"
                />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </form>
  )
}