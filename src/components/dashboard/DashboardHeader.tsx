'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, RefreshCw, Loader2 } from 'lucide-react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

export function DashboardHeader() {
  const { data: session } = useSession()
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error || 'Failed to refresh jobs')
        return
      }
      const total = (data?.stats?.activeJobs ?? 0) as number
      toast.success(`Fetched jobs — ${total.toLocaleString()} active now`)
      router.refresh()
    } catch {
      toast.error('Failed to refresh jobs')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back, {session?.user?.name?.split(' ')[0] || 'there'}!
        </h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Here are your latest job matches
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/resumes/new" className="btn-primary">
          <Plus className="w-4 h-4" />
          Upload Resume
        </Link>
        <button
          className="btn-secondary"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {refreshing ? 'Fetching...' : 'Refresh Jobs'}
        </button>
      </div>
    </div>
  )
}
