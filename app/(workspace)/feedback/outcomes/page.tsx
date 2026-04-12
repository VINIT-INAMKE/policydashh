import { redirect } from 'next/navigation'

/**
 * Legacy route — folded into /feedback?tab=outcomes (Phase 13 D-10).
 * Preserves old bookmarks and notification deep links.
 */
export default function OutcomesPage() {
  redirect('/feedback?tab=outcomes')
}
