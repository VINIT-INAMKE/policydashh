'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { MessageSquare } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

type FeedbackStatus =
  | 'submitted'
  | 'under_review'
  | 'accepted'
  | 'partially_accepted'
  | 'rejected'
  | 'closed'

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  accepted: 'Accepted',
  partially_accepted: 'Partially Accepted',
  rejected: 'Rejected',
  closed: 'Closed',
}

/**
 * All Feedback tab - cross-policy feedback list powered by
 * trpc.feedback.listCrossPolicy (added in Plan 13-01).
 *
 * The procedure is role-aware on the server:
 * - feedback:read_all callers (admin/policy_lead/auditor) see every item
 * - feedback:read_own callers see only their submissions
 *
 * Role gating for tab visibility happens at the parent GlobalFeedbackTabs level.
 * This component only handles the UI - filter bar + results list.
 */
export function AllFeedbackTab() {
  const [policyId, setPolicyId] = useState<string | undefined>(undefined)
  const [status, setStatus] = useState<FeedbackStatus | undefined>(undefined)

  const documentsQuery = trpc.document.list.useQuery()
  const feedbackQuery = trpc.feedback.listCrossPolicy.useQuery({
    policyId,
    status,
  })

  function handlePolicyChange(value: string | null) {
    setPolicyId(!value || value === '__all__' ? undefined : value)
  }

  function handleStatusChange(value: string | null) {
    setStatus(
      !value || value === '__all__' ? undefined : (value as FeedbackStatus),
    )
  }

  const rows = feedbackQuery.data ?? []

  return (
    <div className="flex flex-col gap-4 pt-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-[220px]">
          <Select
            value={policyId ?? '__all__'}
            onValueChange={handlePolicyChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="All policies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All policies</SelectItem>
              {(documentsQuery.data ?? []).map((doc) => (
                <SelectItem key={doc.id} value={doc.id}>
                  {doc.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-[180px]">
          <Select
            value={status ?? '__all__'}
            onValueChange={handleStatusChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All statuses</SelectItem>
              {(Object.keys(STATUS_LABELS) as FeedbackStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results */}
      {feedbackQuery.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border p-12 text-center">
          <MessageSquare className="size-10 text-muted-foreground" />
          <h3 className="mt-4 text-[20px] font-semibold leading-[1.2]">
            {policyId ? 'No feedback for this policy' : 'No feedback submitted yet'}
          </h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Feedback appears here once stakeholders submit responses.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-md border transition-colors hover:bg-muted/50"
            >
              <Link
                href={`/policies/${row.documentId}/feedback`}
                className="flex flex-col gap-1 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[12px] text-muted-foreground">
                    {row.readableId}
                  </span>
                  <Badge variant="outline">
                    {STATUS_LABELS[row.status as FeedbackStatus] ?? row.status}
                  </Badge>
                  <Badge variant="outline">{row.feedbackType}</Badge>
                  <span className="ml-auto text-[12px] text-muted-foreground">
                    {format(new Date(row.createdAt), 'MMM d, yyyy')}
                  </span>
                </div>
                <div className="text-sm font-medium">{row.title}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
