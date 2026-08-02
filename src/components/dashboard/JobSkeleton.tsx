'use client'

export function JobSkeleton() {
  return (
    <div className="card overflow-hidden animate-pulse">
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          </div>
          <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0" />
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-28" />
        </div>
        <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="flex flex-wrap gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="h-10 w-full sm:w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-10 w-full sm:w-32 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    </div>
  )
}