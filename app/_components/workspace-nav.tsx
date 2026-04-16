'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface WorkspaceNavProps {
  userRole?: string
}

export function WorkspaceNav({ userRole }: WorkspaceNavProps) {
  const pathname = usePathname()

  const navItems = useMemo(() => {
    // D-14: canonical order - Dashboard, Policies, Feedback, Workshops, Users, Audit
    // D-15: NO /notifications link (bell stays in header only)
    const items: { href: string; label: string }[] = [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/policies', label: 'Policies' },
      { href: '/feedback', label: 'Feedback' },
      { href: '/workshop-manage', label: 'Workshops' },
    ]
    if (userRole === 'admin' || userRole === 'policy_lead') {
      items.push({ href: '/users', label: 'Users' })
    }
    if (userRole === 'admin' || userRole === 'auditor') {
      items.push({ href: '/audit', label: 'Audit' })
    }
    return items
  }, [userRole])

  return (
    <nav className="flex items-center gap-4">
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'text-sm transition-colors hover:text-foreground',
              isActive
                ? 'font-semibold text-foreground'
                : 'text-muted-foreground'
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
