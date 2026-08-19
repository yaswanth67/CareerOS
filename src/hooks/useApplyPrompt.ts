'use client'

import { useState, useEffect, useCallback } from 'react'

/** Shared sessionStorage key — must match JobCard.tsx and JobDetailDrawer.tsx */
const PENDING_APPLY_KEY = 'pendingApplyCheck'

interface PendingApply {
  jobId: string
  title: string
  company: string
}

export function useApplyPrompt(jobId: string, savedStatus?: string | null) {
  const [showPrompt, setShowPrompt] = useState(false)

  /** Call this when the user clicks an Apply link. Stores the job in sessionStorage. */
  const rememberPendingApply = useCallback((applyJobId?: string) => {
    try {
      sessionStorage.setItem(PENDING_APPLY_KEY, JSON.stringify({ jobId: applyJobId ?? jobId }))
    } catch {
      // storage unavailable — the prompt just won't fire on return
    }
  }, [jobId])

  /** Clear the pending apply and hide the prompt. */
  const clearPendingApply = useCallback(() => {
    try {
      sessionStorage.removeItem(PENDING_APPLY_KEY)
    } catch {
      // ignore
    }
    setShowPrompt(false)
  }, [])

  /** Check sessionStorage and show prompt if this job was the last one opened. */
  const checkPendingApply = useCallback(() => {
    if (savedStatus === 'APPLIED') return
    try {
      const raw = sessionStorage.getItem(PENDING_APPLY_KEY)
      if (!raw) return
      const pending = JSON.parse(raw) as PendingApply
      if (pending && pending.jobId === jobId) {
        // Defer to next tick to avoid synchronous setState in effect (lint warning)
        setTimeout(() => setShowPrompt(true), 0)
      }
    } catch {
      // ignore malformed/blocked storage
    }
  }, [jobId, savedStatus])

  /** Run on mount and whenever the tab regains focus. */
  useEffect(() => {
    checkPendingApply()
    window.addEventListener('focus', checkPendingApply)
    return () => window.removeEventListener('focus', checkPendingApply)
  }, [checkPendingApply])

  return { showPrompt, rememberPendingApply, clearPendingApply }
}

/** Render the "Have you applied?" portal. Pass handlers from the parent. */
export interface ApplyPromptPortalProps {
  isOpen: boolean
  jobTitle: string
  jobCompany: string
  onClose: () => void
  onConfirm: () => void
  confirming?: boolean
}