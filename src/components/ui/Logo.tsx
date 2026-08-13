import { cn } from '@/lib/utils'

type LogoSize = 'sm' | 'md' | 'lg'

interface LogoProps {
  className?: string
  size?: LogoSize
  showWordmark?: boolean
}

const sizeMap: Record<LogoSize, { box: string; glyph: string; wordmark: string }> = {
  sm: { box: 'w-8 h-8 rounded-lg', glyph: 'w-5 h-5', wordmark: 'text-base' },
  md: { box: 'w-11 h-11 rounded-xl', glyph: 'w-7 h-7', wordmark: 'text-lg' },
  lg: { box: 'w-14 h-14 rounded-2xl', glyph: 'w-9 h-9', wordmark: 'text-2xl' },
}

/**
 * CareerOS brand mark: a pilcrow — the typographer's paragraph symbol — in a flat
 * brand tile, with the wordmark. The pilcrow reads as the mark at any size and
 * stays legible down to a 16px favicon.
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
      <span className={cn('inline-flex shrink-0 items-center justify-center', s.box)}>
        {/* Inline SVG mark — colors use CSS variables so the mark adapts to
            light/dark mode. */}
        <svg
          className={s.glyph}
          viewBox="0 0 1024 1024"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-hidden="true"
        >
          <rect x="32" y="32" width="960" height="960" rx="160" ry="160" fill="rgb(var(--mark-bg))" />

          <g fill="rgb(var(--mark-accent))">
            <rect x="160" y="380" width="120" height="24" rx="12" transform="skewX(-8)" opacity="0.95" />
            <rect x="160" y="426" width="88" height="18" rx="9" transform="skewX(-8)" opacity="0.95" />
            <rect x="160" y="470" width="56" height="14" rx="7" transform="skewX(-8)" opacity="0.95" />
          </g>

          <g fill="rgb(var(--mark-foreground))">
            <rect x="240" y="320" width="544" height="336" rx="40" />
            <path d="M240 416 L784 416 L704 560 L320 560 Z" opacity="0.95" />
            <rect x="396" y="248" width="232" height="80" rx="20" fill="rgb(var(--mark-foreground))" />
          </g>

          <g>
            <path d="M320 520 L704 520" stroke="rgb(var(--mark-stroke))" strokeWidth="20" strokeLinecap="round" fill="none" />
            <rect x="476" y="472" width="72" height="72" rx="12" fill="rgb(var(--mark-foreground))" stroke="rgb(var(--mark-accent))" strokeWidth="12" />
            <rect x="420" y="264" width="184" height="48" rx="12" fill="rgb(var(--mark-stroke))" />
          </g>
        </svg>
      </span>
      {showWordmark && (
        <span className={cn('font-bold tracking-tight text-gray-900 dark:text-white leading-none', s.wordmark)}>
          Career
          <span className="text-primary-600 dark:text-primary-300">OS</span>
        </span>
      )}
    </span>
  )
}
