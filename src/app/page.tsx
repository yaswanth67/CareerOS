'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Logo } from '@/components/ui/Logo'

export default function HomePage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status === 'loading') return
    if (session) {
      router.push('/onboarding')
    } else {
      router.push('/auth/signin')
    }
  }, [session, status, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 dark:from-primary-800 dark:via-primary-900 dark:to-gray-950">
      <div className="animate-pulse-soft flex flex-col items-center gap-4">
        <Logo size="lg" />
        <span className="text-sm font-medium text-primary-100/90 dark:text-primary-200/80">Loading your matches...</span>
      </div>
    </div>
  )
}