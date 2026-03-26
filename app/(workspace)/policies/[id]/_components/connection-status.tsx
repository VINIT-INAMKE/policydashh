'use client'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type ConnectionStatusValue = 'connected' | 'connecting' | 'disconnected'

interface ConnectionStatusProps {
  status: ConnectionStatusValue
}

const STATUS_CONFIG = {
  connected: {
    dotColor: '#16A34A',
    pulse: false,
    text: null as string | null,
    ariaLabel: 'Connected to collaboration server',
    tooltip: 'Real-time collaboration active',
  },
  connecting: {
    dotColor: '#D97706',
    pulse: true,
    text: 'Reconnecting\u2026',
    ariaLabel: 'Reconnecting to collaboration server',
    tooltip: null as string | null,
  },
  disconnected: {
    dotColor: '#DC2626',
    pulse: false,
    text: 'Offline',
    ariaLabel: 'Disconnected from collaboration server',
    tooltip: null as string | null,
  },
} as const

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const config = STATUS_CONFIG[status]

  return (
    <TooltipProvider>
      <div
        className="flex h-6 items-center gap-1"
        role="status"
        aria-live="polite"
        aria-label={config.ariaLabel}
      >
        {config.tooltip ? (
          <Tooltip>
            <TooltipTrigger
              render={(props) => (
                <span
                  {...props}
                  className={`inline-block size-2 rounded-full${config.pulse ? ' animate-pulse' : ''}`}
                  style={{ backgroundColor: config.dotColor }}
                />
              )}
            />
            <TooltipContent>{config.tooltip}</TooltipContent>
          </Tooltip>
        ) : (
          <span
            className={`inline-block size-2 rounded-full${config.pulse ? ' animate-pulse' : ''}`}
            style={{ backgroundColor: config.dotColor }}
          />
        )}

        {/* Text: hidden on lg+ when connected (dot only), always shown for reconnecting/offline */}
        {config.text && (
          <span className="text-xs font-normal text-muted-foreground">
            {config.text}
          </span>
        )}
      </div>
    </TooltipProvider>
  )
}
