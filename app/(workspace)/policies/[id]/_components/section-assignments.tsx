'use client'

import { useState } from 'react'
import { UserPlus, X, Users } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface SectionAssignmentsProps {
  sectionId: string
}

export function SectionAssignments({ sectionId }: SectionAssignmentsProps) {
  const [open, setOpen] = useState(false)
  const utils = trpc.useUtils()

  const assignedQuery = trpc.sectionAssignment.listBySection.useQuery({ sectionId })
  const usersQuery = trpc.user.listUsers.useQuery()

  const assignMutation = trpc.sectionAssignment.assign.useMutation({
    onSuccess: () => {
      utils.sectionAssignment.listBySection.invalidate({ sectionId })
      toast.success('User assigned to section')
    },
    onError: (err) => toast.error(err.message),
  })

  const unassignMutation = trpc.sectionAssignment.unassign.useMutation({
    onSuccess: () => {
      utils.sectionAssignment.listBySection.invalidate({ sectionId })
      toast.success('User removed from section')
    },
    onError: (err) => toast.error(err.message),
  })

  const assignedUserIds = new Set(
    (assignedQuery.data ?? []).map((a: { userId: string }) => a.userId)
  )

  const allUsers = usersQuery.data ?? []
  const feedbackRoles = ['stakeholder', 'research_lead', 'workshop_moderator']
  const assignableUsers = allUsers.filter(
    (u: { id: string; role: string }) => feedbackRoles.includes(u.role) && !assignedUserIds.has(u.id)
  )

  const assignedUsers = allUsers.filter(
    (u: { id: string }) => assignedUserIds.has(u.id)
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12px] font-normal uppercase tracking-wide text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          Assigned Stakeholders ({assignedUsers.length})
        </span>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <UserPlus className="mr-1 h-3.5 w-3.5" />
              Assign
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Assign Users to Section</DialogTitle>
            </DialogHeader>
            <p className="text-[14px] text-muted-foreground">
              Assigned users can submit feedback on this section.
            </p>
            <div className="mt-4 flex max-h-[320px] flex-col gap-2 overflow-y-auto">
              {assignableUsers.length === 0 ? (
                <p className="py-4 text-center text-[14px] text-muted-foreground">
                  No users available to assign. All eligible users are already assigned.
                </p>
              ) : (
                assignableUsers.map((user: { id: string; name: string | null; email: string | null; role: string }) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[14px]">
                        {user.name || user.email || 'Unnamed user'}
                      </span>
                      <span className="text-[12px] text-muted-foreground">{user.role}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={assignMutation.isPending}
                      onClick={() => assignMutation.mutate({ sectionId, userId: user.id })}
                    >
                      Assign
                    </Button>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {assignedUsers.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">
          No stakeholders assigned yet. Assign users so they can submit feedback.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {assignedUsers.map((user: { id: string; name: string | null; email: string | null }) => (
            <Badge key={user.id} variant="secondary" className="gap-1">
              {user.name || user.email || user.id.slice(0, 8)}
              <button
                onClick={() => unassignMutation.mutate({ sectionId, userId: user.id })}
                className="ml-0.5 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
