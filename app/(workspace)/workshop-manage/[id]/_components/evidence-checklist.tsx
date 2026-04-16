'use client'

import { trpc } from '@/src/trpc/client'

const SLOT_LABELS: Record<string, string> = {
  registration_export: 'Registration export',
  screenshot:          'Screenshot',
  recording:           'Recording',
  attendance:          'Attendance list',
  summary:             'Summary document',
}

export function EvidenceChecklist(props: { workshopId: string }) {
  const query = trpc.workshop.listChecklist.useQuery({ workshopId: props.workshopId })

  if (query.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading checklist…</div>
  }
  if (query.isError) {
    return <div className="text-sm text-red-600">Failed to load checklist</div>
  }

  const rows = query.data ?? []
  if (rows.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Evidence Checklist</h3>
        <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
          No checklist yet. The checklist is created when the workshop is marked completed.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Evidence Checklist</h3>
      <div className="divide-y rounded-md border">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex items-center justify-between px-3 py-2 text-sm"
          >
            <span>{SLOT_LABELS[row.slot] ?? row.slot}</span>
            <span
              className={
                row.status === 'filled' ? 'text-green-700' : 'text-amber-700'
              }
            >
              {row.status === 'filled' ? '✓ filled' : '○ pending'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
