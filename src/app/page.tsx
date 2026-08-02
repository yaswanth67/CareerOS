'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

export default function HomePage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status === 'loading') return
    if (session) {
      router.push('/dashboard')
    } else {
      router.push('/auth/signin')
    }
  }, [session, status, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse-soft flex items-center gap-3 text-primary-600">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <span className="text-lg font-medium">Loading...</span>
      </div>
    </div>
  )
}