'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export default function CreateWorkshopPage() {
  const router = useRouter()
  const meQuery = trpc.user.getMe.useQuery()
  const role = meQuery.data?.role
  const canManageWorkshops = role === 'admin' || role === 'workshop_moderator'

  // Role gate: redirect unauthorized users
  useEffect(() => {
    if (meQuery.data && !canManageWorkshops) {
      router.replace('/workshops')
    }
  }, [meQuery.data, canManageWorkshops, router])

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [registrationLink, setRegistrationLink] = useState('')

  const createMutation = trpc.workshop.create.useMutation({
    onSuccess: (workshop) => {
      toast.success('Workshop created.')
      router.push(`/workshops/${workshop.id}`)
    },
    onError: () => {
      toast.error("Couldn't create the workshop. Check your connection and try again.")
    },
  })

  const canSubmit = title.trim().length > 0 && scheduledAt.length > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    const isoDate = new Date(scheduledAt).toISOString()
    const dur = durationMinutes ? parseInt(durationMinutes, 10) : undefined
    const regLink = registrationLink.trim() || undefined

    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      scheduledAt: isoDate,
      durationMinutes: dur && dur > 0 ? dur : undefined,
      registrationLink: regLink,
    })
  }

  return (
    <div className="mx-auto max-w-[640px]">
      <Button variant="ghost" size="sm" render={<Link href="/workshops" />} className="mb-4">
        <ArrowLeft className="size-3.5" />
        Back to Workshops
      </Button>

      <h1 className="mb-6 text-xl font-semibold">Create Workshop</h1>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader className="border-b">
            <span className="text-sm font-medium text-muted-foreground">Workshop Details</span>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="workshop-title">Title</Label>
              <Input
                id="workshop-title"
                placeholder="e.g., Stakeholder Consultation Session 1"
                required
                autoFocus
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="workshop-description">Description</Label>
              <Textarea
                id="workshop-description"
                placeholder="Brief overview of the workshop's agenda and objectives"
                rows={4}
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="workshop-datetime">Date &amp; Time</Label>
              <input
                id="workshop-datetime"
                type="datetime-local"
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="workshop-duration">Duration (minutes)</Label>
              <Input
                id="workshop-duration"
                type="number"
                min="1"
                placeholder="e.g., 90"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="workshop-reglink">Registration Link</Label>
              <Input
                id="workshop-reglink"
                type="url"
                placeholder="https://..."
                value={registrationLink}
                onChange={(e) => setRegistrationLink(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <div className="flex w-full items-center justify-end gap-2">
              <Button variant="outline" render={<Link href="/workshops" />}>
                Discard
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit || createMutation.isPending}
              >
                {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Create Workshop
              </Button>
            </div>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
