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
    <div className="card p-4 flex items-center gap-3">
      <span className="p-2.5 rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
        <Icon className="w-5 h-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
        <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{value}</p>
      </div>
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
      <div className="space-y-6">
        {/* Hero header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-700 p-6 sm:p-8 text-white shadow-lg">
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute right-24 bottom-0 w-24 h-24 bg-white/5 rounded-full blur-xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-primary-100 text-sm font-medium mb-2">
              <Sparkles className="w-4 h-4" />
              Personalize your search
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">Job Preferences</h1>
            <p className="mt-1 text-primary-100 max-w-xl">
              Tune how MatchIQ finds, filters, and scores jobs for you
            </p>
          </div>
        </div>

        {/* Live summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryChip icon={Briefcase} label="Target roles" value={targetRoles.length} />
          <SummaryChip icon={MapPin} label="Locations" value={locations.length} />
          <SummaryChip icon={Globe} label="Remote only" value={remoteOnly ? 'On' : 'Off'} />
          <SummaryChip icon={Ban} label="Excluded words" value={excludedKeywords.length} />
        </div>

        {/* Main grid */}
        <div className="grid lg:grid-cols-2 gap-6 items-start">
          {/* Left column */}
          <div className="space-y-6">
            {/* Target Roles */}
            <Card>
              <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                    <Briefcase className="w-5 h-5" />
                  </span>
                  <div>
                    <h2 className="font-semibold text-gray-900 dark:text-white">Target Roles</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      The role types you&apos;re interested in
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <div className="flex flex-wrap gap-2">
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
                          'px-3.5 py-2 rounded-full text-sm font-medium transition-all',
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
              </div>
            </Card>

            {/* Work Preferences */}
            <Card>
              <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                    <Globe className="w-5 h-5" />
                  </span>
                  <div>
                    <h2 className="font-semibold text-gray-900 dark:text-white">Work Preferences</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Remote, visa, and salary requirements
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Remote only</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Only show remote positions
                    </p>
                  </div>
                  <Toggle
                    id="remoteOnly"
                    checked={remoteOnly}
                    onChange={(v) => setValue('remoteOnly', v)}
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Visa sponsorship
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Prioritize companies that sponsor visas
                    </p>
                  </div>
                  <Toggle
                    id="visaRequired"
                    checked={visaRequired}
                    onChange={(v) => setValue('visaRequired', v)}
                  />
                </div>
                <div>
                  <Label htmlFor="minSalary" className="label flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4" />
                    Minimum Annual Salary (USD)
                  </Label>
                  <Input
                    id="minSalary"
                    type="number"
                    {...register('minSalary', { valueAsNumber: true })}
                    placeholder="e.g., 120000"
                    className="mt-1"
                  />
                </div>
              </div>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Preferred Locations */}
            <Card>
              <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                    <MapPin className="w-5 h-5" />
                  </span>
                  <div>
                    <h2 className="font-semibold text-gray-900 dark:text-white">
                      Preferred Locations
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Cities or regions you&apos;d like to work in
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <div className="flex flex-wrap gap-2 mb-3">
                  {locations.map((loc) => (
                    <Badge key={loc} variant="gray" className="flex items-center gap-1.5">
                      {loc}
                      <button
                        type="button"
                        onClick={() => removeLocation(loc)}
                        className="hover:text-gray-500"
                        aria-label={`Remove ${loc}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  {locations.length === 0 && (
                    <span className="text-sm text-gray-400">No locations added yet</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={locationInput}
                    onChange={(e) => setLocationInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLocation())}
                    placeholder="e.g., San Francisco, New York, Austin"
                    className="flex-1"
                  />
                  <Button type="button" variant="secondary" onClick={addLocation}>
                    <Plus className="w-4 h-4" />
                    Add
                  </Button>
                </div>
              </div>
            </Card>

            {/* Excluded Keywords */}
            <Card>
              <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 rounded-lg bg-danger-50 text-danger-500 dark:bg-danger-500/20 dark:text-danger-400">
                    <Ban className="w-5 h-5" />
                  </span>
                  <div>
                    <h2 className="font-semibold text-gray-900 dark:text-white">
                      Excluded Keywords
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Filter out jobs containing these words
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <div className="flex flex-wrap gap-2 mb-3">
                  {excludedKeywords.map((kw) => (
                    <Badge key={kw} variant="danger" className="flex items-center gap-1.5">
                      {kw}
                      <button
                        type="button"
                        onClick={() => removeKeyword(kw)}
                        className="hover:text-danger-300"
                        aria-label={`Remove ${kw}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  {excludedKeywords.length === 0 && (
                    <span className="text-sm text-gray-400">No exclusions set</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                    placeholder="e.g., senior, lead, principal, manager"
                    className="flex-1"
                  />
                  <Button type="button" variant="secondary" onClick={addKeyword}>
                    <Plus className="w-4 h-4" />
                    Add
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Save bar — anchored to the bottom of the screen */}
        <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8">
          <div className="flex items-center justify-between gap-3 border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm px-4 sm:px-6 lg:px-8 py-3">
            <p className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
              Preferences affect new matches and job filtering
            </p>
            <Button type="submit" disabled={saving} className="ml-auto">
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
