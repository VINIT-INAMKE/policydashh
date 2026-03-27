'use client'

import { useState } from 'react'
import { trpc } from '@/src/trpc/client'
import { Users, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { format } from 'date-fns'
import { InviteUserDialog } from './invite-user-dialog'

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

export function UsersClient() {
  const [inviteOpen, setInviteOpen] = useState(false)

  const usersQuery = trpc.user.listUsers.useQuery()

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">User Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage users, roles, and invitations.
          </p>
        </div>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <UserPlus className="mr-1 h-4 w-4" />
          Invite User
        </Button>
      </div>

      {usersQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : !usersQuery.data || usersQuery.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="size-12 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">No users found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Invite users to get started.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Org Type</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersQuery.data.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.name || <span className="text-muted-foreground">--</span>}
                </TableCell>
                <TableCell>
                  {user.email || <span className="text-muted-foreground">--</span>}
                </TableCell>
                <TableCell>
                  {/* TODO: Replace with a role-change dropdown when role update mutation is available */}
                  <Badge variant="secondary">
                    {ROLE_DISPLAY[user.role] ?? user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  {user.orgType
                    ? ORG_TYPE_DISPLAY[user.orgType] ?? user.orgType
                    : <span className="text-muted-foreground">--</span>}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(user.createdAt), 'MMM d, yyyy')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  )
}
