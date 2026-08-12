import { cn } from '@/lib/utils'

type LogoSize = 'sm' | 'md' | 'lg'

interface LogoProps {
  className?: string
  size?: LogoSize
  showWordmark?: boolean
}

const sizeMap: Record<LogoSize, { box: string; bolt: string; wordmark: string }> = {
  sm: { box: 'w-7 h-7 rounded-lg', bolt: 'w-4 h-4', wordmark: 'text-base' },
  md: { box: 'w-9 h-9 rounded-xl', bolt: 'w-5 h-5', wordmark: 'text-lg' },
  lg: { box: 'w-12 h-12 rounded-2xl', bolt: 'w-7 h-7', wordmark: 'text-2xl' },
}

/**
 * Prose brand mark: a gradient tile with a lightning bolt (score/energy) and
 * the wordmark. Reuse everywhere the app is named so branding stays consistent.
 */
export function Logo({ className, size = 'md', showWordmark = true }: LogoProps) {
  const s = sizeMap[size]

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center bg-gradient-to-br from-primary-500 via-primary-600 to-indigo-600 text-white shadow-md shadow-primary-500/25',
          s.box
        )}
      >
        <svg className={s.bolt} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M13.5 2 5 13.25h4.75L10.5 22l8.5-11.25h-4.75L13.5 2z" />
        </svg>
      </span>
      {showWordmark && (
        <span className={cn('font-bold tracking-tight text-gray-900 dark:text-white leading-none', s.wordmark)}>
          Pro
          <span className="text-primary-600 dark:text-primary-400">se</span>
        </span>
      )}
    </span>
  )
}
