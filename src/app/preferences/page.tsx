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
import { Checkbox } from '@/components/ui/Checkbox'
import { RoleType } from '@/types'
import toast from 'react-hot-toast'
import { Loader2, MapPin, Globe, DollarSign, X, Plus, Briefcase } from 'lucide-react'

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
    formState: { errors },
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Job Preferences</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Configure your job search preferences to get better matches
        </p>
      </div>

      {/* Target Roles */}
      <Card>
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            Target Roles
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Select the role types you&apos;re interested in
          </p>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap gap-2">
            {roleOptions.map((role) => (
              <button
                key={role.value}
                type="button"
                onClick={() => {
                  const newRoles = targetRoles.includes(role.value)
                    ? targetRoles.filter(r => r !== role.value)
                    : [...targetRoles, role.value]
                  setValue('targetRoles', newRoles)
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  targetRoles.includes(role.value)
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>
          {errors.targetRoles && (
            <p className="mt-2 text-sm text-danger-500">{errors.targetRoles.message}</p>
          )}
        </div>
      </Card>

      {/* Locations */}
      <Card>
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Preferred Locations
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Add cities or regions you&apos;d like to work in
          </p>
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
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
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

      {/* Remote & Visa */}
      <Card>
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Work Preferences
          </h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox
              id="remoteOnly"
              checked={remoteOnly}
              onChange={(e) => setValue('remoteOnly', e.target.checked)}
            />
            <Label htmlFor="remoteOnly" className="cursor-pointer">
              <span className="font-medium">Remote only</span>
              <p className="text-sm text-gray-500">Only show remote positions</p>
            </Label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="visaRequired"
              checked={visaRequired}
              onChange={(e) => setValue('visaRequired', e.target.checked)}
            />
            <Label htmlFor="visaRequired" className="cursor-pointer">
              <span className="font-medium">Visa sponsorship required</span>
              <p className="text-sm text-gray-500">Filter for companies that sponsor visas</p>
            </Label>
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

      {/* Excluded Keywords */}
      <Card>
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Excluded Keywords
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Filter out jobs containing these words in title or description
          </p>
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
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
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

      <Button type="submit" className="w-full sm:w-auto" disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving...
          </>
        ) : (
          'Save Preferences'
        )}
      </Button>
    </form>
  )
}