'use client'

import { Suspense } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { CountryDropdown } from '@/components/dashboard/CountryDropdown'

function GlobalHeaderContent() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  const currentCountry = searchParams.get('country') || ''

  const handleCountryChange = (country: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (country) {
      params.set('country', country)
    } else {
      params.delete('country')
    }
    router.replace(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-4">
      {/* Country Dropdown - Global, persists across tabs */}
      <CountryDropdown
        selectedCountry={currentCountry}
        onChange={handleCountryChange}
        className="w-full sm:w-48"
      />
    </div>
  )
}

function GlobalHeaderFallback() {
  return (
    <div className="flex items-center gap-4">
      <div className="w-full sm:w-48 h-10 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg" />
    </div>
  )
}

export function GlobalHeader() {
  return (
    <Suspense fallback={<GlobalHeaderFallback />}>
      <GlobalHeaderContent />
    </Suspense>
  )
}