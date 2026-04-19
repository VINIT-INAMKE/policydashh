'use client'

import { useState } from 'react'
import { trpc } from '@/src/trpc/client'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Loader2, Mail, RotateCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const ROLE_DISPLAY: Record<string, string> = {
  admin: 'Admin',
  policy_lead: 'Policy Lead',
  research_lead: 'Research Lead',
  workshop_moderator: 'Workshop Moderator',
  stakeholder: 'Stakeholder',
  observer: 'Observer',
  auditor: 'Auditor',
}

type InviteRole =
  | 'admin'
  | 'policy_lead'
  | 'research_lead'
  | 'workshop_moderator'
  | 'stakeholder'
  | 'observer'
  | 'auditor'

/**
 * C4: Pending invitations panel. Lists open Clerk invitations with
 * resend/revoke actions so admins don't have to drop into Clerk dashboard.
 */
export function PendingInvitationsTable() {
  const utils = trpc.useUtils()
  const [busyId, setBusyId] = useState<string | null>(null)

  const invitesQuery = trpc.user.listPendingInvitations.useQuery({
    status: 'pending',
    limit: 50,
    offset: 0,
  })

  const revokeMutation = trpc.user.revokeInvitation.useMutation({
    onSuccess: () => {
      utils.user.listPendingInvitations.invalidate()
      toast.success('Invitation revoked.')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to revoke invitation.')
    },
    onSettled: () => setBusyId(null),
  })

  const resendMutation = trpc.user.resendInvitation.useMutation({
    onSuccess: () => {
      utils.user.listPendingInvitations.invalidate()
      toast.success('Invitation resent.')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to resend invitation.')
    },
    onSettled: () => setBusyId(null),
  })

  const invites = invitesQuery.data?.data ?? []

  return (
    <div className="space-y-2">
      <div>
        <h2 className="text-base font-semibold">Pending Invitations</h2>
        <p className="text-xs text-muted-foreground">
          Invitations that have not yet been accepted.
        </p>
      </div>
      {invitesQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      ) : invites.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
          <Mail className="size-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No pending invitations.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invites.map((inv) => {
              const roleLabel = inv.role ? ROLE_DISPLAY[inv.role] ?? inv.role : '--'
              const isBusy = busyId === inv.id
              return (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.emailAddress}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{roleLabel}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(inv.createdAt), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isBusy || !inv.role}
                        onClick={() => {
                          if (!inv.role) return
                          setBusyId(inv.id)
                          resendMutation.mutate({
                            invitationId: inv.id,
                            email: inv.emailAddress,
                            role: inv.role as InviteRole,
                          })
                        }}
                      >
                        {isBusy && resendMutation.isPending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RotateCw className="size-3.5" />
                        )}
                        Resend
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => {
                          setBusyId(inv.id)
                          revokeMutation.mutate({ invitationId: inv.id })
                        }}
                      >
                        {isBusy && revokeMutation.isPending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <X className="size-3.5" />
                        )}
                        Revoke
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
