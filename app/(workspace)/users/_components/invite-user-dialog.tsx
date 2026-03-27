'use client'

import { useState } from 'react'
import { trpc } from '@/src/trpc/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'policy_lead', label: 'Policy Lead' },
  { value: 'research_lead', label: 'Research Lead' },
  { value: 'workshop_moderator', label: 'Workshop Moderator' },
  { value: 'stakeholder', label: 'Stakeholder' },
  { value: 'observer', label: 'Observer' },
  { value: 'auditor', label: 'Auditor' },
] as const

type InviteRole = (typeof ROLE_OPTIONS)[number]['value']

interface InviteUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteUserDialog({ open, onOpenChange }: InviteUserDialogProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InviteRole>('stakeholder')
  const utils = trpc.useUtils()

  const inviteMutation = trpc.user.invite.useMutation({
    onSuccess: (data) => {
      utils.user.listUsers.invalidate()
      toast.success(`Invitation sent to ${data.email}.`)
      setEmail('')
      setRole('stakeholder')
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to send invitation. Please try again.')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail) return
    inviteMutation.mutate({ email: trimmedEmail, role })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>
            Send an email invitation with a pre-assigned role.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="invite-role">Role</Label>
              <Select value={role} onValueChange={(val) => setRole(val as InviteRole)}>
                <SelectTrigger className="mt-2 w-full">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!email.trim() || inviteMutation.isPending}>
              {inviteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
