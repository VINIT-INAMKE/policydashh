'use client'

import { useState } from 'react'
import { FileText, Upload } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { Button } from '@/components/ui/button'
import { PolicyCard } from './_components/policy-card'
import { PolicyListSkeleton } from './_components/policy-list-skeleton'
import { CreatePolicyDialog } from './_components/create-policy-dialog'
import { ImportMarkdownDialog } from './_components/import-markdown-dialog'

export default function PoliciesPage() {
  const { data: policies, isLoading } = trpc.document.list.useQuery()
  const { data: me } = trpc.user.getMe.useQuery()
  const [importOpen, setImportOpen] = useState(false)

  const canCreate = me?.role === 'admin' || me?.role === 'policy_lead'

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Policies</h1>
        {canCreate && (
          <div className="flex items-center gap-2">
            <CreatePolicyDialog />
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" />
              Import Markdown
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <PolicyListSkeleton />
      ) : !policies || policies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <FileText className="size-12 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">No policies yet</h2>
          <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
            {canCreate
              ? 'Create your first policy document to get started, or import an existing one from a markdown file.'
              : 'No policy documents have been created yet. Check back later.'}
          </p>
          {canCreate && (
            <div className="mt-6">
              <CreatePolicyDialog />
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {policies.map((policy) => (
            <PolicyCard key={policy.id} policy={policy} canManage={canCreate} />
          ))}
        </div>
      )}

      {canCreate && <ImportMarkdownDialog open={importOpen} onOpenChange={setImportOpen} />}
    </div>
  )
}
