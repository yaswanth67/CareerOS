import * as React from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gray'
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      success: 'bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400',
      warning: 'bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-400',
      danger: 'bg-danger-100 text-danger-700 dark:bg-danger-500/20 dark:text-danger-400',
      info: 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-400',
      gray: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    }

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
          variants[variant],
          className
        )}
        {...props}
      />
    )
  }
)
Badge.displayName = 'Badge'

export { Badge }