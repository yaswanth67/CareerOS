import { cn } from '@/lib/utils'

type LogoSize = 'sm' | 'md' | 'lg'

interface LogoProps {
  className?: string
  size?: LogoSize
  showWordmark?: boolean
}

const sizeMap: Record<LogoSize, { box: string; glyph: string; wordmark: string }> = {
  sm: { box: 'w-7 h-7 rounded-lg', glyph: 'w-4 h-4', wordmark: 'text-base' },
  md: { box: 'w-9 h-9 rounded-xl', glyph: 'w-5 h-5', wordmark: 'text-lg' },
  lg: { box: 'w-12 h-12 rounded-2xl', glyph: 'w-7 h-7', wordmark: 'text-2xl' },
}

/**
 * Prose brand mark: a pilcrow — the typographer's paragraph symbol — in a flat
 * brand tile, with the wordmark. The pilcrow reads as "prose" at any size and
 * stays legible down to a 16px favicon, where the old lightning bolt turned to
 * mush.
 *
 * Colours come from the `primary` scale rather than literal hex, so the mark
 * follows the theme (burgundy tile, blush glyph) without a second edit here.
 * Flat fill by design — the previous gradient-plus-tinted-shadow treatment
 * fights the flat surfaces used everywhere else in the app.
 */
export function Logo({ className, size = 'md', showWordmark = true }: LogoProps) {
  const s = sizeMap[size]

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center bg-primary-600 text-primary-100',
          s.box
        )}
      >
        {/* Pilcrow, drawn to fill the 24-unit box: bowl spans x 4.7–14, stems
            are equal weight. A tighter path left the glyph small and sitting
            right of centre inside the tile. */}
        <svg className={s.glyph} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19 3v18h-2.6V3H14v18h-2.6v-7.4H10a5.3 5.3 0 0 1 0-10.6H19z" />
        </svg>
      </span>
      {showWordmark && (
        <span className={cn('font-bold tracking-tight text-gray-900 dark:text-white leading-none', s.wordmark)}>
          Pro
          <span className="text-primary-600 dark:text-primary-300">se</span>
        </span>
      )}
    </span>
  )
}
