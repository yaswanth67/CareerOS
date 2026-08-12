import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** Evaluate now lives as a tab on the merged AI Career page. */
export default function EvaluatePage() {
  redirect('/ai?tab=evaluate')
}
