/**
 * Timeout budget for career-ops generations, in one place so the layers cannot
 * drift out of order.
 *
 * They had drifted: a real "Scan resume & suggest roles" run against the local
 * Claude router takes ~263 seconds, while the browser aborted the request at
 * 240. Every scan was killed roughly twenty seconds before its results arrived,
 * so the page span forever and then reported a timeout — the work had actually
 * succeeded on the server each time.
 *
 * The ordering that matters:
 *
 *   CLIENT_ABORT_MS  <  SDK_TIMEOUT_MS
 *
 * The browser gives up slightly first so the user gets a written explanation
 * instead of a bare connection error, and both sit far enough above real
 * observed durations that a slow-but-working generation is never cut off.
 * These runs are genuinely slow — the router streams on the order of single
 * digit tokens per second — so the ceilings are deliberately generous.
 */

/** How long the Anthropic SDK waits for the proxy before failing the request. */
export const SDK_TIMEOUT_MS = 600_000 // 10 minutes

/** How long the browser waits before aborting and explaining what happened. */
export const CLIENT_ABORT_MS = 570_000 // 9.5 minutes — just under the SDK

/** Realistic duration to quote in the UI while a generation runs. */
export const TYPICAL_DURATION_LABEL = '4–6 minutes'

/** Message shown when the client abort actually fires. */
export const CLIENT_TIMEOUT_MESSAGE =
  `Timed out after ${Math.round(CLIENT_ABORT_MS / 60_000)} minutes. ` +
  'Your Claude connection on port 20128 is not responding — check that it is running, then retry.'
