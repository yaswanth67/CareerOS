'use client'

import { useState } from 'react'
import { FilterPanel, FilterTrigger } from './FilterPanel'

export function JobFilters() {
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
    <div className="card p-4">
      {/* Advanced Filters Trigger */}
      <div className="flex items-center justify-end">
        <FilterTrigger isOpen={showAdvanced} onClick={() => setShowAdvanced(true)} />
      </div>

      {/* Advanced Filter Panel */}
      <FilterPanel
        isOpen={showAdvanced}
        onClose={() => setShowAdvanced(false)}
      />
    </div>
  )
}