'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { LogOut, User, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/Logo'
import { GlobalHeader } from '@/components/layout/GlobalHeader'
import { NavLinks } from '@/components/layout/NavLinks'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session } = useSession()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-belgium-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-white border-r border-belgium-200 transform transition-transform duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? '' : 'lg:translate-x-0'
        )}
        aria-label="Sidebar"
      >
        <div className="flex h-16 items-center justify-between px-6 border-b border-belgium-200">
          <Link href="/dashboard" className="flex items-center">
            <Logo size="md" />
          </Link>
          <button
            className="lg:hidden p-2 rounded-lg text-khaki-500 hover:bg-belgium-100"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <NavLinks onNavigate={() => setSidebarOpen(false)} />

        <div className="mt-auto p-4 border-t border-belgium-200">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center">
              <User className="w-5 h-5 text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-khaki-900 truncate">
                {session?.user?.name || 'User'}
              </p>
              {session?.user?.email && (
                <p className="text-xs text-khaki-500 truncate">
                  {session?.user?.email}
                </p>
              )}
            </div>
          </div>

          {/* Sign out lives at the very end of the sidebar, outside any dropdown. */}
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="mt-2 flex w-full items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-danger-500 hover:bg-danger-50"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className={collapsed ? '' : 'lg:pl-64'}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 bg-white/80 backdrop-blur-sm border-b border-belgium-200">
          <button
            className="p-2 rounded-lg text-khaki-500 hover:bg-belgium-100"
            onClick={() => {
              if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
                setCollapsed(c => !c)
              } else {
                setSidebarOpen(true)
              }
            }}
            aria-label="Toggle sidebar"
            title="Toggle sidebar"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex-1 lg:flex-none" />

          <GlobalHeader />
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8" id="main-content">
          {children}
        </main>
      </div>
    </div>
  )
}