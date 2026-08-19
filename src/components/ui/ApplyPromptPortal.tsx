'use client'

import { createPortal } from 'react-dom'
import { X, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ApplyPromptPortalProps } from '@/hooks/useApplyPrompt'

export function ApplyPromptPortal({
  isOpen,
  jobTitle,
  jobCompany,
  onClose,
  onConfirm,
  confirming = false,
}: ApplyPromptPortalProps) {
  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
          Have you applied?
        </h4>
        <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
          Did you submit an application for{' '}
          <span className="font-medium text-gray-900 dark:text-white">{jobTitle}</span>{' '}
          at <span className="font-medium text-gray-900 dark:text-white">{jobCompany}</span>?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Not yet
          </Button>
          <Button variant="primary" size="sm" onClick={onConfirm} disabled={confirming}>
            {confirming ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Yes, I applied
              </>
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}