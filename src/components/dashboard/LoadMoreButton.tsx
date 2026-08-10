'use client'

import { useRouter } from 'next/navigation'

// Appends the next batch of jobs to the feed. Uses router.replace with
// scroll:false so loading more doesn't jump the user back to the top of the
// list — the page re-renders server-side with the extra jobs already included.
export function LoadMoreButton({ href }: { href: string }) {
  const router = useRouter()

  return (
    <button
      className="btn-secondary w-full sm:w-auto self-center"
      onClick={() => router.replace(href, { scroll: false })}
    >
      Load More Jobs
    </button>
  )
}
