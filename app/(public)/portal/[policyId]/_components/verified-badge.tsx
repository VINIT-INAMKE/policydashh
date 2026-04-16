import { ShieldCheck } from 'lucide-react'

interface VerifiedBadgeProps {
  txHash: string | null | undefined
}

export function VerifiedBadge({ txHash }: VerifiedBadgeProps) {
  // D-11: No badge for unanchored versions/milestones
  if (!txHash) return null

  const cardanoscanUrl = `https://preview.cardanoscan.io/transaction/${txHash}`

  return (
    <a
      href={cardanoscanUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Verified on Cardano — view transaction"
      className="inline-flex items-center gap-1 rounded-full bg-[var(--status-cr-merged-bg)] text-[var(--status-cr-merged-text)] px-2 py-0.5 text-xs font-semibold"
    >
      <ShieldCheck className="size-3.5" aria-hidden="true" />
      Verified
    </a>
  )
}
