'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { AlertCircle, MessageSquare } from 'lucide-react'
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
import { Button } from '@/components/ui/button'

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
// R24: URL-sync keys for the AllFeedbackTab filters. The parent
// GlobalFeedbackTabs already owns `?tab=`, so we namespace the per-tab
// filter keys (`policyId`, `status`) at the page level and only touch
// them here. Status values that aren't in the enum are dropped silently
// -- the server-side Zod enum would reject a bad value anyway.
const ALL_FEEDBACK_URL_KEYS = {
  policyId: 'policyId',
  status:   'status',
} as const

const STATUS_SET = new Set<FeedbackStatus>([
  'submitted', 'under_review', 'accepted', 'partially_accepted', 'rejected', 'closed',
])

export function AllFeedbackTab() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // R24: seed initial state from the URL so refresh / share preserve the
  // filter. Invalid status values default to undefined.
  const urlPolicyId = searchParams.get(ALL_FEEDBACK_URL_KEYS.policyId) || undefined
  const urlStatusRaw = searchParams.get(ALL_FEEDBACK_URL_KEYS.status) || undefined
  const urlStatus = urlStatusRaw && STATUS_SET.has(urlStatusRaw as FeedbackStatus)
    ? (urlStatusRaw as FeedbackStatus)
    : undefined

  const [policyId, setPolicyIdState] = useState<string | undefined>(urlPolicyId)
  const [status, setStatusState] = useState<FeedbackStatus | undefined>(urlStatus)

  const documentsQuery = trpc.document.list.useQuery()
  const feedbackQuery = trpc.feedback.listCrossPolicy.useQuery({
    policyId,
    status,
  })

  // R24: write filter changes back to the URL via router.replace so the
  // current view is bookmarkable / shareable. The `?tab=` param is
  // preserved untouched.
  const writeUrl = useCallback((nextPolicyId?: string, nextStatus?: FeedbackStatus) => {
    const params = new URLSearchParams(searchParams.toString())
    if (nextPolicyId) params.set(ALL_FEEDBACK_URL_KEYS.policyId, nextPolicyId); else params.delete(ALL_FEEDBACK_URL_KEYS.policyId)
    if (nextStatus)   params.set(ALL_FEEDBACK_URL_KEYS.status, nextStatus);   else params.delete(ALL_FEEDBACK_URL_KEYS.status)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [router, pathname, searchParams])

  function handlePolicyChange(value: string | null) {
    const next = !value || value === '__all__' ? undefined : value
    setPolicyIdState(next)
    writeUrl(next, status)
  }

  function handleStatusChange(value: string | null) {
    const next = !value || value === '__all__' ? undefined : (value as FeedbackStatus)
    setStatusState(next)
    writeUrl(policyId, next)
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
      ) : feedbackQuery.isError ? (
        // S10: surface a real error instead of the generic empty-state.
        <div
          role="alert"
          className="flex flex-col items-center justify-center rounded-md border p-12 text-center"
        >
          <AlertCircle className="size-10 text-destructive" />
          <h3 className="mt-4 text-[20px] font-semibold leading-[1.2]">
            Couldn&apos;t load feedback
          </h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Something went wrong fetching cross-policy feedback. Check your
            connection and try again.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => feedbackQuery.refetch()}
          >
            Retry
          </Button>
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
                href={`/policies/${row.documentId}/feedback?selected=${row.id}`}
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
