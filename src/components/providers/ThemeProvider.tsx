'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useRef, useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// External store for system theme preference
function subscribe(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', callback)
  return () => mediaQuery.removeEventListener('change', callback)
}

function getSnapshot() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function getServerSnapshot() {
  return false
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as Theme | null) ?? 'system'
    }
    return 'system'
  })

  const mountedRef = useRef(false)
  const [mounted, setMounted] = useState(false)

  // Track system theme changes using useSyncExternalStore (React 18+)
  const systemPrefersDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  // Initialize mounted state - use layout effect to avoid the lint warning
  useEffect(() => {
    mountedRef.current = true
    // Use setTimeout to defer the state update to after render
    const timer = setTimeout(() => setMounted(true), 0)
    return () => clearTimeout(timer)
  }, [])

  // Apply theme to document and sync with localStorage
  useEffect(() => {
    if (!mountedRef.current) return

    const root = window.document.documentElement
    root.classList.remove('light', 'dark')

    let resolved: 'light' | 'dark'

    if (theme === 'system') {
      resolved = systemPrefersDark ? 'dark' : 'light'
    } else {
      resolved = theme
    }

    root.classList.add(resolved)
    localStorage.setItem('theme', theme)
  }, [theme, systemPrefersDark])

  // Compute resolved theme
  const resolvedTheme = theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : theme

  if (!mounted) {
    return (
      <ThemeContext.Provider value={{ theme: 'system', resolvedTheme: 'light', setTheme: () => {} }}>
        {children}
      </ThemeContext.Provider>
    )
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}