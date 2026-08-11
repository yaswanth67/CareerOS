import * as React from 'react'
import { cn } from '@/lib/utils'
import { transitions, lift, cardEntrance } from '@/lib/motion'

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    hover?: boolean
    animated?: boolean
    delay?: number
  }
>(({ className, hover = true, animated = true, delay = 0, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-xl border bg-white text-gray-950 shadow-sm dark:bg-gray-800 dark:text-gray-50 dark:border-gray-700',
      'transition-all duration-300 ease-out',
      hover && 'hover:shadow-lg hover:-translate-y-1 hover:border-gray-300 dark:hover:border-gray-600',
      animated && 'animate-in',
      animated && delay > 0 && `[animation-delay:${delay}ms]`,
      className
    )}
    style={{
      animationDuration: '400ms',
      animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
    }}
    {...props}
  />
))
Card.displayName = 'Card'

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
))
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'text-2xl font-semibold leading-none tracking-tight',
      'animate-in',
      className
    )}
    style={{ animationDuration: '300ms', animationDelay: '50ms' }}
    {...props}
  />
))
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-gray-500 dark:text-gray-400', 'animate-in', className)}
    style={{ animationDuration: '300ms', animationDelay: '100ms' }}
    {...props}
  />
))
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0 animate-in', className)} style={{ animationDuration: '300ms', animationDelay: '150ms' }} {...props} />
))
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0 animate-in', className)}
    style={{ animationDuration: '300ms', animationDelay: '200ms' }}
    {...props}
  />
))
CardFooter.displayName = 'CardFooter'

// Interactive card with press/hover states
export interface InteractiveCardProps extends React.HTMLAttributes<HTMLDivElement> {
  onPress?: () => void
  pressed?: boolean
}

export const InteractiveCard = React.forwardRef<HTMLDivElement, InteractiveCardProps>(
  ({ className, onPress, pressed, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border bg-white text-gray-950 shadow-sm dark:bg-gray-800 dark:text-gray-50 dark:border-gray-700',
        'transition-all duration-200 ease-out',
        'hover:shadow-lg hover:-translate-y-1 hover:border-gray-300 dark:hover:border-gray-600',
        'active:scale-[0.99] active:shadow-sm',
        pressed && 'scale-[0.99] shadow-sm',
        className
      )}
      onMouseDown={onPress}
      {...props}
    >
      {children}
    </div>
  )
)
InteractiveCard.displayName = 'InteractiveCard'

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }