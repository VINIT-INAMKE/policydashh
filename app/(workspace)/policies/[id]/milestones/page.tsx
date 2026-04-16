'use client'

import { use } from 'react'
import { Button } from '@/components/ui/button'
import { MilestoneList } from './_components/milestone-list'
import { CreateMilestoneDialog } from './_components/create-milestone-dialog'

// Next.js version in this project: params is a Promise (see AGENTS.md / layout.tsx)
export default function MilestonesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  // canManage is enforced server-side by tRPC milestone:manage permission gate.
  // The create button is always rendered client-side; unauthorized roles get a
  // FORBIDDEN toast from the mutation. This avoids an extra server round-trip.
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h1 className="text-xl font-semibold">Milestones</h1>
        <CreateMilestoneDialog
          documentId={id}
          trigger={<Button variant="default">Create milestone</Button>}
        />
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <MilestoneList documentId={id} canManage />
      </div>
    </div>
  )
}
