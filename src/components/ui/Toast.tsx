'use client'

import { useState, useCallback, useEffect, useMemo, useRef, createContext, useContext, ReactNode } from 'react'
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================
// TYPES
// ============================================

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
  dismissible?: boolean
}

/** Hybrid toast — callable as `toast({ type, message })` OR `toast.error(msg)`. Both styles are used across the app. */
export type ToastFn = {
  (toast: Omit<Toast, 'id'>): string
  success: (message: string, options?: Partial<Toast>) => string
  error: (message: string, options?: Partial<Toast>) => string
  warning: (message: string, options?: Partial<Toast>) => string
  info: (message: string, options?: Partial<Toast>) => string
  loading: (message: string, options?: Partial<Toast>) => string
}

export interface ToastContextValue {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => string
  /** Callable as `toast({ type, message })` or `toast.success(msg)` — see ToastFn. */
  toast: ToastFn
  dismissToast: (id: string) => void
  dismissAll: () => void
  success: (message: string, options?: Partial<Toast>) => string
  error: (message: string, options?: Partial<Toast>) => string
  warning: (message: string, options?: Partial<Toast>) => string
  info: (message: string, options?: Partial<Toast>) => string
  loading: (message: string, options?: Partial<Toast>) => string
  promise: <T>(promise: Promise<T>, messages: {
    loading: string
    success: string | ((result: T) => string)
    error: string | ((error: Error) => string)
  }) => Promise<T>
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

// ============================================
// TOAST COMPONENT
// ============================================

const typeStyles: Record<ToastType, { bg: string; border: string; icon: ReactNode; text: string }> = {
  success: {
    bg: 'bg-success-50 dark:bg-success-500/10',
    border: 'border-success-200 dark:border-success-500/30',
    icon: <CheckCircle2 className="w-5 h-5 text-success-500 flex-shrink-0" />,
    text: 'text-success-700 dark:text-success-400',
  },
  error: {
    bg: 'bg-danger-50 dark:bg-danger-500/10',
    border: 'border-danger-200 dark:border-danger-500/30',
    icon: <AlertCircle className="w-5 h-5 text-danger-500 flex-shrink-0" />,
    text: 'text-danger-700 dark:text-danger-400',
  },
  warning: {
    bg: 'bg-warning-50 dark:bg-warning-500/10',
    border: 'border-warning-200 dark:border-warning-500/30',
    icon: <AlertTriangle className="w-5 h-5 text-warning-500 flex-shrink-0" />,
    text: 'text-warning-700 dark:text-warning-400',
  },
  info: {
    bg: 'bg-primary-50 dark:bg-primary-500/10',
    border: 'border-primary-200 dark:border-primary-500/30',
    icon: <Info className="w-5 h-5 text-primary-500 flex-shrink-0" />,
    text: 'text-primary-700 dark:text-primary-400',
  },
  loading: {
    bg: 'bg-gray-50 dark:bg-gray-800/50',
    border: 'border-gray-200 dark:border-gray-700',
    icon: <Loader2 className="w-5 h-5 text-primary-500 animate-spin flex-shrink-0" />,
    text: 'text-gray-700 dark:text-gray-300',
  },
}

const durations: Record<ToastType, number> = {
  success: 4000,
  error: 6000,
  warning: 5000,
  info: 4000,
  loading: Infinity,
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [isExiting, setIsExiting] = useState(false)
  const [progress, setProgress] = useState(100)
  const progressRef = useRef<number | null>(null)

  const { bg, border, icon, text } = typeStyles[toast.type]
  const duration = toast.duration ?? durations[toast.type]

  useEffect(() => {
    if (duration === Infinity) return

    const startTime = Date.now()
    const animateProgress = () => {
      const elapsed = Date.now() - startTime
      const newProgress = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(newProgress)

      if (newProgress > 0) {
        progressRef.current = requestAnimationFrame(animateProgress)
      }
    }
    progressRef.current = requestAnimationFrame(animateProgress)

    const timeout = setTimeout(() => {
      setIsExiting(true)
      setTimeout(() => onDismiss(toast.id), 200)
    }, duration)

    return () => {
      clearTimeout(timeout)
      if (progressRef.current) cancelAnimationFrame(progressRef.current)
    }
  }, [toast.id, duration, onDismiss])

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(() => onDismiss(toast.id), 200)
  }

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 p-4 rounded-xl border shadow-lg',
        'animate-in',
        isExiting && 'animate-out',
        bg,
        border,
        text
      )}
      style={{
        animationDuration: isExiting ? '200ms' : '300ms',
        animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{toast.message}</p>
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className="mt-2 text-sm font-medium underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-currentColor"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      {toast.dismissible !== false && (
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4 opacity-50 hover:opacity-100" />
        </button>
      )}
      {duration !== Infinity && (
        <div
          className="absolute bottom-0 left-0 h-1 rounded-bl-xl rounded-br-xl bg-current opacity-30"
          style={{ width: `${progress}%`, transition: 'width 100ms linear' }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      )}
    </div>
  )
}

// ============================================
// TOAST CONTAINER
// ============================================

interface ToastContainerProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'
  maxToasts?: number
  gap?: number
}

const positionStyles: Record<string, string> = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
}

export function ToastContainer({
  position = 'top-right',
  maxToasts = 5,
  gap = 8,
}: ToastContainerProps) {
  const { toasts, dismissToast } = useToast()

  const visibleToasts = toasts.slice(-maxToasts)

  return (
    <div
      className={cn(
        'fixed z-[100] flex flex-col pointer-events-none',
        positionStyles[position]
      )}
      style={{ gap: `${gap}px` }}
      aria-live="polite"
      aria-atomic="true"
    >
      {visibleToasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto w-full max-w-sm sm:max-w-md">
          <ToastItem toast={toast} onDismiss={dismissToast} />
        </div>
      ))}
    </div>
  )
}

// ============================================
// TOAST PROVIDER
// ============================================

interface ToastProviderProps {
  children: ReactNode
  position?: ToastContainerProps['position']
  maxToasts?: number
}

let toastId = 0

export function ToastProvider({ children, position = 'top-right', maxToasts = 5 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const generateId = useCallback(() => `toast-${++toastId}-${Date.now()}`, [])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = generateId()
    const newToast = { ...toast, id }
    setToasts(prev => [...prev, newToast])
    return id
  }, [generateId])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const dismissAll = useCallback(() => {
    setToasts([])
  }, [])

  const createToast = useCallback(
    (type: ToastType) => (message: string, options?: Partial<Toast>) =>
      addToast({ type, message, ...options }),
    [addToast]
  )

  const promise = useCallback(async <T,>(
    promise: Promise<T>,
    messages: {
      loading: string
      success: string | ((result: T) => string)
      error: string | ((error: Error) => string)
    }
  ) => {
    const loadingId = addToast({ type: 'loading', message: messages.loading })
    try {
      const result = await promise
      dismissToast(loadingId)
      const successMessage = typeof messages.success === 'function'
        ? messages.success(result)
        : messages.success
      addToast({ type: 'success', message: successMessage })
      return result
    } catch (error) {
      dismissToast(loadingId)
      const errorMessage = typeof messages.error === 'function'
        ? messages.error(error as Error)
        : messages.error
      addToast({ type: 'error', message: errorMessage })
      throw error
    }
  }, [addToast, dismissToast])

  const toast = useMemo<ToastFn>(
    () =>
      Object.assign(
        (t: Omit<Toast, 'id'>) => addToast(t),
        {
          success: createToast('success'),
          error: createToast('error'),
          warning: createToast('warning'),
          info: createToast('info'),
          loading: createToast('loading'),
        }
      ),
    [addToast, createToast]
  )

  const value: ToastContextValue = {
    toasts,
    addToast,
    toast,
    dismissToast,
    dismissAll,
    success: createToast('success'),
    error: createToast('error'),
    warning: createToast('warning'),
    info: createToast('info'),
    loading: createToast('loading'),
    promise,
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer position={position} maxToasts={maxToasts} />
    </ToastContext.Provider>
  )
}

// ============================================
// HOOK FOR DIRECT USAGE (alternative to context)
// ============================================

export function useToastActions() {
  return useToast()
}