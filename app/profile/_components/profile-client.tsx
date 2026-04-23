'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ORG_TYPE_OPTIONS = [
  { value: 'government', label: 'Government' },
  { value: 'industry', label: 'Industry' },
  { value: 'legal', label: 'Legal' },
  { value: 'academia', label: 'Academia' },
  { value: 'civil_society', label: 'Civil Society' },
  { value: 'internal', label: 'Internal' },
] as const

const ROLE_DISPLAY: Record<string, string> = {
  admin: 'Admin',
  policy_lead: 'Policy Lead',
  research_lead: 'Research Lead',
  workshop_moderator: 'Workshop Moderator',
  stakeholder: 'Stakeholder',
  observer: 'Observer',
  auditor: 'Auditor',
}

const HOW_HEARD_OPTIONS = [
  'Social media',
  'Email / newsletter',
  'Colleague / referral',
  'Search engine',
  'News article / press',
  'Other',
]

type OrgType = (typeof ORG_TYPE_OPTIONS)[number]['value']

export function ProfileClient() {
  const utils = trpc.useUtils()
  const meQuery = trpc.user.getMe.useQuery()

  // Local draft state — seeded from server data once, then user-controlled
  // until Save. This avoids the "reset on every refetch" footgun that
  // `useQuery` + `useState` combinations sometimes cause.
  const [name, setName] = useState('')
  const [designation, setDesignation] = useState('')
  const [orgType, setOrgType] = useState<OrgType | ''>('')
  const [orgName, setOrgName] = useState('')
  const [expertise, setExpertise] = useState('')
  const [howHeard, setHowHeard] = useState('')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (!hydrated && meQuery.data) {
      setName(meQuery.data.name ?? '')
      setDesignation(meQuery.data.designation ?? '')
      setOrgType((meQuery.data.orgType ?? '') as OrgType | '')
      setOrgName(meQuery.data.orgName ?? '')
      setExpertise(meQuery.data.expertise ?? '')
      setHowHeard(meQuery.data.howHeard ?? '')
      setHydrated(true)
    }
  }, [meQuery.data, hydrated])

  const updateMutation = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      toast.success('Profile updated.')
      utils.user.getMe.invalidate()
    },
    onError: (err) => {
      toast.error(err.message || 'Could not save your profile.')
    },
  })

  if (meQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-32" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (meQuery.error || !meQuery.data) {
    return (
      <Card className="px-6 py-8 text-center text-sm text-muted-foreground">
        We couldn&apos;t load your profile. Refresh to try again.
      </Card>
    )
  }

  const me = meQuery.data

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    updateMutation.mutate({
      name: name.trim() || undefined,
      designation: designation.trim() || null,
      orgType: orgType || null,
      orgName: orgName.trim() || null,
      expertise: expertise.trim() || null,
      howHeard: howHeard || null,
    })
  }

  return (
    <div className="space-y-6">
      {/* Identity summary — the fields the user cannot change from here.
          email is Clerk-owned (change via Clerk user button); role is
          admin-controlled (see /users/[id]). */}
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-xl font-semibold">Account</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{me.email || '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Role</dt>
              <dd>
                <Badge variant="secondary">
                  {ROLE_DISPLAY[me.role] ?? me.role}
                </Badge>
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            Email is managed through your sign-in provider. Role changes
            require an admin.
          </p>
        </CardContent>
      </Card>

      {/* Editable profile — the Option C enrichment fields plus display name
          and orgType. All fields are optional; backend treats empty strings
          as null so the stakeholder directory filters hide incomplete rows. */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="text-xl font-semibold">About You</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-name">Display name</Label>
              <Input
                id="profile-name"
                placeholder="e.g. Priya Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-designation">Title / Designation</Label>
              <Input
                id="profile-designation"
                placeholder="e.g. Partner, Fintech Practice"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                maxLength={200}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-orgType">Organization type</Label>
              <Select
                value={orgType || null}
                onValueChange={(v) => setOrgType((v ?? '') as OrgType | '')}
              >
                <SelectTrigger id="profile-orgType">
                  <SelectValue placeholder="Select organization type" />
                </SelectTrigger>
                <SelectContent>
                  {ORG_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-orgName">Organization name</Label>
              <Input
                id="profile-orgName"
                placeholder="e.g. Ministry of Electronics and IT"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                maxLength={200}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-expertise">Area of expertise</Label>
              <Textarea
                id="profile-expertise"
                placeholder="Describe your background, research focus, or policy areas you work in…"
                value={expertise}
                onChange={(e) => setExpertise(e.target.value)}
                rows={5}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground">
                {expertise.length} / 1000 characters
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-howHeard">
                How did you hear about this consultation?{' '}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Select
                value={howHeard || null}
                onValueChange={(v) => setHowHeard(v ?? '')}
              >
                <SelectTrigger id="profile-howHeard">
                  <SelectValue placeholder="Select one (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {HOW_HEARD_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 flex justify-end">
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Save changes
          </Button>
        </div>
      </form>
    </div>
  )
}
