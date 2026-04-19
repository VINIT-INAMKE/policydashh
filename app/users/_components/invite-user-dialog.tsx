'use client'

import { useEffect, useState } from 'react'
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
import { AlertCircle, Loader2 } from 'lucide-react'
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

// C3: simple RFC-compliant-enough email regex for client-side validation.
// Server still re-validates via zod on the tRPC procedure.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function InviteUserDialog({ open, onOpenChange }: InviteUserDialogProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InviteRole>('stakeholder')
  const [debouncedEmail, setDebouncedEmail] = useState('')
  const utils = trpc.useUtils()

  const trimmedEmail = email.trim().toLowerCase()
  const emailValid = trimmedEmail.length > 0 && EMAIL_RE.test(trimmedEmail)
  const emailError = email.length > 0 && !emailValid
    ? 'Enter a valid email address.'
    : null

  // Debounce the existing-user check so we don't spam tRPC on each keystroke.
  useEffect(() => {
    if (!emailValid) {
      setDebouncedEmail('')
      return
    }
    const h = setTimeout(() => setDebouncedEmail(trimmedEmail), 400)
    return () => clearTimeout(h)
  }, [trimmedEmail, emailValid])

  const existsQuery = trpc.user.checkEmailExists.useQuery(
    { email: debouncedEmail },
    { enabled: debouncedEmail.length > 0, staleTime: 30_000 },
  )

  const inviteMutation = trpc.user.invite.useMutation({
    onSuccess: (data) => {
      utils.user.listUsers.invalidate()
      utils.user.listPendingInvitations.invalidate()
      toast.success(`Invitation sent to ${data.email}.`)
      setEmail('')
      setRole('stakeholder')
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to send invitation. Please try again.')
    },
  })

  const alreadyExists = existsQuery.data?.exists === true
  const canSubmit = emailValid && !alreadyExists && !inviteMutation.isPending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
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
                aria-invalid={emailError !== null || alreadyExists}
                className="mt-2"
              />
              {emailError && (
                <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="size-3" />
                  {emailError}
                </p>
              )}
              {alreadyExists && (
                <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="size-3" />
                  A user with this email already exists.
                </p>
              )}
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
            <Button type="submit" disabled={!canSubmit}>
              {inviteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
