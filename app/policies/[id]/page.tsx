'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { trpc } from '@/src/trpc/client'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Pencil } from 'lucide-react'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { SectionSidebar } from './_components/section-sidebar'
import { SectionContentView } from './_components/section-content-view'
import { PublicDraftToggle } from './_components/public-draft-toggle'
import { EditPolicyDialog } from '../_components/edit-policy-dialog'

export default function PolicyDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const documentQuery = trpc.document.getById.useQuery({ id })
  const sectionsQuery = trpc.document.getSections.useQuery({ documentId: id })
  const { data: me } = trpc.user.getMe.useQuery()

  const role = me?.role
  const canEdit = role === 'admin' || role === 'policy_lead'

  const selectedSection = sectionsQuery.data?.find((s) => s.id === selectedSectionId) ?? null

  if (documentQuery.isLoading || sectionsQuery.isLoading) {
    return (
      <div className="flex h-full">
        {/* Sidebar skeleton */}
        <div className="w-[280px] shrink-0 border-r bg-muted p-4">
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
        {/* Content skeleton */}
        <div className="flex-1 p-8">
          <div className="mx-auto max-w-[768px]">
            <Skeleton className="mb-4 h-7 w-1/2" />
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (documentQuery.error || !documentQuery.data) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Document not found.</p>
      </div>
    )
  }

  const document = documentQuery.data

  return (
    <div className="flex h-full">
      {/* Section sidebar */}
      <div className="hidden w-[280px] shrink-0 border-r bg-muted lg:block">
        <SectionSidebar
          sections={sectionsQuery.data ?? []}
          documentId={id}
          selectedSectionId={selectedSectionId}
          onSelectSection={setSelectedSectionId}
          canManageSections={canEdit}
        />
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[768px] p-6 lg:p-8">
          {/* Top bar */}
          <div className="mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[28px] font-semibold leading-[1.2]">{document.title}</h1>
                {document.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{document.description}</p>
                )}
              </div>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="mr-1 h-4 w-4" />
                  Edit
                </Button>
              )}
            </div>
            {canEdit && (
              <div className="mt-4">
                <PublicDraftToggle
                  documentId={id}
                  isPublicDraft={document.isPublicDraft ?? false}
                />
              </div>
            )}
          </div>

          {/* Mobile section selector (visible below lg breakpoint) */}
          {(sectionsQuery.data ?? []).length > 0 && (
            <div className="mb-4 lg:hidden">
              <Select
                value={selectedSectionId ?? ''}
                onValueChange={(val) => setSelectedSectionId(val || null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a section..." />
                </SelectTrigger>
                <SelectContent>
                  {(sectionsQuery.data ?? []).map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Section content or empty prompt */}
          {selectedSection ? (
            <SectionContentView
              section={selectedSection}
              canEdit={canEdit}
              documentId={id}
            />
          ) : (
            <div className="flex items-center justify-center py-24">
              <p className="text-sm text-muted-foreground">
                Select a section from the sidebar to view its content.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Edit dialog */}
      {canEdit && (
        <EditPolicyDialog
          policy={{
            id: document.id,
            title: document.title,
            description: document.description,
          }}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </div>
  )
}
