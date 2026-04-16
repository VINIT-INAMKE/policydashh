import { BookOpen } from 'lucide-react'
import { format } from 'date-fns'
import { Separator } from '@/components/ui/separator'

interface WhatChangedLogProps {
  entries: Array<{
    sectionTitle: string
    mergeDate: string
    summary: string
  }>
}

export function WhatChangedLog({ entries }: WhatChangedLogProps) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <BookOpen className="size-12 text-muted-foreground" />
        <h3 className="text-lg font-semibold">No changes merged yet.</h3>
        <p className="text-sm text-muted-foreground">
          Updates will appear here as the framework evolves.
        </p>
      </div>
    )
  }

  return (
    <div>
      {entries.map((entry, index) => (
        <div key={`${entry.mergeDate}-${index}`}>
          <div className="space-y-1 py-4">
            <div className="flex items-center gap-2">
              <time
                dateTime={entry.mergeDate}
                className="text-xs text-muted-foreground font-semibold"
              >
                {format(new Date(entry.mergeDate), 'MMM d, yyyy')}
              </time>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{entry.sectionTitle}</span>
            </div>
            <p className="text-sm text-foreground">{entry.summary}</p>
          </div>
          {index < entries.length - 1 && <Separator />}
        </div>
      ))}
    </div>
  )
}
