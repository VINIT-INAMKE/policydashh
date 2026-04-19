'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { can } from '@/src/lib/permissions'
import type { Role } from '@/src/lib/constants'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ResearchItemForm } from '../_components/research-item-form'

/**
 * /research-manage/new — Phase 27 D-01 (RESEARCH-06 SC-2).
 *
 * Dedicated full-page create surface (not a dialog). Mirrors
 * /workshop-manage/new exactly: role-gated client component, fetches
 * the user role + documents list, then mounts ResearchItemForm in
 * mode='create'. On successful save the form invokes onSuccess(id),
 * we router.push to the new detail page (Plan 27-04 surface).
 *
 * Role gate: research:create permission (admin / policy_lead / research_lead).
 * Server enforcement still applies via requirePermission on
 * trpc.research.create — this client redirect is only a UX shortcut.
 */

export default function NewResearchItemPage() {
  const router = useRouter()
  const meQuery = trpc.user.getMe.useQuery()
  const documentsQuery = trpc.document.list.useQuery({})

  const role = meQuery.data?.role as Role | undefined
  const allowed = role ? can(role, 'research:create') : undefined

  // Role redirect: if the user has no create permission, bounce to list.
  useEffect(() => {
    if (meQuery.data && allowed === false) {
      router.replace('/research-manage')
    }
  }, [meQuery.data, allowed, router])

  if (meQuery.isLoading || documentsQuery.isLoading) {
    return null // keep loading blank; parent layout shows nav skeleton
  }

  if (!allowed) return null

  // documentsQuery.data shape includes id+title+...; the form only reads
  // id+title, so the structural subset is fine.
  const documents = (documentsQuery.data ?? []).map((d) => ({
    id:    d.id,
    title: d.title,
  }))

  return (
    <div className="mx-auto max-w-2xl">
      <Button
        variant="ghost"
        size="sm"
        render={<Link href="/research-manage" />}
        className="mb-4"
      >
        <ArrowLeft className="size-3.5" />
        Back to Research Items
      </Button>

      <h1 className="mb-6 text-xl font-semibold">New Research Item</h1>

      <Card className="p-6">
        <ResearchItemForm
          mode="create"
          documents={documents}
          onSuccess={(id) => router.push(`/research-manage/${id}`)}
        />
      </Card>
    </div>
  )
}
