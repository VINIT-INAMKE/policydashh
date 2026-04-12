import { redirect } from 'next/navigation'

/**
 * Legacy route — folded into /feedback?tab=evidence-gaps (Phase 13 D-10).
 * Preserves old bookmarks and notification deep links.
 */
export default function EvidenceGapsPage() {
  redirect('/feedback?tab=evidence-gaps')
}
