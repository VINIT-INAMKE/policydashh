import Link from 'next/link'

/**
 * Public footer (PUB-09 / PUB-10).
 *
 * Server component — no hooks, no state. Mounted by `app/(public)/layout.tsx`
 * so every `(public)` route inherits the same attribution chrome. Single-row,
 * low-chrome: "Published by PolicyDash" on the left, "Internal Login" link
 * on the right. Zero Clerk imports per Phase 9 (public) route group rule.
 */
export function PublicFooter() {
  return (
    <footer className="border-t border-[var(--cl-outline-variant)] bg-[var(--cl-surface)]">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-5 py-6 sm:px-8 lg:px-12">
        <span
          className="text-sm text-[var(--cl-on-surface-variant)]"
          style={{ fontFamily: 'var(--font-cl-body, Inter, sans-serif)' }}
        >
          Published by PolicyDash
        </span>
        <Link
          href="/sign-in"
          className="text-sm text-[var(--cl-on-surface-variant)] transition-colors hover:text-[var(--cl-primary)]"
          style={{ fontFamily: 'var(--font-cl-body, Inter, sans-serif)' }}
        >
          Internal Login
        </Link>
      </div>
    </footer>
  )
}
