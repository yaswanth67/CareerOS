'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { LayoutDashboard, FileText, Settings, ClipboardList, BarChart2, Search, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Analytics', href: '/analytics', icon: BarChart2 },
  { name: 'Resumes', href: '/resumes', icon: FileText },
  { name: 'Applications', href: '/applications', icon: ClipboardList },
  { name: 'Evaluate', href: '/evaluate', icon: Search },
  { name: 'Preferences', href: '/preferences', icon: Settings },
]

// External tool — opens in a new tab, never navigates away from the app.
const CAREER_OPS_URL = 'https://career-ops.org'

interface NavLinksProps {
  onNavigate?: () => void
}

function NavLinksContent({ onNavigate }: NavLinksProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Preserve the current query string (country + filters) so they don't reset
  // when switching tabs. The dashboard reads country from the URL.
  const hrefWithParams = (href: string) => {
    const qs = searchParams.toString()
    return qs ? `${href}?${qs}` : href
  }

  return (
    <nav className="flex-1 p-4 space-y-1" aria-label="Main navigation">
      {navigation.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.name}
            href={hrefWithParams(item.href)}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary-50 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            {item.name}
          </Link>
        )
      })}

      {/* External tool — opens career-ops in a new tab */}
      <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
        <a
          href={CAREER_OPS_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onNavigate}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <ExternalLink className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          Career Ops
          <ExternalLink className="w-3.5 h-3.5 ml-auto text-gray-400 dark:text-gray-500" aria-hidden="true" />
        </a>
      </div>
    </nav>
  )
}

export function NavLinks({ onNavigate }: NavLinksProps) {
  return (
    <Suspense
      fallback={
        <nav className="flex-1 p-4 space-y-1" aria-label="Main navigation">
          <div className="h-10 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-10 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-10 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </nav>
      }
    >
      <NavLinksContent onNavigate={onNavigate} />
    </Suspense>
  )
}
