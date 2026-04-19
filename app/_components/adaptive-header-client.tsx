'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { Menu, X } from 'lucide-react'
import { NotificationBell } from './notification-bell'

interface NavItem {
  href: string
  label: string
}

const PUBLIC_NAV: NavItem[] = [
  { href: '/research', label: 'Research' },
  { href: '/framework', label: 'Framework' },
  { href: '/workshops', label: 'Workshops' },
  { href: '/participate', label: 'Participate' },
  { href: '/portal', label: 'Portal' },
]

const PUBLIC_PAGES_SECTION: NavItem[] = [
  { href: '/portal', label: 'Portal' },
  { href: '/research', label: 'Research' },
  { href: '/framework', label: 'Framework' },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}

interface AdaptiveHeaderClientProps {
  userId: string | null
  userRole: string | null
}

export function AdaptiveHeaderClient({ userId, userRole }: AdaptiveHeaderClientProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const isLoggedIn = !!userId

  const logoHref = isLoggedIn ? '/dashboard' : '/'

  const navItems = useMemo(() => {
    if (!isLoggedIn) return PUBLIC_NAV

    const items: NavItem[] = [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/policies', label: 'Policies' },
      { href: '/workshops', label: 'Workshops' },
    ]

    // All roles except observer get Feedback
    if (userRole !== 'observer') {
      items.push({ href: '/feedback', label: 'Feedback' })
    }

    // admin, workshop_moderator get Workshop Manage
    if (userRole === 'admin' || userRole === 'workshop_moderator') {
      items.push({ href: '/workshop-manage', label: 'Workshop Manage' })
    }

    // C1: /users is admin-only on the server (permissions.ts `user:list` and
    // the server guards in app/users/page.tsx). Keep the nav link in sync to
    // avoid policy_lead clicking through to an immediate redirect.
    if (userRole === 'admin') {
      items.push({ href: '/users', label: 'Users' })
    }

    // admin, auditor get Audit
    if (userRole === 'admin' || userRole === 'auditor') {
      items.push({ href: '/audit', label: 'Audit' })
    }

    return items
  }, [isLoggedIn, userRole])

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--cl-outline-variant-20)] bg-[var(--cl-surface)]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-5 sm:px-8 lg:px-12">
        {/* Logo */}
        <Link
          href={logoHref}
          className="text-xl font-semibold tracking-tight text-[var(--cl-primary)] font-headline"
        >
          Civilization Lab
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? 'rounded-md bg-[var(--cl-primary-container)] px-3 py-1.5 text-sm font-medium text-[var(--cl-on-primary-container)]'
                    : 'rounded-md px-3 py-1.5 text-sm font-medium text-[var(--cl-on-surface-variant)] transition-colors hover:bg-[var(--cl-surface-container)] hover:text-[var(--cl-on-surface)]'
                }
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <>
              <NotificationBell />
              <UserButton />
            </>
          ) : (
            <Link
              href="/sign-in"
              className="bg-[var(--cl-primary)] text-[var(--cl-on-primary)] px-4 py-2 rounded-sm text-sm font-medium transition-transform active:scale-95 duration-200"
            >
              Sign In
            </Link>
          )}

          {/* Mobile hamburger */}
          <button
            type="button"
            className="p-2 md:hidden"
            aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? (
              <X className="h-6 w-6 text-[var(--cl-on-surface)]" aria-hidden="true" />
            ) : (
              <Menu className="h-6 w-6 text-[var(--cl-on-surface)]" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={
          mobileOpen
            ? 'max-h-[32rem] overflow-hidden border-t border-[var(--cl-outline-variant-20)] bg-[var(--cl-surface)] transition-[max-height] duration-200 ease-out md:hidden'
            : 'max-h-0 overflow-hidden transition-[max-height] duration-200 ease-out md:hidden'
        }
      >
        <nav className="mx-auto flex max-w-screen-2xl flex-col px-5 py-4 sm:px-8">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={
                  active
                    ? 'rounded-md bg-[var(--cl-primary-container)] px-3 py-3 text-sm font-medium text-[var(--cl-on-primary-container)]'
                    : 'px-3 py-3 text-sm font-medium text-[var(--cl-on-surface-variant)] transition-colors hover:text-[var(--cl-on-surface)]'
                }
              >
                {item.label}
              </Link>
            )
          })}

          {/* Public pages section for logged-in users */}
          {isLoggedIn && (
            <>
              <div className="mt-4 mb-2 border-t border-[var(--cl-outline-variant-20)] pt-4">
                <span className="px-3 text-xs font-semibold uppercase tracking-wider text-[var(--cl-on-surface-variant)]">
                  Public Pages
                </span>
              </div>
              {PUBLIC_PAGES_SECTION.map((item) => (
                <Link
                  key={`public-${item.href}`}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-3 text-sm font-medium text-[var(--cl-on-surface-variant)] transition-colors hover:text-[var(--cl-on-surface)]"
                >
                  {item.label}
                </Link>
              ))}
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
