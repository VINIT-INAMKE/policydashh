'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { subDays, format } from 'date-fns'
import { UserX, ChevronUp, ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { StatCard } from './stat-card'

interface UserWithEngagement {
  id: string
  name: string | null
  email: string | null
  role: string
  orgType: string | null
  createdAt: Date | string
  lastActivityAt: Date | string
  engagementScore: number
}

interface InactiveUsersWidgetProps {
  users: UserWithEngagement[]
}

const ROLE_DISPLAY: Record<string, string> = {
  admin: 'Admin',
  policy_lead: 'Policy Lead',
  research_lead: 'Research Lead',
  workshop_moderator: 'Workshop Moderator',
  stakeholder: 'Stakeholder',
  observer: 'Observer',
  auditor: 'Auditor',
}

const ORG_TYPE_DISPLAY: Record<string, string> = {
  government: 'Government',
  industry: 'Industry',
  legal: 'Legal',
  academia: 'Academia',
  civil_society: 'Civil Society',
  internal: 'Internal',
}

const WINDOW_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
]

export function InactiveUsersWidget({ users }: InactiveUsersWidgetProps) {
  const [windowDays, setWindowDays] = useState('30')
  const [sortKey, setSortKey] = useState('lastActivityAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const inactiveUsers = useMemo(() => {
    const cutoff = subDays(new Date(), parseInt(windowDays))
    return users
      .filter(u => new Date(u.lastActivityAt) < cutoff)
      .sort((a, b) => {
        let cmp = 0
        if (sortKey === 'name') {
          cmp = (a.name ?? '').localeCompare(b.name ?? '')
        } else if (sortKey === 'lastActivityAt') {
          cmp = new Date(a.lastActivityAt).getTime() - new Date(b.lastActivityAt).getTime()
        } else if (sortKey === 'engagementScore') {
          cmp = a.engagementScore - b.engagementScore
        }
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [users, windowDays, sortKey, sortDir])

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function SortIcon({ column }: { column: string }) {
    if (sortKey !== column) return null
    return sortDir === 'asc'
      ? <ChevronUp className="ml-1 inline size-4 text-foreground" />
      : <ChevronDown className="ml-1 inline size-4 text-foreground" />
  }

  return (
    <div className="space-y-4">
      {/* Single-card row for inactive count stat */}
      <div className="grid grid-cols-1">
        <StatCard
          icon={<UserX className="size-5" />}
          value={inactiveUsers.length}
          label="Inactive Users"
        />
      </div>

      {/* Widget card with table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            <h2 className="text-xl font-semibold">Inactive Users</h2>
          </CardTitle>
          <Select value={windowDays} onValueChange={(v) => v && setWindowDays(v)}>
            <SelectTrigger className="w-[120px]" aria-label="Inactivity window">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOW_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {inactiveUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <UserX className="size-10 text-muted-foreground" aria-hidden="true" />
              <h3 className="mt-4 text-sm font-semibold text-foreground">All users are active</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                No users have been inactive for the selected window.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="min-h-[44px] cursor-pointer select-none"
                    onClick={() => toggleSort('name')}
                    aria-sort={sortKey === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    Name <SortIcon column="name" />
                  </TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Org Type</TableHead>
                  <TableHead
                    className="min-h-[44px] cursor-pointer select-none"
                    onClick={() => toggleSort('lastActivityAt')}
                    aria-sort={sortKey === 'lastActivityAt' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    Last Active <SortIcon column="lastActivityAt" />
                  </TableHead>
                  <TableHead
                    className="min-h-[44px] cursor-pointer select-none"
                    onClick={() => toggleSort('engagementScore')}
                    aria-sort={sortKey === 'engagementScore' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    Score <SortIcon column="engagementScore" />
                  </TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {inactiveUsers.map(user => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Link
                        href={`/users/${user.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {user.name || '--'}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {ROLE_DISPLAY[user.role] ?? user.role}
                    </TableCell>
                    <TableCell className="text-sm">
                      {user.orgType ? (ORG_TYPE_DISPLAY[user.orgType] ?? user.orgType) : '--'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(user.lastActivityAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.engagementScore}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" render={<Link href={`/users/${user.id}`} />}>
                        View Profile
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
