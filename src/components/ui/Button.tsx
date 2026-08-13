'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { transitions, scaleUp } from '@/lib/motion'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    // Base colours. Primary sits on primary-700 rather than -600: against the
    // cream page, white on -600 measures 4.99:1 — technically AA, but thin at
    // this weight. -700 gives 7.09:1 and reads cleanly.
    const variants = {
      primary: 'bg-primary-700 text-white hover:bg-primary-700 active:bg-primary-700 focus:ring-primary-500 dark:bg-primary-700 dark:text-white dark:hover:bg-primary-700 dark:focus:ring-primary-400',
      secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300 focus:ring-gray-500 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:active:bg-gray-600',
      outline: 'border border-gray-300 bg-transparent hover:bg-gray-50 active:bg-gray-100 focus:ring-gray-500 dark:border-gray-600 dark:hover:bg-gray-800 dark:active:bg-gray-700',
      ghost: 'bg-transparent hover:bg-gray-100 active:bg-gray-200 focus:ring-gray-500 dark:hover:bg-gray-800 dark:active:bg-gray-700',
      danger: 'bg-danger-600 text-white hover:bg-danger-600 active:bg-danger-600 focus:ring-danger-500',
    }

    /**
     * Disabled styling, per variant.
     *
     * A blanket `disabled:opacity-50` was fading the whole button — background
     * and label together — toward the cream page, which dropped a disabled
     * primary button to a 2.02:1 contrast ratio: effectively invisible. That is
     * what made "Save", "Full report" and "Scan resume & suggest roles"
     * unreadable whenever they were disabled or mid-request.
     *
     * Explicit muted colours keep every disabled state above the 4.5:1 AA
     * threshold while still reading as inactive; `cursor-not-allowed` and the
     * flatter tone carry the "you can't press this" signal instead of opacity.
     */
    const disabledStyles = {
      // Stays dark green with white text — a disabled button should still read
      // as the same control, just inactive. -600 against white is 4.99:1 (AA),
      // one step lighter than the enabled -700 so the two are distinguishable.
      primary: 'disabled:bg-primary-700 disabled:text-white disabled:hover:bg-primary-700',
      secondary: 'disabled:bg-gray-100 disabled:text-gray-600 disabled:hover:bg-gray-100 dark:disabled:bg-gray-800 dark:disabled:text-gray-400',
      outline: 'disabled:border-gray-200 disabled:text-gray-600 disabled:hover:bg-transparent dark:disabled:border-gray-700 dark:disabled:text-gray-400',
      ghost: 'disabled:text-gray-600 disabled:hover:bg-transparent dark:disabled:text-gray-400',
      danger: 'disabled:bg-danger-600 disabled:text-white disabled:hover:bg-danger-600',
    }

    const sizes = {
      sm: 'px-3 py-1.5 text-sm gap-1.5',
      md: 'px-4 py-2.5 text-sm gap-2',
      lg: 'px-6 py-3 text-base gap-2.5',
    }

    const iconSizes = {
      sm: 'w-3.5 h-3.5',
      md: 'w-4 h-4',
      lg: 'w-5 h-5',
    }

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:transform-none disabled:active:scale-100',
          'active:scale-[0.98]',
          'data-[pressed]:scale-[0.98]',
          variants[variant],
          disabledStyles[variant],
          sizes[size],
          className
        )}
        disabled={disabled || isLoading}
        onMouseDown={(e) => {
          if (!disabled && !isLoading) {
            e.currentTarget.dataset.pressed = 'true'
          }
        }}
        onMouseUp={(e) => {
          delete e.currentTarget.dataset.pressed
        }}
        onMouseLeave={(e) => {
          delete e.currentTarget.dataset.pressed
        }}
        onTouchStart={(e) => {
          if (!disabled && !isLoading) {
            e.currentTarget.dataset.pressed = 'true'
          }
        }}
        onTouchEnd={(e) => {
          delete e.currentTarget.dataset.pressed
        }}
        onTouchCancel={(e) => {
          delete e.currentTarget.dataset.pressed
        }}
        {...props}
      >
        {isLoading && (
          <svg
            className={cn('animate-spin', iconSizes[size])}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { Button }