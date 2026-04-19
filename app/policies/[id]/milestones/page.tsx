'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { trpc } from '@/src/trpc/client'
import { MilestoneList } from './_components/milestone-list'
import { CreateMilestoneDialog } from './_components/create-milestone-dialog'

// Next.js version in this project: params is a Promise (see AGENTS.md / layout.tsx)
export default function MilestonesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  // D12: gate the Create button on the session role. The tRPC mutation also
  // enforces `milestone:manage`, so this is a UX guard — unauthorized users
  // never see the button.
  const meQuery = trpc.user.getMe.useQuery()
  const role = meQuery.data?.role
  const canManage = role === 'admin' || role === 'policy_lead'

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b border-border px-6 py-4">
        {/* D16: breadcrumb back link. */}
        <Link
          href={`/policies/${id}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" aria-hidden="true" />
          Back to policy
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Milestones</h1>
          {canManage ? (
            <CreateMilestoneDialog
              documentId={id}
              trigger={<Button variant="default">Create milestone</Button>}
            />
          ) : null}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <MilestoneList documentId={id} canManage={canManage} />
      </div>
    </div>
  )
}
