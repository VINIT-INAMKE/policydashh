'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { can } from '@/src/lib/permissions'
import type { Role } from '@/src/lib/constants'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ResearchItemForm } from '../../_components/research-item-form'

/**
 * /research-manage/[id]/edit — Phase 27 D-01 (RESEARCH-06 SC-2).
 *
 * Dedicated full-page edit surface mirroring /research-manage/new. Differs
 * from create only in:
 *   - mode='edit' on the form
 *   - prefilled initialValues from trpc.research.getById
 *   - Cancel returns to detail page (handled by form's default cancelHref)
 *   - onSuccess navigates back to detail page
 *
 * Role gate: research:manage_own permission. Server-side ownership +
 * status-lock guard on trpc.research.update is the authorization truth;
 * the client redirect is purely UX.
 *
 * Edit-mode artifact prefill shortcut: artifactFileName / artifactFileSize
 * are NOT prefilled because trpc.research.getById returns just the
 * research_items row (no join with evidence_artifacts). The form will not
 * show an "Uploaded X" row for an existing artifact, but the user can
 * upload a fresh file to replace it (server creates a new artifact row).
 * A follow-up plan can either denormalize artifact metadata onto
 * research_items or extend getById to join. Documented in 27-03 SUMMARY.
 */

export default function EditResearchItemPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id

  const meQuery = trpc.user.getMe.useQuery()
  const itemQuery = trpc.research.getById.useQuery({ id })
  const documentsQuery = trpc.document.list.useQuery({})

  const role = meQuery.data?.role as Role | undefined
  // Use permission helper — server enforces ownership + status lock
  const allowed = role ? can(role, 'research:manage_own') : undefined

  useEffect(() => {
    if (meQuery.data && allowed === false) {
      router.replace('/research-manage')
    }
  }, [meQuery.data, allowed, router])

  if (itemQuery.isLoading || meQuery.isLoading || documentsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!allowed) return null
  if (!itemQuery.data) return null

  const item = itemQuery.data

  const documents = (documentsQuery.data ?? []).map((d) => ({
    id:    d.id,
    title: d.title,
  }))

  return (
    <div className="mx-auto max-w-2xl">
      <Button
        variant="ghost"
        size="sm"
        render={<Link href={`/research-manage/${id}`} />}
        className="mb-4"
      >
        <ArrowLeft className="size-3.5" />
        Back to Research Item
      </Button>

      <h1 className="mb-6 text-xl font-semibold">Edit Research Item</h1>

      <Card className="p-6">
        <ResearchItemForm
          mode="edit"
          initialValues={{
            id:                item.id,
            documentId:        item.documentId,
            title:             item.title,
            itemType:          item.itemType,
            description:       item.description ?? undefined,
            externalUrl:       item.externalUrl ?? undefined,
            artifactId:        item.artifactId ?? undefined,
            doi:               item.doi ?? undefined,
            authors:           item.authors ?? [],
            publishedDate:     item.publishedDate ?? null,
            peerReviewed:      item.peerReviewed,
            journalOrSource:   item.journalOrSource ?? undefined,
            isAuthorAnonymous: item.isAuthorAnonymous,
            status:            item.status,
          }}
          documents={documents}
          onSuccess={() => router.push(`/research-manage/${id}`)}
        />
      </Card>
    </div>
  )
}
