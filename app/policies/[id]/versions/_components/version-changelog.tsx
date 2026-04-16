'use client'

interface ChangelogEntry {
  crId: string | null
  crReadableId: string | null
  crTitle: string
  summary: string
  feedbackIds: string[]
  affectedSectionIds: string[]
}

interface VersionChangelogProps {
  changelog: ChangelogEntry[] | null
}

export function VersionChangelog({ changelog }: VersionChangelogProps) {
  if (!changelog || changelog.length === 0) {
    return (
      <div>
        <h3 className="text-[12px] font-normal uppercase tracking-wide text-muted-foreground">
          CHANGELOG
        </h3>
        <p className="mt-2 text-[14px] text-muted-foreground">No changelog entries.</p>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-[12px] font-normal uppercase tracking-wide text-muted-foreground">
        CHANGELOG
      </h3>
      <ul className="mt-2 space-y-3">
        {changelog.map((entry, idx) => (
          <li key={idx} className="flex gap-2">
            <span className="mt-2 block h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
            <div className="min-w-0">
              {entry.crReadableId && (
                <span className="mr-2 inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">
                  {entry.crReadableId}
                </span>
              )}
              <span className="text-[14px] font-normal leading-[1.5]">
                {entry.crTitle}
                {entry.summary !== entry.crTitle && ` \u2014 ${entry.summary}`}
              </span>
              {entry.feedbackIds.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {entry.feedbackIds.map((fbId) => (
                    <span
                      key={fbId}
                      className="inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]"
                    >
                      {fbId}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
