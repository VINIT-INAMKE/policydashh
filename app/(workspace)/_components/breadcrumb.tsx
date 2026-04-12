'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { Fragment } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { trpc } from '@/src/trpc/client'
import { cn } from '@/lib/utils'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  policies: 'Policies',
  feedback: 'Feedback',
  workshops: 'Workshops',
  users: 'Users',
  audit: 'Audit',
  'change-requests': 'Change Requests',
  versions: 'Versions',
  traceability: 'Traceability',
  notifications: 'Notifications',
  outcomes: 'My Outcomes',
  'evidence-gaps': 'Evidence Gaps',
}

interface Crumb {
  key: string
  // null label = still loading (show Skeleton)
  label: string | null
  // null href = current page (not a link)
  href: string | null
  hideOnMobile: boolean
}

export function Breadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  // Detect entity IDs by position:
  //   /policies/{uuid}[/...]   → segment[1] is policy UUID
  //   /workshops/{uuid}[/...]  → segment[1] is workshop UUID
  const policyId =
    segments[0] === 'policies' && segments[1] && UUID_REGEX.test(segments[1])
      ? segments[1]
      : null
  const workshopId =
    segments[0] === 'workshops' && segments[1] && UUID_REGEX.test(segments[1])
      ? segments[1]
      : null

  const policyQuery = trpc.document.getById.useQuery(
    { id: policyId ?? '' },
    { enabled: Boolean(policyId) }
  )
  const workshopQuery = trpc.workshop.getById.useQuery(
    { workshopId: workshopId ?? '' },
    { enabled: Boolean(workshopId) }
  )

  const crumbs: Crumb[] = []
  let accumulated = ''
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    accumulated += '/' + seg
    const isLast = i === segments.length - 1

    let label: string | null
    if (UUID_REGEX.test(seg)) {
      if (seg === policyId) {
        // null when loading → caller renders Skeleton
        label = policyQuery.data?.title ?? null
      } else if (seg === workshopId) {
        label = workshopQuery.data?.title ?? null
      } else {
        // Fallback: short id prefix
        label = seg.slice(0, 8)
      }
    } else {
      label = ROUTE_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1)
    }

    crumbs.push({
      key: accumulated,
      label,
      href: isLast ? null : accumulated,
      // Hide middle crumbs on mobile; keep first and direct parent and current
      hideOnMobile:
        !isLast && i !== segments.length - 2 && i !== 0,
    })
  }

  if (crumbs.length === 0) return null

  return (
    <nav
      aria-label="Breadcrumb"
      className="shrink-0 border-b border-border bg-muted/50 px-6 py-2"
    >
      <ol className="flex items-center gap-1 text-sm">
        {crumbs.map((crumb, idx) => (
          <Fragment key={crumb.key}>
            {idx > 0 && (
              <li
                className={cn(
                  'flex items-center',
                  crumb.hideOnMobile && 'hidden sm:flex'
                )}
              >
                <ChevronRight
                  className="h-3 w-3 text-muted-foreground"
                  aria-hidden="true"
                />
              </li>
            )}
            <li
              className={cn(
                'flex items-center',
                crumb.hideOnMobile && 'hidden sm:inline'
              )}
            >
              {crumb.label === null ? (
                <Skeleton className="inline-block h-4 w-24 align-middle" />
              ) : crumb.href ? (
                <Link
                  href={crumb.href}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className="font-medium text-foreground"
                  aria-current="page"
                >
                  {crumb.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}
