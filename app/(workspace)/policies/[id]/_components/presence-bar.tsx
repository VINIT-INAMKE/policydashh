'use client'

import type { HocuspocusProvider } from '@hocuspocus/provider'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { usePresence } from '@/src/lib/hooks/use-presence'
import { getPresenceColor, getInitials } from '@/src/lib/collaboration/presence-colors'

interface PresenceBarProps {
  provider: HocuspocusProvider | null
  currentUserId: string
}

export function PresenceBar({ provider, currentUserId }: PresenceBarProps) {
  const users = usePresence(provider)

  // Hide when only current user (or no users)
  const otherUsers = users.filter((u) => u.userId !== currentUserId)
  if (otherUsers.length === 0) return null

  // Include current user in the display list
  const allUsers = users
  const maxVisible = 5
  const visibleUsers = allUsers.slice(0, maxVisible > allUsers.length ? allUsers.length : (allUsers.length > maxVisible ? maxVisible - 1 : maxVisible))
  const overflowCount = allUsers.length > maxVisible ? allUsers.length - (maxVisible - 1) : 0
  const overflowUsers = overflowCount > 0 ? allUsers.slice(maxVisible - 1) : []

  const overflowTooltip = overflowUsers.length > 0
    ? overflowUsers.length <= 2
      ? overflowUsers.map((u) => u.name).join(', ')
      : `${overflowUsers.slice(0, 2).map((u) => u.name).join(', ')}, and ${overflowUsers.length - 2} others`
    : ''

  return (
    <TooltipProvider delay={300}>
      <div
        className="flex items-center"
        aria-label={`${allUsers.length} users viewing this section`}
      >
        {visibleUsers.map((user, index) => {
          const color = getPresenceColor(user.userId)
          const initials = getInitials(user.name)
          const isCurrentUser = user.userId === currentUserId
          const tooltipText = isCurrentUser ? `${user.name} (you)` : user.name

          return (
            <Tooltip key={user.clientId}>
              <TooltipTrigger
                render={(props) => (
                  <div
                    {...props}
                    className="flex size-7 items-center justify-center rounded-full border-2 border-background"
                    style={{
                      backgroundColor: color.bg,
                      marginLeft: index > 0 ? '-8px' : undefined,
                      zIndex: visibleUsers.length - index,
                    }}
                    aria-label={`${user.name} is viewing this section`}
                  >
                    <span
                      className="text-[10px] font-semibold leading-none"
                      style={{ color: color.text }}
                    >
                      {initials}
                    </span>
                  </div>
                )}
              />
              <TooltipContent>{tooltipText}</TooltipContent>
            </Tooltip>
          )
        })}

        {overflowCount > 0 && (
          <Tooltip>
            <TooltipTrigger
              render={(props) => (
                <div
                  {...props}
                  className="flex size-7 items-center justify-center rounded-full border-2 border-background bg-muted"
                  style={{
                    marginLeft: '-8px',
                    zIndex: 0,
                  }}
                >
                  <span className="text-[10px] font-semibold leading-none text-foreground">
                    +{overflowCount}
                  </span>
                </div>
              )}
            />
            <TooltipContent>{overflowTooltip}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}
