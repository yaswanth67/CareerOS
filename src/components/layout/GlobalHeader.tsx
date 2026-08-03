'use client'

import { Suspense, useEffect, useState } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { CountryDropdown } from '@/components/dashboard/CountryDropdown'

function GlobalHeaderContent() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session } = useSession()
  const [roleName, setRoleName] = useState<string>('')

  const currentCountry = searchParams.get('country') || ''

  // Load the user's most recent resume title to show their target role name
  useEffect(() => {
    let cancelled = false
    fetch('/api/resumes')
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        const resumes = data?.resumes ?? []
        if (resumes.length > 0) {
          setRoleName(resumes[0].title)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

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
      <div className="hidden sm:flex flex-col items-end leading-tight">
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {roleName || session?.user?.name}
        </span>
        {roleName && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {session?.user?.name}
          </span>
        )}
      </div>
    </div>
  )
}

function GlobalHeaderFallback() {
  return (
    <div className="flex items-center gap-4">
      <div className="w-full sm:w-48 h-10 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg" />
      <div className="hidden sm:block w-32 h-4 animate-pulse bg-gray-200 dark:bg-gray-700 rounded" />
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