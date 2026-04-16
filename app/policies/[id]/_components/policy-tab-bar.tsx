'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface Tab {
  label: string
  href: string
  match: 'exact' | 'startsWith'
  visible: boolean
}

interface PolicyTabBarProps {
  documentId: string
  canViewCR: boolean
  canViewTrace: boolean
  canViewMilestones: boolean
}

export function PolicyTabBar({ documentId, canViewCR, canViewTrace, canViewMilestones }: PolicyTabBarProps) {
  const pathname = usePathname()

  const tabs: Tab[] = [
    { label: 'Content', href: `/policies/${documentId}`, match: 'exact', visible: true },
    { label: 'Feedback', href: `/policies/${documentId}/feedback`, match: 'startsWith', visible: true },
    {
      label: 'Change Requests',
      href: `/policies/${documentId}/change-requests`,
      match: 'startsWith',
      visible: canViewCR,
    },
    { label: 'Versions', href: `/policies/${documentId}/versions`, match: 'startsWith', visible: true },
    {
      label: 'Milestones',
      href: `/policies/${documentId}/milestones`,
      match: 'startsWith',
      visible: canViewMilestones,
    },
    {
      label: 'Traceability',
      href: `/policies/${documentId}/traceability`,
      match: 'startsWith',
      visible: canViewTrace,
    },
  ]

  const visibleTabs = tabs.filter((t) => t.visible)

  return (
    <nav
      className="shrink-0 overflow-x-auto whitespace-nowrap border-b border-border px-6 pt-2"
      aria-label="Policy sections"
    >
      <div className="flex gap-1">
        {visibleTabs.map((tab) => {
          const isActive =
            tab.match === 'exact'
              ? pathname === tab.href
              : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative inline-flex h-9 items-center px-3 text-sm font-semibold transition-colors',
                'after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:bg-foreground after:opacity-0 after:transition-opacity',
                isActive
                  ? 'text-foreground after:opacity-100'
                  : 'text-foreground/60 hover:text-foreground'
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
