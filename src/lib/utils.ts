import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatRelativeTime(date: Date | string): string {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(d)
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-success-600 bg-success-100 dark:bg-success-500/20 dark:text-success-400'
  if (score >= 60) return 'text-warning-600 bg-warning-100 dark:bg-warning-500/20 dark:text-warning-400'
  return 'text-danger-600 bg-danger-100 dark:bg-danger-500/20 dark:text-danger-400'
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Strong Match'
  if (score >= 60) return 'Good Match'
  if (score >= 40) return 'Weak Match'
  return 'Poor Match'
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return text.slice(0, length).trim() + '...'
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

/**
 * SQLite has no native array type, so array-valued columns (skills, requirements,
 * experience, education, matchedSkills, missingSkills) are stored as JSON strings.
 * This safely converts a stored value back into an array.
 */
export function parseJsonArray<T = unknown>(
  value: string | string[] | null | undefined,
  fallback: T[] = []
): T[] {
  if (Array.isArray(value)) return value as T[]
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? (parsed as T[]) : fallback
    } catch {
      return fallback
    }
  }
  return fallback
}

/** Serialize an array for storage in a JSON-string column. */
export function stringifyJsonArray(value: unknown): string {
  return JSON.stringify(value ?? [])
}