'use client'

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-2" />
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-64" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2" />
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24" />
              </div>
              <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            </div>
          </div>
        ))}
      </div>

      {/* Filters skeleton */}
      <div className="card p-4">
        <div className="h-10">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="mt-4 flex items-center gap-2">
            <div className="h-8 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </div>

      {/* Job list skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="card overflow-hidden animate-pulse">
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
                {[...Array(5)].map((_, j) => (
                  <div key={j} className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                ))}
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="h-10 w-full sm:w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-10 w-full sm:w-32 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}