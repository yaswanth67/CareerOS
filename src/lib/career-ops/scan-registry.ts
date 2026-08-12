/**
 * A module-level home for the in-flight resume scan.
 *
 * The scan takes 4–6 minutes. It used to live entirely in React state inside
 * ResumeSuggestions, which meant navigating to another page unmounted the
 * component, orphaned the request, and — because the auto-scan effect re-fires
 * whenever it mounts with no cached suggestions — started a completely new scan
 * on the way back. A scan could therefore never finish if you looked at
 * anything else while waiting.
 *
 * A module lives as long as the tab does, so parking the promise here lets any
 * mount *adopt* the run already in progress instead of starting a second one:
 * the same request keeps going, the elapsed time keeps counting from when it
 * actually started, and whichever mount is on screen when it resolves shows the
 * result.
 *
 * Scope: client-side navigation within the tab. A hard reload still discards it
 * — the request belongs to the page that issued it.
 */

export interface ScanResult {
  suggestions: unknown[]
  markdown: string
}

interface ActiveScan {
  promise: Promise<ScanResult>
  controller: AbortController
  startedAt: number
  /** Which resume this run is for, so a different pick starts its own scan. */
  resumeId: string
}

let active: ActiveScan | null = null

/** The scan currently running, or null. */
export function getActiveScan(): ActiveScan | null {
  return active
}

/** Seconds since the active scan began — for an elapsed counter that survives remounts. */
export function activeScanElapsed(): number {
  if (!active) return 0
  return Math.floor((Date.now() - active.startedAt) / 1000)
}

/**
 * Start a scan, or hand back the one already running for this resume.
 *
 * `runner` receives the AbortSignal so the caller keeps ownership of how the
 * request is made; this module only tracks it.
 */
export function startOrAdoptScan(
  resumeId: string,
  runner: (signal: AbortSignal) => Promise<ScanResult>
): ActiveScan {
  if (active && active.resumeId === resumeId) return active

  // A pick of a different resume supersedes the previous run.
  if (active) active.controller.abort()

  const controller = new AbortController()
  const startedAt = Date.now()
  const promise = runner(controller.signal).finally(() => {
    // Only clear if this is still the current run — a newer scan may have
    // replaced it while this one was settling.
    if (active?.startedAt === startedAt) active = null
  })

  active = { promise, controller, startedAt, resumeId }
  return active
}

/** Abort the active scan at the user's request. */
export function cancelActiveScan(): void {
  active?.controller.abort()
  active = null
}
