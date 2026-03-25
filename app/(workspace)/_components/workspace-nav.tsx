'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface WorkspaceNavProps {
  userRole?: string
}

const baseNavItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/policies', label: 'Policies' },
  { href: '/feedback', label: 'Feedback' },
]

export function WorkspaceNav({ userRole }: WorkspaceNavProps) {
  const pathname = usePathname()

  const navItems = useMemo(() => {
    const items = [...baseNavItems]
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
