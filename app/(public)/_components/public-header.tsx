'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'

interface NavItem {
  href: string
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { href: '/research', label: 'Research' },
  { href: '/framework', label: 'Framework' },
  { href: '/workshops', label: 'Workshops' },
  { href: '/participate', label: 'Participate' },
  { href: '/portal', label: 'Portal' },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/portal') return pathname === '/portal' || pathname.startsWith('/portal/')
  if (href === '/framework')
    return pathname === '/framework' || pathname.startsWith('/framework/')
  return pathname === href
}

/**
 * Public header (PUB-09 / PUB-10).
 *
 * Sticky glassmorphism nav mounted by `app/(public)/layout.tsx` so every
 * `(public)` route inherits the same chrome. Logo on the left, five nav
 * links visible at md+, hamburger menu below md. Active route gets an
 * emerald `#179d53` underline per Phase 21 D-01.
 *
 * Client component because it needs `usePathname()` for active-route state
 * and `useState` for mobile menu open/close (Phase 21 Pitfall 6).
 */
export function PublicHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full bg-[var(--cl-surface-container-low)]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-5 sm:px-8 lg:px-12">
        <Link
          href="/"
          className="text-xl font-semibold tracking-tight text-[var(--cl-primary)]"
          style={{ fontFamily: 'var(--font-cl-headline, Newsreader, serif)' }}
        >
          PolicyDash
        </Link>

        {/* Desktop nav — visible at md+ */}
        <nav className="hidden items-center gap-8 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? 'border-b-2 border-[#179d53] pb-1 text-xs font-semibold uppercase tracking-widest text-[var(--cl-primary)]'
                    : 'text-xs font-semibold uppercase tracking-widest text-[var(--cl-on-surface-variant)] transition-colors duration-300 hover:text-[var(--cl-primary)]'
                }
                style={{ fontFamily: 'var(--font-cl-body, Inter, sans-serif)' }}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Mobile hamburger — visible below md */}
        <button
          type="button"
          className="p-3 md:hidden"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <X className="h-6 w-6 text-[var(--cl-primary)]" aria-hidden="true" />
          ) : (
            <Menu className="h-6 w-6 text-[var(--cl-primary)]" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Mobile menu panel — expands via max-height transition */}
      <div
        className={
          open
            ? 'max-h-96 overflow-hidden border-b border-[var(--cl-outline-variant)] bg-[var(--cl-surface)] transition-[max-height] duration-200 ease-out md:hidden'
            : 'max-h-0 overflow-hidden border-b border-[var(--cl-outline-variant)] bg-[var(--cl-surface)] transition-[max-height] duration-200 ease-out md:hidden'
        }
      >
        <nav className="mx-auto flex max-w-screen-2xl flex-col px-5 py-4 sm:px-8">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={
                  active
                    ? 'py-3 text-xs font-semibold uppercase tracking-widest text-[var(--cl-primary)]'
                    : 'py-3 text-xs font-semibold uppercase tracking-widest text-[var(--cl-on-surface-variant)]'
                }
                style={{ fontFamily: 'var(--font-cl-body, Inter, sans-serif)' }}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
