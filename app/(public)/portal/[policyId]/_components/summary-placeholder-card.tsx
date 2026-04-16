/**
 * Summary placeholder - muted "under review" card rendered for sections
 * whose consultation summary is pending, blocked, or errored.
 *
 * Used by SectionSummaryBlock (portal) when a section has an entry in
 * the JSONB but its status !== 'approved'. Takes ZERO props - the only
 * information it displays is static copy, so no internal-only metadata
 * can cross into this component (Phase 21 Pitfall 1).
 */
export function SummaryPlaceholderCard() {
  return (
    <div className="mt-8 rounded-lg border border-[var(--cl-outline-variant)] bg-[var(--cl-surface-container)] p-6">
      <h3
        className="text-base font-semibold text-[var(--cl-on-surface-variant)]"
        style={{ fontFamily: 'var(--font-cl-headline, Newsreader, serif)' }}
      >
        Summary under review
      </h3>
      <p
        className="mt-2 text-sm text-[var(--cl-on-surface-variant)]"
        style={{ fontFamily: 'var(--font-cl-body, Inter, sans-serif)' }}
      >
        The consultation summary for this section is being reviewed before publication.
      </p>
    </div>
  )
}
