'use client'

import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

/** Nothing to subscribe to — "are we on the client" never changes after mount. */
const neverChanges = () => () => {}

/**
 * True once rendering on the client, false during server rendering.
 *
 * useSyncExternalStore rather than the usual `useState(false)` +
 * `useEffect(() => setMounted(true))`: that pattern sets state synchronously
 * inside an effect, which triggers a cascading render (and is what the
 * react-hooks lint rule flags). Here the server snapshot is simply `false` and
 * the client snapshot `true`, with no state to write.
 */
function useIsClient(): boolean {
  return useSyncExternalStore(
    neverChanges,
    () => true,
    () => false
  )
}

/**
 * Renders drawers and modals into <body> instead of where they sit in the tree.
 *
 * Why this exists: a `position: fixed` element is positioned against the
 * viewport *only* if no ancestor establishes a containing block. Any non-`none`
 * transform, filter, backdrop-filter, will-change, perspective or paint
 * containment on an ancestor takes over that job — and the page wrappers here
 * carry `.animate-in`, whose fill mode leaves `transform: matrix(1,0,0,1,0,0)`
 * behind once the entrance animation settles. An identity transform still
 * counts, so `fixed right-0 top-0 h-screen` was resolving against a
 * `max-w-3xl` wrapper: the drawer opened three-quarters of the way across the
 * page, inset from the top, and never reached the right edge or full height.
 *
 * Escaping to <body> fixes it for good, rather than chasing whichever wrapper
 * happens to have a transform today.
 *
 * The mount guard keeps this safe during server rendering, where there is no
 * document to portal into.
 */
export function DrawerPortal({ children }: { children: React.ReactNode }) {
  const isClient = useIsClient()

  if (!isClient || typeof document === 'undefined') return null
  return createPortal(children, document.body)
}
