'use client'

/**
 * F18: Attendee list tab for the workshop manage detail page.
 *
 * Surfaces the `workshop.listRegistrations` router procedure output with a
 * simple table showing email, name, booking status, registration time, and
 * attendance source (cal.com MEETING_ENDED vs manual). Moderators can
 * confirm who's coming + who actually showed up without going through the
 * cal.com dashboard.
 */

import { format, parseISO } from 'date-fns'
import { trpc } from '@/src/trpc/client'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'

interface AttendeeListProps {
  workshopId: string
}

const STATUS_VARIANT: Record<string, string> = {
  registered:  'bg-blue-100 text-blue-800',
  rescheduled: 'bg-amber-100 text-amber-800',
  cancelled:   'bg-slate-100 text-slate-600 line-through',
}

function formatWhen(input: string | Date): string {
  const iso = typeof input === 'string' ? input : input.toISOString()
  return format(parseISO(iso), 'MMM d, yyyy \u00b7 h:mm a')
}

export function AttendeeList({ workshopId }: AttendeeListProps) {
  const query = trpc.workshop.listRegistrations.useQuery({ workshopId })

  if (query.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  const rows = query.data ?? []
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Users className="size-10 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 text-sm text-muted-foreground">No registrations yet</p>
        <p className="mt-1 max-w-md text-xs text-muted-foreground">
          Attendees will appear here once they register through the public workshop
          listing or book via cal.com.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Registered</th>
            <th className="px-3 py-2 font-medium">Attended</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t hover:bg-muted/30">
              <td className="px-3 py-2 font-mono text-xs">{r.email}</td>
              <td className="px-3 py-2 text-sm">{r.name ?? <span className="text-muted-foreground">&mdash;</span>}</td>
              <td className="px-3 py-2">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_VARIANT[r.status] ?? 'bg-slate-100 text-slate-800'}`}
                >
                  {r.status}
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {formatWhen(r.registeredAt)}
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {r.attendedAt ? (
                  <div className="flex flex-col gap-0.5">
                    <span>{formatWhen(r.attendedAt)}</span>
                    {r.attendanceSource ? (
                      <Badge variant="outline" className="w-fit text-[10px]">
                        {r.attendanceSource === 'cal_meeting_ended' ? 'cal.com' : r.attendanceSource}
                      </Badge>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-muted-foreground">&mdash;</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
