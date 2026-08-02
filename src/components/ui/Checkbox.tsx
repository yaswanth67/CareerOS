'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const checkboxId = id || props.name

    return (
      <div className="flex items-start gap-3">
        <div className="relative mt-0.5">
          <input
            ref={ref}
            type="checkbox"
            id={checkboxId}
            className={cn(
              'peer h-4 w-4 shrink-0 rounded-sm border border-gray-300 text-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800',
              className
            )}
            {...props}
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Check
              className={cn(
                'w-3.5 h-3.5 text-white opacity-0 scale-50 transition-all peer-checked:opacity-100 peer-checked:scale-100',
                props.disabled && 'peer-disabled:opacity-50'
              )}
            />
          </div>
        </div>
        {label && (
          <label htmlFor={checkboxId} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed cursor-pointer">
            {label}
          </label>
        )}
      </div>
    )
  }
)
Checkbox.displayName = 'Checkbox'

export { Checkbox }