import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-[var(--cl-outline-variant-20)] bg-[var(--cl-surface-container-low)]">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
        <p className="text-sm text-[var(--cl-on-surface-variant)]">
          Published by Civilization Lab
        </p>
        <nav className="flex items-center gap-4 text-sm text-[var(--cl-on-surface-variant)]">
          <Link href="/portal" className="hover:text-[var(--cl-on-surface)]">Portal</Link>
          <Link href="/research" className="hover:text-[var(--cl-on-surface)]">Research</Link>
          <Link href="/framework" className="hover:text-[var(--cl-on-surface)]">Framework</Link>
        </nav>
      </div>
    </footer>
  )
}
