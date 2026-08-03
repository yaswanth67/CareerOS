'use client'

import { useTheme } from '@/components/providers/ThemeProvider'
import { Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
      {(['light', 'dark', 'system'] as const).map((t) => (
        <button
          key={t}
          onClick={() => setTheme(t)}
          className={cn(
            'relative flex items-center justify-center w-9 h-9 rounded-md text-sm font-medium transition-all duration-200',
            theme === t
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-white dark:hover:bg-gray-700'
          )}
          aria-label={t === 'system' ? 'System theme' : t === 'dark' ? 'Dark theme' : 'Light theme'}
          aria-pressed={theme === t}
        >
          {t === 'light' && <Sun className="w-4 h-4" />}
          {t === 'dark' && <Moon className="w-4 h-4" />}
          {t === 'system' && <Monitor className="w-4 h-4" />}
        </button>
      ))}
    </div>
  )
}

export function ThemeToggleCompact() {
  const { theme, setTheme } = useTheme()

  const icons = {
    light: <Sun className="w-5 h-5" />,
    dark: <Moon className="w-5 h-5" />,
    system: <Monitor className="w-5 h-5" />,
  }

  const labels = {
    light: 'Light',
    dark: 'Dark',
    system: 'System',
  }

  const nextTheme: Record<typeof theme, Theme> = {
    light: 'dark',
    dark: 'system',
    system: 'light',
  }

  return (
    <button
      onClick={() => setTheme(nextTheme[theme])}
      className="relative p-2 rounded-lg text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      aria-label={`Current: ${labels[theme]}. Click to switch to ${labels[nextTheme[theme]]}`}
      title={`Theme: ${labels[theme]}. Click to change.`}
    >
      {icons[theme]}
    </button>
  )
}

type Theme = 'light' | 'dark' | 'system'