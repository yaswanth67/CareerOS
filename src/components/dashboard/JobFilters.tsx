'use client'

import { AdvancedFilters } from './AdvancedFilters'

export function JobFilters() {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-end">
        <AdvancedFilters />
      </div>
    </div>
  )
}
